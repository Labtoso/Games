/* Starwatch: a screen-printed space shooter */
(() => {
  const S = Shell, E = S.ease, snd = S.sound;
  const cv = document.getElementById('c');
  const st = S.stage(cv, () => { if (player) { player.x = S.clamp(player.x, 16, st.w - 16); player.y = S.clamp(player.y, 40, st.h - 24); } });
  const ctx = st.ctx;
  const hud = S.hud('sternwacht');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  // Nachtpalette (siehe STYLEGUIDE.md)
  const N = { bg: '#0d0b1a', paper: '#f2ecdf', pink: '#ff4d8d', blue: '#3f7bff', yellow: '#ffc93c', green: '#2fd38a', orange: '#ff7a3d', dim: 'rgba(242,236,223,0.35)', ink: '#0d0b1a' };

  S.setWear(N.bg);
  const diff = S.difficulty('sternwacht');
  const D = () => diff.pick({ easy: { lives: 5, shot: 0.7, bspd: 0.8 }, normal: { lives: 3, shot: 1, bspd: 1 }, hard: { lives: 2, shot: 1.35, bspd: 1.2 } });
  let player = null, pBullets = [], eBullets = [], enemies = [], drops = [], rings = [], schedule = [];
  let score = 0, wave = 0, waveT = 0, state = 'menu', t = 0, shake = 0, flash = 0, banner = null, bossRef = null, chain = 0, chainT = 0;
  let stars = [], nebY = 0, nebula = null;
  const T = {
    title: 'Starwatch', play: 'Launch', retry: 'Launch again', record: 'New best', lost: 'Watch over',
    intro: 'Your ship fires on its own. Dodge, collect shards and spend them in the shop.',
    over: (s, w, b) => `<b>${s}</b> points, reached <b>wave ${w}</b>. Best: <b>${b}</b>.`,
    wave: (n) => `Wave ${n}`, boss: (n) => `Wave ${n}: Warden`, shopHint: 'B or Space: shop',
    shop: 'Shop', paused: (n) => `Paused. You have <b>${n}</b> shards.`, resume: 'Resume',
    maxed: 'Maxed', full: 'Full', now: 'Now', next: 'Next', items: 'Supplies',
    hudWave: (n) => `WAVE ${n}`, shards: 'SHARDS', hudShield: 'SHIELD', chain: (n) => `CHAIN ×${n}`, bombUp: 'Bomb +1', lifeUp: 'Life +1',
  };

  /* Upgrade table. Tier n (counting from 0) costs base × growth^n, rounded to 5, times the difficulty factor. */
  const UPG = [
    { id: 'multi', name: 'Multishot', base: 30, growth: 1.8, tiers: ['2 beams', '3 beams', '5 beams', 'Wide 5-beam fan'] },
    { id: 'laser', name: 'Laser', base: 70, growth: 1.7, tiers: ['Piercing beam every 3s', 'Beam lasts longer', 'Wider, heavier beam', 'Beam every 2s'] },
    { id: 'rocket', name: 'Homing Missiles', base: 45, growth: 1.7, tiers: ['1 missile', 'Faster reload', '2 missiles', 'Sharper turns'] },
    { id: 'shield', name: 'Shield', base: 50, growth: 1.75, tiers: ['Blocks 1 hit', 'Recharges faster', 'Blocks 2 hits', 'Recharges in 6s'] },
    { id: 'drone', name: 'Drones', base: 60, growth: 1.8, tiers: ['1 drone', '2 drones', '3 drones, faster fire'] },
    { id: 'magnet', name: 'Magnet', base: 20, growth: 1.7, tiers: ['Wider pickup', 'Stronger pull', 'Pulls from far away'] },
    { id: 'rate', name: 'Fire Rate', base: 30, growth: 1.65, tiers: ['+15% fire rate', '+30% fire rate', '+45% fire rate', '+60% fire rate'] },
    { id: 'speed', name: 'Speed', base: 25, growth: 1.7, tiers: ['+12% speed', '+24% speed', '+36% speed'] },
    { id: 'bombcap', name: 'Bomb Capacity', base: 35, growth: 1.8, tiers: ['Carry 4 bombs', 'Carry 5 bombs', 'Carry 6 bombs'] },
  ];
  const ITEMS = [{ id: 'bomb', name: 'Bomb', info: 'One more bomb', cost: 35 }, { id: 'life', name: 'Spare Ship', info: 'One more life', cost: 120 }];
  const priceMul = () => diff.pick({ easy: 0.85, normal: 1, hard: 1.2 });
  const price = (u, lv) => Math.round((u.base * Math.pow(u.growth, lv) * priceMul()) / 5) * 5;
  const SHARD_DROP = { drone: 1, mini: 1, diver: 2, splitter: 3, turret: 4, boss: 40 };

  /* Saved ship: { v: 1, shards, up }. Additive key, unknown fields are ignored. */
  const SAVE = 'sternwacht:ship';
  function loadShip() {
    const d = S.store.get(SAVE, null) || {};
    const u = {};
    for (const x of UPG) u[x.id] = S.clamp((d.up && d.up[x.id]) | 0, 0, x.tiers.length);
    let n = Math.max(0, d.shards | 0);
    if (S.debug.on && S.debug.money) n = S.debug.money;
    return { shards: n, up: u };
  }
  const saved = loadShip();
  let up = saved.up, shards = saved.shards, shardShow = shards, shardPop = 0, rockets = [], countT = 0, buyFx = 0, preview = null;
  function saveShip() { S.store.set(SAVE, { v: 1, shards, up }); }
  const bombCap = () => 3 + up.bombcap;
  const shieldMax = () => (up.shield >= 3 ? 2 : up.shield ? 1 : 0);

  const isShopKey = (k) => k === 'b' || k === 'B' || k === ' ';
  const keys = S.keys((k) => {
    if (state === 'shop') { if (k === 'Escape' || k === 'b' || k === 'B') closeShop(); else if (k.startsWith('Arrow')) moveFocus(k); return; }
    if (ov.open) return;
    if (k === 'x' || k === 'X' || k === 'q' || k === 'Q') bomb();
    else if (isShopKey(k) || k === 'Escape') openShop();
  });
  const shopBtn = document.querySelector('[data-shop]');
  if (shopBtn) shopBtn.addEventListener('click', () => { shopBtn.blur(); if (state === 'shop') closeShop(); else openShop(); });
  const ptr = S.pointer(cv);
  let drag = null;

  function makeStars() {
    stars = [];
    for (let i = 0; i < 140; i++) stars.push({ x: Math.random(), y: Math.random(), z: S.pick([0.25, 0.5, 1]), tw: Math.random() * 6 });
    nebula = S.tex.nebula(360, 720, [N.pink, N.blue, '#6a3fb8'], 17);
  }

  function reset() {
    player = { x: st.w / 2, y: st.h - 80, r: 9, lives: D().lives, bombs: 2, sx: 1, sy: 1, inv: 2, fireT: 0, tilt: 0, rocketT: 0, laserT: 2, laserOn: 0, shieldUp: 0, shieldT: 0, droneT: 0 };
    player.shieldUp = shieldMax(); rockets = [];
    pBullets = []; eBullets = []; enemies = []; drops = []; rings = []; schedule = []; fx.clear(); fl.clear();
    score = 0; wave = S.debug.on ? Math.max(0, S.debug.start - 1) : 0; chain = 0; hud.score(0); bossRef = null;
    nextWave();
  }

  /* ---------- Wellen ---------- */
  function nextWave() {
    wave++; waveT = 0; schedule = [];
    const w = st.w;
    if (wave % 5 === 0) {
      banner = { text: T.boss(wave), t: 0 };
      schedule.push({ at: 1.6, type: 'boss', x: w / 2 });
      snd.chord([196, 233, 294], 0.9, 'sawtooth', 0.08, 0.12);
    } else {
      banner = { text: T.wave(wave), t: 0 };
      const count = 7 + wave * 2;
      const types = ['drone', 'drone', ...(wave >= 2 ? ['diver'] : []), ...(wave >= 3 ? ['turret'] : []), ...(wave >= 4 ? ['splitter', 'diver'] : [])];
      let at = 1.4;
      for (let i = 0; i < count; i++) {
        const type = S.pick(types);
        if (type === 'drone' && Math.random() < 0.5) {
          // kleine Formation
          const x0 = S.rand(60, w - 60);
          for (let j = 0; j < 3; j++) schedule.push({ at: at + j * 0.25, type: 'drone', x: S.clamp(x0 + (j - 1) * 34, 20, w - 20) });
          i += 2;
        } else schedule.push({ at, type, x: S.rand(40, w - 40) });
        at += S.rand(0.5, 1.1) * Math.max(0.45, 1 - wave * 0.04);
      }
      snd.chord([392, 523], 0.3, 'triangle', 0.12);
    }
  }

  const ENEMY = {
    drone: { hp: 2, r: 12, pts: 10 },
    diver: { hp: 3, r: 13, pts: 20 },
    turret: { hp: 9, r: 17, pts: 40 },
    splitter: { hp: 5, r: 15, pts: 30 },
    mini: { hp: 1, r: 8, pts: 5 },
    boss: { hp: 260, r: 46, pts: 1000 },
  };

  function spawn(type, x, y = -30) {
    const d = ENEMY[type];
    const hp = type === 'boss' ? d.hp + wave * 40 : d.hp + Math.floor(wave / 4);
    const e = { type, x, y, r: d.r, hp, max: hp, t: 0, ph: Math.random() * 6, vx: 0, vy: type === 'mini' ? 120 : 70 + wave * 3, hit: 0, shotT: S.rand(0.8, 2), state: 'in', ty: S.rand(st.h * 0.15, st.h * 0.4), pat: 0, patT: 0 };
    if (type === 'boss') { e.ty = st.h * 0.2; e.vy = 60; bossRef = e; }
    enemies.push(e);
    return e;
  }

  /* ---------- Shooting ---------- */
  const FAN = [[0], [-6, 6], [-9, 0, 9], [-14, -7, 0, 7, 14], [-16, -8, 0, 8, 16]];
  const SPREAD = [0, 0, 0.12, 0.2, 0.42];
  function playerShoot() {
    const p = player, lv = up.multi, row = FAN[lv];
    for (let i = 0; i < row.length; i++) {
      const a = row.length > 1 ? (i / (row.length - 1) - 0.5) * SPREAD[lv] : 0;
      pBullets.push({ x: p.x + row[i], y: p.y - 14, vx: Math.sin(a) * 760, vy: -Math.cos(a) * 760, dmg: 1 });
    }
    snd.tone(880 + Math.random() * 60, 0.04, 'square', 0.04, 0.6);
  }
  function aimed(e, speed, spread = 0, count = 1) {
    const a0 = Math.atan2(player.y - e.y, player.x - e.x);
    for (let i = 0; i < count; i++) {
      const a = a0 + (count > 1 ? (i / (count - 1) - 0.5) * spread : 0);
      eBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed * D().bspd, vy: Math.sin(a) * speed * D().bspd, r: 4.5 });
    }
  }
  function ring(e, speed, count, off = 0, r = 5) {
    for (let i = 0; i < count; i++) { const a = off + (i / count) * Math.PI * 2; eBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed * D().bspd, vy: Math.sin(a) * speed * D().bspd, r }); }
  }

  function bomb() {
    if (state !== 'play' || player.bombs <= 0) return;
    player.bombs--; flash = S.reduced ? 0 : 0.5; shake = 0.4 * S.shakeScale; S.hitstop(60); player.sy = 0.7; player.sx = 1.25;
    for (const b of eBullets) fx.burst(b.x, b.y, N.pink, 2, 60, 0.3, 2);
    eBullets = [];
    for (const e of enemies) damage(e, e.type === 'boss' ? 40 : 30);
    rings.push({ x: player.x, y: player.y, r: 0, max: Math.max(st.w, st.h), c: N.yellow });
    snd.noise(1, 0.5, 300); snd.tone(120, 0.8, 'sine', 0.3, 0.4);
  }

  function damage(e, dmg) {
    e.hp -= dmg; e.hit = 0.08; e.sq = 1;
    if (e.hp <= 0 && !e.dead) kill(e);
  }

  function kill(e) {
    e.dead = true;
    chain++; chainT = 1.2;
    const mul = Math.min(5, 1 + Math.floor(chain / 6));
    const pts = ENEMY[e.type].pts * mul;
    score += pts; hud.score(score);
    fl.add(e.x, e.y - e.r, mul > 1 ? `${pts} ×${mul}` : `${pts}`, N.paper);
    const big = e.type === 'boss';
    fx.burst(e.x, e.y, N.orange, big ? 80 : 18, big ? 420 : 220, big ? 1.4 : 0.7, big ? 6 : 4);
    fx.burst(e.x, e.y, N.yellow, big ? 40 : 8, big ? 300 : 160, 0.6, 3);
    rings.push({ x: e.x, y: e.y, r: 0, max: big ? 260 : e.r * 4, c: big ? N.yellow : N.orange });
    shake = Math.max(shake, (big ? 0.8 : 0.12) * S.shakeScale); if (big) S.hitstop(80);
    snd.noise(big ? 1.2 : 0.3, big ? 0.6 : 0.25, big ? 180 : 500);
    if (e.type === 'splitter') { for (const s of [-1, 1]) { const m = spawn('mini', e.x + s * 10, e.y); m.vx = s * 90; m.state = 'go'; } }
    const nShard = SHARD_DROP[e.type] || 1;
    for (let i = 0; i < nShard; i++) { const a = Math.random() * Math.PI * 2, v = S.rand(60, 150); drops.push({ x: e.x, y: e.y, kind: 'shard', vy: Math.sin(a) * v + 40, vx: Math.cos(a) * v, rot: Math.random() * 6, age: 0 }); }
    if (big) { bossRef = null; eBullets = []; drops.push({ x: e.x - 20, y: e.y, kind: 'bomb', vy: 60 }, { x: e.x + 20, y: e.y, kind: 'life', vy: 60 }); banner = { text: T.shopHint, t: 0 }; }
    else {
      const r = Math.random();
      if (r < 0.03) drops.push({ x: e.x, y: e.y, kind: 'bomb', vy: 70 });
      else if (r < 0.04) drops.push({ x: e.x, y: e.y, kind: 'life', vy: 70 });
    }
  }

  function hitPlayer() {
    if (player.inv > 0 || state !== 'play' || (S.debug.on && S.debug.god)) return;
    if (player.shieldUp) { player.shieldUp--; player.shieldT = 0; player.inv = 1; shake = 0.25 * S.shakeScale; S.hitstop(40); fx.burst(player.x, player.y, N.blue, 24, 220, 0.6, 3); snd.tone(500, 0.3, 'sine', 0.2, 0.5); eBullets = eBullets.filter((b) => Math.hypot(b.x - player.x, b.y - player.y) > 90); return; }
    player.lives--; player.inv = 2.2; chain = 0;
    shake = 0.5 * S.shakeScale; flash = S.reduced ? 0 : 0.25; S.hitstop(80); player.sx = 1.3; player.sy = 0.75;
    fx.burst(player.x, player.y, N.pink, 30, 260, 0.9, 4);
    snd.noise(0.6, 0.5, 300); snd.tone(160, 0.5, 'sawtooth', 0.2, 0.4);
    eBullets = eBullets.filter((b) => Math.hypot(b.x - player.x, b.y - player.y) > 140);
    if (player.lives <= 0) {
      state = 'over';
      const rec = hud.best(score);
      saveShip();
      setTimeout(() => ov.show(rec && score > 0 ? T.record : T.lost, T.over(score, wave, hud.bestValue), T.retry, start), 900);
      setTimeout(() => diff.mount(ov), 910);
    }
  }

  function start() { reset(); state = 'play'; }

  /* ---------- Shop: pauses everything, closes with B, Esc, Resume or a tap ---------- */
  function openShop() {
    if (state !== 'play' && state !== 'count') return;
    state = 'shop'; drag = null;
    snd.chord([392, 494], 0.2, 'triangle', 0.15);
    render();
  }
  function closeShop() {
    if (state !== 'shop') return;
    ov.hide(); preview = null;
    state = 'count'; countT = S.reduced ? 1 : 1.8;
    player.inv = Math.max(player.inv, 0.8);
    snd.tone(520, 0.08, 'triangle', 0.15);
    saveShip();
  }
  function moveFocus(k) {
    const list = [...document.querySelectorAll('.overlay .shop button, .overlay .btn')];
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const cols = getComputedStyle(list[0].parentElement).gridTemplateColumns.split(' ').length || 1;
    const step = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : k === 'ArrowUp' ? -cols : cols;
    list[S.clamp(i < 0 ? 0 : i + step, 0, list.length - 1)].focus();
  }
  function row(id, name, pips, info, can, label) {
    return `<button data-buy="${id}" ${can ? '' : 'disabled'} aria-label="${name}: ${info}"><span>${name}${pips}<small>${info}</small></span><span>${label}</span></button>`;
  }
  function render(focusId) {
    const p = player;
    const ups = UPG.map((u) => {
      const lv = up[u.id], max = u.tiers.length, maxed = lv >= max, cost = maxed ? 0 : price(u, lv);
      const pips = ` <span class="pips">${'■'.repeat(lv)}${'□'.repeat(max - lv)}</span>`;
      const info = maxed ? `${T.maxed}` : `${T.next}: ${u.tiers[lv]}`;
      return row(u.id, u.name, pips, info, !maxed && shards >= cost, maxed ? '–' : `${cost} ◆`);
    }).join('');
    const items = ITEMS.map((it) => {
      const full = (it.id === 'bomb' && p.bombs >= bombCap()) || (it.id === 'life' && p.lives >= 6);
      return row(it.id, it.name, '', full ? T.full : it.info, !full && shards >= it.cost, `${it.cost} ◆`);
    }).join('');
    ov.show(T.shop, T.paused(shards), T.resume, () => { closeShop(); });
    const box = ov.extra(`<div class="shop-head"><canvas class="ship-preview" width="240" height="160" aria-hidden="true"></canvas></div><div class="shop two">${ups}${items}</div>`);
    preview = box.querySelector('canvas');
    // the overlay button hides the overlay itself; closeShop handles the rest
    box.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.buy)));
    if (focusId) { const f = box.querySelector(`[data-buy="${focusId}"]`); if (f && !f.disabled) f.focus({ preventScroll: true }); }
  }
  function buy(id) {
    const u = UPG.find((x) => x.id === id), it = ITEMS.find((x) => x.id === id);
    const cost = u ? (up[id] < u.tiers.length ? price(u, up[id]) : null) : it.cost;
    if (cost == null || shards < cost) { snd.tone(180, 0.1, 'square', 0.1); return; }
    shards -= cost; shardShow = shards;
    if (u) up[id]++;
    else if (id === 'bomb') player.bombs = Math.min(bombCap(), player.bombs + 1);
    else player.lives++;
    if (id === 'shield') player.shieldUp = shieldMax();
    buyFx = 1; player.sx = 0.8; player.sy = 1.25;
    snd.chord([523, 659, 784], 0.2, 'triangle', 0.18);
    saveShip();
    render(id);
  }

  ptr.onDown = (x, y) => {
    if (state !== 'play') return;
    // Bombenknopf unten rechts
    if (x > st.w - 64 && y > st.h - 64) { bomb(); return; }
    if (x > st.w - 64 && y > st.h - 124 && y <= st.h - 64) { openShop(); return; }
    drag = { ox: player.x - x, oy: player.y - y };
  };
  ptr.onUp = () => { drag = null; };

  /* ---------- Update ---------- */
  function update(dt) {
    t += dt;
    nebY += dt * 18;
    for (const s of stars) { s.y += s.z * dt * 0.12; if (s.y > 1) { s.y -= 1; s.x = Math.random(); } }
    if (player) { player.sx = S.lerp(player.sx, 1, Math.min(1, dt * 9)); player.sy = S.lerp(player.sy, 1, Math.min(1, dt * 9)); }
    buyFx = Math.max(0, buyFx - dt * 1.4);
    if (state === 'count') { countT -= dt; if (countT <= 0) state = 'play'; }
    if (state !== 'play') { fx.update(dt); fl.update(dt); for (const r of rings) r.r += dt * 300; rings = rings.filter((r) => r.r < r.max); return; }
    const w = st.w, h = st.h, p = player;

    // Steuerung
    let ax = 0, ay = 0;
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) ax -= 1;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) ax += 1;
    if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) ay -= 1;
    if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) ay += 1;
    const slow = keys.has('Shift') ? 0.5 : 1;
    const spd = 340 * slow * (1 + up.speed * 0.12);
    const len = Math.hypot(ax, ay) || 1;
    let mvx = (ax / len) * spd * dt, mvy = (ay / len) * spd * dt;
    if (drag && ptr.down) { const tx = ptr.x + drag.ox, ty = ptr.y + drag.oy; mvx = S.clamp(tx - p.x, -900 * dt, 900 * dt); mvy = S.clamp(ty - p.y, -900 * dt, 900 * dt); }
    p.x = S.clamp(p.x + mvx, 16, w - 16); p.y = S.clamp(p.y + mvy, 40, h - 24);
    p.tilt = S.lerp(p.tilt, S.clamp(mvx / (spd * dt || 1), -1, 1), Math.min(1, dt * 10));
    p.inv = Math.max(0, p.inv - dt);
    p.fireT -= dt;
    if (p.fireT <= 0) { p.fireT = 0.1 / (1 + up.rate * 0.15); playerShoot(); }
    // Raketen
    if (up.rocket) {
      p.rocketT -= dt;
      if (p.rocketT <= 0) {
        p.rocketT = up.rocket >= 2 ? 0.8 : 1.3;
        const n = up.rocket >= 3 ? 2 : 1;
        for (let i = 0; i < n; i++) rockets.push({ x: p.x + (i ? 12 : -12), y: p.y, vx: (i ? 1 : -1) * 120, vy: -120, life: 3 });
        snd.noise(0.15, 0.08, 1500);
      }
    }
    for (const r of rockets) {
      let tgt = null, bd = 1e9;
      for (const e of enemies) { if (e.dead || e.y < 0) continue; const d = Math.hypot(e.x - r.x, e.y - r.y); if (d < bd) { bd = d; tgt = e; } }
      const ang = Math.atan2(r.vy, r.vx);
      let want = tgt ? Math.atan2(tgt.y - r.y, tgt.x - r.x) : -Math.PI / 2;
      let da = ((want - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const turn = up.rocket >= 4 ? 10 : 6, na = ang + S.clamp(da, -turn * dt, turn * dt);
      const sp = Math.min(520, Math.hypot(r.vx, r.vy) + 600 * dt);
      r.vx = Math.cos(na) * sp; r.vy = Math.sin(na) * sp;
      r.x += r.vx * dt; r.y += r.vy * dt; r.life -= dt;
      if (Math.random() < dt * 50) fx.spark(r.x, r.y, 0, 0, 0.3, N.orange, 2.5);
      for (const e of enemies) if (!e.dead && Math.hypot(e.x - r.x, e.y - r.y) < e.r + 5) { r.life = 0; damage(e, 4); fx.burst(r.x, r.y, N.orange, 10, 140, 0.4, 3); snd.noise(0.15, 0.12, 700); break; }
    }
    rockets = rockets.filter((r) => r.life > 0 && r.y > -40 && r.y < h + 40 && r.x > -40 && r.x < w + 40);
    // Laser
    if (up.laser) {
      if (p.laserOn > 0) {
        p.laserOn -= dt;
        for (const e of enemies) if (!e.dead && e.y < p.y && Math.abs(e.x - p.x) < e.r + (up.laser >= 3 ? 12 : 7)) { damage(e, (up.laser >= 3 ? 45 : 28) * dt); if (Math.random() < dt * 30) fx.spark(e.x + S.rand(-5, 5), e.y + e.r * 0.5, S.rand(-60, 60), S.rand(-60, 20), 0.3, N.pink, 2); }
        eBullets = eBullets.filter((b) => !(b.y < p.y && Math.abs(b.x - p.x) < 8));
      } else {
        p.laserT -= dt;
        if (p.laserT <= 0) { p.laserT = up.laser >= 4 ? 2 : 3; p.laserOn = up.laser >= 2 ? 1 : 0.7; snd.tone(220, 0.7, 'sawtooth', 0.1, 3); }
      }
    }
    // Drohnen
    if (up.drone) {
      p.droneT -= dt;
      if (p.droneT <= 0) {
        p.droneT = up.drone >= 3 ? 0.22 : 0.32;
        for (let i = 0; i < up.drone; i++) { const a = t * 2.4 + (i * Math.PI * 2) / up.drone; pBullets.push({ x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 18 - 4, vx: 0, vy: -700, dmg: 1, drone: true }); }
      }
    }
    // Schild
    if (up.shield && p.shieldUp < shieldMax()) { p.shieldT += dt; if (p.shieldT >= [0, 14, 9, 9, 6][up.shield]) { p.shieldUp++; p.shieldT = 0; snd.tone(660, 0.2, 'sine', 0.12, 1.5); } }
    if (Math.random() < dt * 40) fx.spark(p.x + S.rand(-3, 3), p.y + 14, S.rand(-20, 20), S.rand(120, 200), 0.25, Math.random() < 0.5 ? N.orange : N.yellow, 3);

    // Plan abarbeiten
    waveT += dt;
    while (schedule.length && schedule[0].at <= waveT) { const s = schedule.shift(); spawn(s.type, s.x); }
    if (!schedule.length && !enemies.length && !bossRef) nextWave();

    // Gegner
    for (const e of enemies) {
      e.t += dt; e.hit = Math.max(0, e.hit - dt);
      if (e.type === 'drone' || e.type === 'mini') {
        e.y += e.vy * dt; e.x += Math.sin(e.t * 2.4 + e.ph) * 70 * dt + e.vx * dt;
        e.shotT -= dt * D().shot;
        if (wave >= 3 && e.type === 'drone' && e.shotT <= 0 && e.y > 0) { e.shotT = S.rand(2.2, 3.6); aimed(e, 150 + wave * 6); }
      } else if (e.type === 'diver') {
        if (e.state === 'in') { e.y += e.vy * dt; if (e.y >= e.ty) { e.state = 'aim'; e.patT = 0.7; } }
        else if (e.state === 'aim') { e.patT -= dt; if (e.patT <= 0) { const a = Math.atan2(player.y - e.y, player.x - e.x); e.vx = Math.cos(a) * 320; e.vy = Math.sin(a) * 320; e.state = 'go'; snd.tone(300, 0.2, 'sawtooth', 0.06, 2); } }
        else { e.x += e.vx * dt; e.y += e.vy * dt; }
      } else if (e.type === 'turret') {
        if (e.state === 'in') { e.y += e.vy * dt; if (e.y >= e.ty) { e.state = 'hold'; e.patT = 5; } }
        else if (e.state === 'hold') {
          e.patT -= dt; e.shotT -= dt * D().shot;
          if (e.shotT <= 0) { e.shotT = 1.1; aimed(e, 170 + wave * 5, 0.9, 5); snd.tone(220, 0.08, 'square', 0.06); }
          if (e.patT <= 0) e.state = 'out';
        } else e.y += 90 * dt;
      } else if (e.type === 'splitter') {
        e.y += e.vy * 0.7 * dt; e.x += Math.cos(e.t * 1.3 + e.ph) * 90 * dt;
        e.shotT -= dt * D().shot; if (e.shotT <= 0 && e.y > 0) { e.shotT = 2.4; ring(e, 120, 6, e.t); }
      } else if (e.type === 'boss') {
        if (e.state === 'in') { e.y += e.vy * dt; if (e.y >= e.ty) e.state = 'fight'; }
        else {
          const rage = e.hp < e.max * 0.5 ? 1.5 : 1;
          e.x = w / 2 + Math.sin(e.t * 0.6) * (w * 0.32);
          e.patT += dt;
          if (e.patT > 5) { e.patT = 0; e.pat = (e.pat + 1) % 3; }
          e.shotT -= dt * rage * D().shot;
          if (e.shotT <= 0) {
            if (e.pat === 0) { e.shotT = 0.09; const a = e.t * 3.2; for (const k of [0, Math.PI]) eBullets.push({ x: e.x, y: e.y + 10, vx: Math.cos(a + k) * 170, vy: Math.sin(a + k) * 170, r: 5 }); }
            else if (e.pat === 1) { e.shotT = 0.7; aimed(e, 230, 1.2, 7); }
            else { e.shotT = 1.0; ring(e, 150, 18, e.t, 5.5); }
            if (Math.random() < 0.3) snd.tone(180, 0.05, 'square', 0.04);
          }
        }
      }
      if (e.x < -60 || e.x > w + 60 || e.y > h + 60) e.dead = true, e.gone = true;
      if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r - 2) { hitPlayer(); if (e.type !== 'boss') kill(e); }
    }

    // Kugeln
    for (const b of pBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      for (const e of enemies) {
        if (e.dead || e.y < -10) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 4) { b.dead = true; damage(e, b.dmg); fx.spark(b.x, b.y, S.rand(-60, 60), S.rand(-80, 0), 0.2, N.yellow, 2); break; }
      }
    }
    for (const b of eBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r * 0.45) { b.dead = true; hitPlayer(); }
    }
    pBullets = pBullets.filter((b) => !b.dead && b.y > -20 && b.x > -20 && b.x < w + 20);
    eBullets = eBullets.filter((b) => !b.dead && b.y > -30 && b.y < h + 30 && b.x > -30 && b.x < w + 30);
    enemies = enemies.filter((e) => !e.dead);

    // Beute
    for (const d of drops) {
      d.age = (d.age || 0) + dt;
      if (d.kind === 'shard' && d.age < 0.5) d.vy += 120 * dt; // burst out, then settle into a slow fall
      d.y += d.vy * dt;
      const dist = Math.hypot(d.x - p.x, d.y - p.y) || 1;
      if (d.vx) { d.x += d.vx * dt; d.vx *= Math.exp(-3 * dt); }
      if (d.kind === 'shard') d.vy = S.lerp(d.vy, 70, Math.min(1, dt * 2));
      const mag = 90 + [0, 80, 140, 420][up.magnet], pull = 240 + up.magnet * 140;
      if (dist < mag && (d.age > 0.35 || d.kind !== 'shard')) { d.x += ((p.x - d.x) / dist) * pull * dt; d.y += ((p.y - d.y) / dist) * pull * dt; }
      if (dist < 20) {
        d.got = true;
        if (d.kind === 'shard') { shards++; shardPop = 1; if (Math.random() < 0.35) snd.tone(1300 + Math.random() * 200, 0.04, 'sine', 0.08, 0, 0, (d.x / w) * 2 - 1); }
        else if (d.kind === 'bomb') { p.bombs = Math.min(bombCap(), p.bombs + 1); fl.add(d.x, d.y - 10, T.bombUp, N.orange); }
        else { p.lives = Math.min(6, p.lives + 1); fl.add(d.x, d.y - 10, T.lifeUp, N.pink); }
        if (d.kind !== 'shard') { snd.chord([660, 880], 0.15, 'triangle', 0.18); p.sx = 1.2; p.sy = 0.85; }
      }
    }
    drops = drops.filter((d) => !d.got && d.y < h + 20);
    for (const r of rings) r.r += dt * (r.max > 300 ? 900 : 260);
    rings = rings.filter((r) => r.r < r.max);
    chainT -= dt; if (chainT <= 0) chain = 0;
    if (banner) { banner.t += dt; if (banner.t > 2.2) banner = null; }
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt);
    fx.update(dt); fl.update(dt);
    shardShow = shards < shardShow ? shards : Math.min(shards, shardShow + Math.max(1, (shards - shardShow) * 8 * dt));
    shardPop = Math.max(0, shardPop - dt * 4);
    if (Math.floor(t) !== Math.floor(t - dt) && Math.floor(t) % 10 === 0) saveShip();
    hud.best(score);
  }

  /* ---------- Zeichnen ---------- */
  function riso(path, under, over, dx = 2.5, dy = 2) { S.riso(ctx, path, under, over, dx, dy); }

  function drawEnemy(e) {
    ctx.save(); ctx.translate(e.x, e.y);
    const white = e.hit > 0;
    const col = (c) => (white ? N.paper : c);
    if (e.type === 'drone' || e.type === 'mini') {
      const r = e.r;
      ctx.rotate(Math.sin(e.t * 3) * 0.2);
      riso(() => { ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(r, -r * 0.4); ctx.lineTo(r * 0.4, -r * 0.8); ctx.lineTo(-r * 0.4, -r * 0.8); ctx.lineTo(-r, -r * 0.4); ctx.closePath(); }, N.blue, col(N.pink));
      ctx.fillStyle = N.bg; ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.28, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'diver') {
      const r = e.r;
      if (e.state === 'go') ctx.rotate(Math.atan2(e.vy, e.vx) - Math.PI / 2);
      riso(() => { ctx.beginPath(); ctx.moveTo(0, r * 1.3); ctx.lineTo(r * 0.8, -r); ctx.lineTo(0, -r * 0.5); ctx.lineTo(-r * 0.8, -r); ctx.closePath(); }, N.pink, col(N.yellow));
      if (e.state === 'aim') { ctx.strokeStyle = N.pink; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * 1.6 + Math.sin(t * 30) * 2, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    } else if (e.type === 'turret') {
      const r = e.r;
      riso(() => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); }, N.pink, col(N.green));
      ctx.globalAlpha = 0.5; S.tex.halftoneCircle(ctx, 0, 0, r * 0.95, N.bg, -2.3, 3.6); ctx.globalAlpha = 1;
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      ctx.rotate(a); ctx.fillStyle = N.paper; ctx.fillRect(0, -3, r + 6, 6);
    } else if (e.type === 'splitter') {
      const r = e.r;
      ctx.rotate(e.t * 1.5);
      riso(() => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); }, N.blue, col(N.orange));
      ctx.globalAlpha = 0.55; S.tex.halftoneCircle(ctx, 0, 0, r, N.bg, -2.3, 3.4); ctx.globalAlpha = 1;
      ctx.strokeStyle = N.bg; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
    } else if (e.type === 'boss') {
      const r = e.r;
      // Ring aus Segmenten
      ctx.save(); ctx.rotate(e.t * 0.5);
      for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillStyle = i % 2 ? N.blue : N.pink; ctx.fillRect(r * 0.95, -6, 16, 12); }
      ctx.restore();
      riso(() => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); }, N.pink, col(N.blue), 4, 3);
      ctx.globalAlpha = 0.55; S.tex.halftoneCircle(ctx, 0, 0, r, N.bg, -2.3, 5); ctx.globalAlpha = 1;
      ctx.fillStyle = N.paper; ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2); ctx.fill();
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      ctx.fillStyle = e.hp < e.max * 0.5 ? N.pink : N.bg; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16, r * 0.17, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* Ship with every upgrade visible; tiers change the parts. Drawn into any context (game or shop preview). */
  function drawShip(g, p, sc = 1) {
    const L = up;
    g.save(); g.translate(p.x, p.y); g.scale(sc, sc);
    // magnet ring
    if (L.magnet) { g.save(); g.rotate(t * 0.8); g.strokeStyle = N.green; g.globalAlpha = 0.5; g.lineWidth = 1.2; g.setLineDash([3, 5 - L.magnet]); g.beginPath(); g.arc(0, 0, 28 + L.magnet * 4, 0, Math.PI * 2); g.stroke(); g.restore(); }
    // shield bubble: one ring per charge, recharge arc while empty
    const sm = shieldMax();
    if (sm) {
      for (let i = 0; i < p.shieldUp; i++) { g.strokeStyle = N.blue; g.lineWidth = 2; g.globalAlpha = 0.65 + Math.sin(t * 5 + i) * 0.2; g.beginPath(); g.arc(0, 0, 22 + i * 5, 0, Math.PI * 2); g.stroke(); }
      if (p.shieldUp < sm) { g.globalAlpha = 0.35; g.strokeStyle = N.blue; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 22 + p.shieldUp * 5, -Math.PI / 2, -Math.PI / 2 + (p.shieldT / [1, 14, 9, 9, 6][L.shield]) * Math.PI * 2); g.stroke(); }
      g.globalAlpha = 1;
    }
    g.scale((1 - Math.abs(p.tilt || 0) * 0.25) * (p.sx || 1), p.sy || 1);
    // engines: bigger nacelles and longer flames with Speed
    const eng = 5 + L.speed * 1.5, flame = (8 + Math.random() * 7) * (1 + L.speed * 0.25);
    g.fillStyle = N.orange; g.beginPath(); g.moveTo(-eng, 10); g.lineTo(0, 10 + flame); g.lineTo(eng, 10); g.closePath(); g.fill();
    g.fillStyle = N.yellow; g.beginPath(); g.moveTo(-eng / 2, 10); g.lineTo(0, 10 + flame * 0.6); g.lineTo(eng / 2, 10); g.closePath(); g.fill();
    if (L.speed) for (const sx of [-1, 1]) { g.fillStyle = N.blue; g.fillRect(sx * 13 - 2, 9, 4, 4 + L.speed * 2); g.fillStyle = N.orange; g.fillRect(sx * 13 - 1.5, 13 + L.speed * 2, 3, 3 + L.speed * 2 * Math.random()); }
    // rocket pods under the wings
    if (L.rocket) { const pods = L.rocket >= 3 ? [-12, -7, 7, 12] : [-12, 12]; g.fillStyle = N.orange; for (const x of pods) g.fillRect(x - 2, 4, 4, 6 + Math.min(L.rocket, 2) * 2); }
    S.riso(g, () => { g.beginPath(); g.moveTo(0, -18); g.lineTo(7, -2); g.lineTo(16, 8); g.lineTo(16, 12); g.lineTo(5, 9); g.lineTo(0, 12); g.lineTo(-5, 9); g.lineTo(-16, 12); g.lineTo(-16, 8); g.lineTo(-7, -2); g.closePath(); }, N.pink, N.paper);
    g.fillStyle = N.blue; g.beginPath(); g.ellipse(0, -4, 3.2, 6, 0, 0, Math.PI * 2); g.fill();
    // cannons: one barrel per beam
    g.fillStyle = N.yellow;
    for (const x of FAN[L.multi]) if (x !== 0 || L.multi === 0) g.fillRect(x - 1.5, Math.abs(x) > 10 ? 0 : -8 - (x === 0 ? 6 : 0), 3, 8);
    // laser emitter at the nose
    if (L.laser) { g.fillStyle = p.laserOn > 0 ? N.paper : N.pink; g.beginPath(); g.arc(0, -17, 2 + L.laser * 0.8 + (p.laserOn > 0 ? 1.5 : 0), 0, Math.PI * 2); g.fill(); if (L.laser >= 3) { g.fillRect(-5, -20, 2, 6); g.fillRect(3, -20, 2, 6); } }
    // bomb bay: filled pips for bombs carried
    for (let i = 0; i < bombCap(); i++) { g.fillStyle = i < p.bombs ? N.orange : 'rgba(13,11,26,0.55)'; g.fillRect(-((bombCap() - 1) * 3) / 2 + i * 3 - 1, 4, 2, 2); }
    g.restore();
    // drones orbit outside the ship transform
    const dr = Math.min(3, L.drone);
    for (let i = 0; i < dr; i++) { const a = t * 2.4 + (i * Math.PI * 2) / dr, dx = p.x + Math.cos(a) * 30 * sc, dy = p.y + (Math.sin(a) * 18 - 4) * sc; S.riso(g, () => { g.beginPath(); g.moveTo(dx, dy - 6 * sc); g.lineTo(dx + 5 * sc, dy + 4 * sc); g.lineTo(dx - 5 * sc, dy + 4 * sc); g.closePath(); }, N.pink, N.green, 1.5, 1.5); }
  }

  function drawPlayer() {
    const p = player;
    if (p.laserOn > 0) {
      const k = Math.min(1, p.laserOn * 4), wbeam = (up.laser >= 3 ? 13 : 8) * k;
      ctx.fillStyle = N.pink; ctx.globalAlpha = 0.35; ctx.fillRect(p.x - wbeam, 0, wbeam * 2, p.y - 14);
      ctx.globalAlpha = 0.9; ctx.fillStyle = N.paper; ctx.fillRect(p.x - wbeam * 0.3, 0, wbeam * 0.6, p.y - 14); ctx.globalAlpha = 1;
    }
    if (buyFx > 0) { ctx.strokeStyle = N.yellow; ctx.lineWidth = 2; ctx.globalAlpha = buyFx; ctx.beginPath(); ctx.arc(p.x, p.y, 20 + E.outCubic(1 - buyFx) * 50, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    if (p.inv > 0 && state === 'play' && !S.reduced && Math.floor(t * 14) % 2) return;
    if (p.inv > 0 && S.reduced) ctx.globalAlpha = 0.55;
    drawShip(ctx, p); ctx.globalAlpha = 1;
  }

  function drawPreview() {
    if (!preview || !player) return;
    const g = preview.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = N.bg; g.fillRect(0, 0, preview.width, preview.height);
    const k = buyFx > 0 ? 1 + E.outElastic(1 - buyFx) * 0.12 - 0.12 * buyFx : 1;
    drawShip(g, { x: preview.width / 2, y: preview.height / 2 + 6, tilt: 0, sx: player.sx, sy: player.sy, shieldUp: player.shieldUp, shieldT: player.shieldT, laserOn: 0, bombs: player.bombs }, 2.2 * k);
  }

  function drawDrop(d) {
    if (d.kind === 'shard') { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot + t * 3); ctx.fillStyle = N.paper; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a + 0.5) * 3, Math.sin(a + 0.5) * 3); } ctx.closePath(); ctx.fill(); ctx.fillStyle = N.bg; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(t * 2);
    const c = d.kind === 'bomb' ? N.orange : N.pink;
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(-9, -9, 18, 18); ctx.stroke();
    ctx.rotate(-t * 2);
    ctx.fillStyle = c; ctx.font = '600 11px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.kind === 'bomb' ? 'B' : '♥', 0, 1);
    ctx.restore();
  }

  function draw() {
    const w = st.w, h = st.h;
    ctx.fillStyle = N.bg; ctx.fillRect(0, 0, w, h);
    // Nebel, gekachelt und langsam scrollend
    if (nebula) {
      const sc = Math.max(w / nebula.width, 1.2), nh = nebula.height * sc, off = (nebY % nh);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(nebula, 0, off - nh, nebula.width * sc, nh); ctx.drawImage(nebula, 0, off, nebula.width * sc, nh);
      if (nebula.width * sc < w) { ctx.drawImage(nebula, nebula.width * sc, off - nh, nebula.width * sc, nh); ctx.drawImage(nebula, nebula.width * sc, off, nebula.width * sc, nh); }
      ctx.globalAlpha = 1;
    }
    for (const s of stars) {
      ctx.globalAlpha = s.z * (0.6 + Math.sin(t * 3 + s.tw) * 0.3);
      ctx.fillStyle = s.z === 1 ? N.paper : s.z === 0.5 ? N.yellow : N.blue;
      const sz = s.z === 1 ? 2.5 : 1.6;
      ctx.fillRect(s.x * w, s.y * h, sz, sz * (1 + s.z * 2));
    }
    ctx.globalAlpha = 1;

    ctx.save();
    if (shake > 0) ctx.translate(S.rand(-1, 1) * shake * 10, S.rand(-1, 1) * shake * 10);

    for (const r of rings) {
      const k = r.r / r.max;
      ctx.fillStyle = r.c; ctx.globalAlpha = (1 - k) * 0.9;
      const n = Math.max(12, Math.floor(r.r / 4));
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const sz = 3 * (1 - k) + 1; ctx.rect(r.x + Math.cos(a) * r.r - sz / 2, r.y + Math.sin(a) * r.r - sz / 2, sz, sz); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const d of drops) drawDrop(d);
    for (const e of enemies) drawEnemy(e);
    if (state !== 'over' && player && state !== 'menu') drawPlayer();

    ctx.fillStyle = N.yellow;
    for (const b of pBullets) { ctx.beginPath(); ctx.roundRect(b.x - 2, b.y - 7, 4, 12, 2); ctx.fill(); }
    for (const r of rockets) { ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(Math.atan2(r.vy, r.vx)); ctx.fillStyle = N.paper; ctx.fillRect(-6, -2, 10, 4); ctx.fillStyle = N.orange; ctx.fillRect(-9, -1.5, 3, 3); ctx.restore(); }
    for (const b of eBullets) {
      ctx.fillStyle = N.pink; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = N.paper; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    if (player) { S.dbg.circle(ctx, player.x, player.y, player.r * 0.45); for (const e of enemies) S.dbg.circle(ctx, e.x, e.y, e.r, '#f0f'); for (const b of eBullets) S.dbg.circle(ctx, b.x, b.y, b.r, '#ff0'); }
    fx.draw(ctx); fl.draw(ctx);
    ctx.restore();

    S.tex.grain(ctx, w, h, N.paper, 0.45, 0, -nebY);
    if (flash > 0) { ctx.globalAlpha = flash; ctx.fillStyle = N.paper; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }

    if (player && state !== 'menu') {
      ctx.font = '600 12px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = N.paper; ctx.fillText(T.hudWave(wave), 14, 20);
      for (let i = 0; i < player.lives; i++) { ctx.fillStyle = N.pink; ctx.beginPath(); ctx.moveTo(18 + i * 16, 34); ctx.lineTo(24 + i * 16, 46); ctx.lineTo(12 + i * 16, 46); ctx.closePath(); ctx.fill(); }
      ctx.save(); ctx.translate(14, 62); const pk = 1 + E.outBack(shardPop) * 0.0 + shardPop * 0.18; ctx.scale(pk, pk);
      ctx.fillStyle = N.yellow; ctx.fillText('◆', 0, 0); ctx.fillStyle = N.paper; ctx.fillText(`${Math.round(shardShow)}`, 14, 0); ctx.restore();
      if (player.shieldUp) { ctx.fillStyle = N.blue; ctx.fillText(T.hudShield + (player.shieldUp > 1 ? ' ×2' : ''), 110, 62); }
      if (chain >= 6) { ctx.fillStyle = N.yellow; ctx.fillText(T.chain(Math.min(5, 1 + Math.floor(chain / 6))), 14, 82); }
      // shop button
      ctx.strokeStyle = N.paper; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(w - 38, h - 94, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = N.paper; ctx.textAlign = 'center'; ctx.font = '600 11px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'; ctx.fillText(T.shop.toUpperCase(), w - 38, h - 93); ctx.textAlign = 'left'; ctx.font = '600 12px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace';
      // Bombenknopf
      const bx = w - 38, by = h - 38;
      ctx.globalAlpha = player.bombs ? 1 : 0.35;
      ctx.strokeStyle = N.orange; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = N.orange; ctx.textAlign = 'center'; ctx.font = '600 13px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'; ctx.font = '600 10px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'; ctx.fillText(`BOMB ${player.bombs}`, bx, by + 1);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
      if (bossRef && bossRef.state !== 'in') {
        const bw = Math.min(360, w - 120), x = w / 2 - bw / 2;
        ctx.strokeStyle = N.paper; ctx.lineWidth = 1.5; ctx.strokeRect(x, 14, bw, 9);
        ctx.fillStyle = N.pink; ctx.fillRect(x + 2, 16, (bw - 4) * Math.max(0, bossRef.hp / bossRef.max), 5);
      }
      ctx.textBaseline = 'alphabetic';
    }
    if (banner) {
      const k = banner.t < 0.4 ? E.outBack(banner.t / 0.4) : banner.t > 1.8 ? 1 - (banner.t - 1.8) / 0.4 : 1;
      ctx.save(); ctx.globalAlpha = S.clamp(k, 0, 1); ctx.translate(w / 2, h * 0.36); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
      ctx.font = '700 34px "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = N.paper; ctx.fillText(banner.text, 0, 0);
      ctx.restore();
    }
    if (state === 'count') {
      const n = Math.ceil(countT / 0.6), f = 1 - ((countT / 0.6) % 1);
      const k = S.reduced ? 1 : E.outBack(Math.min(1, f * 2));
      ctx.save(); ctx.translate(w / 2, h * 0.5); ctx.scale(k, k); ctx.globalAlpha = S.reduced ? 1 : 1 - Math.max(0, f - 0.7) / 0.3;
      ctx.font = '700 64px "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = N.paper;
      ctx.fillText(String(Math.max(1, n)), 0, 0); ctx.restore(); ctx.textBaseline = 'alphabetic';
    }
    if (state === 'shop') drawPreview();
  }

  S.dbg.next = () => { if (state !== 'play') return; schedule = []; for (const e of enemies) if (!e.dead) kill(e); };
  makeStars();
  ov.show(T.title, T.intro, T.play, start);
  diff.mount(ov);

  S.loop((dt) => { update(dt); draw(); });
})();
