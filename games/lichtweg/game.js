/* Lichtweg: Spiegel drehen, bis der Strahl alle Kristalle in der richtigen Farbe trifft */
(() => {
  const S = Shell, E = S.ease, snd = S.sound;
  const cv = document.getElementById('c');
  let P = S.palette();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { P = S.palette(); });
  const st = S.stage(cv, () => layout());
  const ctx = st.ctx;
  const hud = S.hud('lichtweg');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  /* Zellen:
     {k:'mirror'|'split', m:'/'|'\\', lock, sol, ang, from, tw}
     {k:'filter', c}  {k:'portal', to}  {k:'stone'}  {k:'target', c, glow} */
  const COLS = ['p', 'b', 'g'];
  const colorOf = (c) => (c === 'b' ? P.blue : c === 'g' ? P.green : P.pink);
  const NAMES = { p: 'rosa', b: 'blau', g: 'grün' };

  let n = 5, grid = [], initial = [], src = null;
  let level = S.store.get('lichtweg:level', 1), score = S.store.get('lichtweg:score', 0);
  let moves = 0, par = 0, hintUsed = false, history = [];
  let tr = null, grown = 0, fade = null, litSet = new Set();
  let phase = 'in', phaseT = 0, t = 0, hover = -1, hintCell = -1, hintT = 0, winInfo = null;
  let ox = 0, oy = 0, cs = 40, buttons = [];
  const GROW = 15; // Zellen pro Sekunde

  const reflect = (dx, dy, m) => (m === '/' ? [-dy, -dx] : [dy, dx]);
  const angFor = (m) => (m === '/' ? -Math.PI / 4 : Math.PI / 4);
  const inB = (x, y) => x >= 0 && y >= 0 && x < n && y < n;

  /* ---------- Strahlverfolgung mit Verzweigungen ---------- */
  function trace(g) {
    const segs = [], hits = new Map(), passD = new Map(), bounces = [], passC = new Map();
    const seen = new Set();
    const q = [{ x: src.x, y: src.y, dx: src.dx, dy: src.dy, c: 'p', px: src.x - src.dx * 0.85, py: src.y - src.dy * 0.85, d: 0 }];
    let guard = 0;
    const seg = (x1, y1, x2, y2, c, d) => { const L = Math.hypot(x2 - x1, y2 - y1); if (L > 0.001) segs.push({ x1, y1, x2, y2, c, d0: d, d1: d + L }); return d + L; };
    while (q.length && guard++ < 64) {
      let { x, y, dx, dy, c, px, py, d } = q.shift();
      for (let steps = 0; steps < 300; steps++) {
        if (!inB(x, y)) { d = seg(px, py, x - dx * 0.5, y - dy * 0.5, c, d); break; }
        const key = `${x},${y},${dx},${dy},${c}`;
        if (seen.has(key)) { seg(px, py, x - dx * 0.5, y - dy * 0.5, c, d); break; }
        seen.add(key);
        const id = y * n + x, cell = g[id];
        const dc = d + Math.hypot(x - px, y - py);
        if (!passD.has(id) || passD.get(id) > dc) passD.set(id, dc);
        if (!passC.has(id)) passC.set(id, new Set());
        passC.get(id).add(c);
        if (cell) {
          if (cell.k === 'stone') { seg(px, py, x - dx * 0.5, y - dy * 0.5, c, d); break; }
          if (cell.k === 'target') { if (!hits.has(id)) hits.set(id, []); hits.get(id).push({ c, d: dc }); }
          if (cell.k === 'filter') { d = seg(px, py, x, y, c, d); px = x; py = y; c = cell.c; }
          if (cell.k === 'mirror') { d = seg(px, py, x, y, c, d); px = x; py = y; bounces.push({ x, y, d, c }); [dx, dy] = reflect(dx, dy, cell.m); }
          if (cell.k === 'split') {
            d = seg(px, py, x, y, c, d); px = x; py = y; bounces.push({ x, y, d, c });
            const [rx, ry] = reflect(dx, dy, cell.m);
            q.push({ x: x + rx, y: y + ry, dx: rx, dy: ry, c, px: x, py: y, d });
          }
          if (cell.k === 'portal') {
            d = seg(px, py, x, y, c, d);
            const o = cell.to, tx = o % n, ty = (o / n) | 0;
            bounces.push({ x, y, d, c, portal: true });
            d += 0.4; px = tx; py = ty;
            bounces.push({ x: tx, y: ty, d, c, portal: true });
            seen.add(`${tx},${ty},${dx},${dy},${c}`);
            if (!passD.has(o) || passD.get(o) > d) passD.set(o, d);
            x = tx; y = ty;
          }
        }
        x += dx; y += dy;
      }
    }
    let maxD = 0; for (const s of segs) maxD = Math.max(maxD, s.d1);
    return { segs, hits, passD, passC, bounces, maxD };
  }

  function isSolvedBy(g, r) {
    for (let id = 0; id < g.length; id++) {
      const c = g[id];
      if (c && c.k === 'target') { const h = r.hits.get(id); if (!h || !h.some((x) => x.c === c.c)) return false; }
    }
    return true;
  }

  /* ---------- Levelbau ---------- */
  function rules(lv) {
    return {
      n: Math.min(5 + Math.floor((lv - 1) / 3), 9),
      minRot: Math.min(2 + Math.floor(lv / 2), 10),
      targets: Math.min(2 + Math.floor(lv / 3), 6),
      locks: lv >= 4, stones: lv >= 4,
      splits: lv >= 6 ? (lv >= 10 ? 2 : 1) : 0,
      filters: lv >= 9 ? (lv >= 14 ? 2 : 1) : 0,
      portal: lv >= 12,
    };
  }

  function generate() {
    const R = rules(level);
    n = R.n;
    for (let relax = 0; relax < 6; relax++) {
      for (let tries = 0; tries < 700; tries++) {
        const g = attempt(R, Math.max(2, R.minRot - relax), Math.max(2, R.targets - Math.floor(relax / 2)));
        if (g) { grid = g; initial = clone(g); return; }
      }
    }
  }

  function clone(g) { return g.map((c) => (c ? { ...c } : null)); }

  function attempt(R, minRot, wantTargets) {
    const g = new Array(n * n).fill(null);
    const side = S.randInt(0, 3), k = S.randInt(0, n - 1);
    src = side === 0 ? { x: 0, y: k, dx: 1, dy: 0 } : side === 1 ? { x: n - 1, y: k, dx: -1, dy: 0 } : side === 2 ? { x: k, y: 0, dx: 0, dy: 1 } : { x: k, y: n - 1, dx: 0, dy: -1 };
    const visited = new Set();
    let rot = 0, splits = 0, filters = 0, portal = false;
    const q = [{ x: src.x, y: src.y, dx: src.dx, dy: src.dy, c: 'p' }];
    const seen = new Set();
    let guard = 0;
    while (q.length && guard++ < 8) {
      let { x, y, dx, dy, c } = q.shift();
      for (let steps = 0; steps < n * n * 2; steps++) {
        if (!inB(x, y)) break;
        const key = `${x},${y},${dx},${dy}`;
        if (seen.has(key)) return null;
        seen.add(key);
        const id = y * n + x;
        if (!g[id] && !visited.has(id) && steps > 0) {
          const r = Math.random();
          if (r < 0.3) { g[id] = { k: 'mirror', m: Math.random() < 0.5 ? '/' : '\\' }; rot++; }
          else if (r < 0.4 && splits < R.splits) { g[id] = { k: 'split', m: Math.random() < 0.5 ? '/' : '\\' }; splits++; rot++; }
          else if (r < 0.48 && filters < R.filters) { g[id] = { k: 'filter', c: S.pick(COLS.filter((z) => z !== c)) }; filters++; }
          else if (r < 0.53 && R.portal && !portal) {
            const free = [];
            for (let i = 0; i < n * n; i++) if (!g[i] && !visited.has(i) && i !== id && Math.abs((i % n) - x) + Math.abs(((i / n) | 0) - y) > 3) free.push(i);
            if (free.length) { const o = S.pick(free); g[id] = { k: 'portal', to: o }; g[o] = { k: 'portal', to: id }; portal = true; }
          }
        }
        visited.add(id);
        const cell = g[id];
        if (cell) {
          if (cell.k === 'mirror') [dx, dy] = reflect(dx, dy, cell.m);
          else if (cell.k === 'split') { const [rx, ry] = reflect(dx, dy, cell.m); q.push({ x: x + rx, y: y + ry, dx: rx, dy: ry, c }); }
          else if (cell.k === 'filter') c = cell.c;
          else if (cell.k === 'portal') { const o = cell.to; x = o % n; y = (o / n) | 0; visited.add(o); seen.add(`${x},${y},${dx},${dy}`); }
        }
        x += dx; y += dy;
      }
    }
    if (rot < minRot || visited.size < n * 1.8) return null;
    if (R.splits && level >= 7 && splits === 0 && Math.random() < 0.7) return null;
    if (R.filters && level >= 10 && filters === 0 && Math.random() < 0.7) return null;
    if (R.portal && level >= 13 && !portal && Math.random() < 0.7) return null;

    // Kristalle: freie Pfadzellen mit eindeutiger Farbe
    const sol = trace(g);
    const cand = [];
    for (const [id, set] of sol.passC) if (!g[id] && set.size === 1) cand.push({ id, c: [...set][0] });
    if (cand.length < wantTargets) return null;
    S.shuffle(cand);
    cand.sort((a, b) => (a.c === 'p') - (b.c === 'p'));
    const targets = [];
    for (const cd of cand) {
      if (targets.length >= wantTargets) break;
      if (targets.some((o) => Math.abs((o.id % n) - (cd.id % n)) + Math.abs(((o.id / n) | 0) - ((cd.id / n) | 0)) < 2)) continue;
      targets.push(cd);
    }
    if (targets.length < wantTargets) return null;
    for (const tg of targets) g[tg.id] = { k: 'target', c: tg.c };

    // Ablenkungen abseits des Wegs
    const off = []; for (let i = 0; i < n * n; i++) if (!sol.passC.has(i) && !g[i]) off.push(i);
    S.shuffle(off);
    let oi = 0;
    const decoys = Math.min(off.length, 1 + Math.floor(level * 0.6));
    for (let i = 0; i < decoys; i++) { g[off[oi++]] = { k: Math.random() < 0.2 && R.splits ? 'split' : 'mirror', m: Math.random() < 0.5 ? '/' : '\\' }; }
    if (R.stones) { const sc = Math.min(off.length - oi, S.randInt(1, 1 + Math.floor(level / 4))); for (let i = 0; i < sc; i++) g[off[oi++]] = { k: 'stone' }; }

    // Lösung merken, manche Teile fest, dann mischen
    const movable = [];
    for (let i = 0; i < g.length; i++) {
      const c = g[i];
      if (c && (c.k === 'mirror' || c.k === 'split')) {
        c.sol = c.m; c.lock = false;
        if (R.locks && sol.passC.has(i) && Math.random() < 0.2) c.lock = true;
        if (!c.lock) movable.push(i);
      }
    }
    if (movable.length < 2) return null;
    const need = Math.max(2, Math.ceil(movable.length * 0.5));
    S.shuffle(movable);
    for (let i = 0; i < need; i++) g[movable[i]].m = g[movable[i]].m === '/' ? '\\' : '/';
    if (isSolvedBy(g, trace(g))) return null;
    par = 0; for (const i of movable) if (g[i].m !== g[i].sol) par++;
    for (const c of g) if (c && c.m) { c.ang = angFor(c.m); c.from = c.ang; c.tw = 1; }
    return g;
  }

  /* ---------- Layout ---------- */
  function layout() {
    const padX = 30, top = 54, bottom = 84;
    cs = Math.floor(Math.min((st.w - padX * 2) / (n + 1.4), (st.h - top - bottom) / (n + 0.6), 82));
    cs = Math.max(cs, 26);
    ox = Math.floor((st.w - cs * n) / 2);
    oy = Math.floor(top + (st.h - top - bottom - cs * n) / 2);
    const bw = Math.min(118, (st.w - 40) / 3 - 8), bh = 34, by = oy + cs * n + 26;
    const labels = [['undo', 'Zurück'], ['hint', 'Tipp'], ['reset', 'Neu']];
    const total = labels.length * bw + (labels.length - 1) * 10;
    buttons = labels.map(([id, label], i) => ({ id, label, x: st.w / 2 - total / 2 + i * (bw + 10), y: by, w: bw, h: bh }));
  }

  /* ---------- Ablauf ---------- */
  const INTRO = {
    4: ['Neue Teile', 'Spiegel mit <b>Schrauben</b> lassen sich nicht drehen. <b>Steine</b> schlucken das Licht.'],
    6: ['Strahlteiler', 'Halbdurchlässiges Glas: Der Strahl läuft <b>geradeaus weiter und wird zugleich abgelenkt</b>. Auch Teiler lassen sich drehen.'],
    9: ['Farbfilter', 'Farbiges Glas <b>färbt den Strahl um</b>. Jeder Kristall leuchtet nur, wenn ihn Licht in seiner eigenen Farbe trifft.'],
    12: ['Portale', 'Licht, das in ein Portal fällt, kommt <b>am anderen Portal</b> in derselben Richtung wieder heraus.'],
  };

  function beginLevel(showIntro = true) {
    generate(); layout();
    moves = 0; hintUsed = false; history = []; litSet = new Set(); fade = null; winInfo = null;
    tr = trace(grid); grown = 0;
    phase = 'in'; phaseT = 0;
    S.store.set('lichtweg:level', level);
    if (showIntro && INTRO[level]) { phase = 'paused'; ov.show(INTRO[level][0], INTRO[level][1], 'Verstanden', () => { phase = 'in'; phaseT = 0; }); }
  }

  function retrace(fromId) {
    const old = tr;
    tr = trace(grid);
    const keep = Math.min(grown, old.passD.has(fromId) ? old.passD.get(fromId) : grown);
    fade = { tr: old, from: keep, a: 1, grownAt: grown };
    grown = keep;
    for (const id of [...litSet]) { const h = tr.hits.get(id); const c = grid[id]; if (!h || !h.some((x) => x.c === c.c && x.d <= grown)) litSet.delete(id); }
  }

  function rotate(id, record = true) {
    const c = grid[id];
    const cx = ox + (id % n) * cs + cs / 2, cy = oy + ((id / n) | 0) * cs + cs / 2;
    if (c.lock) { c.shake = 0.35; snd.tone(140, 0.08, 'square', 0.15); fx.burst(cx, cy, P.soft, 4, 50, 0.25, 2); return; }
    c.from = c.ang; c.m = c.m === '/' ? '\\' : '/';
    c.target = (c.target ?? angFor(c.m === '/' ? '\\' : '/')) + Math.PI / 2;
    c.tw = 0;
    if (record) { history.push(id); moves++; }
    snd.tone(c.k === 'split' ? 660 : 520, 0.07, 'triangle', 0.25, 1.4);
    if (hintCell === id) hintCell = -1;
    retrace(id);
  }

  function clickCell(id) {
    if (phase !== 'play' || id < 0) return;
    const c = grid[id];
    if (!c || (c.k !== 'mirror' && c.k !== 'split')) return;
    rotate(id);
  }

  function undo() {
    if (phase !== 'play' || !history.length) return;
    const id = history.pop(); rotate(id, false); moves = Math.max(0, moves - 1);
  }
  function hint() {
    if (phase !== 'play') return;
    const wrong = [];
    for (let i = 0; i < grid.length; i++) { const c = grid[i]; if (c && c.m && !c.lock && c.m !== c.sol) wrong.push(i); }
    if (!wrong.length) return;
    hintCell = S.pick(wrong); hintT = 0; hintUsed = true;
    snd.chord([392, 523], 0.25, 'sine', 0.18);
  }
  function resetLevel() {
    if (phase !== 'play') return;
    grid = clone(initial);
    for (const c of grid) if (c && c.m) { c.ang = angFor(c.m); c.from = c.ang; c.tw = 1; c.target = undefined; }
    moves = 0; history = []; litSet = new Set(); tr = trace(grid); grown = 0; fade = null;
    snd.tone(300, 0.15, 'sine', 0.2, 0.6);
  }

  function win() {
    phase = 'win'; phaseT = 0;
    let stars = moves <= par ? 3 : moves <= par + 3 ? 2 : 1;
    if (hintUsed) stars = Math.min(stars, 2);
    const pts = [0, 20, 35, 50][stars];
    score += pts; hud.score(score); hud.best(score);
    S.store.set('lichtweg:score', score);
    const total = S.store.get('lichtweg:stars', 0) + stars; S.store.set('lichtweg:stars', total);
    winInfo = { stars, pts };
    snd.chord([523, 659, 784, 1046], 0.5, 'triangle', 0.22, 0.07);
  }

  function cellAt(x, y) {
    const cx = Math.floor((x - ox) / cs), cy = Math.floor((y - oy) / cs);
    return inB(cx, cy) ? cy * n + cx : -1;
  }
  function buttonAt(x, y) { return buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); }

  const ptr = S.pointer(cv);
  ptr.onDown = (x, y) => {
    if (ov.open) return;
    const b = buttonAt(x, y);
    if (b) { b.press = 0.2; if (b.id === 'undo') undo(); else if (b.id === 'hint') hint(); else resetLevel(); return; }
    clickCell(cellAt(x, y));
  };
  S.keys((k) => {
    if (ov.open) return;
    if (k === 'r' || k === 'R') resetLevel();
    if (k === 'z' || k === 'Z' || k === 'Backspace') undo();
    if (k === 'h' || k === 'H') hint();
  });

  /* ---------- Update ---------- */
  function update(dt) {
    t += dt; phaseT += dt;
    for (const c of grid) {
      if (!c) continue;
      if (c.m && c.tw < 1) { c.tw = Math.min(1, c.tw + dt * 4.2); c.ang = S.lerp(c.from, c.target, E.outBack(c.tw)); }
      if (c.shake) c.shake = Math.max(0, c.shake - dt);
    }
    for (const b of buttons) if (b.press) b.press = Math.max(0, b.press - dt);
    if (phase === 'in' && phaseT > 0.9) phase = 'play';

    if (phase === 'play' || phase === 'win') {
      grown = Math.min(tr.maxD, grown + GROW * dt);
      if (fade) { fade.a -= dt * 3.5; if (fade.a <= 0) fade = null; }
      // Kristalle zünden, sobald das Licht ankommt
      for (const [id, h] of tr.hits) {
        const c = grid[id];
        if (!litSet.has(id) && h.some((x) => x.c === c.c && x.d <= grown)) {
          litSet.add(id);
          const cx = ox + (id % n) * cs + cs / 2, cy = oy + ((id / n) | 0) * cs + cs / 2;
          fx.burst(cx, cy, colorOf(c.c), 12, 140, 0.6, 3);
          snd.tone(660 + litSet.size * 110, 0.22, 'sine', 0.22);
        }
      }
      // Funken an Umlenkpunkten
      for (const b of tr.bounces) {
        if (b.d <= grown && Math.random() < dt * 5) {
          fx.list.push({ x: ox + b.x * cs + cs / 2, y: oy + b.y * cs + cs / 2, vx: S.rand(-30, 30), vy: S.rand(-50, -10), life: 0.5, max: 0.5, color: colorOf(b.c), size: 2 });
        }
      }
      if (phase === 'play' && grown >= tr.maxD - 0.001 && isSolvedBy(grid, tr) && litSet.size === grid.filter((c) => c && c.k === 'target').length) win();
    }
    if (phase === 'win' && phaseT > 2.4) { phase = 'out'; phaseT = 0; snd.tone(220, 0.3, 'sine', 0.12, 2); }
    if (phase === 'out' && phaseT > 0.55) { level++; beginLevel(); }
    if (hintCell >= 0) { hintT += dt; if (hintT > 3) hintCell = -1; }

    hover = ptr.inside && ptr.type === 'mouse' && phase === 'play' ? cellAt(ptr.x, ptr.y) : -1;
    const hc = hover >= 0 ? grid[hover] : null;
    const hb = ptr.inside && ptr.type === 'mouse' ? buttonAt(ptr.x, ptr.y) : null;
    cv.style.cursor = (hc && hc.m && !hc.lock) || hb ? 'pointer' : 'default';
    fx.update(dt, 40); fl.update(dt);
  }

  /* ---------- Zeichnen ---------- */
  function cellScale(x, y) {
    if (phase === 'in') { const delay = ((x + y) / Math.max(1, 2 * n - 2)) * 0.45; return E.outBack(S.clamp((phaseT - delay) / 0.42, 0, 1)); }
    if (phase === 'out') { const delay = (1 - (x + y) / Math.max(1, 2 * n - 2)) * 0.25; return 1 - E.inOut(S.clamp((phaseT - delay) / 0.3, 0, 1)); }
    if (phase === 'paused') return 0;
    return 1;
  }

  function drawBeamPart(s, upTo, alphaMul) {
    if (upTo <= s.d0) return;
    const k = Math.min(1, (upTo - s.d0) / (s.d1 - s.d0));
    const x1 = ox + s.x1 * cs + cs / 2, y1 = oy + s.y1 * cs + cs / 2;
    const x2 = ox + S.lerp(s.x1, s.x2, k) * cs + cs / 2, y2 = oy + S.lerp(s.y1, s.y2, k) * cs + cs / 2;
    const col = colorOf(s.c);
    ctx.strokeStyle = col; ctx.lineCap = 'round';
    ctx.globalAlpha = 0.16 * alphaMul; ctx.lineWidth = Math.max(14, cs * 0.36);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = 0.32 * alphaMul; ctx.lineWidth = Math.max(7, cs * 0.16);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = alphaMul; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // wandernde Lichtteilchen
    ctx.save(); ctx.strokeStyle = P.paper; ctx.globalAlpha = 0.9 * alphaMul; ctx.lineWidth = 1.6;
    ctx.setLineDash([2, 13]); ctx.lineDashOffset = -(t * 60) + s.d0 * cs;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    // Kopf des Strahls
    if (k < 1) {
      ctx.globalAlpha = alphaMul; ctx.fillStyle = P.paper;
      ctx.beginPath(); ctx.arc(x2, y2, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x2, y2, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPiece(c, id, x, y, sc) {
    const cx = x + cs / 2, cy = y + cs / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
    if (c.k === 'stone') {
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.roundRect(-cs * 0.34, -cs * 0.34, cs * 0.68, cs * 0.68, cs * 0.14); ctx.fill();
      ctx.strokeStyle = P.paper; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(-cs * 0.2, -cs * 0.08); ctx.lineTo(0, cs * 0.06); ctx.lineTo(cs * 0.18, -cs * 0.12); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (c.k === 'filter') {
      ctx.fillStyle = colorOf(c.c); ctx.globalAlpha = 0.38;
      ctx.fillRect(-cs * 0.38, -cs * 0.38, cs * 0.76, cs * 0.76); ctx.globalAlpha = 1;
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.strokeRect(-cs * 0.38, -cs * 0.38, cs * 0.76, cs * 0.76);
      ctx.strokeStyle = colorOf(c.c); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-cs * 0.26, cs * 0.1); ctx.lineTo(-cs * 0.1, -cs * 0.26); ctx.moveTo(-cs * 0.26, cs * 0.26); ctx.lineTo(cs * 0.06, -cs * 0.26); ctx.stroke();
    } else if (c.k === 'portal') {
      const r = cs * 0.32;
      ctx.rotate(t * 1.4 * (id < c.to ? 1 : -1));
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i === 1 ? P.blue : P.ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r * (1 - i * 0.28), i * 1.3, i * 1.3 + Math.PI * 1.4); ctx.stroke();
      }
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (c.k === 'target') {
      const on = litSet.has(id);
      const col = colorOf(c.c);
      const pulse = on ? 1 + Math.sin(t * 5 + id) * 0.07 : 1 + Math.sin(t * 2 + id) * 0.02;
      const r = cs * 0.25 * pulse;
      if (on) {
        ctx.save(); ctx.rotate(t * 0.8);
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.55;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r1 = r * 1.35, r2 = r * (1.75 + 0.2 * Math.sin(t * 6 + i)); ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); ctx.stroke(); }
        ctx.restore(); ctx.globalAlpha = 0.25; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      const dia = () => { ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.78, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.78, 0); ctx.closePath(); };
      ctx.save(); ctx.translate(2, 2); ctx.fillStyle = P.ink; ctx.globalAlpha = 0.2; dia(); ctx.fill(); ctx.restore();
      ctx.fillStyle = on ? col : P.card; dia(); ctx.fill();
      if (!on) { ctx.save(); dia(); ctx.clip(); ctx.fillStyle = col; ctx.globalAlpha = 0.35; ctx.fillRect(-r, r * 0.2, r * 2, r); ctx.restore(); }
      ctx.save(); dia(); ctx.clip(); ctx.globalAlpha = 0.35; S.tex.halftoneRect(ctx, 0, -r, r, r * 2, P.ink, (u) => 0.25 + u * 0.6, 3.2); ctx.restore();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; dia(); ctx.stroke();
      ctx.strokeStyle = on ? P.paper : col; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-r * 0.78, 0); ctx.lineTo(r * 0.78, 0); ctx.moveTo(0, -r); ctx.lineTo(r * 0.3, 0); ctx.lineTo(0, r); ctx.stroke();
    } else if (c.m) {
      const L = cs * 0.37;
      const jit = c.shake ? Math.sin(t * 70) * c.shake * 0.4 : 0;
      ctx.rotate(c.ang + jit);
      if (c.lock) {
        ctx.fillStyle = P.paper2; ctx.strokeStyle = P.line; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(-L - 5, -cs * 0.16, (L + 5) * 2, cs * 0.32, 4); ctx.fill(); ctx.stroke();
      }
      ctx.lineCap = 'round';
      const w = Math.max(5, cs * 0.12);
      if (c.k === 'split') {
        ctx.strokeStyle = P.blue; ctx.globalAlpha = 0.35; ctx.lineWidth = w + 4;
        ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(-L, -w / 2); ctx.lineTo(L, -w / 2); ctx.moveTo(-L, w / 2); ctx.lineTo(L, w / 2); ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = P.blue; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(-L + 2, 3); ctx.lineTo(L + 2, 3); ctx.stroke();
        ctx.strokeStyle = P.ink;
        ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
        ctx.strokeStyle = P.paper; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-L * 0.6, -1); ctx.lineTo(-L * 0.1, -1); ctx.stroke(); ctx.globalAlpha = 1;
      }
      // Drehpunkt
      ctx.fillStyle = c.lock ? P.ink : P.card; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (c.lock) { ctx.fillStyle = P.ink; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * (L + 1), 0, 2.2, 0, Math.PI * 2); ctx.fill(); } }
    }
    ctx.restore();
  }

  function draw() {
    const w = st.w, h = st.h;
    ctx.fillStyle = P.paper; ctx.fillRect(0, 0, w, h);
    // feine Punkte im Hintergrund
    ctx.fillStyle = P.line;
    for (let y = 14; y < h; y += 28) for (let x = 14; x < w; x += 28) ctx.fillRect(x, y, 1.5, 1.5);

    const boardIn = phase === 'in' ? E.outCubic(S.clamp(phaseT / 0.35, 0, 1)) : phase === 'out' ? 1 - S.clamp((phaseT - 0.25) / 0.3, 0, 1) : phase === 'paused' ? 0 : 1;
    // Brett mit versetztem Schatten
    ctx.globalAlpha = boardIn;
    ctx.fillStyle = P.pink; ctx.globalAlpha = 0.5 * boardIn; ctx.fillRect(ox + 6, oy + 6, cs * n, cs * n);
    ctx.globalAlpha = boardIn; ctx.fillStyle = P.card; ctx.fillRect(ox, oy, cs * n, cs * n);
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 1; i < n; i++) { ctx.moveTo(ox + i * cs, oy); ctx.lineTo(ox + i * cs, oy + n * cs); ctx.moveTo(ox, oy + i * cs); ctx.lineTo(ox + n * cs, oy + i * cs); }
    ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, cs * n, cs * n);
    // Kanten des Bretts gerastert, damit es nach Druck aussieht
    ctx.globalAlpha = 0.18 * boardIn;
    S.tex.halftoneRect(ctx, ox, oy, cs * n, cs * n, P.ink, (u, v) => Math.max(0, (Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) - 0.38) * 3.2), 6);
    ctx.globalAlpha = 1;

    // Siegeswelle
    if (phase === 'win') {
      const wave = phaseT * 14;
      for (let id = 0; id < n * n; id++) {
        const x = id % n, y = (id / n) | 0;
        const d = Math.hypot(x - src.x, y - src.y);
        const k = 1 - Math.abs(d - wave) / 1.6;
        if (k > 0) { ctx.globalAlpha = k * 0.35; ctx.fillStyle = P.yellow; ctx.fillRect(ox + x * cs + 1, oy + y * cs + 1, cs - 2, cs - 2); }
      }
      ctx.globalAlpha = 1;
    }

    // Hover und Tipp
    if (hover >= 0) { const c = grid[hover]; if (c && c.m && !c.lock) { ctx.fillStyle = P.paper2; ctx.fillRect(ox + (hover % n) * cs + 1, oy + ((hover / n) | 0) * cs + 1, cs - 2, cs - 2); } }
    if (hintCell >= 0) {
      const x = ox + (hintCell % n) * cs, y = oy + ((hintCell / n) | 0) * cs;
      ctx.strokeStyle = P.orange; ctx.lineWidth = 3; ctx.globalAlpha = 0.5 + Math.sin(t * 10) * 0.4;
      ctx.strokeRect(x + 3, y + 3, cs - 6, cs - 6); ctx.globalAlpha = 1;
    }

    // Strahl (alt ausblenden, neu wachsen lassen)
    if (tr && phase !== 'paused' && phase !== 'in') {
      if (fade) for (const s of fade.tr.segs) if (s.d1 > fade.from) {
        const cut = { ...s };
        if (cut.d0 < fade.from) { const k = (fade.from - s.d0) / (s.d1 - s.d0); cut.x1 = S.lerp(s.x1, s.x2, k); cut.y1 = S.lerp(s.y1, s.y2, k); cut.d0 = fade.from; }
        drawBeamPart(cut, fade.grownAt, Math.max(0, fade.a) * 0.6);
      }
      const outK = phase === 'out' ? 1 - S.clamp(phaseT / 0.25, 0, 1) : 1;
      for (const s of tr.segs) drawBeamPart(s, grown, outK);
    }

    // Teile
    for (let id = 0; id < n * n; id++) {
      const c = grid[id];
      if (!c) continue;
      const sc = cellScale(id % n, (id / n) | 0);
      if (sc <= 0.01) continue;
      drawPiece(c, id, ox + (id % n) * cs, oy + ((id / n) | 0) * cs, sc);
    }

    // Lampe
    if (src && phase !== 'paused') {
      const lx = ox + (src.x - src.dx * 0.85) * cs + cs / 2, ly = oy + (src.y - src.dy * 0.85) * cs + cs / 2;
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(Math.atan2(src.dy, src.dx)); ctx.globalAlpha = boardIn;
      const g = 1 + Math.sin(t * 3) * 0.12;
      ctx.fillStyle = P.pink; ctx.globalAlpha = 0.25 * boardIn; ctx.beginPath(); ctx.arc(4, 0, 14 * g, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = boardIn;
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.roundRect(-17, -12, 20, 24, 5); ctx.fill();
      ctx.fillStyle = P.pink; ctx.beginPath(); ctx.arc(3, 0, 7, -Math.PI / 2, Math.PI / 2); ctx.fill();
      ctx.restore();
    }

    // Kopfzeile
    const targets = grid.filter((c) => c && c.k === 'target');
    ctx.fillStyle = P.ink; ctx.font = '600 13px "IBM Plex Mono", monospace'; ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left'; ctx.fillText(`Level ${level}`, ox, oy - 16);
    ctx.textAlign = 'right';
    ctx.fillText(`${litSet.size}/${targets.length} ◆   ${moves} ${moves === 1 ? 'Zug' : 'Züge'} · Ziel ${par}`, ox + cs * n, oy - 16);
    ctx.textAlign = 'left';

    // Knöpfe
    ctx.font = '600 13px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of buttons) {
      const p = b.press ? 2 : 0;
      const off = (b.id === 'undo' && !history.length) || phase !== 'play';
      ctx.globalAlpha = off ? 0.4 : 1;
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.roundRect(b.x + 3, b.y + 3, b.w, b.h, 17); ctx.fill();
      ctx.fillStyle = b.id === 'hint' ? P.yellow : P.card; ctx.beginPath(); ctx.roundRect(b.x + p, b.y + p, b.w, b.h, 17); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = b.id === 'hint' ? '#23202c' : P.ink; ctx.fillText(b.label, b.x + b.w / 2 + p, b.y + b.h / 2 + p + 1);
    }
    ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    fx.draw(ctx); fl.draw(ctx);
    S.tex.grain(ctx, w, h, P.ink, P.dark ? 0.5 : 1);

    // Sternekarte
    if (phase === 'win' && winInfo) {
      const k = E.outBack(S.clamp(phaseT / 0.4, 0, 1));
      const cw = Math.min(300, w - 40), chh = 132;
      const cx = w / 2, cy = oy + (cs * n) / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.roundRect(-cw / 2 + 6, -chh / 2 + 6, cw, chh, 8); ctx.fill();
      ctx.fillStyle = P.card; ctx.beginPath(); ctx.roundRect(-cw / 2, -chh / 2, cw, chh, 8); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = P.ink; ctx.textAlign = 'center';
      ctx.font = '600 italic 26px "Fraunces", Georgia, serif'; ctx.fillText('Alles im Licht', 0, -26);
      for (let i = 0; i < 3; i++) {
        const sk = E.outElastic(S.clamp((phaseT - 0.35 - i * 0.18) / 0.6, 0, 1));
        const on = i < winInfo.stars;
        ctx.save(); ctx.translate((i - 1) * 46, 18); ctx.scale(sk, sk);
        star(0, 0, 17, 7.5); ctx.fillStyle = on ? P.yellow : P.paper2; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
        if (on && phaseT - 0.35 - i * 0.18 > 0 && phaseT - 0.35 - i * 0.18 < 0.03) snd.tone(880 + i * 220, 0.18, 'triangle', 0.2);
      }
      ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.fillStyle = P.soft;
      ctx.fillText(`+${winInfo.pts} Punkte${hintUsed ? ' · mit Tipp' : ''}`, 0, 54);
      ctx.restore(); ctx.textAlign = 'left';
    }
  }

  function star(x, y, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }

  hud.score(score);
  beginLevel(false);
  phase = 'paused';
  const cont = level > 1 ? `Du machst bei <b>Level ${level}</b> weiter.` : 'Neue Teile kommen nach und nach dazu.';
  ov.show('Lichtweg',
    `Eine Lampe wirft einen Strahl über das Brett. <b>Tippe Spiegel an</b>, um sie zu kippen, bis jeder Kristall leuchtet. Wer mit wenigen Zügen auskommt, bekommt drei Sterne. ${cont}<br><br><kbd>Z</kbd> zurück · <kbd>H</kbd> Tipp · <kbd>R</kbd> neu`,
    level > 1 ? 'Weiterspielen' : 'Los', () => { if (INTRO[level] && level > 1) { ov.show(INTRO[level][0], INTRO[level][1], 'Verstanden', () => { phase = 'in'; phaseT = 0; }); } else { phase = 'in'; phaseT = 0; } });

  S.loop((dt) => { update(dt); draw(); });
})();
