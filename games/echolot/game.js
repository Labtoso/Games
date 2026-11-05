/* Echolot: im Dunkeln tauchen, mit Schall sehen */
(() => {
  const S = Shell, snd = S.sound;
  const cv = document.getElementById('c');
  const st = S.stage(cv);
  const ctx = st.ctx;
  const hud = S.hud('echolot');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  // Echolot hat eine eigene Nachtpalette (siehe STYLEGUIDE.md)
  const C = { bg: '#071419', grid: 'rgba(110,242,196,0.05)', wall: '#6ef2c4', sub: '#e9fff6', mine: '#ff5d8f', exit: '#ffd25e', pearl: '#b9c8ff', fix: '#9dff7a', dim: 'rgba(110,242,196,0.35)' };
  const CS = 22;
  const RING_SPEED = 430;
  const FADE = 3.2;

  let cols, rows, grid, rock, lit, start, exit, sub, mines, items, pings, beaconT, level, score, hull, charge, pearls, state = 'menu', t = 0, shake = 0, camX = 0, camY = 0, levelTime = 0, echoDir = null;
  let up;
  const diff = S.difficulty('echolot');
  const D = () => diff.pick({ leicht: { hull: 4, mines: 0.6, msp: 0.8, rech: 1.3 }, normal: { hull: 3, mines: 1, msp: 1, rech: 1.7 }, schwer: { hull: 2, mines: 1.4, msp: 1.25, rech: 2.1 } });
  const baseUp = () => ({ maxCharge: 3, maxHull: D().hull, quiet: 0, engine: 0, range: 0 });

  const ringMax = () => 520 + up.range * 110;
  const wakeRange = () => 600 * (1 - up.quiet * 0.25);

  function idx(x, y) { return y * cols + x; }
  function isWall(x, y) { return x < 0 || y < 0 || x >= cols || y >= rows || grid[idx(x, y)] === 1; }

  function generate() {
    cols = 46 + Math.min(level * 4, 40);
    rows = 30 + Math.min(level * 2, 24);
    for (let attempt = 0; attempt < 40; attempt++) {
      grid = new Uint8Array(cols * rows);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
        grid[idx(x, y)] = border || Math.random() < 0.46 ? 1 : 0;
      }
      for (let it = 0; it < 5; it++) {
        const ng = new Uint8Array(cols * rows);
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          let n = 0;
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && isWall(x + i, y + j)) n++;
          const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
          ng[idx(x, y)] = border || n >= 5 || (it < 2 && n <= 1) ? 1 : 0;
        }
        grid = ng;
      }
      let s = null;
      for (let x = 2; x < cols / 3 && !s; x++) for (let dy = 0; dy < rows / 2 && !s; dy++) {
        for (const y of [Math.floor(rows / 2) + dy, Math.floor(rows / 2) - dy]) {
          if (y > 1 && y < rows - 2 && !isWall(x, y) && !isWall(x + 1, y) && !isWall(x, y + 1) && !isWall(x - 1, y) && !isWall(x, y - 1)) { s = { x, y }; break; }
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
          if (!isWall(nx, ny) && dist[idx(nx, ny)] < 0) { dist[idx(nx, ny)] = dist[k] + 1; q.push(idx(nx, ny)); }
        }
      }
      let open = 0; for (let k = 0; k < grid.length; k++) if (!grid[k]) open++;
      if (reach < open * 0.6 || dist[far] < cols * 0.9) continue;
      for (let k = 0; k < grid.length; k++) if (!grid[k] && dist[k] < 0) grid[k] = 1;
      start = s; exit = { x: far % cols, y: (far / cols) | 0 };
      // Gesteinstextur aus Rauschen
      const nf = S.tex.noiseField(cols, rows, 5, 11 + level * 7, 3);
      rock = nf;
      lit = new Float32Array(cols * rows).fill(-99);

      const openCells = [];
      for (let k = 0; k < grid.length; k++) if (!grid[k] && dist[k] > 6) openCells.push(k);
      S.shuffle(openCells);
      const cx = (k) => (k % cols) * CS + CS / 2, cy = (k) => ((k / cols) | 0) * CS + CS / 2;
      const far2 = (list, x, y, d) => list.every((o) => Math.hypot(o.x - x, o.y - y) > d);

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
      for (const k of openCells) {
        if (items.filter((i) => i.kind === 'pearl').length >= pearlsWanted) break;
        const x = cx(k), y = cy(k);
        if (far2(items, x, y, CS * 4) && far2(mines, x, y, CS * 2)) items.push({ kind: 'pearl', x, y, lit: -99, ph: Math.random() * 6 });
      }
      const fixes = 1 + (level > 3 ? 1 : 0);
      for (const k of openCells.slice().reverse()) {
        if (items.filter((i) => i.kind === 'fix').length >= fixes) break;
        if (dist[k] < dist[far] * 0.3) continue;
        const x = cx(k), y = cy(k);
        if (far2(items, x, y, CS * 4)) items.push({ kind: 'fix', x, y, lit: -99, ph: 0 });
      }
      return true;
    }
    return false;
  }

  function newLevel() {
    generate();
    sub = { x: start.x * CS + CS / 2, y: start.y * CS + CS / 2, vx: 0, vy: 0, hitCd: 0 };
    pings = []; beaconT = 0; levelTime = 0; echoDir = null;
    camX = sub.x - st.w / 2; camY = sub.y - st.h / 2;
    charge = up.maxCharge;
  }

  function startGame() { level = S.debug.on ? Math.max(1, S.debug.start) : 1; score = 0; pearls = 0; up = baseUp(); hull = up.maxHull; hud.score(0); fx.clear(); newLevel(); state = 'play'; }

  function ping() {
    if (state !== 'play' || charge < 1) return;
    charge -= 1;
    const o = { x: sub.x, y: sub.y, t0: t };
    pings.push(o);
    const R = ringMax();
    for (let k = 0; k < grid.length; k++) {
      if (!grid[k]) continue;
      const cx = (k % cols) * CS + CS / 2, cy = ((k / cols) | 0) * CS + CS / 2;
      const d = Math.hypot(cx - o.x, cy - o.y);
      if (d < R) lit[k] = t + d / RING_SPEED;
    }
    const wr = Math.min(R, wakeRange());
    for (const m of mines) {
      const d = Math.hypot(m.x - o.x, m.y - o.y);
      if (d < R) m.lit = t + d / RING_SPEED;
      if (d < wr) { m.wake = t + d / RING_SPEED; m.tx = o.x; m.ty = o.y; }
    }
    for (const it of items) { const d = Math.hypot(it.x - o.x, it.y - o.y); if (d < R) it.lit = t + d / RING_SPEED; }
    const ex = exit.x * CS + CS / 2, ey = exit.y * CS + CS / 2;
    echoDir = { a: Math.atan2(ey - sub.y, ex - sub.x), t };
    snd.tone(1400, 0.6, 'sine', 0.25, 0.55);
    snd.tone(700, 0.4, 'sine', 0.08, 0.9, 0.35);
  }

  function collideCircle(o, r, bounce) {
    const gx = Math.floor(o.x / CS), gy = Math.floor(o.y / CS);
    let hit = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j;
      if (!isWall(cx, cy)) continue;
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

  function damage() {
    if ((S.debug.on && S.debug.god)) { shake = 0.2; return; }
    hull -= 1; shake = 0.35; sub.hitCd = 1;
    fx.burst(sub.x, sub.y, C.mine, 16, 180, 0.7, 3);
    snd.noise(0.35, 0.4, 260); snd.tone(110, 0.3, 'square', 0.15, 0.6);
    if (hull <= 0) {
      state = 'over';
      const rec = hud.best(score);
      setTimeout(() => ov.show(rec && score > 0 ? 'Neuer Rekord!' : 'Rumpf geborsten',
        `Du bist bis <b>Tiefe ${level}</b> gekommen und hast <b>${score}</b> Punkte. Rekord: <b>${hud.bestValue}</b>.`, 'Nochmal tauchen', startGame), 700);
      setTimeout(() => diff.mount(ov), 710);
    }
  }

  /* Werft zwischen den Tauchgängen */
  const SHOP = [
    { id: 'charge', name: 'Größerer Akku', info: '+1 Ping-Ladung', max: 3, cost: (lv) => 6 + lv * 4, can: () => up.maxCharge < 6, buy: () => { up.maxCharge++; } },
    { id: 'hull', name: 'Verstärkter Rumpf', info: '+1 Rumpfpunkt', max: 3, cost: (lv) => 8 + lv * 4, can: () => up.maxHull < 6, buy: () => { up.maxHull++; hull++; } },
    { id: 'quiet', name: 'Leiser Ping', info: 'Minen hören dich schlechter', max: 2, cost: (lv) => 10 + lv * 6, can: () => up.quiet < 2, buy: () => { up.quiet++; } },
    { id: 'range', name: 'Starker Sender', info: 'Ping reicht weiter', max: 2, cost: (lv) => 8 + lv * 5, can: () => up.range < 2, buy: () => { up.range++; } },
    { id: 'engine', name: 'Neuer Motor', info: 'schneller und wendiger', max: 2, cost: (lv) => 6 + lv * 5, can: () => up.engine < 2, buy: () => { up.engine++; } },
    { id: 'repair', name: 'Reparatur', info: 'Rumpf voll machen', cost: () => 4, can: () => hull < up.maxHull, buy: () => { hull = up.maxHull; } },
  ];
  const lvOf = (id) => (id === 'charge' ? up.maxCharge - 3 : id === 'hull' ? up.maxHull - 3 : up[id] || 0);

  function openShop() {
    const render = () => {
      const rows = SHOP.map((s) => {
        const c = s.cost(lvOf(s.id));
        const dis = !s.can() || pearls < c;
        return `<button data-buy="${s.id}" ${dis ? 'disabled' : ''}><span>${s.name}<small>${s.info}</small></span><span>${s.can() ? c + ' ◯' : 'voll'}</span></button>`;
      }).join('');
      ov.show(`Werft · Tiefe ${level - 1} geschafft`,
        `Du hast <b>${pearls} Perlen</b>. Rumpf ${hull}/${up.maxHull}, Akku ${up.maxCharge}.`,
        `Weiter auf Tiefe ${level}`, () => { newLevel(); state = 'play'; });
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
  ptr.onDown = (x, y) => { downAt = performance.now(); downX = x; downY = y; moved = false; };
  ptr.onUp = (x, y) => { if (performance.now() - downAt < 230 && Math.hypot(x - downX, y - downY) < 14 && !moved) ping(); };

  function update(dt) {
    t += dt;
    if (state === 'play') {
      levelTime += dt;
      charge = Math.min(up.maxCharge, charge + dt / D().rech);
      let ax = 0, ay = 0;
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) ax -= 1;
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) ax += 1;
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) ay -= 1;
      if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) ay += 1;
      if (ptr.down && performance.now() - downAt > 120) {
        const wx = ptr.x + camX, wy = ptr.y + camY;
        const dx = wx - sub.x, dy = wy - sub.y, d = Math.hypot(dx, dy);
        if (d > 10) { ax = dx / d; ay = dy / d; moved = true; }
      }
      const al = Math.hypot(ax, ay) || 1;
      const acc = 420 * (1 + up.engine * 0.18);
      sub.vx += (ax / al) * acc * dt; sub.vy += (ay / al) * acc * dt;
      const drag = Math.exp(-2.1 * dt); sub.vx *= drag; sub.vy *= drag;
      sub.x += sub.vx * dt; sub.y += sub.vy * dt;
      if ((ax || ay) && Math.random() < dt * 14) fx.list.push({ x: sub.x - (sub.vx / 30), y: sub.y - (sub.vy / 30), vx: S.rand(-10, 10), vy: S.rand(-20, -5), life: 0.8, max: 0.8, color: C.dim, size: 2 });
      const imp = collideCircle(sub, 7, 0.35);
      sub.hitCd = Math.max(0, sub.hitCd - dt);
      if (imp > 110 && sub.hitCd <= 0) damage();
      else if (imp > 30) { shake = Math.max(shake, 0.1); if (imp > 50) snd.tone(90, 0.1, 'sine', 0.2); }

      for (let i = mines.length - 1; i >= 0; i--) {
        const m = mines[i];
        if (t >= m.wake) { m.hunt = 1; m.wake = Infinity; }
        if (m.hunt) {
          const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
          const sp = (48 + level * 7) * D().msp;
          if (d > 4) { const o = { x: m.x + (dx / d) * sp * dt, y: m.y + (dy / d) * sp * dt, vx: 0, vy: 0 }; collideCircle(o, 8, 0); m.x = o.x; m.y = o.y; }
          else m.hunt = 0;
        } else if (m.patrol) {
          const o = { x: m.x + m.vx * dt, y: m.y + m.vy * dt, vx: m.vx, vy: m.vy };
          collideCircle(o, 8, 1); m.x = o.x; m.y = o.y; m.vx = o.vx; m.vy = o.vy;
        }
        if (state === 'play' && Math.hypot(m.x - sub.x, m.y - sub.y) < 15) { mines.splice(i, 1); fx.burst(m.x, m.y, C.mine, 24, 220, 0.9, 3); damage(); }
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (Math.hypot(it.x - sub.x, it.y - sub.y) < 16) {
          items.splice(i, 1);
          if (it.kind === 'pearl') { pearls++; score += 10; hud.score(score); fl.add(it.x, it.y - 10, '+10', C.pearl); snd.tone(1200, 0.12, 'sine', 0.2); snd.tone(1600, 0.1, 'sine', 0.15, 1, 0.06); fx.burst(it.x, it.y, C.pearl, 10, 120, 0.5, 2); }
          else { hull = Math.min(up.maxHull, hull + 1); fl.add(it.x, it.y - 10, 'Rumpf +1', C.fix); snd.chord([392, 523, 659], 0.25, 'triangle', 0.18); fx.burst(it.x, it.y, C.fix, 14, 140, 0.6, 3); }
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
    }
    beaconT += dt; if (beaconT > 3.6) { beaconT = 0; }
    pings = pings.filter((p) => t - p.t0 < ringMax() / RING_SPEED + 0.2);
    const w = st.w, h = st.h;
    if (sub) { camX = S.lerp(camX, sub.x - w / 2, Math.min(1, dt * 4)); camY = S.lerp(camY, sub.y - h / 2, Math.min(1, dt * 4)); }
    fx.update(dt); fl.update(dt);
    shake = Math.max(0, shake - dt);
  }

  function visAlpha(litAt, x, y, nearR) {
    const age = t - litAt;
    let a = age >= 0 && age < FADE ? 1 - age / FADE : 0;
    const near = Math.hypot(x - sub.x, y - sub.y);
    if (near < nearR) a = Math.max(a, (1 - near / nearR) * 0.8);
    return a;
  }

  function draw() {
    const w = st.w, h = st.h;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    if (!grid) return;
    ctx.save();
    if (shake > 0) ctx.translate(S.rand(-1, 1) * shake * 12, S.rand(-1, 1) * shake * 12);
    ctx.translate(-Math.round(camX), -Math.round(camY));

    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    const gx0 = Math.floor(camX / 88) * 88, gy0 = Math.floor(camY / 88) * 88;
    ctx.beginPath();
    for (let x = gx0; x < camX + w + 88; x += 88) { ctx.moveTo(x, camY - 10); ctx.lineTo(x, camY + h + 10); }
    for (let y = gy0; y < camY + h + 88; y += 88) { ctx.moveTo(camX - 10, y); ctx.lineTo(camX + w + 10, y); }
    ctx.stroke();

    // Gestein: Rasterpunkte, Größe aus dem Rauschfeld
    const x0 = Math.max(0, Math.floor(camX / CS) - 1), x1 = Math.min(cols - 1, Math.ceil((camX + w) / CS) + 1);
    const y0 = Math.max(0, Math.floor(camY / CS) - 1), y1 = Math.min(rows - 1, Math.ceil((camY + h) / CS) + 1);
    ctx.fillStyle = C.wall;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = idx(x, y);
      if (!grid[k]) continue;
      const cx = x * CS + CS / 2, cy = y * CS + CS / 2;
      const a = visAlpha(lit[k], cx, cy, 70) * (lit[k] > -99 || Math.hypot(cx - sub.x, cy - sub.y) < 70 ? 1 : 0);
      if (a <= 0.01) continue;
      const isEdge = !isWall(x + 1, y) || !isWall(x - 1, y) || !isWall(x, y + 1) || !isWall(x, y - 1);
      const rv = rock[k];
      if (isEdge) {
        ctx.globalAlpha = a * 0.14; ctx.fillRect(x * CS + 1, y * CS + 1, CS - 2, CS - 2);
        ctx.globalAlpha = a;
        // vier Punkte pro Kantenzelle, Größe je nach Gestein
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          const r = 1 + rv * 2.2 + ((i + j) % 2) * 0.4;
          ctx.beginPath(); ctx.arc(x * CS + 6 + i * 10, y * CS + 6 + j * 10, r, 0, Math.PI * 2); ctx.fill();
        }
        const age = t - lit[k];
        if (age >= 0 && age < 0.18) { ctx.globalAlpha = (1 - age / 0.18) * 0.7; ctx.fillRect(x * CS, y * CS, CS, CS); }
      } else {
        ctx.globalAlpha = a * 0.25;
        if (rv > 0.5) { ctx.beginPath(); ctx.arc(cx, cy, (rv - 0.5) * 4, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    ctx.globalAlpha = 1;

    for (const p of pings) {
      const r = (t - p.t0) * RING_SPEED, R = ringMax();
      if (r > R) continue;
      ctx.globalAlpha = (1 - r / R) * 0.6; ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha *= 0.4; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, r - 14), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Gegenstände
    for (const it of items) {
      const a = visAlpha(it.lit, it.x, it.y, 90);
      if (a <= 0.02) continue;
      ctx.globalAlpha = a;
      if (it.kind === 'pearl') {
        const r = 4.5 + Math.sin(t * 3 + it.ph) * 0.6;
        ctx.fillStyle = C.pearl; ctx.beginPath(); ctx.arc(it.x, it.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(it.x + 1.5, it.y + 1.5, r * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = C.pearl; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(it.x, it.y, r + 4, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.strokeStyle = C.fix; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(it.x - 6, it.y); ctx.lineTo(it.x + 6, it.y); ctx.moveTo(it.x, it.y - 6); ctx.lineTo(it.x, it.y + 6); ctx.stroke();
        ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(it.x, it.y, 11, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    const ex = exit.x * CS + CS / 2, ey = exit.y * CS + CS / 2;
    if (beaconT < 1.6) {
      ctx.globalAlpha = (1 - beaconT / 1.6) * 0.8; ctx.strokeStyle = C.exit; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex, ey, beaconT * 70, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.3; ctx.fillStyle = C.exit;
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

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
      ctx.fillStyle = sub.hitCd > 0 && Math.floor(t * 16) % 2 ? C.mine : C.sub;
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-2, -8, 4, 4);
      ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(3, 0, 1.8, 0, Math.PI * 2); ctx.fill();
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
    if (sub) { S.dbg.circle(ctx, sub.x, sub.y, 7); for (const m of mines) S.dbg.circle(ctx, m.x, m.y, 8, '#f0f'); }
    fx.draw(ctx); fl.draw(ctx);
    ctx.restore();

    // Bildschirm: Vignette, Rauschen, Zeilen
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    S.tex.grain(ctx, w, h, '#6ef2c4', 0.5, Math.random() * 256, Math.random() * 256);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    if (state === 'play' || state === 'between') {
      ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.wall; ctx.fillText(`TIEFE ${level}`, 16, 20);
      ctx.fillStyle = C.pearl; ctx.fillText(`PERLEN ${pearls}`, 110, 20);
      ctx.fillStyle = C.wall; ctx.fillText('RUMPF', 16, 42);
      for (let i = 0; i < up.maxHull; i++) { ctx.globalAlpha = i < hull ? 1 : 0.2; ctx.fillStyle = C.sub; ctx.fillRect(70 + i * 16, 36, 11, 11); }
      ctx.globalAlpha = 1; ctx.fillStyle = C.wall; ctx.fillText('PING', 16, 64);
      for (let i = 0; i < up.maxCharge; i++) {
        const f = S.clamp(charge - i, 0, 1);
        ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5; ctx.strokeRect(70 + i * 16, 58, 11, 11);
        ctx.fillStyle = C.wall; ctx.globalAlpha = f >= 1 ? 1 : 0.35; ctx.fillRect(70 + i * 16, 58 + 11 * (1 - f), 11, 11 * f);
        ctx.globalAlpha = 1;
      }
      ctx.textBaseline = 'alphabetic';
    }
  }

  S.dbg.next = () => { if (state === 'play') { sub.x = exit.x * CS + CS / 2; sub.y = exit.y * CS + CS / 2; } };
  level = 1; score = 0; pearls = 0; up = baseUp(); hull = up.maxHull;
  newLevel();
  setTimeout(() => { state = 'play'; ping(); state = 'menu'; }, 300);
  ov.show('Echolot',
    'Du steuerst ein U-Boot durch eine stockdunkle Höhle. <b>Ping</b> macht die Wände kurz sichtbar und zeigt Richtung Leuchtfeuer.<ul><li>Minen hören den Ping und kommen näher</li><li>Perlen sammeln und in der Werft gegen Upgrades tauschen</li><li>Grüne Kreuze reparieren den Rumpf</li><li>Harte Stöße an der Wand kosten Rumpf</li></ul>',
    'Abtauchen', startGame);
  diff.mount(ov);

  S.loop((dt) => { update(dt); draw(); });
})();
