/* Lichtweg: Spiegel drehen, bis der Strahl alle Kristalle trifft */
(() => {
  const S = Shell;
  const cv = document.getElementById('c');
  let P = S.palette();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { P = S.palette(); });
  const st = S.stage(cv, () => layout());
  const ctx = st.ctx;
  const hud = S.hud('lichtweg');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  // Zelle: null | {m:'/'|'\\', lock, rot} | {target:true} | {stone:true}
  let n, grid, initial, src, level = 1, score = 0, moves = 0, par = 0, solved = false, t = 0, hover = -1;
  let ox = 0, oy = 0, cs = 40, beam = null;

  const reflect = (dx, dy, m) => (m === '/' ? [-dy, -dx] : [dy, dx]);

  function trace(g) {
    let x = src.x, y = src.y, dx = src.dx, dy = src.dy;
    const pts = [[x - dx * 0.5 - dx * 0.35, y - dy * 0.5 - dy * 0.35]];
    const hits = new Set(); const seen = new Set();
    for (let steps = 0; steps < 600; steps++) {
      if (x < 0 || y < 0 || x >= n || y >= n) { pts.push([x - dx * 0.5, y - dy * 0.5]); break; }
      const key = `${x},${y},${dx},${dy}`;
      if (seen.has(key)) { pts.push([x, y]); break; }
      seen.add(key);
      const c = g[y * n + x];
      if (c && c.stone) { pts.push([x - dx * 0.5, y - dy * 0.5]); break; }
      if (c && c.target) hits.add(y * n + x);
      if (c && c.m) { pts.push([x, y]); [dx, dy] = reflect(dx, dy, c.m); }
      x += dx; y += dy;
    }
    return { pts, hits };
  }

  function generate() {
    n = Math.min(5 + Math.floor((level - 1) / 2), 9);
    const minMirrors = Math.min(3 + Math.floor(level / 2), 9);
    for (let tries = 0; tries < 2000; tries++) {
      const g = new Array(n * n).fill(null);
      const side = S.randInt(0, 3);
      const k = S.randInt(0, n - 1);
      if (side === 0) src = { x: 0, y: k, dx: 1, dy: 0 };
      else if (side === 1) src = { x: n - 1, y: k, dx: -1, dy: 0 };
      else if (side === 2) src = { x: k, y: 0, dx: 0, dy: 1 };
      else src = { x: k, y: n - 1, dx: 0, dy: -1 };
      let x = src.x, y = src.y, dx = src.dx, dy = src.dy;
      const visited = new Set(); const path = []; let mirrors = 0; let ok = false;
      for (let step = 0; step < n * n * 2; step++) {
        if (x < 0 || y < 0 || x >= n || y >= n) { ok = true; break; }
        const id = y * n + x;
        const c = g[id];
        if (c && c.m) { [dx, dy] = reflect(dx, dy, c.m); }
        else if (!visited.has(id) && step > 0 && Math.random() < 0.38) {
          const m = Math.random() < 0.5 ? '/' : '\\';
          g[id] = { m, lock: false, rot: 0 }; mirrors++;
          [dx, dy] = reflect(dx, dy, m);
        }
        visited.add(id); path.push(id);
        x += dx; y += dy;
      }
      if (!ok || mirrors < minMirrors || visited.size < n * 2) continue;
      // Kristalle auf freie Pfadzellen
      const free = [...visited].filter((id) => !g[id]);
      const tc = Math.min(2 + Math.floor(level / 3), 5);
      if (free.length < tc) continue;
      S.shuffle(free);
      const targets = [];
      for (const id of free) {
        if (targets.length >= tc) break;
        if (targets.some((o) => Math.abs((o % n) - (id % n)) + Math.abs(((o / n) | 0) - ((id / n) | 0)) < 2)) continue;
        targets.push(id);
      }
      if (targets.length < tc) continue;
      for (const id of targets) g[id] = { target: true };
      // Lockspiegel und Steine abseits des Wegs
      const off = []; for (let i = 0; i < n * n; i++) if (!visited.has(i) && !g[i]) off.push(i);
      S.shuffle(off);
      const decoys = Math.min(off.length, 1 + Math.floor(level * 0.8));
      for (let i = 0; i < decoys; i++) g[off[i]] = { m: Math.random() < 0.5 ? '/' : '\\', lock: false, rot: 0 };
      const stones = Math.min(off.length - decoys, level > 2 ? S.randInt(1, 2 + Math.floor(level / 3)) : 0);
      for (let i = 0; i < stones; i++) g[off[decoys + i]] = { stone: true };
      // einige Wegspiegel fest verschrauben
      const pathMirrors = [...visited].filter((id) => g[id] && g[id].m);
      for (const id of pathMirrors) if (Math.random() < 0.22) g[id].lock = true;
      // mischen
      const movable = g.map((c, i) => (c && c.m && !c.lock ? i : -1)).filter((i) => i >= 0);
      if (movable.length < 2) continue;
      let flipped = 0;
      for (let i = 0; i < 30 && (flipped < Math.max(2, Math.ceil(movable.length * 0.45)) || trace(g).hits.size === targets.length); i++) {
        const id = S.pick(movable);
        g[id].m = g[id].m === '/' ? '\\' : '/'; g[id].flipped = !g[id].flipped;
        flipped = movable.filter((m) => g[m].flipped).length;
      }
      if (trace(g).hits.size === targets.length) continue;
      par = movable.filter((m) => g[m].flipped).length;
      for (const c of g) if (c) delete c.flipped;
      grid = g;
      initial = g.map((c) => (c ? { ...c } : null));
      return;
    }
  }

  function layout() {
    if (!n) return;
    const pad = 46;
    cs = Math.floor(Math.min((st.w - pad * 2) / n, (st.h - pad * 2) / n, 84));
    ox = Math.floor((st.w - cs * n) / 2);
    oy = Math.floor((st.h - cs * n) / 2);
  }

  function newLevel() { generate(); moves = 0; solved = false; layout(); beam = trace(grid); }

  function resetLevel() {
    if (solved) return;
    grid = initial.map((c) => (c ? { ...c } : null)); moves = 0; beam = trace(grid);
  }

  function targetsCount() { return grid.filter((c) => c && c.target).length; }

  function clickCell(id) {
    if (solved || ov.open || id < 0) return;
    const c = grid[id];
    if (!c || !c.m) return;
    const cx = ox + (id % n) * cs + cs / 2, cy = oy + ((id / n) | 0) * cs + cs / 2;
    if (c.lock) { c.rot = 0.18; fx.burst(cx, cy, P.soft, 5, 60, 0.3, 2); return; }
    c.m = c.m === '/' ? '\\' : '/';
    c.rot = Math.PI / 2;
    moves++;
    beam = trace(grid);
    if (beam.hits.size === targetsCount()) win();
  }

  function win() {
    solved = true;
    const pts = Math.max(10, 50 - Math.max(0, moves - par) * 5);
    score += pts; hud.score(score); hud.best(score);
    for (const id of beam.hits) fx.burst(ox + (id % n) * cs + cs / 2, oy + ((id / n) | 0) * cs + cs / 2, P.yellow, 16, 170, 0.9, 4);
    fl.add(st.w / 2, oy - 12, `+${pts}`, P.ink);
    setTimeout(() => { level++; newLevel(); }, 1400);
  }

  function cellAt(x, y) {
    const cx = Math.floor((x - ox) / cs), cy = Math.floor((y - oy) / cs);
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) return -1;
    return cy * n + cx;
  }

  const ptr = S.pointer(cv);
  ptr.onDown = (x, y) => clickCell(cellAt(x, y));
  S.keys((k) => { if ((k === 'r' || k === 'R') && !ov.open) resetLevel(); });

  function update(dt) {
    t += dt;
    for (const c of grid) if (c && c.m && c.rot) { c.rot = c.rot > 0.002 ? c.rot * Math.exp(-14 * dt) : 0; }
    hover = ptr.inside && ptr.type === 'mouse' ? cellAt(ptr.x, ptr.y) : -1;
    fx.update(dt); fl.update(dt);
  }

  function toPx(p) { return [ox + p[0] * cs + cs / 2, oy + p[1] * cs + cs / 2]; }

  function draw() {
    const w = st.w, h = st.h;
    ctx.fillStyle = P.paper; ctx.fillRect(0, 0, w, h);

    // Tafel
    ctx.fillStyle = P.card; ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
    ctx.fillRect(ox, oy, cs * n, cs * n);
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < n; i++) { ctx.moveTo(ox + i * cs, oy); ctx.lineTo(ox + i * cs, oy + n * cs); ctx.moveTo(ox, oy + i * cs); ctx.lineTo(ox + n * cs, oy + i * cs); }
    ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, cs * n, cs * n);

    // Zellen
    for (let id = 0; id < n * n; id++) {
      const c = grid[id];
      const x = ox + (id % n) * cs, y = oy + ((id / n) | 0) * cs;
      if (id === hover && c && c.m && !c.lock && !solved) { ctx.fillStyle = P.paper2; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2); }
      if (!c) continue;
      if (c.stone) {
        ctx.fillStyle = P.ink; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.roundRect(x + cs * 0.16, y + cs * 0.16, cs * 0.68, cs * 0.68, cs * 0.12); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = P.paper; ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(x + cs * 0.3, y + cs * 0.4); ctx.lineTo(x + cs * 0.5, y + cs * 0.55); ctx.lineTo(x + cs * 0.68, y + cs * 0.38); ctx.stroke();
      }
      if (c.target) {
        const on = beam && beam.hits.has(id);
        const cx = x + cs / 2, cy = y + cs / 2, r = cs * 0.24 * (on ? 1 + Math.sin(t * 6) * 0.06 : 1);
        const dia = () => { ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.8, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.8, cy); ctx.closePath(); };
        if (on) { ctx.globalAlpha = 0.35; ctx.fillStyle = P.yellow; ctx.beginPath(); ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
        S.riso(ctx, dia, P.pink, on ? P.yellow : P.card, 2, 2);
        ctx.strokeStyle = P.ink; ctx.lineWidth = 2; dia(); ctx.stroke();
      }
      if (c.m) {
        const cx = x + cs / 2, cy = y + cs / 2, L = cs * 0.36;
        ctx.save(); ctx.translate(cx, cy);
        ctx.rotate((c.m === '/' ? -Math.PI / 4 : Math.PI / 4) + (c.rot || 0) * (c.lock ? Math.sin(t * 60) : 1));
        if (c.lock) { ctx.fillStyle = P.paper2; ctx.fillRect(-L - 4, -cs * 0.22, (L + 4) * 2, cs * 0.44); }
        ctx.lineCap = 'round';
        ctx.strokeStyle = P.blue; ctx.lineWidth = Math.max(5, cs * 0.12);
        ctx.beginPath(); ctx.moveTo(-L + 2, 3); ctx.lineTo(L + 2, 3); ctx.stroke();
        ctx.strokeStyle = P.ink;
        ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
        if (c.lock) { ctx.fillStyle = P.ink; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * (L + 1), -cs * 0.15, 2.4, 0, Math.PI * 2); ctx.fill(); } }
        ctx.restore();
      }
    }

    // Strahl
    if (beam) {
      const pts = beam.pts.map(toPx);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = P.pink; ctx.globalAlpha = 0.28; ctx.lineWidth = Math.max(8, cs * 0.22);
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 3;
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
      ctx.save(); ctx.strokeStyle = P.paper; ctx.lineWidth = 1.5; ctx.setLineDash([3, 11]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
      ctx.restore();
      // Lampe
      const [lx, ly] = toPx([src.x - src.dx * 0.5 - src.dx * 0.35, src.y - src.dy * 0.5 - src.dy * 0.35]);
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(Math.atan2(src.dy, src.dx));
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.roundRect(-16, -11, 18, 22, 4); ctx.fill();
      ctx.fillStyle = P.pink; ctx.beginPath(); ctx.arc(2, 0, 6, -Math.PI / 2, Math.PI / 2); ctx.fill();
      ctx.restore();
    }

    // Kopfzeile
    ctx.fillStyle = P.ink; ctx.font = '600 13px "IBM Plex Mono", monospace'; ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left'; ctx.fillText(`Level ${level}`, ox, oy - 14);
    ctx.textAlign = 'right';
    const lit = beam ? beam.hits.size : 0;
    ctx.fillText(`${lit}/${targetsCount()} Kristalle · ${moves} Züge`, ox + cs * n, oy - 14);
    ctx.textAlign = 'left';
    if (solved) {
      ctx.textAlign = 'center'; ctx.font = '600 italic 28px "Fraunces", Georgia, serif';
      ctx.fillStyle = P.ink; ctx.fillText('Alles im Licht', w / 2, oy + cs * n + 34);
      ctx.textAlign = 'left';
    }
    fx.draw(ctx); fl.draw(ctx);
  }

  newLevel();
  ov.show('Lichtweg',
    'Eine Lampe wirft einen Strahl über das Brett. <b>Tippe Spiegel an</b>, um sie zu kippen, bis der Strahl jeden Kristall trifft. Verschraubte Spiegel bewegen sich nicht, Steine schlucken das Licht. Weniger Züge geben mehr Punkte.',
    'Los', () => {});

  S.loop((dt) => { update(dt); draw(); });
})();
