/* Weichenwerk: Pakete über Weichen in die richtige Rutsche lenken */
(() => {
  const S = Shell, E = S.ease, snd = S.sound;
  const cv = document.getElementById('c');
  let P = S.palette();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { P = S.palette(); });
  const st = S.stage(cv, () => layout());
  const ctx = st.ctx;
  const hud = S.hud('weichenwerk');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  // Baum: Weichen in Heap-Reihenfolge, danach die Rutschen
  let D = 2, NS = 3, NL = 4;
  let sw = [], swPos = [], leafPos = [], entry = null, segs = {}, chuteColor = [], parcels = [];
  let score = 0, strikes = 0, streak = 0, state = 'menu', t = 0, spawnT = 0, sorted = 0, shuffleAt = 15, shuffleWarn = 0, shake = 0, banner = null, stage = 1;
  let flash = [];

  const colors = () => [P.pink, P.blue, P.yellow, P.green];
  const diff = S.difficulty('weichenwerk');
  const DF = () => diff.pick({ leicht: { sp: 0.8, lives: 5 }, normal: { sp: 1, lives: 3 }, schwer: { sp: 1.2, lives: 2 } });
  const mult = () => Math.min(4, 1 + Math.floor(streak / 5));

  function setDepth(d) {
    D = d; NS = (1 << D) - 1; NL = 1 << D;
    sw = new Array(NS).fill(0);
    chuteColor = []; for (let i = 0; i < NL; i++) chuteColor.push(i % 4);
    if (D > 2) S.shuffle(chuteColor);
    flash = new Array(NL).fill(0);
    layout();
  }

  function layout() {
    const w = st.w, h = st.h;
    const top = 14, y0 = h * 0.17, yc = h * 0.74;
    const spread = Math.min(w * 0.92, D > 2 ? 920 : 760);
    const left = w / 2 - spread / 2;
    leafPos = [];
    for (let i = 0; i < NL; i++) leafPos.push({ x: left + (spread * (i + 0.5)) / NL, y: yc });
    swPos = [];
    for (let id = 0; id < NS; id++) {
      const l = Math.floor(Math.log2(id + 1)), j = id - ((1 << l) - 1);
      const span = NL >> l;
      let sx = 0; for (let k = j * span; k < (j + 1) * span; k++) sx += leafPos[k].x;
      swPos.push({ x: sx / span, y: y0 + l * ((yc - y0) / D) });
    }
    entry = { x: swPos[0].x, y: top };
    segs = {};
    const elbow = (a, b) => { const d = (b.y - a.y) * 0.45; return [[a.x, a.y], [a.x, a.y + d], [b.x, a.y + d], [b.x, b.y]]; };
    segs['e'] = [[entry.x, entry.y], [swPos[0].x, swPos[0].y]];
    for (let id = 0; id < NS; id++) for (const c of [2 * id + 1, 2 * id + 2]) segs[`${id}-${c}`] = elbow(swPos[id], nodePos(c));
    for (const k in segs) segs[k].len = polyLen(segs[k]);
  }

  const nodePos = (n) => (n < NS ? swPos[n] : leafPos[n - NS]);
  function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function pointAt(pts, d) {
    for (let i = 1; i < pts.length; i++) {
      const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= L) { const k = L ? d / L : 0; return [S.lerp(pts[i - 1][0], pts[i][0], k), S.lerp(pts[i - 1][1], pts[i][1], k)]; }
      d -= L;
    }
    return pts[pts.length - 1];
  }

  function speed() { return DF().sp * Math.min(85 + score * 1.6, 220) * Math.max(0.8, st.h / 700) * (D > 2 ? 0.85 : 1); }
  function interval() { return Math.max(0.8, 2.3 - score * 0.025) * (D > 2 ? 1.15 : 1); }

  function startGame() {
    score = 0; strikes = 0; streak = 0; sorted = 0; shuffleAt = 15; parcels = []; stage = 1;
    setDepth(2);
    spawnT = 0.6; hud.score(0); fx.clear(); fl.clear(); state = 'play'; banner = { text: 'Schicht beginnt', t: 0 };
    if (S.debug.on && S.debug.start > 1) upgradeStage();
  }

  function toggle(i) {
    if (state !== 'play' || i >= NS) return;
    sw[i] ^= 1;
    const n = swPos[i];
    fx.burst(n.x, n.y, P.ink, 4, 60, 0.25, 2);
    snd.tone(sw[i] ? 520 : 440, 0.05, 'square', 0.12);
  }

  function spawn() {
    const r = Math.random();
    let kind = 'plain';
    if (score > 8 && r < 0.07) kind = 'gold';
    else if (score > 14 && r < 0.15) kind = 'bomb';
    else if (score > 10 && r < 0.25) kind = 'express';
    else if (score > 20 && r < 0.33) kind = 'mixed';
    const c = S.randInt(0, 3);
    let c2 = c; while (c2 === c) c2 = S.randInt(0, 3);
    parcels.push({ c, c2, kind, seg: 'e', to: 0, d: 0, rot: S.rand(-0.2, 0.2), fuse: 0 });
  }

  function arrive(p, node) {
    if (node >= NS) {
      const li = node - NS, n = leafPos[li];
      const col = chuteColor[li];
      if (p.kind === 'bomb') {
        strikes++; shake = 0.5; flash[li] = -0.6; streak = 0;
        fx.burst(n.x, n.y, P.orange, 30, 260, 0.8, 4); fx.burst(n.x, n.y, P.ink, 16, 200, 0.7, 3);
        fl.add(n.x, n.y - 10, 'Bumm!', P.ink); snd.noise(0.6, 0.5, 200);
        if (strikes >= DF().lives) gameOver();
        return true;
      }
      const good = p.kind === 'gold' || col === p.c || (p.kind === 'mixed' && col === p.c2);
      if (good) {
        streak++;
        const base = p.kind === 'gold' ? 5 : p.kind === 'express' ? 2 : 1;
        const pts = base * mult();
        score += pts; sorted++; hud.score(score); flash[li] = 0.5;
        fx.burst(n.x, n.y + 20, p.kind === 'gold' ? P.yellow : colors()[col], 12, 150, 0.6, 4);
        fl.add(n.x, n.y - 10, `+${pts}`, P.ink);
        snd.tone(440 * Math.pow(1.06, Math.min(streak, 24)), 0.1, 'triangle', 0.22);
        if (streak > 0 && streak % 5 === 0 && mult() > 1) { banner = { text: `Kombo ×${mult()}`, t: 0 }; snd.chord([523, 659, 784], 0.25, 'triangle', 0.15); }
        if (sorted >= shuffleAt) { shuffleWarn = 2.2; shuffleAt += 15; }
        if (stage === 1 && score >= 30) upgradeStage();
      } else {
        strikes++; shake = 0.35; flash[li] = -0.6; streak = 0;
        fl.add(n.x, n.y - 10, '✕', P.ink); snd.tone(150, 0.25, 'sawtooth', 0.18, 0.7);
        if (strikes >= DF().lives) gameOver();
      }
      return true;
    }
    const next = 2 * node + 1 + sw[node];
    p.seg = `${node}-${next}`; p.to = next; p.d = 0;
    return false;
  }

  function upgradeStage() {
    stage = 2;
    banner = { text: 'Ausbau: acht Rutschen', t: 0 };
    snd.chord([392, 523, 659, 784], 0.5, 'triangle', 0.2);
    for (const p of parcels) { const [x, y] = pointAt(segs[p.seg], p.d); fx.burst(x, y, P.soft, 6, 80, 0.4, 2); }
    parcels = []; spawnT = 2.2;
    setDepth(3);
    if (strikes > 0) strikes--;
  }

  function gameOver() {
    if ((S.debug.on && S.debug.god)) { strikes = 0; return; }
    state = 'over';
    const rec = hud.best(score);
    snd.tone(200, 0.6, 'sine', 0.2, 0.5);
    setTimeout(() => ov.show(rec && score > 0 ? 'Neuer Rekord!' : 'Schicht vorbei',
      `<b>${score}</b> Punkte, <b>${sorted}</b> Pakete sortiert${stage > 1 ? ', Ausbaustufe 2 erreicht' : ''}. Rekord: <b>${hud.bestValue}</b>.`, 'Nächste Schicht', startGame), 600);
    setTimeout(() => diff.mount(ov), 610);
  }

  const ptr = S.pointer(cv);
  ptr.onDown = (x, y) => {
    if (state !== 'play') return;
    // Bomben antippen entschärft sie
    for (let i = parcels.length - 1; i >= 0; i--) {
      const p = parcels[i];
      if (p.kind !== 'bomb') continue;
      const [px, py] = pointAt(segs[p.seg], p.d);
      if (Math.hypot(px - x, py - y) < 26) {
        parcels.splice(i, 1); score += 2; hud.score(score);
        fx.burst(px, py, P.blue, 14, 140, 0.5, 3); fl.add(px, py - 14, 'entschärft +2', P.ink);
        snd.chord([660, 990], 0.15, 'sine', 0.2); return;
      }
    }
    let best = -1, bd = Math.max(56, st.w * (D > 2 ? 0.06 : 0.09));
    for (let i = 0; i < NS; i++) { const n = swPos[i]; const d = Math.hypot(x - n.x, y - n.y); if (d < bd) { bd = d; best = i; } }
    if (best >= 0) toggle(best);
  };
  S.keys((k) => {
    if (ov.open) return;
    const n = parseInt(k, 10);
    if (n >= 1 && n <= NS) toggle(n - 1);
  });

  function update(dt) {
    t += dt;
    if (state === 'play') {
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = interval() * S.rand(0.9, 1.25);
        const last = parcels[parcels.length - 1];
        if (!last || last.seg !== 'e' || last.d > 44) spawn();
      }
      if (shuffleWarn > 0) {
        shuffleWarn -= dt;
        if (shuffleWarn <= 0) {
          const old = chuteColor.join();
          do S.shuffle(chuteColor); while (chuteColor.join() === old);
          for (let i = 0; i < NL; i++) fx.burst(leafPos[i].x, leafPos[i].y + 20, colors()[chuteColor[i]], 8, 120, 0.5, 3);
          snd.chord([330, 440, 554], 0.3, 'square', 0.08, 0.04);
        }
      }
      const v = speed();
      for (let i = parcels.length - 1; i >= 0; i--) {
        const p = parcels[i];
        p.d += v * (p.kind === 'express' ? 1.6 : 1) * dt;
        if (p.kind === 'bomb') p.fuse += dt;
        const seg = segs[p.seg];
        if (p.d >= seg.len) {
          const over = p.d - seg.len;
          if (arrive(p, p.to)) { parcels.splice(i, 1); continue; }
          p.d = over;
        }
        if (state !== 'play') break;
      }
    }
    for (let i = 0; i < NL; i++) flash[i] = flash[i] > 0 ? Math.max(0, flash[i] - dt) : Math.min(0, flash[i] + dt);
    shake = Math.max(0, shake - dt);
    if (banner) { banner.t += dt; if (banner.t > 2.2) banner = null; }
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

  function drawParcel(p, x, y, s) {
    const C = colors();
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot + (p.kind === 'bomb' ? Math.sin(t * 20) * 0.08 : 0));
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.roundRect(-s - 3, -s - 3, (s + 3) * 2, (s + 3) * 2, 4); ctx.fill();
    if (p.kind === 'bomb') {
      ctx.fillStyle = '#2b2733'; ctx.beginPath(); ctx.roundRect(-s - 1, -s - 1, (s + 1) * 2, (s + 1) * 2, 3); ctx.fill();
      ctx.fillStyle = P.orange; ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = Math.floor(t * 8) % 2 ? P.yellow : P.paper; ctx.beginPath(); ctx.arc(s * 0.6, -s * 0.9, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); return;
    }
    // Karton mit Schraffur
    ctx.fillStyle = p.kind === 'gold' ? P.yellow : P.card; ctx.beginPath(); ctx.roundRect(-s - 1, -s - 1, (s + 1) * 2, (s + 1) * 2, 3); ctx.fill();
    ctx.globalAlpha = 0.25; S.tex.hatch(ctx, -s, -s, s * 2, s * 2, P.ink, 4, Math.PI / 4, 0.8); ctx.globalAlpha = 1;
    if (p.kind === 'express') { ctx.fillStyle = P.ink; ctx.fillRect(-s - 1, -s * 0.15, (s + 1) * 2, s * 0.3); }
    if (p.kind === 'gold') {
      ctx.fillStyle = P.ink; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.28 : s * 0.62; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    } else if (p.kind === 'mixed') {
      ctx.save(); ctx.beginPath(); ctx.rect(-s, -s, s, s * 2); ctx.clip(); ctx.fillStyle = C[p.c]; shapePath(p.c, 0, 0, s * 0.62); ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, -s, s, s * 2); ctx.clip(); ctx.fillStyle = C[p.c2]; shapePath(p.c2, 0, 0, s * 0.62); ctx.fill(); ctx.restore();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke();
    } else {
      ctx.fillStyle = C[p.c]; shapePath(p.c, 0, 0, s * 0.62); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; shapePath(p.c, 0, 0, s * 0.62); ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    const w = st.w, h = st.h;
    S.tex.paperBg(ctx, w, h, P);
    // Fabrikboden: Rasterfeld
    ctx.globalAlpha = 0.08; ctx.drawImage(S.tex.cached('floor' + P.ink, w, h, (c) => S.tex.halftoneRect(c, 0, 0, w, h, P.ink, (u, v) => 0.2 + v * 0.5, 9)), 0, 0); ctx.globalAlpha = 1;
    ctx.save();
    if (shake > 0) ctx.translate(S.rand(-1, 1) * shake * 12, S.rand(-1, 1) * shake * 6);
    const C = colors();
    const tw = Math.max(13, Math.min(24, w * (D > 2 ? 0.022 : 0.03)));

    const active = new Set(['e']);
    for (let i = 0; i < NS; i++) active.add(`${i}-${2 * i + 1 + sw[i]}`);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const k in segs) { ctx.strokeStyle = P.ink; ctx.lineWidth = tw + 4; strokePoly(segs[k]); }
    for (const k in segs) { ctx.strokeStyle = active.has(k) ? P.card : P.paper2; ctx.lineWidth = tw; strokePoly(segs[k]); }
    ctx.save(); ctx.setLineDash([2, 12]); ctx.lineDashOffset = -t * speed();
    ctx.lineWidth = tw - 8; ctx.lineCap = 'butt';
    for (const k in segs) { ctx.strokeStyle = active.has(k) ? P.ink : P.line; ctx.globalAlpha = active.has(k) ? 0.35 : 1; strokePoly(segs[k]); }
    ctx.restore(); ctx.globalAlpha = 1;

    // Rutschen
    const cw = Math.max(34, Math.min(84, (w * 0.9) / NL - 8)), chh = Math.max(40, h * 0.12);
    for (let i = 0; i < NL; i++) {
      const n = leafPos[i], x = n.x - cw / 2, y = n.y;
      const warn = shuffleWarn > 0 && Math.floor(t * 8) % 2;
      ctx.fillStyle = flash[i] < 0 ? P.ink : P.card; ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
      const chute = () => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cw, y); ctx.lineTo(x + cw * 0.82, y + chh); ctx.lineTo(x + cw * 0.18, y + chh); ctx.closePath(); };
      chute(); ctx.fill();
      ctx.save(); chute(); ctx.clip(); ctx.globalAlpha = 0.3; S.tex.halftoneRect(ctx, x, y, cw, chh, C[chuteColor[i]], (u, v) => 0.2 + v * 0.7, 5); ctx.restore();
      chute(); ctx.stroke();
      const s = Math.min(15, cw * 0.22);
      ctx.save(); ctx.translate(2.5, 2.5); ctx.fillStyle = P.ink; ctx.globalAlpha = 0.25; shapePath(chuteColor[i], n.x, y + chh * 0.5, s); ctx.fill(); ctx.restore();
      ctx.fillStyle = warn ? P.paper2 : C[chuteColor[i]]; shapePath(chuteColor[i], n.x, y + chh * 0.5, s); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; shapePath(chuteColor[i], n.x, y + chh * 0.5, s); ctx.stroke();
      if (flash[i] > 0) { ctx.globalAlpha = flash[i] * 1.6; ctx.strokeStyle = C[chuteColor[i]]; ctx.lineWidth = 5; ctx.strokeRect(x - 5, y - 5, cw + 10, chh + 10); ctx.globalAlpha = 1; }
    }

    ctx.fillStyle = P.ink; ctx.fillRect(entry.x - tw, 0, tw * 2, entry.y + 6);

    for (let i = 0; i < NS; i++) {
      const n = swPos[i], r = Math.max(14, tw * 0.95);
      const kid = nodePos(2 * i + 1 + sw[i]);
      const dir = Math.sign(kid.x - n.x) || 1;
      S.riso(ctx, () => { ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); }, P.pink, P.card, 3, 3);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.translate(n.x, n.y); ctx.scale(dir, 1);
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.18); ctx.lineTo(r * 0.15, -r * 0.18); ctx.lineTo(r * 0.15, -r * 0.45); ctx.lineTo(r * 0.6, 0); ctx.lineTo(r * 0.15, r * 0.45); ctx.lineTo(r * 0.15, r * 0.18); ctx.lineTo(-r * 0.5, r * 0.18); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = P.soft; ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), n.x, n.y - r - 7);
    }

    const s = Math.max(8, tw * 0.48);
    for (const p of parcels) { const [x, y] = pointAt(segs[p.seg], p.d); drawParcel(p, x, y, s); }

    for (let i = 0; i < NS; i++) S.dbg.circle(ctx, swPos[i].x, swPos[i].y, Math.max(56, st.w * (D > 2 ? 0.06 : 0.09)));
    fx.draw(ctx); fl.draw(ctx);
    ctx.restore();
    S.tex.grain(ctx, w, h, P.ink, P.dark ? 0.5 : 1);

    ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.fillStyle = P.ink;
    ctx.fillText('FEHLER', 16, 26);
    for (let i = 0; i < DF().lives; i++) {
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.strokeRect(74 + i * 20, 16, 14, 14);
      if (i < strikes) { ctx.beginPath(); ctx.moveTo(77 + i * 20, 19); ctx.lineTo(85 + i * 20, 27); ctx.moveTo(85 + i * 20, 19); ctx.lineTo(77 + i * 20, 27); ctx.stroke(); }
    }
    if (mult() > 1) { ctx.fillStyle = P.pink; ctx.fillText(`Kombo ×${mult()}`, 16, 48); }
    ctx.textAlign = 'right'; ctx.fillStyle = P.soft; ctx.fillText(`Stufe ${stage}`, w - 16, 26); ctx.textAlign = 'left';
    if (shuffleWarn > 0) {
      ctx.textAlign = 'center'; ctx.font = '400 22px "Young Serif", Georgia, serif'; ctx.fillStyle = P.ink;
      ctx.fillText('Achtung, die Rutschen tauschen!', w / 2, h - 18);
    }
    if (banner) {
      const k = banner.t < 0.4 ? E.outBack(banner.t / 0.4) : banner.t > 1.8 ? 1 - (banner.t - 1.8) / 0.4 : 1;
      ctx.save(); ctx.globalAlpha = S.clamp(k, 0, 1); ctx.translate(w / 2, h * 0.09 + 30); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
      ctx.font = '400 28px "Young Serif", Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = P.ink; ctx.fillText(banner.text, 0, 0);
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  S.dbg.next = () => { if (state !== 'play') return; if (stage === 1) upgradeStage(); else { score += 10; hud.score(score); } };
  setDepth(2);
  ov.show('Weichenwerk',
    'Pakete laufen über das Band nach unten. <b>Stell die Weichen</b> so, dass jedes Paket in der Rutsche mit derselben Farbe und Form landet. Sind alle Fehlerkästchen voll, ist Schicht.<ul><li>Goldpakete passen überall, Expresspakete sind schnell</li><li>Halbe-halbe-Pakete dürfen in eine der beiden Farben</li><li><b>Bomben antippen</b>, bevor sie unten ankommen</li><li>Ab 30 Punkten baut das Werk auf acht Rutschen aus</li></ul>',
    'Band starten', startGame);
  diff.mount(ov);

  S.loop((dt) => { update(dt); draw(); });
})();
