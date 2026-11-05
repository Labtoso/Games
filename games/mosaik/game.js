/* Mosaic: logic puzzle. Each number counts the glazed tiles in the 3×3 block around it. */
(() => {
  const S = Shell, E = S.ease, snd = S.sound;
  const cv = document.getElementById('c');
  let P = S.palette();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { P = S.palette(); });
  const st = S.stage(cv, () => layout());
  const ctx = st.ctx;
  const hud = S.hud('mosaik');
  const T = {
    title: 'Mosaic', play: 'Lay tiles', done: 'Finished',
    intro: 'Each number counts the glazed tiles in the 3×3 block around it, itself included. Every puzzle has one solution and needs no guessing.',
    solved: (a, b, c) => `<br>Solved: Easy ${a} · Normal ${b} · Hard ${c}`,
    fill: 'Mode: glaze', mark: 'Mode: empty', hint: 'Hint', check: 'Check', fresh: 'New puzzle',
    hints: (n) => ` · ${n} hint${n > 1 ? 's' : ''}`,
  };
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();
  const diff = S.difficulty('mosaik');
  const CFG = { easy: { n: 6, rules: 1, keep: 0.3, pts: 50 }, normal: { n: 8, rules: 2, keep: 0.08, pts: 100 }, hard: { n: 10, rules: 2, keep: 0, pts: 200 } };

  let n = 6, sol = [], shown = [], cells = [], clue = [], solved = false, hints = 0, time = 0, solvedT = 0, seed = 1;
  let score = S.store.get('mosaik:score', 0), streakN = 0;
  let ox = 0, oy = 0, cs = 40, buttons = [], markMode = false, painting = null, hover = -1, checkT = 0, introT = 0, tint = [];
  let state = 'menu', t = 0;

  const nb = (i) => { const x = i % n, y = (i / n) | 0, out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < n && b < n) out.push(b * n + a); } return out; };

  /* ---------- Löser: nur logische Schritte, ohne Raten ---------- */
  function solve(show, rules) {
    const s = new Int8Array(n * n).fill(-1);
    const regions = []; for (let i = 0; i < n * n; i++) if (show[i]) regions.push({ c: clue[i], cells: nb(i), i });
    const near = regions.map((A) => regions.filter((B) => B !== A && Math.abs((A.i % n) - (B.i % n)) <= 2 && Math.abs(((A.i / n) | 0) - ((B.i / n) | 0)) <= 2));
    let changed = true, guard = 0;
    while (changed && guard++ < 200) {
      changed = false;
      for (let r = 0; r < regions.length; r++) {
        const A = regions[r];
        let f = 0; const u = [];
        for (const k of A.cells) { if (s[k] === 1) f++; else if (s[k] === -1) u.push(k); }
        if (!u.length) continue;
        if (f === A.c) { for (const k of u) s[k] = 0; changed = true; continue; }
        if (f + u.length === A.c) { for (const k of u) s[k] = 1; changed = true; continue; }
        if (rules < 2) continue;
        const needA = A.c - f;
        for (const B of near[r]) {
          let fb = 0; const ub = [];
          for (const k of B.cells) { if (s[k] === 1) fb++; else if (s[k] === -1) ub.push(k); }
          if (!ub.length) continue;
          const needB = B.c - fb;
          // Liegt A ganz in B, gilt für den Rest von B: needB − needA
          if (u.every((k) => ub.includes(k))) {
            const rest = ub.filter((k) => !u.includes(k));
            if (!rest.length) continue;
            const d = needB - needA;
            if (d === 0) { for (const k of rest) s[k] = 0; changed = true; }
            else if (d === rest.length) { for (const k of rest) s[k] = 1; changed = true; }
          }
          // Überlappung: B kann höchstens so viele im Schnitt haben, wie A braucht
          const inter = ub.filter((k) => u.includes(k)), onlyA = u.filter((k) => !ub.includes(k)), onlyB = ub.filter((k) => !u.includes(k));
          if (inter.length && onlyA.length && onlyB.length) {
            const maxInter = Math.min(inter.length, needB);
            if (needA - maxInter === onlyA.length && maxInter === needB) { for (const k of onlyA) s[k] = 1; for (const k of onlyB) s[k] = 0; changed = true; }
          }
        }
      }
    }
    for (let i = 0; i < n * n; i++) if (s[i] === -1) return null;
    return s;
  }

  function generate() {
    const cfg = CFG[diff.value];
    n = cfg.n;
    for (let tries = 0; tries < 30; tries++) {
      const dens = S.rand(0.42, 0.56);
      sol = []; for (let i = 0; i < n * n; i++) sol.push(Math.random() < dens ? 1 : 0);
      clue = sol.map((_, i) => nb(i).reduce((a, k) => a + sol[k], 0));
      shown = new Array(n * n).fill(true);
      if (!solve(shown, cfg.rules)) continue;
      const order = S.shuffle([...Array(n * n).keys()]);
      for (const i of order) { shown[i] = false; if (!solve(shown, cfg.rules)) shown[i] = true; }
      if (cfg.keep) for (const i of order) if (!shown[i] && Math.random() < cfg.keep) shown[i] = true;
      break;
    }
    cells = new Array(n * n).fill(-1);
    tint = sol.map((_, i) => S.pick([P.pink, P.blue, P.yellow, P.green, P.orange]));
    solved = false; hints = 0; time = 0; solvedT = 0; introT = 0; seed = Math.random() * 100;
  }

  function layout() {
    const top = 46, bottom = 92;
    cs = Math.floor(Math.min((st.w - 32) / n, (st.h - top - bottom) / n, 64));
    ox = Math.floor((st.w - cs * n) / 2);
    oy = Math.floor(top + (st.h - top - bottom - cs * n) / 2);
    const labels = [['mode', markMode ? T.mark : T.fill], ['hint', T.hint], ['check', T.check], ['new', T.fresh]];
    const bw = Math.min(124, (st.w - 24) / labels.length - 6), bh = 34, by = oy + cs * n + 22;
    const total = labels.length * bw + (labels.length - 1) * 6;
    buttons = labels.map(([id, label], i) => ({ id, label, x: st.w / 2 - total / 2 + i * (bw + 6), y: by, w: bw, h: bh }));
  }

  function newPuzzle() { generate(); layout(); state = 'play'; }

  function counts(i) { let f = 0, u = 0; for (const k of nb(i)) { if (cells[k] === 1) f++; else if (cells[k] === -1) u++; } return { f, u }; }

  function setCell(i, v) {
    if (cells[i] === v || solved) return;
    cells[i] = v;
    if (v === 1) snd.tone(420 + ((i * 37) % 7) * 40, 0.05, 'triangle', 0.15);
    else if (v === 0) snd.tone(260, 0.03, 'sine', 0.08);
    checkWin();
  }

  function checkWin() {
    for (let i = 0; i < n * n; i++) if ((cells[i] === 1) !== (sol[i] === 1)) return;
    solved = true; solvedT = 0;
    const cfg = CFG[diff.value];
    const bonus = Math.max(0, Math.round(cfg.pts * 0.6 - time * (diff.value === 'hard' ? 0.5 : 1)));
    const pts = Math.max(10, cfg.pts + bonus - hints * 15);
    score += pts; hud.score(score); hud.best(score); S.store.set('mosaik:score', score);
    const done = S.store.get('mosaik:done:' + diff.value, S.store.get('mosaik:done:' + ({ easy: 'leicht', hard: 'schwer' }[diff.value] || diff.value), 0)) + 1; S.store.set('mosaik:done:' + diff.value, done);
    fl.add(st.w / 2, oy - 8, `+${pts}`, P.ink);
    snd.chord([523, 659, 784, 1046, 1318], 0.6, 'triangle', 0.18, 0.08);
    for (let i = 0; i < n * n; i++) for (let i2 = 0; i2 < (sol[i] ? 1 : 0); i2++) cells[i] = 1;
    for (let i = 0; i < n * n; i++) if (!sol[i]) cells[i] = 0;
  }

  function hint() {
    if (solved || state !== 'play') return;
    const wrong = []; const open = [];
    for (let i = 0; i < n * n; i++) { if (cells[i] !== -1 && cells[i] !== sol[i]) wrong.push(i); else if (cells[i] === -1) open.push(i); }
    const pool = wrong.length ? wrong : open;
    if (!pool.length) return;
    const i = S.pick(pool); hints++;
    cells[i] = sol[i];
    const cx = ox + (i % n) * cs + cs / 2, cy = oy + ((i / n) | 0) * cs + cs / 2;
    fx.burst(cx, cy, P.yellow, 12, 120, 0.5, 3);
    snd.chord([392, 523], 0.2, 'sine', 0.15);
    checkWin();
  }

  function cellAt(x, y) { const cx = Math.floor((x - ox) / cs), cy = Math.floor((y - oy) / cs); return cx >= 0 && cy >= 0 && cx < n && cy < n ? cy * n + cx : -1; }
  const buttonAt = (x, y) => buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);

  const ptr = S.pointer(cv);
  ptr.onDown = (x, y, e) => {
    if (ov.open) return;
    const b = buttonAt(x, y);
    if (b) {
      b.press = 0.2;
      if (b.id === 'mode') { markMode = !markMode; layout(); snd.tone(500, 0.05, 'triangle', 0.12); }
      else if (b.id === 'hint') hint();
      else if (b.id === 'check') { checkT = 1.6; snd.tone(300, 0.1, 'sine', 0.12); }
      else menu();
      return;
    }
    const i = cellAt(x, y);
    if (i < 0 || solved || state !== 'play') return;
    const alt = e && (e.button === 2 || e.shiftKey);
    const want = markMode || alt ? (cells[i] === 0 ? -1 : 0) : (cells[i] === 1 ? 0 : cells[i] === 0 ? -1 : 1);
    painting = want;
    setCell(i, want);
  };
  ptr.onUp = () => { painting = null; };
  S.keys((k) => { if (ov.open) return; if (k === 'h' || k === 'H') hint(); if (k === 'm' || k === 'M') { markMode = !markMode; layout(); } });

  function update(dt) {
    t += dt; introT += dt;
    if (state === 'play' && !solved) time += dt;
    if (solved) solvedT += dt;
    checkT = Math.max(0, checkT - dt);
    for (const b of buttons) if (b.press) b.press = Math.max(0, b.press - dt);
    if (painting !== null && ptr.down) { const i = cellAt(ptr.x, ptr.y); if (i >= 0) setCell(i, painting); }
    hover = ptr.inside && ptr.type === 'mouse' ? cellAt(ptr.x, ptr.y) : -1;
    cv.style.cursor = hover >= 0 || (ptr.inside && buttonAt(ptr.x, ptr.y)) ? 'pointer' : 'default';
    fx.update(dt, 60); fl.update(dt);
  }

  function draw() {
    const w = st.w, h = st.h;
    S.tex.paperBg(ctx, w, h, P);
    if (!sol.length) return;

    // Fugenmörtel unter dem Brett
    ctx.fillStyle = P.ink; ctx.globalAlpha = 0.85;
    S.tex.wobblyRect(ctx, ox - 6, oy - 6, cs * n + 12, cs * n + 12, 1.6, 3); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = P.paper2; ctx.fillRect(ox - 2, oy - 2, cs * n + 4, cs * n + 4);

    const g = Math.max(2, cs * 0.06);
    for (let i = 0; i < n * n; i++) {
      const x = ox + (i % n) * cs, y = oy + ((i / n) | 0) * cs;
      const delay = (((i % n) + ((i / n) | 0)) / (2 * n)) * 0.5;
      const k = E.outBack(S.clamp((introT - delay) / 0.35, 0, 1));
      if (k <= 0.01) continue;
      const v = cells[i];
      const cx = x + cs / 2, cy = y + cs / 2, half = (cs / 2 - g) * k;
      const tile = () => { S.tex.wobblyRect(ctx, cx - half, cy - half, half * 2, half * 2, Math.max(0.8, cs * 0.03), i + seed); };
      const wrong = checkT > 0 && v !== -1 && v !== sol[i];
      if (v === 1) {
        // glasierter Stein: nach dem Lösen bunt, vorher Tintenblau
        const win = solved ? S.clamp((solvedT - delay) / 0.3, 0, 1) : 0;
        const col = win > 0.5 ? tint[i] : P.blue;
        S.riso(ctx, tile, P.ink, wrong ? P.orange : col, 2, 2, { x: cx * 1.7, y: cy * 1.3 });
        ctx.save(); tile(); ctx.clip(); ctx.globalAlpha = 0.35;
        S.tex.halftoneRect(ctx, cx - half, cy - half, half * 2, half * 2, P.paper, (u, vv) => Math.max(0, 0.7 - (u + vv) * 0.7), Math.max(3.5, cs / 9));
        ctx.restore();
        if (win > 0 && win < 1) { ctx.globalAlpha = 1 - win; ctx.fillStyle = P.paper; tile(); ctx.fill(); ctx.globalAlpha = 1; }
      } else {
        ctx.fillStyle = i === hover && !solved ? P.paper : P.card; tile(); ctx.fill();
        ctx.save(); tile(); ctx.clip(); ctx.globalAlpha = 0.12; S.tex.halftoneRect(ctx, cx - half, cy - half, half * 2, half * 2, P.ink, (u, vv) => (u + vv) * 0.4, Math.max(4, cs / 8)); ctx.restore();
        if (v === 0 && !solved) { ctx.fillStyle = wrong ? P.orange : P.soft; ctx.beginPath(); ctx.arc(cx + cs * 0.28, cy + cs * 0.28, Math.max(2, cs * 0.05), 0, Math.PI * 2); ctx.fill(); }
        if (wrong) { ctx.strokeStyle = P.orange; ctx.lineWidth = 2.5; tile(); ctx.stroke(); }
      }
      if (shown[i] && !(solved && solvedT > 1.2)) {
        const { f, u } = counts(i);
        const done = u === 0 && f === clue[i];
        const err = f > clue[i] || f + u < clue[i];
        ctx.font = `400 ${Math.floor(cs * 0.44)}px "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = err ? P.orange : v === 1 ? P.paper : done ? P.soft : P.ink;
        ctx.globalAlpha = done && !err ? 0.55 : 1;
        ctx.fillText(String(clue[i]), cx, cy + 1);
        ctx.globalAlpha = 1;
      }
    }
    ctx.textBaseline = 'alphabetic';

    // Kopfzeile
    ctx.fillStyle = P.ink; ctx.font = '600 13px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${diff.label} · ${n}×${n}`, ox - 4, oy - 16);
    ctx.textAlign = 'right';
    const mm = Math.floor(time / 60), ss = Math.floor(time % 60);
    ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}${hints ? T.hints(hints) : ''}`, ox + cs * n + 4, oy - 16);
    ctx.textAlign = 'left';

    // Knöpfe
    ctx.font = '600 12px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of buttons) {
      const pr = b.press ? 2 : 0;
      ctx.fillStyle = P.ink; S.tex.wobblyRect(ctx, b.x + 3, b.y + 3, b.w, b.h, 1, b.x); ctx.fill();
      ctx.fillStyle = b.id === 'mode' && markMode ? P.ink : b.id === 'new' && solved ? P.pink : P.card;
      S.tex.wobblyRect(ctx, b.x + pr, b.y + pr, b.w, b.h, 1, b.x + 1); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = b.id === 'mode' && markMode ? P.paper : P.ink;
      ctx.fillText(b.label, b.x + b.w / 2 + pr, b.y + b.h / 2 + pr + 1);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    if (solved && solvedT > 0.6) {
      const k = E.outBack(S.clamp((solvedT - 0.6) / 0.4, 0, 1));
      ctx.save(); ctx.translate(st.w / 2, oy + (cs * n) / 2); ctx.scale(k, k);
      ctx.font = '700 38px "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.strokeStyle = P.paper; ctx.strokeText(T.done, 0, 0);
      ctx.fillStyle = P.ink; ctx.fillText(T.done, 0, 0);
      ctx.restore(); ctx.textAlign = 'left';
    }
    fx.draw(ctx); fl.draw(ctx);
    S.tex.grain(ctx, w, h, P.ink, P.dark ? 0.5 : 1);
  }

  function menu() {
    state = 'menu';
    const done = ['easy', 'normal', 'hard'].map((d) => S.store.get('mosaik:done:' + d, S.store.get('mosaik:done:' + ({ easy: 'leicht', hard: 'schwer' }[d] || d), 0)));
    ov.show(T.title, T.intro + T.solved(done[0], done[1], done[2]), T.play, newPuzzle);
    diff.mount(ov);
  }

  S.dbg.next = () => { if (state === 'play' && !solved) { for (let i = 0; i < n * n; i++) cells[i] = sol[i]; checkWin(); } };
  hud.score(score);
  generate(); layout();
  menu();
  S.loop((dt) => { update(dt); draw(); });
})();
