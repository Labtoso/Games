// Builds the website pool for "What does it sell?".
// node build.mjs --old <dir of current pool> --out <dir> --target 3300
// Reads lists/top-1m.csv (Tranco), lists/block.txt and lists/urlhaus.txt (hosts files), removal-list.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { CATEGORIES, BLOCK_WORDS, JUNK_WORDS, PERSONAL_WORDS, INFRA_WORDS } from './taxonomy.mjs';
import { classify, hasWord } from './classify.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const OLD = args.old && fs.existsSync(path.join(args.old, 'meta.json')) ? args.old : null;
const OUT = args.out || 'out';
const TARGET = Number(args.target || 3300);
const SHARDS = 32;
const CHURN = 0.15; // share of old entries replaced per run
const CONCURRENCY = Number(args.concurrency || 10);
const MAX_MINUTES = Number(args.minutes || 300);
const LISTS = args.lists || 'lists';
const LOCAL = args.local || ''; // test mode: load <local><domain>.html instead of the real site
const started = Date.now();

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const enc = (s) => Buffer.from([...Buffer.from(s, 'utf8')].map((b) => b ^ 0x5a)).toString('base64');
const dec = (s) => Buffer.from([...Buffer.from(s, 'base64')].map((b) => b ^ 0x5a)).toString('utf8');
const shardOf = (id) => parseInt(id.slice(0, 4), 16) % SHARDS;

// ---------- lists ----------
function readHosts(file) {
  const set = new Set();
  if (!fs.existsSync(file)) return set;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.trim().match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([^\s#]+)/);
    if (m) set.add(m[1].toLowerCase().replace(/^www\./, ''));
  }
  return set;
}
const blocked = new Set([...readHosts(path.join(LISTS, 'block.txt')), ...readHosts(path.join(LISTS, 'urlhaus.txt'))]);
const removal = JSON.parse(fs.readFileSync('removal-list.json', 'utf8'));
const removed = new Set((removal.domains || []).map((d) => d.toLowerCase().replace(/^www\./, '')));
const removedIds = new Set(removal.ids || []);
log('blocklist', blocked.size, 'removal', removed.size + removedIds.size);

const isBlockedDomain = (d) => {
  const parts = d.split('.');
  for (let i = 0; i < parts.length - 1; i++) if (blocked.has(parts.slice(i).join('.'))) return true;
  return removed.has(d);
};

function rankBucket(rank) { return rank <= 2000 ? 0 : rank <= 20000 ? 1 : rank <= 200000 ? 2 : 3; }

function loadTranco() {
  const file = ['top-1m.csv', 'tranco.csv'].map((f) => path.join(LISTS, f)).find((f) => fs.existsSync(f));
  if (!file) throw new Error('Tranco list missing');
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const [r, d] = line.trim().split(',');
    if (d) out.push({ rank: Number(r), domain: d.toLowerCase() });
  }
  return out;
}

function plausibleDomain(d) {
  if (isBlockedDomain(d)) return false;
  const labels = d.split('.');
  if (labels.length > 3) return false;
  const tld = labels[labels.length - 1];
  if (['gov', 'mil', 'int', 'arpa', 'local'].includes(tld)) return false;
  if (labels.some((l) => l.split('-').some((t) => INFRA_WORDS.includes(t)))) return false;
  if (BLOCK_WORDS.some((w) => !w.includes(' ') && d.includes(w))) return false;
  if (/\d{3,}/.test(labels[0]) || labels[0].length < 3) return false;
  return true;
}

// Spread picks over all rank ranges, so the pool is not only famous sites.
function sampleCandidates(list, n, taken) {
  const buckets = [[], [], [], []];
  const seenBrand = new Set();
  for (const e of list) {
    if (taken.has(e.domain) || !plausibleDomain(e.domain)) continue;
    const brand = e.domain.split('.').slice(-2)[0];
    if (seenBrand.has(brand)) continue;
    seenBrand.add(brand);
    buckets[rankBucket(e.rank)].push(e);
  }
  const weights = [0.12, 0.28, 0.35, 0.25];
  const out = [];
  buckets.forEach((b, i) => {
    for (let k = b.length - 1; k > 0; k--) { const j = crypto.randomInt(k + 1); [b[k], b[j]] = [b[j], b[k]]; }
    out.push(...b.slice(0, Math.round(n * weights[i])));
  });
  for (let k = out.length - 1; k > 0; k--) { const j = crypto.randomInt(k + 1); [out[k], out[j]] = [out[j], out[k]]; }
  return out;
}

