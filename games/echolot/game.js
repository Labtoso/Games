/* Echolot: im Dunkeln tauchen, mit Schall sehen */
(() => {
  const S = Shell;
  const cv = document.getElementById('c');
  const st = S.stage(cv);
  const ctx = st.ctx;
  const hud = S.hud('echolot');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  // Echolot ist immer ein dunkler Bildschirm
  const C = { bg: '#071419', grid: 'rgba(110,242,196,0.05)', wall: '#6ef2c4', sub: '#e9fff6', mine: '#ff5d8f', exit: '#ffd25e', dim: 'rgba(110,242,196,0.35)' };
  const CS = 22;            // Zellgröße
  const RING_SPEED = 430;   // px/s
  const RING_MAX = 560;
  const FADE = 3.2;         // Sekunden sichtbar

  let cols, rows, grid, edge, lit, start, exit, sub, mines, pings, beaconT, level, score, hull, charge, state = 'menu', t = 0, shake = 0, camX = 0, camY = 0, levelTime = 0, echoDir = null;

  function idx(x, y) { return y * cols + x; }
  function isWall(x, y) { return x < 0 || y < 0 || x >= cols || y >= rows || grid[idx(x, y)] === 1; }

  function generate() {
    cols = 46 + Math.min(level * 4, 34);
    rows = 30 + Math.min(level * 2, 20);
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
      // Start links suchen
      let s = null;
      for (let x = 2; x < cols / 3 && !s; x++) for (let dy = 0; dy < rows / 2 && !s; dy++) {
        for (const y of [Math.floor(rows / 2) + dy, Math.floor(rows / 2) - dy]) {
          if (y > 1 && y < rows - 2 && !isWall(x, y) && !isWall(x + 1, y) && !isWall(x, y + 1) && !isWall(x - 1, y) && !isWall(x, y - 1)) { s = { x, y }; break; }
        }
      }
      if (!s) continue;
      // Breitensuche
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
      // Kanten (Wandzellen neben Wasser)
      edge = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (!grid[idx(x, y)]) continue;
        if (!isWall(x + 1, y) || !isWall(x - 1, y) || !isWall(x, y + 1) || !isWall(x, y - 1)) edge.push(idx(x, y));
      }
      lit = new Float32Array(cols * rows).fill(-99);
      // Minen in offenen Zellen, weg vom Start
      mines = [];
      const want = 3 + level * 2;
      const cand = [];
      for (let k = 0; k < grid.length; k++) if (!grid[k] && dist[k] > 12 && dist[k] < dist[far] - 3) cand.push(k);
      S.shuffle(cand);
      for (const k of cand) {
        if (mines.length >= want) break;
        const mx = (k % cols) * CS + CS / 2, my = ((k / cols) | 0) * CS + CS / 2;
        if (mines.some((m) => Math.hypot(m.x - mx, m.y - my) < CS * 6)) continue;
        mines.push({ x: mx, y: my, tx: mx, ty: my, lit: -99, hunt: 0, wake: Infinity, ph: Math.random() * 6 });
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
    charge = 3;
  }

  function startGame() { level = 1; score = 0; hull = 3; hud.score(0); fx.clear(); newLevel(); state = 'play'; }

  function ping() {
    if (state !== 'play' || charge < 1) return;
    charge -= 1;
    const o = { x: sub.x, y: sub.y, t0: t };
    pings.push(o);
    for (const k of edge) {
      const cx = (k % cols) * CS + CS / 2, cy = ((k / cols) | 0) * CS + CS / 2;
      const d = Math.hypot(cx - o.x, cy - o.y);
      if (d < RING_MAX) lit[k] = t + d / RING_SPEED;
    }
    for (const m of mines) {
      const d = Math.hypot(m.x - o.x, m.y - o.y);
      if (d < RING_MAX) { m.lit = t + d / RING_SPEED; m.wake = t + d / RING_SPEED; m.tx = o.x; m.ty = o.y; }
    }
    const ex = exit.x * CS + CS / 2, ey = exit.y * CS + CS / 2;
    echoDir = { a: Math.atan2(ey - sub.y, ex - sub.x), t: t };
  }

  function collideCircle(o, r, bounce) {
    const gx = Math.floor(o.x / CS), gy = Math.floor(o.y / CS);
    let hit = false;
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
    hull -= 1; shake = 0.35; sub.hitCd = 1;
    fx.burst(sub.x, sub.y, C.mine, 16, 180, 0.7, 3);
    if (hull <= 0) {
      state = 'over';
      const rec = hud.best(score);
      setTimeout(() => ov.show(rec && score > 0 ? 'Neuer Rekord!' : 'Rumpf geborsten',
        `Du bist bis <b>Tiefe ${level}</b> gekommen und hast <b>${score}</b> Punkte. Rekord: <b>${hud.bestValue}</b>.`, 'Nochmal tauchen', startGame), 700);
    }
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
      charge = Math.min(3, charge + dt / 1.7);
      // Steuerung
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
      sub.vx += (ax / al) * 420 * dt; sub.vy += (ay / al) * 420 * dt;
      const drag = Math.exp(-2.1 * dt); sub.vx *= drag; sub.vy *= drag;
      sub.x += sub.vx * dt; sub.y += sub.vy * dt;
      const imp = collideCircle(sub, 7, 0.35);
      sub.hitCd = Math.max(0, sub.hitCd - dt);
      if (imp > 110 && sub.hitCd <= 0) damage();
      else if (imp > 30) shake = Math.max(shake, 0.1);

      // Minen
      for (let i = mines.length - 1; i >= 0; i--) {
        const m = mines[i];
        if (t >= m.wake) { m.hunt = 1; m.wake = Infinity; }
        if (m.hunt) {
          const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
          const sp = 48 + level * 7;
          if (d > 4) {
            const o = { x: m.x + (dx / d) * sp * dt, y: m.y + (dy / d) * sp * dt, vx: 0, vy: 0 };
            collideCircle(o, 8, 0); m.x = o.x; m.y = o.y;
          } else m.hunt = 0;
        }
        if (state === 'play' && Math.hypot(m.x - sub.x, m.y - sub.y) < 15) {
          mines.splice(i, 1); fx.burst(m.x, m.y, C.mine, 24, 220, 0.9, 3); damage();
        }
      }

      // Ziel erreicht?
      const ex = exit.x * CS + CS / 2, ey = exit.y * CS + CS / 2;
      if (state === 'play' && Math.hypot(sub.x - ex, sub.y - ey) < 18) {
        const bonus = Math.max(0, Math.round(90 - levelTime)) + hull * 10;
        score += 100 + bonus; hud.score(score);
        fl.add(ex, ey - 14, `+${100 + bonus}`, C.exit);
        fx.burst(ex, ey, C.exit, 30, 220, 1, 3);
        level += 1;
        state = 'between';
        setTimeout(() => { newLevel(); state = 'play'; }, 900);
      }
    }
    // Leuchtfeuer pulst
    beaconT += dt; if (beaconT > 3.6) beaconT = 0;
    pings = pings.filter((p) => t - p.t0 < RING_MAX / RING_SPEED + 0.2);

    // Kamera
    const w = st.w, h = st.h;
    if (sub) {
      camX = S.lerp(camX, sub.x - w / 2, Math.min(1, dt * 4));
      camY = S.lerp(camY, sub.y - h / 2, Math.min(1, dt * 4));
    }
    fx.update(dt); fl.update(dt);
    shake = Math.max(0, shake - dt);
  }

  function draw() {
    const w = st.w, h = st.h;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    if (!grid) return;
    ctx.save();
    if (shake > 0) ctx.translate(S.rand(-1, 1) * shake * 12, S.rand(-1, 1) * shake * 12);
    ctx.translate(-Math.round(camX), -Math.round(camY));

    // Raster
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    const gx0 = Math.floor(camX / 88) * 88, gy0 = Math.floor(camY / 88) * 88;
    ctx.beginPath();
    for (let x = gx0; x < camX + w + 88; x += 88) { ctx.moveTo(x, camY - 10); ctx.lineTo(x, camY + h + 10); }
    for (let y = gy0; y < camY + h + 88; y += 88) { ctx.moveTo(camX - 10, y); ctx.lineTo(camX + w + 10, y); }
    ctx.stroke();

    // Wände: nur was das Echo trifft, plus Nahbereich
    const x0 = Math.max(0, Math.floor(camX / CS) - 1), x1 = Math.min(cols - 1, Math.ceil((camX + w) / CS) + 1);
    const y0 = Math.max(0, Math.floor(camY / CS) - 1), y1 = Math.min(rows - 1, Math.ceil((camY + h) / CS) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = idx(x, y);
      if (!grid[k]) continue;
      const cx = x * CS + CS / 2, cy = y * CS + CS / 2;
      let a = 0;
      const age = t - lit[k];
      if (age >= 0 && age < FADE) a = 1 - age / FADE;
      const near = Math.hypot(cx - sub.x, cy - sub.y);
      if (near < 70) a = Math.max(a, (1 - near / 70) * 0.55);
      if (a <= 0.01) continue;
      const isEdge = !isWall(x + 1, y) || !isWall(x - 1, y) || !isWall(x, y + 1) || !isWall(x, y - 1);
      ctx.globalAlpha = a * (isEdge ? 0.16 : 0.06);
      ctx.fillStyle = C.wall; ctx.fillRect(x * CS + 1, y * CS + 1, CS - 2, CS - 2);
      if (isEdge) {
        ctx.globalAlpha = a;
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
        if (age >= 0 && age < 0.18) { ctx.globalAlpha = (1 - age / 0.18) * 0.7; ctx.fillRect(x * CS, y * CS, CS, CS); }
      }
    }
    ctx.globalAlpha = 1;

    // Ping-Ringe
    for (const p of pings) {
      const r = (t - p.t0) * RING_SPEED;
      if (r > RING_MAX) continue;
      ctx.globalAlpha = (1 - r / RING_MAX) * 0.6;
      ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Ausgang
    const ex = exit.x * CS + CS / 2, ey = exit.y * CS + CS / 2;
    const br = beaconT * 70;
    if (beaconT < 1.6) {
      ctx.globalAlpha = (1 - beaconT / 1.6) * 0.8; ctx.strokeStyle = C.exit; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex, ey, br, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.3; ctx.fillStyle = C.exit;
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Minen
    for (const m of mines) {
      const age = t - m.lit;
      let a = age >= 0 && age < FADE ? 1 - age / FADE : 0;
      const near = Math.hypot(m.x - sub.x, m.y - sub.y);
      if (near < 80) a = Math.max(a, 1 - near / 80);
      if (a <= 0.02) continue;
      ctx.globalAlpha = a;
      ctx.strokeStyle = C.mine; ctx.fillStyle = C.mine; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * Math.PI * 2 + t * (m.hunt ? 2 : 0.4);
        ctx.beginPath(); ctx.moveTo(m.x + Math.cos(an) * 7, m.y + Math.sin(an) * 7); ctx.lineTo(m.x + Math.cos(an) * 11, m.y + Math.sin(an) * 11); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // U-Boot
    if (state !== 'over') {
      ctx.save(); ctx.translate(sub.x, sub.y);
      const ang = Math.atan2(sub.vy, sub.vx);
      if (Math.hypot(sub.vx, sub.vy) > 5) ctx.rotate(ang);
      ctx.fillStyle = sub.hitCd > 0 && Math.floor(t * 16) % 2 ? C.mine : C.sub;
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-2, -8, 4, 4);
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
    fx.draw(ctx); fl.draw(ctx);
    ctx.restore();

    // Vignette und Scanlines
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    // Anzeigen
    if (state === 'play' || state === 'between') {
      ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.wall; ctx.fillText(`TIEFE ${level}`, 16, 20);
      ctx.fillText('RUMPF', 16, 42);
      for (let i = 0; i < 3; i++) { ctx.globalAlpha = i < hull ? 1 : 0.2; ctx.fillStyle = C.sub; ctx.fillRect(70 + i * 16, 36, 11, 11); }
      ctx.globalAlpha = 1; ctx.fillStyle = C.wall; ctx.fillText('PING', 16, 64);
      for (let i = 0; i < 3; i++) {
        const f = S.clamp(charge - i, 0, 1);
        ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5; ctx.strokeRect(70 + i * 16, 58, 11, 11);
        ctx.fillStyle = C.wall; ctx.globalAlpha = f >= 1 ? 1 : 0.35; ctx.fillRect(70 + i * 16, 58 + 11 * (1 - f), 11, 11 * f);
        ctx.globalAlpha = 1;
      }
    }
  }

  level = 1; hull = 3; score = 0;
  newLevel();
  // Startbildschirm: ein Ping zur Ansicht
  setTimeout(() => { state = 'play'; ping(); state = 'menu'; }, 300);
  ov.show('Echolot',
    'Du steuerst ein U-Boot durch eine stockdunkle Höhle. <b>Ping</b> macht die Wände kurz sichtbar und zeigt Richtung Leuchtfeuer. Aber Vorsicht: Minen hören den Ping und kommen näher. Harte Stöße an der Wand kosten Rumpf.',
    'Abtauchen', startGame);

  S.loop((dt) => { update(dt); draw(); });
})();
