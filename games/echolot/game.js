/* Sonar: dive in the dark and see with sound. Style: chalk and ink on blueprint paper. */
(() => {
  const S = Shell, snd = S.sound, E = S.ease;
  const cv = document.getElementById('c');
  const st = S.stage(cv);
  const ctx = st.ctx;
  const hud = S.hud('echolot');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  const T = {
    title: 'Sonar', play: 'Dive', retry: 'Dive again', record: 'New best', lost: 'Hull breached',
    intro: 'Hold to steer, tap to ping. Pings cost battery and wake things up. Find the beacon.',
    introTouch: 'Left thumb steers with the stick, the button pings. Pings cost battery and wake things up. Find the beacon.',
    pingBtn: 'PING',
    over: (d, s, b) => `You reached <b>depth ${d}</b> with <b>${s}</b> points. Best: <b>${b}</b>.`,
    dock: (d) => `Dock · depth ${d} cleared`, dockInfo: (p, h, mh, b) => `<b>${p}</b> pearls. Hull ${h}/${mh}, battery ${b}%.`,
    next: (d, z) => `Dive to depth ${d}: ${z}`, full: 'Full',
    zone: (d, z) => `Depth ${d} · ${z}`, hull: 'HULL', battery: 'BATTERY', pearls: 'PEARLS', depth: 'DEPTH',
    hullUp: 'Hull +1', cell: 'Battery +35%', secret: 'Hidden pocket', low: 'Battery low',
    shop: [
      ['cap', 'Bigger Battery', 'Pings cost less'],
      ['hull', 'Reinforced Hull', '+1 hull point'],
      ['quiet', 'Quiet Ping', 'Mines and anglers hear less'],
      ['range', 'Strong Emitter', 'Ping reaches further'],
      ['engine', 'New Engine', 'Faster and nimbler'],
      ['repair', 'Repair', 'Hull back to full'],
      ['charge', 'Recharge', 'Battery back to full'],
    ],
  };

  /* Blueprint palette from the shared family: pale chalk lines on deep ink blue */
  const A = S.art.pal;
  const C = { bg: '#0f1b2b', paper: '#13233a', rock: '#d9e4ee', metal: '#f6bf31', thin: '#9fb3c8', sub: A.light, mine: '#ff5d6c', exit: A.yellow, pearl: '#b9c8ff', fix: '#7fe0a8', fish: '#7fe0a8', angler: '#ff8a4c', jelly: '#d58cff', dim: 'rgba(217,228,238,0.35)', grid: 'rgba(217,228,238,0.05)' };
  S.setWear(C.bg);

  const CS = 22;
  const RING_SPEED = 430;
  const FADE = 3.2;
  const ROCK = 1, METAL = 2, THIN = 3;

  /* Depth zones. Each one adds something; the cycle repeats deeper with more of everything. */
  const ZONES = [
    { name: 'The Reef', fill: 0.44, metal: 0, fish: 3, anglers: 0, jellies: 0, secrets: 1 },
    { name: 'The Wreck', fill: 0.45, metal: 3, fish: 2, anglers: 1, jellies: 0, secrets: 1 },
    { name: 'The Trench', fill: 0.49, metal: 1, fish: 1, anglers: 2, jellies: 3, secrets: 2 },
    { name: 'The Caves', fill: 0.47, metal: 1, fish: 2, anglers: 3, jellies: 2, secrets: 3 },
  ];
  const zoneOf = (lv) => ZONES[Math.min(ZONES.length - 1, Math.floor((lv - 1) / 2))];

  let cols, rows, grid, rock, lit, start, exit, sub, mines, items, creatures, pings, beaconT, level, score, hull, battery, pearls, state = 'menu', t = 0, shake = 0, camX = 0, camY = 0, levelTime = 0, echoDir = null, banner = null, lowWarn = 0;
  let up;
  const diff = S.difficulty('echolot');
  const D = () => diff.pick({ easy: { hull: 4, mines: 0.6, msp: 0.8, cost: 9, trickle: 1.6 }, normal: { hull: 3, mines: 1, msp: 1, cost: 12, trickle: 1.1 }, hard: { hull: 2, mines: 1.4, msp: 1.25, cost: 15, trickle: 0.7 } });
  const baseUp = () => ({ cap: 0, maxHull: D().hull, quiet: 0, engine: 0, range: 0 });

  const ringMax = () => 520 + up.range * 110;
  const wakeRange = () => 600 * (1 - up.quiet * 0.25);
  const pingCost = () => D().cost * (1 - up.cap * 0.18);

  function idx(x, y) { return y * cols + x; }
  const out = (x, y) => x < 0 || y < 0 || x >= cols || y >= rows;
  /* the sub can slip through thin rock, everything else treats it as wall */
  function isWall(x, y) { if (out(x, y)) return true; const g = grid[idx(x, y)]; return g === ROCK || g === METAL; }
  function isSolid(x, y) { return out(x, y) || grid[idx(x, y)] !== 0; }

  function generate() {
    const z = zoneOf(level);
    cols = 46 + Math.min(level * 4, 40);
    rows = 30 + Math.min(level * 2, 24);
    for (let attempt = 0; attempt < 40; attempt++) {
      grid = new Uint8Array(cols * rows);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
        grid[idx(x, y)] = border || Math.random() < z.fill ? 1 : 0;
      }
      for (let it = 0; it < 5; it++) {
        const ng = new Uint8Array(cols * rows);
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          let n = 0;
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && isSolid(x + i, y + j)) n++;
          const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
          ng[idx(x, y)] = border || n >= 5 || (it < 2 && n <= 1) ? 1 : 0;
        }
        grid = ng;
      }
      let s = null;
      for (let x = 2; x < cols / 3 && !s; x++) for (let dy = 0; dy < rows / 2 && !s; dy++) {
        for (const y of [Math.floor(rows / 2) + dy, Math.floor(rows / 2) - dy]) {
          if (y > 1 && y < rows - 2 && !isSolid(x, y) && !isSolid(x + 1, y) && !isSolid(x, y + 1) && !isSolid(x - 1, y) && !isSolid(x, y - 1)) { s = { x, y }; break; }
        }
      }
      if (!s) continue;
      const dist = new Int32Array(cols * rows).fill(-1);
      const q = [idx(s.x, s.y)]; dist[q[0]] = 0; let reach = 0, far = q[0];
      for (let qi = 0; qi < q.length; qi++) {
        const k = q[qi]; reach++;
        const x = k % cols, y = (k / cols) | 0;
        if (dist[k] > dist[far]) far = k;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!isSolid(nx, ny) && dist[idx(nx, ny)] < 0) { dist[idx(nx, ny)] = dist[k] + 1; q.push(idx(nx, ny)); }
        }
      }
      let open = 0; for (let k = 0; k < grid.length; k++) if (!grid[k]) open++;
      if (reach < open * 0.6 || dist[far] < cols * 0.9) continue;
      for (let k = 0; k < grid.length; k++) if (!grid[k] && dist[k] < 0) grid[k] = 1;
      start = s; exit = { x: far % cols, y: (far / cols) | 0 };
      rock = S.tex.noiseField(cols, rows, 5, 11 + level * 7, 3);
      lit = new Float32Array(cols * rows).fill(-99);

      const openCells = [];
      for (let k = 0; k < grid.length; k++) if (!grid[k] && dist[k] > 6) openCells.push(k);
      S.shuffle(openCells);
      const cx = (k) => (k % cols) * CS + CS / 2, cy = (k) => ((k / cols) | 0) * CS + CS / 2;
      const far2 = (list, x, y, d) => list.every((o) => Math.hypot(o.x - x, o.y - y) > d);

      // wreck plates: runs of metal along walls
      let wrecks = 0;
      for (const k of openCells) {
        if (wrecks >= z.metal + Math.floor(level / 4)) break;
        const x = k % cols, y = (k / cols) | 0;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          if (grid[idx(x + dx, y + dy)] !== ROCK) continue;
          const lx = dy ? 1 : 0, ly = dx ? 1 : 0, len = S.randInt(4, 8);
          for (let i = -2; i < len; i++) { const gx = x + dx + lx * i, gy = y + dy + ly * i; if (!out(gx, gy) && grid[idx(gx, gy)] === ROCK) grid[idx(gx, gy)] = METAL; }
          wrecks++; break;
        }
      }

      mines = [];
      const want = Math.round((3 + level * 2) * D().mines);
      for (const k of openCells) {
        if (mines.length >= want) break;
        if (dist[k] < 12 || dist[k] > dist[far] - 3) continue;
        const mx = cx(k), my = cy(k);
        if (!far2(mines, mx, my, CS * 6)) continue;
        const patrol = level >= 3 && Math.random() < 0.3;
        const ang = Math.random() * Math.PI * 2;
        mines.push({ x: mx, y: my, tx: mx, ty: my, lit: -99, hunt: 0, wake: Infinity, ph: Math.random() * 6, patrol, vx: patrol ? Math.cos(ang) * 40 : 0, vy: patrol ? Math.sin(ang) * 40 : 0 });
      }
      items = [];
      const pearlsWanted = 7 + level * 2;
      let np = 0;
      for (const k of openCells) {
        if (np >= pearlsWanted) break;
        const x = cx(k), y = cy(k);
        if (far2(items, x, y, CS * 4) && far2(mines, x, y, CS * 2)) { items.push({ kind: 'pearl', x, y, lit: -99, ph: Math.random() * 6 }); np++; }
      }
      const extras = [['fix', 1 + (level > 3 ? 1 : 0)], ['cell', 2 + Math.floor(level / 3)]];
      for (const [kind, n] of extras) {
        let c = 0;
        for (const k of openCells.slice().reverse()) {
          if (c >= n) break;
          if (dist[k] < dist[far] * 0.25) continue;
          const x = cx(k), y = cy(k);
          if (far2(items, x, y, CS * 4)) { items.push({ kind, x, y, lit: -99, ph: 0 }); c++; }
        }
      }

      // hidden pockets: a thin rock door into a small chamber with pearls
      let pockets = 0;
      for (const k of openCells) {
        if (pockets >= z.secrets) break;
        const x = k % cols, y = (k / cols) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const mx = x + dx * 3, my = y + dy * 3;
          if (mx < 3 || my < 3 || mx > cols - 4 || my > rows - 4) continue;
          let ok = grid[idx(x + dx, y + dy)] === ROCK;
          for (let j = -2; j <= 2 && ok; j++) for (let i = -2; i <= 2 && ok; i++) if (grid[idx(mx + i, my + j)] !== ROCK) ok = false;
          if (!ok) continue;
          grid[idx(x + dx, y + dy)] = THIN;
          grid[idx(x + dx * 2, y + dy * 2)] = 0;
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) grid[idx(mx + i, my + j)] = 0;
          items.push({ kind: 'pearl', x: mx * CS + CS / 2 - 6, y: my * CS + CS / 2, lit: -99, ph: 1, secret: true });
          items.push({ kind: 'pearl', x: mx * CS + CS / 2 + 6, y: my * CS + CS / 2 + 4, lit: -99, ph: 2, secret: true });
          pockets++; break;
        }
      }

      creatures = [];
      const spawnC = (kind, n) => {
        let c = 0;
        for (const k of openCells) {
          if (c >= n) break;
          if (dist[k] < 10) continue;
          const x = cx(k), y = cy(k);
          if (!far2(creatures, x, y, CS * 5) || !far2(mines, x, y, CS * 3)) continue;
          const a = Math.random() * Math.PI * 2;
          creatures.push({ kind, x, y, hx: x, hy: y, vx: Math.cos(a) * 20, vy: Math.sin(a) * 20, lit: -99, ph: Math.random() * 6, flee: 0, hunt: 0, wake: Infinity, tx: x, ty: y, sq: 0 });
          c++;
        }
      };
      spawnC('fish', z.fish + Math.floor(level / 3));
      spawnC('angler', Math.round((z.anglers + Math.floor(level / 5)) * D().mines));
      spawnC('jelly', z.jellies + Math.floor(level / 4));
      return true;
    }
    return false;
  }

  function newLevel() {
    generate();
    sub = { x: start.x * CS + CS / 2, y: start.y * CS + CS / 2, vx: 0, vy: 0, hitCd: 0, sx: 1, sy: 1 };
    pings = []; beaconT = 0; levelTime = 0; echoDir = null;
    camX = sub.x - st.w / 2; camY = sub.y - st.h / 2;
    banner = { text: T.zone(level, zoneOf(level).name), t: 0 };
  }

  function startGame() { level = S.debug.on ? Math.max(1, S.debug.start) : 1; score = 0; pearls = S.debug.on ? S.debug.money || 0 : 0; up = baseUp(); hull = up.maxHull; battery = 100; hud.score(0); fx.clear(); newLevel(); state = 'play'; }

  const panOf = (x) => S.clamp((x - sub.x) / 420, -1, 1);

  function ping() {
    if (state !== 'play') return;
    if (battery < pingCost()) { lowWarn = 1; snd.tone(180, 0.15, 'square', 0.08); return; }
    battery -= pingCost();
    const o = { x: sub.x, y: sub.y, t0: t, seed: Math.random() * 10 };
    pings.push(o);
    sub.sx = 1.25; sub.sy = 0.8;
    const R = ringMax();
    let metalEcho = null, md = 1e9;
    for (let k = 0; k < grid.length; k++) {
      if (!grid[k]) continue;
      const cx = (k % cols) * CS + CS / 2, cy = ((k / cols) | 0) * CS + CS / 2;
      const d = Math.hypot(cx - o.x, cy - o.y);
      if (d < R) {
        lit[k] = t + d / RING_SPEED;
        if (grid[k] === METAL && d < md) { md = d; metalEcho = { x: cx, d }; }
      }
    }
    const wr = Math.min(R, wakeRange());
    for (const m of mines) {
      const d = Math.hypot(m.x - o.x, m.y - o.y);
      if (d < R) m.lit = t + d / RING_SPEED;
      if (d < wr) { m.wake = t + d / RING_SPEED; m.tx = o.x; m.ty = o.y; }
    }
    let lifeEcho = null, ld = 1e9;
    for (const c of creatures) {
      const d = Math.hypot(c.x - o.x, c.y - o.y);
      if (d < R) { c.lit = t + d / RING_SPEED; if (d < ld) { ld = d; lifeEcho = { x: c.x, d }; } }
      if (c.kind === 'fish' && d < R * 0.8) { c.flee = 2.5; const a = Math.atan2(c.y - o.y, c.x - o.x); c.vx = Math.cos(a) * 140; c.vy = Math.sin(a) * 140; c.sq = 1; }
      if (c.kind === 'angler' && d < wr) { c.wake = t + d / RING_SPEED; c.tx = o.x; c.ty = o.y; }
    }
    for (const it of items) { const d = Math.hypot(it.x - o.x, it.y - o.y); if (d < R) it.lit = t + d / RING_SPEED; }
    const ex = exit.x * CS + CS / 2, ey = exit.y * CS + CS / 2;
    echoDir = { a: Math.atan2(ey - sub.y, ex - sub.x), t };
    // the ping itself, then echoes: rock is a dull thud, metal rings, living things chirp; panned by direction
    snd.tone(1400, 0.6, 'sine', 0.25, 0.55);
    snd.tone(700, 0.4, 'sine', 0.08, 0.9, 0.35);
    if (metalEcho) snd.tone(2200, 0.35, 'triangle', 0.08, 0.98, Math.min(1.2, metalEcho.d / RING_SPEED) * 2, panOf(metalEcho.x));
    if (lifeEcho) { const dl = Math.min(1.2, lifeEcho.d / RING_SPEED) * 2; snd.tone(900, 0.08, 'sine', 0.08, 1.6, dl, panOf(lifeEcho.x)); snd.tone(1200, 0.06, 'sine', 0.06, 1.4, dl + 0.07, panOf(lifeEcho.x)); }
    snd.tone(520, 0.25, 'sine', 0.05, 0.9, Math.min(1.4, Math.hypot(ex - sub.x, ey - sub.y) / RING_SPEED), panOf(ex));
  }

  function collideCircle(o, r, bounce, solid = isWall) {
    const gx = Math.floor(o.x / CS), gy = Math.floor(o.y / CS);
    let hit = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j;
      if (!solid(cx, cy)) continue;
      const nx = S.clamp(o.x, cx * CS, cx * CS + CS), ny = S.clamp(o.y, cy * CS, cy * CS + CS);
      const dx = o.x - nx, dy = o.y - ny, d = Math.hypot(dx, dy);
      if (d < r) {
        const ux = d > 0.001 ? dx / d : 0, uy = d > 0.001 ? dy / d : -1;
        o.x = nx + ux * r; o.y = ny + uy * r;
        const vn = o.vx * ux + o.vy * uy;
        if (vn < 0) { o.vx -= (1 + bounce) * vn * ux; o.vy -= (1 + bounce) * vn * uy; hit = Math.max(hit, -vn); }
      }
    }
    return hit;
  }

  function damage(src) {
    if ((S.debug.on && S.debug.god)) { shake = 0.2 * S.shakeScale; return; }
    hull -= 1; shake = 0.35 * S.shakeScale; sub.hitCd = 1; S.hitstop(70);
    sub.sx = 0.7; sub.sy = 1.3;
    fx.burst(sub.x, sub.y, src || C.mine, 16, 180, 0.7, 3);
    snd.noise(0.35, 0.4, 260); snd.tone(110, 0.3, 'square', 0.15, 0.6);
    if (hull <= 0) {
      state = 'over';
      const rec = hud.best(score);
      setTimeout(() => ov.show(rec && score > 0 ? T.record : T.lost, T.over(level, score, hud.bestValue), T.retry, startGame), 700);
      setTimeout(() => diff.mount(ov), 710);
    }
  }

  /* Dock between dives */
  const SHOP = [
    { id: 'cap', max: 3, cost: (lv) => 6 + lv * 4, can: () => up.cap < 3, buy: () => { up.cap++; } },
    { id: 'hull', max: 3, cost: (lv) => 8 + lv * 4, can: () => up.maxHull < 6, buy: () => { up.maxHull++; hull++; } },
    { id: 'quiet', max: 2, cost: (lv) => 10 + lv * 6, can: () => up.quiet < 2, buy: () => { up.quiet++; } },
    { id: 'range', max: 2, cost: (lv) => 8 + lv * 5, can: () => up.range < 2, buy: () => { up.range++; } },
    { id: 'engine', max: 2, cost: (lv) => 6 + lv * 5, can: () => up.engine < 2, buy: () => { up.engine++; } },
    { id: 'repair', cost: () => 4, can: () => hull < up.maxHull, buy: () => { hull = up.maxHull; } },
    { id: 'charge', cost: () => 3, can: () => battery < 99, buy: () => { battery = 100; } },
  ];
  const NAMES = Object.fromEntries(T.shop.map(([id, n, i]) => [id, { n, i }]));
  const lvOf = (id) => (id === 'hull' ? up.maxHull - D().hull : up[id] || 0);

  function openShop() {
    const render = () => {
      const rows = SHOP.map((s) => {
        const c = s.cost(lvOf(s.id));
        const dis = !s.can() || pearls < c;
        const pips = s.max ? ` <span class="pips">${'■'.repeat(lvOf(s.id))}${'□'.repeat(Math.max(0, s.max - lvOf(s.id)))}</span>` : '';
        return `<button data-buy="${s.id}" ${dis ? 'disabled' : ''}><span>${NAMES[s.id].n}${pips}<small>${NAMES[s.id].i}</small></span><span>${s.can() ? c + ' ◯' : T.full}</span></button>`;
      }).join('');
      ov.show(T.dock(level - 1), T.dockInfo(pearls, hull, up.maxHull, Math.round(battery)), T.next(level, zoneOf(level).name), () => { newLevel(); state = 'play'; });
      ov.extra(`<div class="shop">${rows}</div>`);
      document.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
        const s = SHOP.find((x) => x.id === b.dataset.buy); const c = s.cost(lvOf(s.id));
        if (pearls >= c && s.can()) { pearls -= c; s.buy(); snd.chord([523, 659], 0.2, 'triangle', 0.2); render(); }
      }));
    };
    render();
  }

  const keys = S.keys((k) => { if (k === ' ' && !ov.open) ping(); });
  const ptr = S.pointer(cv);
  let downAt = 0, downX = 0, downY = 0, moved = false;
  ptr.onDown = (x, y, e) => { if (e.pointerType === 'touch') return; downAt = performance.now(); downX = x; downY = y; moved = false; };
  ptr.onUp = (x, y, e) => { if (e.pointerType === 'touch') return; if (performance.now() - downAt < 230 && Math.hypot(x - downX, y - downY) < 14 && !moved) ping(); };

  // Touch: a floating stick for the left thumb and a ping button for the right one, both multi-touch
  const touch = { on: matchMedia('(pointer: coarse)').matches, stick: null, btn: null, press: 0, ax: 0, ay: 0 };
  const STICK_R = 46;
  const btnPos = () => ({ x: st.w - 70, y: st.h - 78, r: 36 });
  const restPos = () => ({ x: 82, y: st.h - 92 });
  function tpos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  cv.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || ov.open) return;
    touch.on = true;
    const p = tpos(e), b = btnPos();
    if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 18) { touch.btn = e.pointerId; touch.press = 1; ping(); return; }
    if (touch.stick) return;
    // the base appears under the thumb, kept away from the edges
    const bx = S.clamp(p.x, STICK_R + 14, st.w - STICK_R - 14), by = S.clamp(p.y, STICK_R + 80, st.h - STICK_R - 14);
    touch.stick = { id: e.pointerId, bx, by, x: p.x, y: p.y, k: 0 };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!touch.stick || e.pointerId !== touch.stick.id) return;
    const p = tpos(e); touch.stick.x = p.x; touch.stick.y = p.y;
  });
  const tEnd = (e) => {
    if (touch.stick && e.pointerId === touch.stick.id) touch.stick = null;
    if (e.pointerId === touch.btn) touch.btn = null;
  };
  cv.addEventListener('pointerup', tEnd); cv.addEventListener('pointercancel', tEnd);
  function stickVec() {
    const s = touch.stick;
    if (!s) return [0, 0];
    let dx = (s.x - s.bx) / STICK_R, dy = (s.y - s.by) / STICK_R;
    const m = Math.hypot(dx, dy);
    if (m < 0.14) return [0, 0];
    const k = Math.min(1, (m - 0.14) / 0.86) / m; // dead zone, then full range
    return [dx * k, dy * k];
  }
  function drawTouch(w, h) {
    const s = touch.stick, rest = restPos();
    const bx = s ? s.bx : rest.x, by = s ? s.by : rest.y;
    const [vx, vy] = stickVec();
    ctx.save();
    ctx.globalAlpha = s ? 0.85 : 0.35;
    ctx.strokeStyle = C.rock; ctx.lineWidth = S.art.lw.detail; inkRing(bx, by, STICK_R, 7);
    ctx.lineWidth = S.art.lw.fine; ctx.globalAlpha *= 0.5; inkRing(bx, by, STICK_R * 0.55, 11);
    ctx.globalAlpha = s ? 0.9 : 0.4;
    const kx = bx + vx * STICK_R, ky = by + vy * STICK_R;
    ctx.fillStyle = C.sub; ctx.beginPath(); ctx.arc(kx, ky, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(kx + 3, ky + 3, 7, 0, Math.PI * 2); ctx.fill(); // offset print shadow inside the knob
    const b = btnPos(), sc = 1 - touch.press * 0.12, low = battery < pingCost();
    ctx.translate(b.x, b.y); ctx.scale(sc, sc);
    ctx.globalAlpha = touch.btn != null ? 1 : 0.75;
    ctx.strokeStyle = low ? C.mine : C.exit; ctx.lineWidth = S.art.lw.outline; inkRing(0, 0, b.r, 3);
    ctx.lineWidth = S.art.lw.fine; inkRing(0, 0, b.r * 0.62, 5); inkRing(0, 0, b.r * 0.3, 9);
    ctx.fillStyle = low ? C.mine : C.exit; ctx.font = '700 11px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(T.pingBtn, 0, b.r + 14);
    ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  function updateCreatures(dt) {
    for (const c of creatures) {
      c.sq = Math.max(0, c.sq - dt * 3);
      if (c.kind === 'fish') {
        c.flee = Math.max(0, c.flee - dt);
        if (!c.flee) { c.vx += (c.hx - c.x) * 0.15 * dt + S.rand(-30, 30) * dt; c.vy += (c.hy - c.y) * 0.15 * dt + S.rand(-30, 30) * dt; }
        const sp = Math.hypot(c.vx, c.vy), mx = c.flee ? 160 : 34;
        if (sp > mx) { c.vx *= mx / sp; c.vy *= mx / sp; }
        const o = { x: c.x + c.vx * dt, y: c.y + c.vy * dt, vx: c.vx, vy: c.vy };
        collideCircle(o, 6, 0.6, isSolid); c.x = o.x; c.y = o.y; c.vx = o.vx; c.vy = o.vy;
      } else if (c.kind === 'angler') {
        if (t >= c.wake) { c.hunt = 4; c.wake = Infinity; c.sq = 1; }
        if (c.hunt > 0) {
          c.hunt -= dt;
          const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy) || 1;
          const sp = (60 + level * 6) * D().msp;
          c.vx = S.lerp(c.vx, (dx / d) * sp, Math.min(1, dt * 2)); c.vy = S.lerp(c.vy, (dy / d) * sp, Math.min(1, dt * 2));
          if (d < 8) c.hunt = 0;
        } else { c.vx *= Math.exp(-dt); c.vy *= Math.exp(-dt); }
        const o = { x: c.x + c.vx * dt, y: c.y + c.vy * dt, vx: c.vx, vy: c.vy };
        collideCircle(o, 9, 0.2, isSolid); c.x = o.x; c.y = o.y; c.vx = o.vx; c.vy = o.vy;
        if (state === 'play' && sub.hitCd <= 0 && Math.hypot(c.x - sub.x, c.y - sub.y) < 16) { damage(C.angler); c.hunt = 0; c.vx = -c.vx * 3; c.vy = -c.vy * 3; }
      } else {
        // jellies drift on a slow loop and sting on contact
        c.x = c.hx + Math.sin(t * 0.4 + c.ph) * 26; c.y = c.hy + Math.sin(t * 0.7 + c.ph) * 18;
        if (state === 'play' && sub.hitCd <= 0 && Math.hypot(c.x - sub.x, c.y - sub.y) < 15) damage(C.jelly);
      }
    }
  }

  function update(dt) {
    t += dt;
    touch.press = Math.max(0, touch.press - dt * 6);
    if (sub) { sub.sx = S.lerp(sub.sx, 1, Math.min(1, dt * 8)); sub.sy = S.lerp(sub.sy, 1, Math.min(1, dt * 8)); }
    if (banner) { banner.t += dt; if (banner.t > 2.6) banner = null; }
    lowWarn = Math.max(0, lowWarn - dt * 1.5);
    if (state === 'play') {
      levelTime += dt;
      battery = Math.min(100, battery + D().trickle * dt);
      let ax = 0, ay = 0;
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) ax -= 1;
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) ax += 1;
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) ay -= 1;
      if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) ay += 1;
      if (touch.stick) { const [vx, vy] = stickVec(); ax += vx; ay += vy; }
      if (ptr.down && ptr.type !== 'touch' && performance.now() - downAt > 120) {
        const wx = ptr.x + camX, wy = ptr.y + camY;
        const dx = wx - sub.x, dy = wy - sub.y, d = Math.hypot(dx, dy);
        if (d > 10) { ax = dx / d; ay = dy / d; moved = true; }
      }
      const al = Math.max(1, Math.hypot(ax, ay)); // a half-pushed stick gives half thrust
      const acc = 420 * (1 + up.engine * 0.18);
      sub.vx += (ax / al) * acc * dt; sub.vy += (ay / al) * acc * dt;
      const drag = Math.exp(-2.1 * dt); sub.vx *= drag; sub.vy *= drag;
      sub.x += sub.vx * dt; sub.y += sub.vy * dt;
      if ((ax || ay) && Math.random() < dt * 14) fx.spark(sub.x - (sub.vx / 30), sub.y - (sub.vy / 30), S.rand(-10, 10), S.rand(-20, -5), 0.8, C.dim, 2);
      const imp = collideCircle(sub, 7, 0.35);
      sub.hitCd = Math.max(0, sub.hitCd - dt);
      if (imp > 110 && sub.hitCd <= 0) damage(C.rock);
      else if (imp > 30) { shake = Math.max(shake, 0.1 * S.shakeScale); sub.sx = 0.85; sub.sy = 1.15; if (imp > 50) snd.tone(90, 0.1, 'sine', 0.2); }
      // slipping through thin rock reveals the pocket
      const gk = idx(Math.floor(sub.x / CS), Math.floor(sub.y / CS));
      if (grid[gk] === THIN) { grid[gk] = 0; fl.add(sub.x, sub.y - 14, T.secret, C.pearl); snd.chord([659, 784, 988], 0.3, 'triangle', 0.15); fx.burst(sub.x, sub.y, C.thin, 14, 120, 0.6, 2); }

      for (let i = mines.length - 1; i >= 0; i--) {
        const m = mines[i];
        if (t >= m.wake) { m.hunt = 1; m.wake = Infinity; }
        if (m.hunt) {
          const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
          const sp = (48 + level * 7) * D().msp;
          if (d > 4) { const o = { x: m.x + (dx / d) * sp * dt, y: m.y + (dy / d) * sp * dt, vx: 0, vy: 0 }; collideCircle(o, 8, 0, isSolid); m.x = o.x; m.y = o.y; }
          else m.hunt = 0;
        } else if (m.patrol) {
          const o = { x: m.x + m.vx * dt, y: m.y + m.vy * dt, vx: m.vx, vy: m.vy };
          collideCircle(o, 8, 1, isSolid); m.x = o.x; m.y = o.y; m.vx = o.vx; m.vy = o.vy;
        }
        if (state === 'play' && Math.hypot(m.x - sub.x, m.y - sub.y) < 15) { mines.splice(i, 1); fx.burst(m.x, m.y, C.mine, 24, 220, 0.9, 3); damage(C.mine); }
      }
      updateCreatures(dt);
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (Math.hypot(it.x - sub.x, it.y - sub.y) < 16) {
          items.splice(i, 1);
          sub.sx = 1.2; sub.sy = 0.85;
          if (it.kind === 'pearl') { const v = it.secret ? 25 : 10; pearls++; score += v; hud.score(score); fl.add(it.x, it.y - 10, `+${v}`, C.pearl); snd.tone(1200, 0.12, 'sine', 0.2); snd.tone(1600, 0.1, 'sine', 0.15, 1, 0.06); fx.burst(it.x, it.y, C.pearl, 10, 120, 0.5, 2); }
          else if (it.kind === 'cell') { battery = Math.min(100, battery + 35); fl.add(it.x, it.y - 10, T.cell, C.metal); snd.chord([440, 660], 0.2, 'triangle', 0.15); fx.burst(it.x, it.y, C.metal, 12, 130, 0.5, 2); }
          else { hull = Math.min(up.maxHull, hull + 1); fl.add(it.x, it.y - 10, T.hullUp, C.fix); snd.chord([392, 523, 659], 0.25, 'triangle', 0.18); fx.burst(it.x, it.y, C.fix, 14, 140, 0.6, 3); }
        }
      }

      const ex = exit.x * CS + CS / 2, ey = exit.y * CS + CS / 2;
      if (state === 'play' && Math.hypot(sub.x - ex, sub.y - ey) < 18) {
        const bonus = Math.max(0, Math.round(90 - levelTime)) + hull * 10;
        score += 100 + bonus; hud.score(score); hud.best(score);
        fl.add(ex, ey - 14, `+${100 + bonus}`, C.exit);
        fx.burst(ex, ey, C.exit, 30, 220, 1, 3);
        snd.chord([523, 659, 784, 1046], 0.4, 'triangle', 0.2);
        level += 1;
        state = 'between';
        setTimeout(openShop, 900);
      }
    } else if (state === 'menu' && creatures) updateCreatures(dt);
    beaconT += dt; if (beaconT > 3.6) { beaconT = 0; }
    pings = pings.filter((p) => t - p.t0 < ringMax() / RING_SPEED + 0.2);
    const w = st.w, h = st.h;
    if (sub) { camX = S.lerp(camX, sub.x - w / 2, Math.min(1, dt * 4)); camY = S.lerp(camY, sub.y - h / 2, Math.min(1, dt * 4)); }
    fx.update(dt); fl.update(dt);
    shake = Math.max(0, shake - dt);
  }

  function visAlpha(litAt, x, y, nearR) {
    const age = t - litAt;
    let a = age >= 0 && age < FADE ? 1 - E.inOutQuad(age / FADE) : 0;
    const near = Math.hypot(x - sub.x, y - sub.y);
    if (near < nearR) a = Math.max(a, (1 - near / nearR) * 0.8);
    return a;
  }

  /* hand-drawn ring: a slightly uneven circle, same wobble every frame for one ping */
  function inkRing(x, y, r, seed) {
    ctx.beginPath();
    const n = Math.max(24, Math.min(96, Math.floor(r / 6)));
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (1 + 0.012 * Math.sin(a * 5 + seed) + 0.008 * Math.sin(a * 11 + seed * 2));
      if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.stroke();
  }

  function drawCreature(c, a) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.globalAlpha = a;
    const k = 1 + E.outBack(c.sq) * 0.25 * c.sq;
    if (c.kind === 'fish') {
      ctx.rotate(Math.atan2(c.vy, c.vx)); ctx.scale(k, 1 / k);
      ctx.strokeStyle = C.fish; ctx.lineWidth = S.art.lw.detail;
      for (let i = 0; i < 3; i++) { const ox = -i * 9, oy = Math.sin(t * 6 + c.ph + i) * 3 + (i - 1) * 5; ctx.beginPath(); ctx.ellipse(ox, oy, 5, 2.6, 0, 0, Math.PI * 2); ctx.moveTo(ox - 5, oy); ctx.lineTo(ox - 9, oy - 3); ctx.lineTo(ox - 9, oy + 3); ctx.closePath(); ctx.stroke(); }
    } else if (c.kind === 'angler') {
      ctx.scale(k, k);
      ctx.strokeStyle = C.angler; ctx.fillStyle = C.angler; ctx.lineWidth = S.art.lw.outline;
      const dir = c.vx >= 0 ? 1 : -1; ctx.scale(dir, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, 2); ctx.lineTo(4, 4); ctx.lineTo(10, 5); ctx.stroke();
      ctx.lineWidth = S.art.lw.fine; ctx.beginPath(); ctx.moveTo(4, -6); ctx.quadraticCurveTo(10, -16, 16, -10); ctx.stroke();
      ctx.globalAlpha = a * (0.6 + Math.sin(t * 7 + c.ph) * 0.4); ctx.beginPath(); ctx.arc(16, -10, 2.4, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = C.jelly; ctx.lineWidth = S.art.lw.detail;
      const pulse = 1 + Math.sin(t * 3 + c.ph) * 0.12;
      ctx.scale(pulse, 1 / pulse);
      ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI, 0); ctx.closePath(); ctx.stroke();
      ctx.lineWidth = S.art.lw.fine;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 3, 0); ctx.quadraticCurveTo(i * 3 + Math.sin(t * 2 + i) * 3, 7, i * 3, 14); ctx.stroke(); }
    }
    ctx.restore();
  }

  function draw() {
    const w = st.w, h = st.h;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    if (!grid) return;
    ctx.save();
    if (shake > 0) ctx.translate(S.rand(-1, 1) * shake * 12, S.rand(-1, 1) * shake * 12);
    ctx.translate(-Math.round(camX), -Math.round(camY));

    // blueprint grid, two weights
    ctx.strokeStyle = C.grid; ctx.lineWidth = S.art.lw.fine;
    const gx0 = Math.floor(camX / 22) * 22, gy0 = Math.floor(camY / 22) * 22;
    ctx.beginPath();
    for (let x = gx0; x < camX + w + 22; x += 22) { ctx.moveTo(x, camY - 10); ctx.lineTo(x, camY + h + 10); }
    for (let y = gy0; y < camY + h + 22; y += 22) { ctx.moveTo(camX - 10, y); ctx.lineTo(camX + w + 10, y); }
    ctx.stroke();
    ctx.lineWidth = S.art.lw.detail; ctx.strokeStyle = 'rgba(217,228,238,0.09)';
    ctx.beginPath();
    for (let x = Math.floor(camX / 110) * 110; x < camX + w + 110; x += 110) { ctx.moveTo(x, camY - 10); ctx.lineTo(x, camY + h + 10); }
    for (let y = Math.floor(camY / 110) * 110; y < camY + h + 110; y += 110) { ctx.moveTo(camX - 10, y); ctx.lineTo(camX + w + 10, y); }
    ctx.stroke();

    // rock as chalk stipple, metal as hatched plates, thin rock as a sparse dotted door
    const x0 = Math.max(0, Math.floor(camX / CS) - 1), x1 = Math.min(cols - 1, Math.ceil((camX + w) / CS) + 1);
    const y0 = Math.max(0, Math.floor(camY / CS) - 1), y1 = Math.min(rows - 1, Math.ceil((camY + h) / CS) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = idx(x, y), g = grid[k];
      if (!g) continue;
      const cx = x * CS + CS / 2, cy = y * CS + CS / 2;
      const a = visAlpha(lit[k], cx, cy, 70) * (lit[k] > -99 || Math.hypot(cx - sub.x, cy - sub.y) < 70 ? 1 : 0);
      if (a <= 0.01) continue;
      const isEdge = !isSolid(x + 1, y) || !isSolid(x - 1, y) || !isSolid(x, y + 1) || !isSolid(x, y - 1);
      const rv = rock[k];
      const age = t - lit[k];
      if (g === METAL) {
        ctx.globalAlpha = a; ctx.strokeStyle = C.metal; ctx.lineWidth = S.art.lw.detail;
        ctx.strokeRect(x * CS + 2, y * CS + 2, CS - 4, CS - 4);
        ctx.beginPath(); for (let i = 4; i < CS * 2; i += 5) { ctx.moveTo(x * CS + Math.max(2, i - CS + 2), y * CS + Math.min(CS - 2, i)); ctx.lineTo(x * CS + Math.min(CS - 2, i), y * CS + Math.max(2, i - CS + 2)); } ctx.stroke();
        if (age >= 0 && age < 0.3) { ctx.globalAlpha = (1 - age / 0.3) * 0.6; ctx.fillStyle = C.metal; ctx.fillRect(x * CS, y * CS, CS, CS); }
      } else if (g === THIN) {
        ctx.globalAlpha = a * 0.8; ctx.fillStyle = C.thin;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if ((i + j) % 2 === 0) { ctx.beginPath(); ctx.arc(x * CS + 5 + i * 6, y * CS + 5 + j * 6, 1.1, 0, Math.PI * 2); ctx.fill(); }
      } else if (isEdge) {
        ctx.fillStyle = C.rock;
        ctx.globalAlpha = a * 0.12; ctx.fillRect(x * CS + 1, y * CS + 1, CS - 2, CS - 2);
        ctx.globalAlpha = a;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          const r = 1 + rv * 2.2 + ((i + j) % 2) * 0.4;
          ctx.beginPath(); ctx.arc(x * CS + 6 + i * 10, y * CS + 6 + j * 10, r, 0, Math.PI * 2); ctx.fill();
        }
        if (age >= 0 && age < 0.18) { ctx.globalAlpha = (1 - age / 0.18) * 0.5; ctx.fillRect(x * CS, y * CS, CS, CS); }
      } else {
        ctx.fillStyle = C.rock; ctx.globalAlpha = a * 0.22;
        if (rv > 0.5) { ctx.beginPath(); ctx.arc(cx, cy, (rv - 0.5) * 4, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    ctx.globalAlpha = 1;

    for (const p of pings) {
      const r = (t - p.t0) * RING_SPEED, R = ringMax();
      if (r > R) continue;
      const k = r / R;
      ctx.strokeStyle = C.rock; ctx.lineWidth = S.art.lw.detail;
      ctx.globalAlpha = (1 - E.outCubic(k)) * 0.7; inkRing(p.x, p.y, r, p.seed);
      ctx.globalAlpha *= 0.4; ctx.lineWidth = S.art.lw.fine; inkRing(p.x, p.y, Math.max(0, r - 14), p.seed + 3);
    }
    ctx.globalAlpha = 1;

    for (const it of items) {
      const a = visAlpha(it.lit, it.x, it.y, 90);
      if (a <= 0.02) continue;
      ctx.globalAlpha = a;
      if (it.kind === 'pearl') {
        const r = 4.5 + Math.sin(t * 3 + it.ph) * 0.6;
        ctx.fillStyle = C.pearl; ctx.beginPath(); ctx.arc(it.x, it.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(it.x + 1.5, it.y + 1.5, r * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = C.pearl; ctx.lineWidth = S.art.lw.fine; ctx.beginPath(); ctx.arc(it.x, it.y, r + 4, 0, Math.PI * 2); ctx.stroke();
      } else if (it.kind === 'cell') {
        ctx.strokeStyle = C.metal; ctx.lineWidth = S.art.lw.detail;
        ctx.strokeRect(it.x - 5, it.y - 8, 10, 16); ctx.fillStyle = C.metal; ctx.fillRect(it.x - 2, it.y - 11, 4, 3);
        ctx.fillRect(it.x - 3, it.y - 1 + Math.sin(t * 4) * 2, 6, 2);
      } else {
        ctx.strokeStyle = C.fix; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(it.x - 6, it.y); ctx.lineTo(it.x + 6, it.y); ctx.moveTo(it.x, it.y - 6); ctx.lineTo(it.x, it.y + 6); ctx.stroke();
        ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(it.x, it.y, 11, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    const ex = exit.x * CS + CS / 2, ey = exit.y * CS + CS / 2;
    if (beaconT < 1.6) {
      ctx.globalAlpha = (1 - E.outCubic(beaconT / 1.6)) * 0.8; ctx.strokeStyle = C.exit; ctx.lineWidth = 2;
      inkRing(ex, ey, beaconT * 70, 2);
    }
    ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.3; ctx.fillStyle = C.exit;
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    for (const c of creatures) { const a = visAlpha(c.lit, c.x, c.y, 80); if (a > 0.02) drawCreature(c, a); }

    for (const m of mines) {
      const a = visAlpha(m.lit, m.x, m.y, 80);
      if (a <= 0.02) continue;
      ctx.globalAlpha = a;
      ctx.strokeStyle = C.mine; ctx.fillStyle = C.mine; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * Math.PI * 2 + t * (m.hunt ? 2 : m.patrol ? 1 : 0.4);
        ctx.beginPath(); ctx.moveTo(m.x + Math.cos(an) * 7, m.y + Math.sin(an) * 7); ctx.lineTo(m.x + Math.cos(an) * 11, m.y + Math.sin(an) * 11); ctx.stroke();
      }
      if (m.patrol) { ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(m.x, m.y, 16, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;

    if (state !== 'over') {
      ctx.save(); ctx.translate(sub.x, sub.y);
      if (Math.hypot(sub.vx, sub.vy) > 5) ctx.rotate(Math.atan2(sub.vy, sub.vx));
      ctx.scale(sub.sx, sub.sy);
      ctx.fillStyle = sub.hitCd > 0 && Math.floor(t * 16) % 2 && !S.reduced ? C.mine : C.sub;
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-2, -8, 4, 4);
      ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(3, 0, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.bg; ctx.lineWidth = S.art.lw.fine; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-1, -2); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = C.dim; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sub.x, sub.y, 18, 0, Math.PI * 2); ctx.stroke();
      if (echoDir && t - echoDir.t < 1.6) {
        ctx.globalAlpha = 1 - (t - echoDir.t) / 1.6;
        ctx.strokeStyle = C.exit; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sub.x, sub.y, 18, echoDir.a - 0.3, echoDir.a + 0.3); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (sub) { S.dbg.circle(ctx, sub.x, sub.y, 7); for (const m of mines) S.dbg.circle(ctx, m.x, m.y, 8, '#f0f'); for (const c of creatures) S.dbg.circle(ctx, c.x, c.y, c.kind === 'fish' ? 6 : 15, '#ff0'); }
    fx.draw(ctx); fl.draw(ctx);
    ctx.restore();

    // paper grain tied to the camera, so it moves with the map and never flickers
    S.tex.grain(ctx, w, h, C.rock, 0.35, -camX * 0.5, -camY * 0.5);

    if (touch.on && state === 'play') drawTouch(w, h);
    if (state === 'play' || state === 'between') {
      ctx.font = '600 12px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.rock; ctx.fillText(`${T.depth} ${level}`, 16, 20);
      ctx.fillStyle = C.pearl; ctx.fillText(`${T.pearls} ${pearls}`, 110, 20);
      ctx.fillStyle = C.rock; ctx.fillText(T.hull, 16, 42);
      for (let i = 0; i < up.maxHull; i++) { ctx.globalAlpha = i < hull ? 1 : 0.2; ctx.fillStyle = C.sub; ctx.fillRect(88 + i * 16, 36, 11, 11); }
      ctx.globalAlpha = 1; ctx.fillStyle = lowWarn > 0 && Math.floor(t * 8) % 2 ? C.mine : C.rock; ctx.fillText(T.battery, 16, 64);
      const bw = 96, low = battery < pingCost();
      ctx.strokeStyle = C.rock; ctx.lineWidth = S.art.lw.detail; ctx.strokeRect(88, 58, bw, 11);
      ctx.fillStyle = low ? C.mine : C.metal; ctx.fillRect(90, 60, (bw - 4) * battery / 100, 7);
      ctx.strokeStyle = C.bg; ctx.lineWidth = 1; ctx.beginPath(); for (let c = pingCost(); c < 100; c += pingCost()) { const xx = 90 + (bw - 4) * c / 100; ctx.moveTo(xx, 60); ctx.lineTo(xx, 67); } ctx.stroke();
      ctx.textBaseline = 'alphabetic';
    }
    if (banner) {
      const k = banner.t < 0.4 ? E.outBack(banner.t / 0.4) : banner.t > 2.2 ? 1 - (banner.t - 2.2) / 0.4 : 1;
      ctx.save(); ctx.globalAlpha = S.clamp(k, 0, 1); ctx.translate(w / 2, h * 0.24); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
      ctx.font = '700 28px "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = C.rock;
      ctx.fillText(banner.text, 0, 0); ctx.restore(); ctx.textAlign = 'left';
    }
  }

  S.dbg.next = () => { if (state === 'play') { sub.x = exit.x * CS + CS / 2; sub.y = exit.y * CS + CS / 2; } };
  level = S.debug.on ? Math.max(1, S.debug.start) : 1; score = 0; pearls = 0; up = baseUp(); hull = up.maxHull; battery = 100;
  newLevel(); banner = null;
  setTimeout(() => { state = 'play'; ping(); state = 'menu'; battery = 100; }, 300);
  ov.show(T.title, touch.on ? T.introTouch : T.intro, T.play, startGame);
  diff.mount(ov);

  S.loop((dt) => { update(dt); draw(); });
})();