// ---------- page capture ----------
const CONSENT_TEXT = /^(reject all|reject|decline|decline all|deny|deny all|only necessary|necessary only|use necessary cookies only|refuse|continue without accepting|accept all|accept|accept cookies|allow all|agree|i agree|got it|ok|okay|close)$/i;
const HIDE_CSS = `
  #onetrust-banner-sdk, #onetrust-consent-sdk, #CybotCookiebotDialog, #cookiebanner, #cookie-banner, #cookie-notice, #cookieConsent,
  .cc-window, .cookie-banner, .cookie-consent, .cookie-notice, .cookies-banner, .consent-banner, .qc-cmp2-container, #usercentrics-root,
  [id*="cookie" i][class*="banner" i], [class*="cookie-consent" i], [aria-label*="cookie" i][role="dialog"], #didomi-host, .fc-consent-root, #sp_message_container_ {
    display: none !important; }
  html, body { overflow: auto !important; }`;

async function dismissOverlays(page) {
  for (const frame of page.frames().slice(0, 6)) {
    try {
      const buttons = await frame.$$('button, [role="button"], a.button, input[type="button"]');
      for (const b of buttons.slice(0, 80)) {
        const txt = ((await b.innerText().catch(() => '')) || (await b.getAttribute('value').catch(() => '')) || '').trim();
        if (txt && txt.length < 40 && CONSENT_TEXT.test(txt) && (await b.isVisible().catch(() => false))) { await b.click({ timeout: 1200 }).catch(() => {}); break; }
      }
    } catch (e) { /* frame went away */ }
  }
  await page.addStyleTag({ content: HIDE_CSS }).catch(() => {});
  // remove leftover fixed layers that cover a large part of the screen
  await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height > vw * vh * 0.25 && (Number(cs.zIndex) > 10 || cs.position === 'fixed') && r.top > -5 && !(r.top < 5 && r.height < 140)) el.remove();
    }
    document.documentElement.style.overflow = 'auto'; document.body.style.overflow = 'auto';
  }).catch(() => {});
}

async function capture(ctx, domain) {
  const page = await ctx.newPage();
  try {
    const res = await page.goto(LOCAL ? LOCAL + domain + '.html' : 'https://' + domain, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!res || res.status() >= 400) return { fail: 'status ' + (res ? res.status() : 'none') };
    await page.waitForTimeout(2600);
    await dismissOverlays(page);
    await page.waitForTimeout(500);
    const meta = await page.evaluate(() => {
      const m = (sel) => (document.querySelector(sel) || {}).content || '';
      const text = (document.body && document.body.innerText) || '';
      return {
        title: document.title || '', desc: m('meta[name="description" i]'), ogTitle: m('meta[property="og:title"]'), ogDesc: m('meta[property="og:description"]'),
        site: m('meta[property="og:site_name"]'), keywords: m('meta[name="keywords" i]'), lang: document.documentElement.lang || '',
        textLen: text.replace(/\s+/g, ' ').trim().length, password: !!document.querySelector('input[type="password"]'), host: location.hostname,
      };
    });
    const png = await page.screenshot({ type: 'png' });
    return { meta, png };
  } catch (e) {
    return { fail: String(e.message || e).slice(0, 80) };
  } finally {
    await page.close().catch(() => {});
  }
}

async function judge(domain, cap) {
  const { meta } = cap;
  const all = [meta.title, meta.desc, meta.ogTitle, meta.ogDesc, meta.site, meta.keywords].join(' ').toLowerCase();
  if (meta.lang && !/^en/i.test(meta.lang)) return 'not english';
  if (!meta.desc && !meta.ogDesc) return 'no description';
  if (meta.textLen < 250) return 'almost empty';
  if (meta.password && meta.textLen < 900) return 'login page';
  const host = LOCAL ? domain : meta.host.toLowerCase().replace(/^www\./, '');
  if (isBlockedDomain(host)) return 'blocked redirect';
  if (BLOCK_WORDS.some((w) => hasWord(all, w))) return 'blocked word';
  if (JUNK_WORDS.some((w) => all.includes(w))) return 'junk';
  if (PERSONAL_WORDS.some((w) => all.includes(w))) return 'personal';
  const img = sharp(cap.png);
  const stats = await img.stats();
  const sd = stats.channels.slice(0, 3).reduce((a, c) => a + c.stdev, 0) / 3;
  if (sd < 14) return 'blank screenshot';
  return null;
}

