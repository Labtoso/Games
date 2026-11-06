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
const CONCURRENCY = Number(args.concurrency || 14);
// parallel runs: --part i --parts n collects a share of new sites into <out>/fresh.json,
// --merge dirA,dirB,... joins those shares with the old pool into the published format
const PART = args.part != null ? Number(args.part) : null;
const PARTS = Number(args.parts || 1);
const MERGE = args.merge ? args.merge.split(',').filter(Boolean) : null;
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

// a page can hang in evaluate() or screenshot() (endless scripts, dialogs), and a worn-out browser can hang in
// newPage(), so the whole capture gets a hard limit
const CAPTURE_MS = 45000;
async function capture(ctx, domain) {
  let page = null, timer;
  const limit = new Promise((resolve) => { timer = setTimeout(() => resolve({ fail: 'timeout' }), CAPTURE_MS); });
  const work = (async () => {
    page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    return grab(page, domain);
  })().catch((e) => ({ fail: String(e.message || e).slice(0, 80) }));
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
    if (page) await Promise.race([page.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
    else work.then(() => page && page.close().catch(() => {}));
  }
}

async function grab(page, domain) {
  try {
    const go = (u) => page.goto(u, { waitUntil: 'domcontentloaded', timeout: 20000 });
    let res;
    try { res = await go(LOCAL ? LOCAL + domain + '.html' : 'https://' + domain); } catch (e) {
      // many sites only answer on www.
      if (LOCAL || domain.startsWith('www.') || !/ERR_NAME|ERR_CONNECTION|ERR_CERT|ERR_SSL/.test(String(e.message))) throw e;
      res = await go('https://www.' + domain);
    }
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
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const CTX_OPTS = { viewport: { width: 1280, height: 800 }, locale: 'en-US', timezoneId: 'America/New_York', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', javaScriptEnabled: true };

async function openBrowser() {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await browser.newContext(CTX_OPTS);
  await ctx.route('**/*', (route) => (['media', 'websocket'].includes(route.request().resourceType()) ? route.abort() : route.continue()).catch(() => {}));
  return { browser, ctx };
}
const closeBrowser = (b) => Promise.race([b.browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 20000))]);

// visits candidates until `need` new entries are found or time is up
async function collect(need, taken) {
  const tranco = loadTranco().filter((e) => PART == null || hash(e.domain) % PARTS === PART);
  const candidates = sampleCandidates(tranco, Math.ceil(need * 25) + 50, taken);
  log('need', need, 'candidates', candidates.length);
  let session = await openBrowser();
  let used = 0, stalls = 0, restarting = null;
  // a fresh browser every 400 pages, or after a run of timeouts, keeps memory and hung tabs in check
  async function restart() {
    if (!restarting) restarting = (async () => { const old = session; session = await openBrowser(); used = 0; stalls = 0; closeBrowser(old); log('browser restarted'); })().finally(() => { restarting = null; });
    return restarting;
  }
  const fresh = [];
  const reasons = {};
  const now = Math.floor(Date.now() / 1000);
  let next = 0;
  const timeLeft = () => (Date.now() - started) / 60000 < MAX_MINUTES;
  async function worker() {
    while (fresh.length < need && next < candidates.length && timeLeft()) {
      if (restarting) await restarting;
      const c = candidates[next++];
      if (next % 250 === 0) log('tried', next, 'new', fresh.length, JSON.stringify(reasons));
      const cap = await capture(session.ctx, c.domain);
      used++;
      stalls = cap.fail === 'timeout' ? stalls + 1 : 0;
      if (used >= 400 || stalls >= CONCURRENCY) await restart();
      let why = cap.fail ? (cap.fail === 'timeout' ? 'timeout' : 'load') : await judge(c.domain, cap);
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
  // workers stop at the deadline; if one is still stuck a few minutes later, write what we have anyway
  const grace = Math.max(0, MAX_MINUTES * 60000 - (Date.now() - started)) + 4 * 60000;
  await Promise.race([Promise.all(Array.from({ length: CONCURRENCY }, worker)), new Promise((r) => setTimeout(r, grace))]);
  await closeBrowser(session);
  log('new total', fresh.length, 'tried', next, JSON.stringify(reasons));
  return fresh.slice();
}

async function main() {
  fs.mkdirSync(path.join(OUT, 's'), { recursive: true });
  // keep old entries, minus removals, and minus churn once the pool is full
  let old = [];
  if (OLD) {
    for (let i = 0; i < SHARDS; i++) {
      const f = path.join(OLD, 'i', i + '.json');
      if (fs.existsSync(f)) old.push(...JSON.parse(fs.readFileSync(f, 'utf8')));
    }
  }
  let keep = old.filter((e) => !removedIds.has(e.id) && !isBlockedDomain(dec(e.d)) && CATEGORIES.some((c) => c.id === e.c));
  keep.sort((a, b) => a.a - b.a);
  const drop = keep.length >= TARGET * 0.9 ? Math.floor(keep.length * CHURN) : 0;
  keep = keep.slice(drop);
  const taken = new Set(old.map((e) => dec(e.d)));
  const need = Math.max(0, TARGET - keep.length);

  if (PART != null) {
    const fresh = await collect(Math.ceil(need / PARTS), taken);
    fs.writeFileSync(path.join(OUT, 'fresh.json'), JSON.stringify(fresh));
    return;
  }

  for (const e of keep) fs.copyFileSync(path.join(OLD, 's', e.id + '.webp'), path.join(OUT, 's', e.id + '.webp'));
  log('kept', keep.length, 'dropped', drop);
  let fresh = [];
  if (MERGE) {
    for (const dir of MERGE) {
      const f = path.join(dir, 'fresh.json');
      if (!fs.existsSync(f)) { log('missing part', dir); continue; }
      for (const e of JSON.parse(fs.readFileSync(f, 'utf8'))) {
        const d = dec(e.d);
        if (taken.has(d) || !fs.existsSync(path.join(dir, 's', e.id + '.webp'))) continue;
        taken.add(d);
        fs.copyFileSync(path.join(dir, 's', e.id + '.webp'), path.join(OUT, 's', e.id + '.webp'));
        fresh.push(e);
      }
      log('merged', dir, fresh.length);
    }
  } else {
    fresh = await collect(need, taken);
  }

  fs.mkdirSync(path.join(OUT, 'i'), { recursive: true });
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

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
