/* What does it sell? Guess a real website from a screenshot that sharpens step by step.
   Style: newsprint frame with screen-print registration marks; grain sits on the frame, never on the screenshot. */
(() => {
  const S = Shell, snd = S.sound, E = S.ease;
  const POOL = '../../pool/';
  const REPO = 'https://github.com/Labtoso/Games';
  const cv = document.getElementById('c');
  const st = S.stage(cv, () => { rebuild(); });
  const ctx = st.ctx;
  const hud = S.hud('guess');
  const ov = S.overlay();
  const fx = S.particles(120);
  let P = S.palette();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { P = S.palette(); });

  const T = {
    title: 'What does it sell?', play: 'Play', retry: 'Play again', record: 'New best', done: 'Round over',
    intro: 'A real website, blurred. Guess what it sells or does. The sooner you know, the more points.',
    over: (s, r, b) => `<b>${s}</b> points, <b>${r}</b> of 10 right. Best: <b>${b}</b>.`,
    round: (i) => `Site ${i}/10`, reveal: (a, b) => `Reveal ${a}/${b}`, time: (s) => `${s}s`,
    mode: 'Answers', choices: 'Choices', free: 'Free text', loading: 'Loading sites…', offline: 'The website pool could not be loaded. Try again in a moment.',
    allSeen: 'You have seen every site in the pool. Starting over.', more: 'Reveal more', next: 'Next', report: 'Report',
    reported: 'Thanks. This site will not show up again for you.', streak: (n) => `Streak ×${n}`, lost: 'Missed',
  };

  /* Difficulty: stages run from most hidden to almost visible. */
  const DIFF = {
    easy: { stages: ['blur18', 'blur9', 'spot', 'tiles60', 'tiles90'], auto: 9, onWrong: 'next', buckets: [0, 1, 2], limit: 0 },
    normal: { stages: ['blur40', 'blur18', 'pixel', 'tiles50', 'tiles85'], auto: 7, onWrong: 'next', buckets: [0, 1, 2, 3], limit: 0 },
    hard: { stages: ['blur60', 'pixel', 'tiles45'], auto: 7, onWrong: 'lose', buckets: [1, 2, 3], limit: 24 },
  };
  const BASE = [500, 380, 270, 170, 90];
  const diff = S.difficulty('guess');
  const cfg = () => DIFF[diff.value];

  // ---------- per-player order ----------
  const hash = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  let seed = S.store.get('guess:seed', 0);
  if (!seed) { seed = (Math.random() * 4294967295) >>> 0 || 1; S.store.set('guess:seed', seed); }
  const short = (id) => id.slice(0, 8);
  let seen = new Set(S.store.get('guess:seen', []));
  const reported = new Set(S.store.get('guess:reported', []));
  const saveSeen = () => S.store.set('guess:seen', [...seen]);
  const dec = (s) => { try { const b = atob(s); let o = ''; for (let i = 0; i < b.length; i++) o += String.fromCharCode(b.charCodeAt(i) ^ 0x5a); return decodeURIComponent(escape(o)); } catch (e) { return ''; } };

  let meta = null, cats = null, catMap = {}, shardCache = {}, shardOrder = [];
  const shardOf = (id) => parseInt(id.slice(0, 4), 16) % meta.shards;
  const getJSON = (u) => fetch(u, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  async function loadShard(n) {
    if (!shardCache[n]) shardCache[n] = getJSON(`${POOL}i/${n}.json`).then((list) => list.filter((e) => catMap[e.c]).sort((a, b) => hash(seed + a.id) - hash(seed + b.id))).catch(() => []);
    return shardCache[n];
  }
  async function init() {
    [meta, cats] = await Promise.all([getJSON(POOL + 'meta.json'), getJSON(POOL + 'categories.json')]);
    for (const c of cats) catMap[c.id] = c;
    for (const id of meta.removed || []) reported.add(id);
    shardOrder = Array.from({ length: meta.shards }, (_, i) => i).sort((a, b) => hash(seed + ':' + a) - hash(seed + ':' + b));
  }

  /* Next unseen site: walk shards in this player's order, prefer allowed popularity, avoid repeating recent categories. */
  async function pickSite(recentCats, usedIds) {
    const allowed = cfg().buckets;
    for (let pass = 0; pass < 3; pass++) {
      for (const n of shardOrder) {
        if (!meta.sizes[n]) continue;
        const list = await loadShard(n);
        let fallback = null;
        for (const e of list) {
          if (seen.has(short(e.id)) || reported.has(e.id) || usedIds.has(e.id) || failed.has(e.id)) continue;
          if (pass === 0 && !allowed.includes(e.r)) continue;
          if (pass < 2 && recentCats.includes(e.c)) { fallback = fallback || e; continue; }
          return e;
        }
        if (fallback && pass > 0) return fallback;
      }
    }
    return null;
  }

  /* Three wrong options: one or two from the same group, the rest from others, never the same answer twice. */
  function options(entry) {
    const right = catMap[entry.c];
    const r = S.tex.rng(hash(seed + entry.id + 'o'));
    const same = cats.filter((c) => c.group === right.group && c.id !== right.id);
    const other = cats.filter((c) => c.group !== right.group);
    const pickFrom = (arr) => arr.splice(Math.floor(r() * arr.length), 1)[0];
    const out = [right];
    const wantSame = Math.min(same.length, r() < 0.5 ? 1 : 2);
    while (out.length < 1 + wantSame) { const c = pickFrom(same); if (!out.some((o) => o.answer === c.answer)) out.push(c); }
    while (out.length < 4 && other.length) { const c = pickFrom(other); if (!out.some((o) => o.answer === c.answer) && !out.slice(1).some((o) => o.group === c.group)) out.push(c); }
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }

  // ---------- free text ----------
  const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'it', 'they', 'sells', 'sell', 'selling', 'online', 'site', 'website', 'shop', 'store', 'company', 'stuff', 'things', 'app', 'software', 'service', 'services']);
  const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
  function freeMatch(text, cat) {
    const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).map(stem);
    if (!words.length) return false;
    const pool = new Set([...cat.syn, ...cat.answer.toLowerCase().split(/[^a-z0-9]+/)].filter((w) => w && !STOP.has(w)).map(stem));
    return words.some((w) => pool.has(w) || [...pool].some((p) => p.length > 3 && (p.startsWith(w) && w.length > 3 || w.startsWith(p))));
  }

  // ---------- state ----------
  let state = 'menu', t = 0, round = [], idx = 0, score = 0, rightCount = 0, streak = 0, site = null, img = null, stage = 0, stageT = 0, siteT = 0;
  let layers = [], prevCanvas = null, curCanvas = null, fade = 1, pop = 0, solved = false, opts = [], nextImg = null, nextEntry = null;
  let freeMode = S.store.get('guess:mode', 'choices') === 'free';
  const failed = new Set();
  const el = {
    options: document.querySelector('[data-options]'), free: document.querySelector('[data-free]'), more: document.querySelector('[data-more]'),
    next: document.querySelector('[data-next]'), site: document.querySelector('[data-site]'), report: document.querySelector('[data-report]'),
    round: document.querySelector('[data-round]'), reveal: document.querySelector('[data-reveal]'), timer: document.querySelector('[data-timer]'),
  };
  const input = el.free.querySelector('input');

  function loadImage(entry) {
    return new Promise((res) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = `${POOL}s/${entry.id}.webp`;
    });
  }

  // ---------- reveal layers ----------
  function frameRect() {
    const pad = Math.max(14, Math.min(st.w, st.h) * 0.045);
    let w = st.w - pad * 2, h = w / 1.6;
    if (h > st.h - pad * 2) { h = st.h - pad * 2; w = h * 1.6; }
    return { x: (st.w - w) / 2, y: (st.h - h) / 2, w, h };
  }
  function scaled(scale, smooth) {
    const r = frameRect(), W = Math.max(1, Math.round(r.w * st.dpr)), H = Math.max(1, Math.round(r.h * st.dpr));
    const small = S.tex.canvas(Math.max(2, Math.round(W / scale)), Math.max(2, Math.round(H / scale)));
    const g = small.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(img, 0, 0, small.width, small.height);
    const out = S.tex.canvas(W, H), o = out.getContext('2d');
    o.imageSmoothingEnabled = smooth; o.imageSmoothingQuality = 'high'; o.drawImage(small, 0, 0, W, H);
    return out;
  }
  function sharp() { const r = frameRect(), c = S.tex.canvas(Math.round(r.w * st.dpr), Math.round(r.h * st.dpr)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c; }
  function buildLayer(kind) {
    const rnd = S.tex.rng(hash(site.id + kind));
    if (kind.startsWith('blur')) { const k = Number(kind.slice(4)); return blurTwice(scaled(k, true), k); }
    if (kind === 'pixel') return scaled(26, false);
    const base = kind === 'spot' ? scaled(12, true) : scaled(kind === 'tiles45' ? 20 : 12, false);
    const g = base.getContext('2d'), full = sharp();
    if (kind === 'spot') {
      for (let i = 0; i < 3; i++) {
        const x = (0.15 + rnd() * 0.7) * base.width, y = (0.15 + rnd() * 0.7) * base.height, r = base.width * (0.09 + rnd() * 0.05);
        g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip(); g.drawImage(full, 0, 0); g.restore();
        g.strokeStyle = P.ink; g.lineWidth = S.art.lw.detail * st.dpr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      }
      return base;
    }
    const share = Number(kind.slice(5)) / 100, cols = 8, rowsN = 5;
    const order = Array.from({ length: cols * rowsN }, (_, i) => i).sort(() => rnd() - 0.5);
    const tw = base.width / cols, th = base.height / rowsN;
    for (const i of order.slice(0, Math.round(order.length * share))) {
      const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
      g.drawImage(full, x, y, tw, th, x, y, tw, th);
    }
    return base;
  }
  function blurTwice(c, k) {
    // smooth again with a canvas filter where available; the downscale already does most of the work
    if (!('filter' in ctx)) return c;
    const out = S.tex.canvas(c.width, c.height), o = out.getContext('2d');
    o.drawImage(c, 0, 0); o.filter = `blur(${Math.max(2, k * 0.35) * st.dpr}px)`; o.drawImage(c, 0, 0); o.filter = 'none';
    return out;
  }
  function rebuild() {
    if (!img || !site) return;
    layers = cfg().stages.map(() => null);
    curCanvas = solved ? sharp() : layerAt(stage); prevCanvas = null; fade = 1;
  }
  function layerAt(i) { if (!layers[i]) layers[i] = buildLayer(cfg().stages[i]); return layers[i]; }
  function setStage(i) {
    stage = i; stageT = 0;
    prevCanvas = curCanvas; curCanvas = layerAt(i); fade = 0;
    // build the next one ahead of time so the switch is instant
    if (i + 1 < cfg().stages.length) setTimeout(() => { if (site) layerAt(Math.min(i + 1, cfg().stages.length - 1)); }, 60);
    paintStatus();
  }

  // ---------- flow ----------
  async function startRound() {
    state = 'loading'; score = 0; rightCount = 0; streak = 0; idx = 0; round = []; hud.score(0);
    ov.show(T.title, T.loading, T.play, () => {}); ov.hide();
    try { if (!meta) await init(); } catch (e) { state = 'menu'; ov.show(T.title, T.offline, T.retry, startRound); return; }
    nextEntry = null; nextImg = null;
    await nextSite();
  }
  async function fetchNext() {
    const used = new Set(round.map((e) => e.id));
    if (site) used.add(site.id);
    const recent = round.slice(-2).map((e) => e.c);
    for (let tries = 0; tries < 8; tries++) {
      let e = null;
      if (S.debug.on && S.debug.params && S.debug.params.get('site') && !round.length && !site) {
        const id = S.debug.params.get('site');
        const list = await loadShard(shardOf(id));
        e = list.find((x) => x.id === id) || null;
      }
      if (!e) e = await pickSite(recent, used);
      if (!e) {
        if (seen.size) { seen = new Set(); saveSeen(); S.store.set('guess:cycle', (S.store.get('guess:cycle', 0) || 0) + 1); fl(T.allSeen); continue; }
        return null;
      }
      const im = await loadImage(e);
      if (im) return { e, im };
      failed.add(e.id); used.add(e.id);
    }
    return null;
  }
  async function nextSite() {
    if (nextEntry && round.some((e) => e.id === nextEntry.id)) nextEntry = null;
    let got = nextEntry ? { e: nextEntry, im: nextImg } : await fetchNext();
    nextEntry = null; nextImg = null;
    if (!got) { state = 'menu'; ov.show(T.title, T.offline, T.retry, startRound); return; }
    site = got.e; img = got.im; round.push(site);
    seen.add(short(site.id)); saveSeen();
    solved = false; siteT = 0; pop = 0;
    layers = cfg().stages.map(() => null);
    let first = 0;
    if (S.debug.on && S.debug.params && S.debug.params.has('stage')) first = S.clamp((Number(S.debug.params.get('stage')) || 1) - 1, 0, cfg().stages.length - 1);
    curCanvas = null; prevCanvas = null; setStage(first);
    opts = options(site);
    renderOptions();
    el.site.hidden = true; el.next.hidden = true; el.more.hidden = false; el.report.hidden = false;
    state = 'play';
    // preload the following site while this one is being guessed
    if (round.length < 10) { const cur = site.id; fetchNext().then((g) => { if (g && state !== 'menu' && site && site.id === cur && g.e.id !== cur) { nextEntry = g.e; nextImg = g.im; } }); }
  }
  function renderOptions() {
    el.free.hidden = !freeMode; el.options.hidden = freeMode;
    if (freeMode) { input.value = ''; input.disabled = false; setTimeout(() => input.focus({ preventScroll: true }), 30); return; }
    el.options.innerHTML = opts.map((c, i) => `<button type="button" data-i="${i}"><kbd>${i + 1}</kbd><span>${c.answer}</span></button>`).join('');
    el.options.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => answer(Number(b.dataset.i))));
    if (S.debug.on && (S.debug.params && S.debug.params.get('solution') === '1' || S.debug.solution)) { const i = opts.findIndex((c) => c.id === site.c); el.options.children[i].classList.add('solution'); }
  }
  function paintStatus() {
    const c = cfg();
    el.round.textContent = T.round(Math.min(10, round.length || 1));
    el.reveal.textContent = T.reveal(stage + 1, c.stages.length);
  }

  function points() {
    const c = cfg(), share = stage / Math.max(1, c.stages.length - 1);
    const base = BASE[Math.min(BASE.length - 1, Math.round(share * (BASE.length - 1)))];
    const fast = Math.max(0, Math.round(60 - siteT * 2));
    return base + fast + Math.min(streak, 5) * 25;
  }
  function answer(i) {
    if (state !== 'play' || solved) return;
    const ok = opts[i].id === site.c;
    const btn = el.options.children[i];
    if (ok) win(btn); else miss(btn);
  }
  function submitFree() {
    if (state !== 'play' || solved) return;
    if (!input.value.trim()) return;
    if (freeMatch(input.value, catMap[site.c])) win(null); else { miss(el.free); input.select(); }
  }
  function win(btn) {
    solved = true; streak++; rightCount++;
    const pts = points(); score += pts; hud.score(score);
    if (btn) btn.classList.add('right');
    reveal(true, pts);
    snd.chord([523, 659, 784], 0.3, 'triangle', 0.2);
    if (streak > 1) snd.tone(988, 0.12, 'triangle', 0.12, 1, 0.25);
  }
  function miss(btn) {
    streak = 0;
    if (btn) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); if (btn.tagName === 'BUTTON') { btn.classList.add('wrong'); btn.disabled = true; } }
    snd.tone(180, 0.22, 'sawtooth', 0.12, 0.7);
    if (cfg().onWrong === 'lose' || stage >= cfg().stages.length - 1) { solved = true; reveal(false, 0); }
    else { score = Math.max(0, score - (diff.value === 'normal' ? 40 : 0)); hud.score(score); setStage(stage + 1); }
  }
  function reveal(ok, pts) {
    state = 'shown';
    prevCanvas = curCanvas; curCanvas = sharp(); fade = 0; pop = ok ? 1 : 0;
    const domain = dec(site.d);
    el.site.hidden = false; el.site.href = 'https://' + domain; el.site.textContent = domain;
    el.more.hidden = true; el.next.hidden = false; el.next.textContent = round.length >= 10 ? T.done : T.next;
    if (!freeMode) {
      [...el.options.children].forEach((b, i) => { b.disabled = true; if (opts[i].id === site.c) b.classList.add('right'); });
    } else { input.disabled = true; input.value = catMap[site.c].answer; }
    el.reveal.textContent = ok ? `+${pts}${streak > 1 ? ' · ' + T.streak(streak) : ''}` : T.lost;
    if (ok) { const r = frameRect(); fx.burst(r.x + r.w / 2, r.y + r.h / 2, P.yellow, 26, 260, 0.8, 4); fx.burst(r.x + r.w / 2, r.y + r.h / 2, P.pink, 16, 200, 0.7, 3); }
    setTimeout(() => el.next.focus({ preventScroll: true }), 50);
  }
  function next() {
    if (state !== 'shown') return;
    if (round.length >= 10) return finish();
    nextSite();
  }
  function finish() {
    state = 'menu';
    const rec = hud.best(score);
    snd.chord(rec ? [523, 659, 784, 1046] : [392, 494, 587], 0.5, 'triangle', 0.18);
    menu(rec && score > 0 ? T.record : T.done, T.over(score, rightCount, hud.bestValue), T.retry);
  }
  function more() { if (state === 'play' && !solved && stage < cfg().stages.length - 1) { setStage(stage + 1); snd.tone(660, 0.06, 'triangle', 0.1); } }
  function report() {
    if (!site) return;
    const title = encodeURIComponent(`Guessing game: report site ${site.id}`);
    const body = encodeURIComponent(`Site id: ${site.id}\n\nWhat is wrong? (wrong answer, unsuitable content, please remove)\n\n`);
    window.open(`${REPO}/issues/new?labels=report&title=${title}&body=${body}`, '_blank', 'noopener,noreferrer');
    reported.add(site.id); S.store.set('guess:reported', [...reported]);
    el.reveal.textContent = T.reported;
    if (state === 'play') { solved = true; state = 'shown'; el.more.hidden = true; el.next.hidden = false; el.next.textContent = round.length >= 10 ? T.done : T.next; }
  }
  let note = null;
  function fl(text) { note = { text, t: 0 }; }

  el.more.addEventListener('click', more);
  el.next.addEventListener('click', next);
  el.report.addEventListener('click', report);
  el.free.addEventListener('submit', (e) => { e.preventDefault(); submitFree(); });
  S.keys((k, e) => {
    if (ov.open) return;
    if (e.target === input) return;
    if (k >= '1' && k <= '4' && !freeMode) answer(Number(k) - 1);
    else if (k === 'Enter') { if (state === 'shown') next(); }
    else if (k === ' ' || k === 'r' || k === 'R') more();
  });

  function menu(title, text, label) {
    ov.show(title, text, label, startRound);
    diff.mount(ov);
    const box = ov.extra('');
    const render = () => {
      box.innerHTML = `<div class="choice" role="group" aria-label="${T.mode}"><button data-m="choices" aria-pressed="${!freeMode}">${T.choices}</button><button data-m="free" aria-pressed="${freeMode}">${T.free}</button></div>`;
      box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { freeMode = b.dataset.m === 'free'; S.store.set('guess:mode', freeMode ? 'free' : 'choices'); S.sound.tone(600, 0.05, 'triangle', 0.15); render(); }));
    };
    render();
  }

  // ---------- update and draw ----------
  function update(dt) {
    t += dt;
    fade = Math.min(1, fade + dt / (S.reduced ? 0.25 : 0.45));
    pop = Math.max(0, pop - dt * 1.6);
    fx.update(dt, 300);
    if (note) { note.t += dt; if (note.t > 3) note = null; }
    if (state === 'play' && !solved) {
      siteT += dt; stageT += dt;
      const c = cfg();
      if (stageT > c.auto && stage < c.stages.length - 1) setStage(stage + 1);
      if (c.limit && siteT > c.limit) { streak = 0; solved = true; reveal(false, 0); snd.tone(160, 0.3, 'sine', 0.15, 0.6); }
      el.timer.textContent = c.limit ? T.time(Math.max(0, Math.ceil(c.limit - siteT))) : T.time(Math.floor(siteT));
    }
  }

  function draw() {
    const w = st.w, h = st.h;
    S.tex.paperBg(ctx, w, h, P);
    const r = frameRect();
    const k = pop > 0 && !S.reduced ? 1 + E.outElastic(1 - pop) * 0.0 + Math.sin((1 - pop) * Math.PI) * 0.02 : 1;
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(k, k); ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    // offset print shadow and registration marks around the frame
    ctx.fillStyle = P.pink; ctx.globalAlpha = 0.85; ctx.fillRect(r.x + 7, r.y + 7, r.w, r.h); ctx.globalAlpha = 1;
    ctx.fillStyle = P.ink; ctx.fillRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
    S.tex.grain(ctx, w, h, P.paper, 0.6);
    if (curCanvas) {
      ctx.imageSmoothingEnabled = true;
      if (prevCanvas && fade < 1) { ctx.drawImage(prevCanvas, r.x, r.y, r.w, r.h); ctx.globalAlpha = E.inOutQuad(fade); }
      ctx.drawImage(curCanvas, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = P.paper2; ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    ctx.restore();
    ctx.strokeStyle = P.ink; ctx.lineWidth = S.art.lw.fine;
    for (const [cx, cy] of [[r.x - 14, r.y - 14], [r.x + r.w + 14, r.y - 14], [r.x - 14, r.y + r.h + 14], [r.x + r.w + 14, r.y + r.h + 14]]) {
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9); ctx.stroke();
    }
    fx.draw(ctx);
    if (note) {
      ctx.save(); ctx.globalAlpha = S.clamp(note.t < 0.3 ? note.t / 0.3 : 3 - note.t, 0, 1);
      ctx.font = '600 13px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = P.ink;
      ctx.fillText(note.text, w / 2, r.y - 22 > 12 ? r.y - 22 : 16); ctx.restore();
    }
    if (state === 'loading') { ctx.font = '600 13px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = P.soft; ctx.fillText(T.loading, w / 2, h / 2); ctx.textAlign = 'left'; }
  }

  S.dbg.next = () => { if (state === 'play') { const i = opts.findIndex((c) => c.id === site.c); if (freeMode) win(null); else answer(i); } else if (state === 'shown') next(); };
  if (S.debug.on && S.debug.params && S.debug.params.get('resetseen') === '1') { seen = new Set(); saveSeen(); }
  el.more.textContent = T.more; el.report.textContent = T.report;
  menu(T.title, T.intro, T.play);
  S.loop((dt) => { update(dt); draw(); });
})();
