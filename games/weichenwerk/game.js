/* Weichenwerk: Pakete über Weichen in die richtige Rutsche lenken */
(() => {
  const S = Shell;
  const cv = document.getElementById('c');
  let P = S.palette();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { P = S.palette(); });
  const st = S.stage(cv, () => layout());
  const ctx = st.ctx;
  const hud = S.hud('weichenwerk');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  // Knoten: 0 Einlauf, 1..3 Weichen, 4..7 Rutschen
  let nodes = [], segs = {}, switches = [0, 0, 0], chuteColor = [0, 1, 2, 3], parcels = [];
  let score = 0, strikes = 0, state = 'menu', t = 0, spawnT = 0, sorted = 0, shuffleAt = 15, shuffleWarn = 0, shake = 0;
  const KIDS = { 1: [2, 3], 2: [4, 5], 3: [6, 7] };
  const flash = [0, 0, 0, 0];

  const colors = () => [P.pink, P.blue, P.yellow, P.green];

  function layout() {
    const w = st.w, h = st.h;
    const cx = w / 2;
    const top = 16, ys0 = h * 0.22, ys1 = h * 0.47, yc = h * 0.76;
    const spread = Math.min(w * 0.84, 760);
    const left = cx - spread / 2;
    const cxs = [0, 1, 2, 3].map((i) => left + spread * (i + 0.5) / 4);
    const s1x = (cxs[0] + cxs[1]) / 2, s2x = (cxs[2] + cxs[3]) / 2;
    nodes = [
      { x: cx, y: top }, { x: cx, y: ys0 }, { x: s1x, y: ys1 }, { x: s2x, y: ys1 },
      { x: cxs[0], y: yc }, { x: cxs[1], y: yc }, { x: cxs[2], y: yc }, { x: cxs[3], y: yc },
    ];
    const d0 = (ys1 - ys0) * 0.45, d1 = (yc - ys1) * 0.45;
    const path = (a, b, d) => [[nodes[a].x, nodes[a].y], [nodes[a].x, nodes[a].y + d], [nodes[b].x, nodes[a].y + d], [nodes[b].x, nodes[b].y]];
    segs = {
      '0-1': [[cx, top], [cx, ys0]],
      '1-2': path(1, 2, d0), '1-3': path(1, 3, d0),
      '2-4': path(2, 4, d1), '2-5': path(2, 5, d1),
      '3-6': path(3, 6, d1), '3-7': path(3, 7, d1),
    };
    for (const k in segs) segs[k].len = polyLen(segs[k]);
  }

  function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function pointAt(pts, d) {
    for (let i = 1; i < pts.length; i++) {
      const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= L) { const k = L ? d / L : 0; return [S.lerp(pts[i - 1][0], pts[i][0], k), S.lerp(pts[i - 1][1], pts[i][1], k)]; }
      d -= L;
    }
    return pts[pts.length - 1];
  }

  function speed() { return Math.min(85 + score * 2.6, 230) * Math.max(0.8, st.h / 700); }
  function interval() { return Math.max(0.85, 2.3 - score * 0.04); }

  function startGame() {
    score = 0; strikes = 0; sorted = 0; shuffleAt = 15; parcels = []; switches = [0, 0, 0]; chuteColor = [0, 1, 2, 3];
    spawnT = 0.6; hud.score(0); fx.clear(); fl.clear(); state = 'play';
  }

  function toggle(i) {
    if (state !== 'play') return;
    switches[i] ^= 1;
    const n = nodes[i + 1];
    fx.burst(n.x, n.y, P.ink, 4, 60, 0.25, 2);
  }

  function arrive(p, node) {
    if (node >= 4) {
      const ci = node - 4;
      const good = chuteColor[ci] === p.c;
      const n = nodes[node];
      if (good) {
        score++; sorted++; hud.score(score); flash[ci] = 0.5;
        fx.burst(n.x, n.y + 20, colors()[p.c], 12, 150, 0.6, 4);
        fl.add(n.x, n.y - 10, '+1', P.ink);
        if (sorted >= shuffleAt) { shuffleWarn = 2.2; shuffleAt += 15; }
      } else {
        strikes++; shake = 0.35; flash[ci] = -0.6;
        fl.add(n.x, n.y - 10, '✕', P.ink);
        if (strikes >= 3) gameOver();
      }
      return true;
    }
    const next = KIDS[node][switches[node - 1]];
    p.seg = `${node}-${next}`; p.to = next; p.d = 0;
    return false;
  }

  function gameOver() {
    state = 'over';
    const rec = hud.best(score);
    setTimeout(() => ov.show(rec && score > 0 ? 'Neuer Rekord!' : 'Schicht vorbei',
      `<b>${score}</b> Pakete richtig sortiert. Rekord: <b>${hud.bestValue}</b>.`, 'Nächste Schicht', startGame), 600);
  }

  const ptr = S.pointer(cv);
  ptr.onDown = (x, y) => {
    let best = -1, bd = Math.max(70, st.w * 0.09);
    for (let i = 0; i < 3; i++) { const n = nodes[i + 1]; const d = Math.hypot(x - n.x, y - n.y); if (d < bd) { bd = d; best = i; } }
    if (best >= 0) toggle(best);
  };
  S.keys((k) => {
    if (ov.open) return;
    if (k === '1' || k === 'ArrowUp') toggle(0);
    if (k === '2' || k === 'ArrowLeft') toggle(1);
    if (k === '3' || k === 'ArrowRight') toggle(2);
  });

  function update(dt) {
    t += dt;
    if (state === 'play') {
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = interval() * S.rand(0.9, 1.25);
        const last = parcels[parcels.length - 1];
        if (!last || last.seg !== '0-1' || last.d > 44) parcels.push({ c: S.randInt(0, 3), seg: '0-1', to: 1, d: 0, rot: S.rand(-0.2, 0.2) });
      }
      if (shuffleWarn > 0) {
        shuffleWarn -= dt;
        if (shuffleWarn <= 0) {
          const old = chuteColor.join();
          do S.shuffle(chuteColor); while (chuteColor.join() === old);
          for (let i = 0; i < 4; i++) fx.burst(nodes[4 + i].x, nodes[4 + i].y + 20, colors()[chuteColor[i]], 10, 120, 0.5, 3);
        }
      }
      const v = speed();
      for (let i = parcels.length - 1; i >= 0; i--) {
        const p = parcels[i];
        p.d += v * dt;
        const seg = segs[p.seg];
        if (p.d >= seg.len) {
          const over = p.d - seg.len;
          if (arrive(p, p.to)) { parcels.splice(i, 1); continue; }
          p.d = over;
        }
        if (state !== 'play') break;
      }
    }
    for (let i = 0; i < 4; i++) flash[i] = flash[i] > 0 ? Math.max(0, flash[i] - dt) : Math.min(0, flash[i] + dt);
    shake = Math.max(0, shake - dt);
    fx.update(dt, 300); fl.update(dt);
  }

  function shapePath(c, x, y, s) {
    ctx.beginPath();
    if (c === 0) ctx.arc(x, y, s, 0, Math.PI * 2);
    else if (c === 1) ctx.rect(x - s * 0.9, y - s * 0.9, s * 1.8, s * 1.8);
    else if (c === 2) { ctx.moveTo(x, y - s * 1.1); ctx.lineTo(x + s, y + s * 0.8); ctx.lineTo(x - s, y + s * 0.8); ctx.closePath(); }
    else { ctx.moveTo(x, y - s * 1.1); ctx.lineTo(x + s * 1.1, y); ctx.lineTo(x, y + s * 1.1); ctx.lineTo(x - s * 1.1, y); ctx.closePath(); }
  }

  function strokePoly(pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }

  function draw() {
    const w = st.w, h = st.h;
    ctx.fillStyle = P.paper; ctx.fillRect(0, 0, w, h);
    ctx.save();
    if (shake > 0) ctx.translate(S.rand(-1, 1) * shake * 12, S.rand(-1, 1) * shake * 6);
    const C = colors();
    const tw = Math.max(16, Math.min(24, w * 0.03));

    // Bänder
    const active = new Set(['0-1', `1-${KIDS[1][switches[0]]}`, `2-${KIDS[2][switches[1]]}`, `3-${KIDS[3][switches[2]]}`]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const k in segs) { ctx.strokeStyle = P.ink; ctx.lineWidth = tw + 4; strokePoly(segs[k]); }
    for (const k in segs) {
      ctx.strokeStyle = active.has(k) ? P.card : P.paper2; ctx.lineWidth = tw; strokePoly(segs[k]);
    }
    // Laufband-Striche
    ctx.save(); ctx.setLineDash([2, 12]); ctx.lineDashOffset = -t * speed();
    ctx.lineWidth = tw - 8; ctx.lineCap = 'butt';
    for (const k in segs) { ctx.strokeStyle = active.has(k) ? P.ink : P.line; ctx.globalAlpha = active.has(k) ? 0.35 : 1; strokePoly(segs[k]); }
    ctx.restore(); ctx.globalAlpha = 1;

    // Rutschen
    for (let i = 0; i < 4; i++) {
      const n = nodes[4 + i], cw = Math.max(46, Math.min(84, w * 0.12)), chh = Math.max(40, h * 0.12);
      const x = n.x - cw / 2, y = n.y;
      const warn = shuffleWarn > 0 && Math.floor(t * 8) % 2;
      ctx.fillStyle = flash[i] < 0 ? P.ink : P.card;
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cw, y); ctx.lineTo(x + cw * 0.82, y + chh); ctx.lineTo(x + cw * 0.18, y + chh); ctx.closePath(); ctx.fill(); ctx.stroke();
      const s = Math.min(16, cw * 0.2);
      ctx.save(); ctx.translate(2.5, 2.5); ctx.fillStyle = P.ink; ctx.globalAlpha = 0.25; shapePath(chuteColor[i], n.x, y + chh * 0.55, s); ctx.fill(); ctx.restore();
      ctx.fillStyle = warn ? P.paper2 : C[chuteColor[i]]; shapePath(chuteColor[i], n.x, y + chh * 0.55, s); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; shapePath(chuteColor[i], n.x, y + chh * 0.55, s); ctx.stroke();
      if (flash[i] > 0) { ctx.globalAlpha = flash[i] * 1.6; ctx.strokeStyle = C[chuteColor[i]]; ctx.lineWidth = 5; ctx.strokeRect(x - 6, y - 6, cw + 12, chh + 12); ctx.globalAlpha = 1; }
    }

    // Einlauf
    const e = nodes[0];
    ctx.fillStyle = P.ink; ctx.fillRect(e.x - tw, 0, tw * 2, e.y + 6);

    // Weichen
    for (let i = 0; i < 3; i++) {
      const n = nodes[i + 1], r = Math.max(17, tw * 0.95);
      const kid = nodes[KIDS[i + 1][switches[i]]];
      const dir = Math.sign(kid.x - n.x) || 1;
      S.riso(ctx, () => { ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); }, P.pink, P.card, 3, 3);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.translate(n.x, n.y); ctx.scale(dir, 1);
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.18); ctx.lineTo(r * 0.15, -r * 0.18); ctx.lineTo(r * 0.15, -r * 0.45); ctx.lineTo(r * 0.6, 0); ctx.lineTo(r * 0.15, r * 0.45); ctx.lineTo(r * 0.15, r * 0.18); ctx.lineTo(-r * 0.5, r * 0.18); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = P.soft; ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), n.x, n.y - r - 8);
    }

    // Pakete
    for (const p of parcels) {
      const [x, y] = pointAt(segs[p.seg], p.d);
      const s = Math.max(9, tw * 0.48);
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.roundRect(-s - 3, -s - 3, (s + 3) * 2, (s + 3) * 2, 4); ctx.fill();
      ctx.fillStyle = P.card; ctx.beginPath(); ctx.roundRect(-s - 1, -s - 1, (s + 1) * 2, (s + 1) * 2, 3); ctx.fill();
      ctx.fillStyle = C[p.c]; shapePath(p.c, 0, 0, s * 0.62); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; shapePath(p.c, 0, 0, s * 0.62); ctx.stroke();
      ctx.restore();
    }

    fx.draw(ctx); fl.draw(ctx);
    ctx.restore();

    // Anzeigen
    ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.fillStyle = P.ink;
    ctx.fillText('FEHLER', 16, 26);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.strokeRect(74 + i * 20, 16, 14, 14);
      if (i < strikes) { ctx.beginPath(); ctx.moveTo(77 + i * 20, 19); ctx.lineTo(85 + i * 20, 27); ctx.moveTo(85 + i * 20, 19); ctx.lineTo(77 + i * 20, 27); ctx.stroke(); }
    }
    if (shuffleWarn > 0) {
      ctx.textAlign = 'center'; ctx.font = '600 italic 22px "Fraunces", Georgia, serif';
      ctx.fillText('Achtung, die Rutschen tauschen!', w / 2, h - 18);
    }
    ctx.textAlign = 'left';
  }

  layout();
  ov.show('Weichenwerk',
    'Pakete laufen über das Band nach unten. <b>Stell die drei Weichen</b> so, dass jedes Paket in der Rutsche mit derselben Farbe und Form landet. Drei Fehler, dann ist Schicht. Ab und zu tauschen die Rutschen ihre Plätze.',
    'Band starten', startGame);

  S.loop((dt) => { update(dt); draw(); });
})();