// ---------- main ----------
async function main() {
  fs.mkdirSync(path.join(OUT, 's'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'i'), { recursive: true });
  // keep old entries, minus churn and removals
  let keep = [];
  if (OLD) {
    for (let i = 0; i < SHARDS; i++) {
      const f = path.join(OLD, 'i', i + '.json');
      if (fs.existsSync(f)) keep.push(...JSON.parse(fs.readFileSync(f, 'utf8')));
    }
    keep = keep.filter((e) => !removedIds.has(e.id) && !isBlockedDomain(dec(e.d)) && CATEGORIES.some((c) => c.id === e.c));
    keep.sort((a, b) => a.a - b.a);
    const drop = Math.floor(keep.length * CHURN);
    keep = keep.slice(drop);
    for (const e of keep) fs.copyFileSync(path.join(OLD, 's', e.id + '.webp'), path.join(OUT, 's', e.id + '.webp'));
    log('kept', keep.length, 'dropped', drop);
  }
  const taken = new Set(keep.map((e) => dec(e.d)));
  const need = Math.max(0, TARGET - keep.length);
  const tranco = loadTranco();
  const candidates = sampleCandidates(tranco, Math.ceil(need * 7) + 50, taken);
  log('need', need, 'candidates', candidates.length);

  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US', timezoneId: 'America/New_York', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', javaScriptEnabled: true });
  await ctx.route('**/*', (route) => (['media', 'websocket'].includes(route.request().resourceType()) ? route.abort() : route.continue()));
  const fresh = [];
  const reasons = {};
  const now = Math.floor(Date.now() / 1000);
  let next = 0;
  async function worker() {
    while (fresh.length < need && next < candidates.length && (Date.now() - started) / 60000 < MAX_MINUTES) {
      const c = candidates[next++];
      const cap = await capture(ctx, c.domain);
      let why = cap.fail ? 'load' : await judge(c.domain, cap);
      let cat = null;
      if (!why) { cat = classify(cap.meta); if (!cat) why = 'unclear'; }
      if (why) { reasons[why] = (reasons[why] || 0) + 1; continue; }
      const id = crypto.randomBytes(5).toString('hex');
      await sharp(cap.png).resize(1024, 640).webp({ quality: 56, effort: 5 }).toFile(path.join(OUT, 's', id + '.webp'));
      const title = (cap.meta.ogTitle || cap.meta.title || '').trim().slice(0, 90);
      fresh.push({ id, c: cat.id, r: rankBucket(c.rank), d: enc(c.domain), t: enc(title), a: now });
      if (fresh.length % 50 === 0) log('new', fresh.length, '/', need, 'tried', next, JSON.stringify(reasons));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();
  log('new total', fresh.length, 'tried', next, JSON.stringify(reasons));

  const all = [...keep, ...fresh];
  const shards = Array.from({ length: SHARDS }, () => []);
  for (const e of all) shards[shardOf(e.id)].push(e);
  shards.forEach((s, i) => fs.writeFileSync(path.join(OUT, 'i', i + '.json'), JSON.stringify(s)));
  const cats = CATEGORIES.map(({ id, group, answer, syn, kw }) => ({ id, group, answer, syn: [...new Set([...(syn || []), ...kw.filter((k) => !k.includes(' ')).slice(0, 4)])] }));
  fs.writeFileSync(path.join(OUT, 'categories.json'), JSON.stringify(cats));
  const byCat = {};
  for (const e of all) byCat[e.c] = (byCat[e.c] || 0) + 1;
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ v: 1, updated: new Date().toISOString(), count: all.length, shards: SHARDS, sizes: shards.map((s) => s.length), removed: [...removedIds], byCat }));
  fs.writeFileSync(path.join(OUT, 'README.md'), 'Data for the guessing game on games.labtoso.de. Built by tools/guess-pipeline on the main branch. Do not edit by hand.\n');
  let bytes = 0; for (const f of fs.readdirSync(path.join(OUT, 's'))) bytes += fs.statSync(path.join(OUT, 's', f)).size;
  log('pool', all.length, 'entries,', (bytes / 1048576).toFixed(1), 'MB of screenshots');
}

main().catch((e) => { console.error(e); process.exit(1); });
