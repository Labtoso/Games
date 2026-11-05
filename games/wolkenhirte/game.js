/* Wolkenhirte: du bist der Wind, die Wolken sind deine Herde */
(() => {
  const S = Shell;
  const cv = document.getElementById('c');
  let P = S.palette();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { P = S.palette(); });
  const st = S.stage(cv, () => { if (state !== 'play') buildLevel(); });
  const ctx = st.ctx;
  const hud = S.hud('wolkenhirte');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  let clouds = [], fields = [], lake = null, drops = [], level = 1, score = 0, timeLeft = 0, state = 'menu', t = 0;
  const ptr = S.pointer(cv);

  function rectsOverlap(a, b, m) { return a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y; }

  function buildLevel() {
    const w = st.w, h = st.h;
    const unit = Math.min(w, h);
    const corner = S.randInt(0, 3);
    const lr = { rx: Math.max(60, unit * 0.16), ry: Math.max(42, unit * 0.11) };
    lake = { x: corner % 2 ? w - lr.rx - 20 : lr.rx + 20, y: corner < 2 ? lr.ry + 24 : h - lr.ry - 24, ...lr };
    const lakeBox = { x: lake.x - lake.rx, y: lake.y - lake.ry, w: lake.rx * 2, h: lake.ry * 2 };
    const want = Math.min(2 + level, 8);
    fields = [];
    for (let tries = 0; tries < 600 && fields.length < want; tries++) {
      const fw = S.rand(unit * 0.15, unit * 0.24), fh = S.rand(unit * 0.11, unit * 0.18);
      const f = { x: S.rand(16, w - fw - 16), y: S.rand(16, h - fh - 16), w: fw, h: fh, m: 0, bloom: false, raining: false, flowers: [] };
      if (rectsOverlap(f, lakeBox, 40)) continue;
      if (fields.some((o) => rectsOverlap(f, o, 22))) continue;
      fields.push(f);
    }
    clouds = [];
    const nc = Math.min(3 + Math.floor(level / 2), 7);
    for (let i = 0; i < nc; i++) {
      const a = (i / nc) * Math.PI * 2;
      clouds.push({ x: w / 2 + Math.cos(a) * unit * 0.12, y: h / 2 + Math.sin(a) * unit * 0.1, vx: 0, vy: 0, water: 0.6, puffs: makePuffs(), ph: Math.random() * 6 });
    }
    timeLeft = 40 + fields.length * 11;
    drops = [];
  }

  function makePuffs() {
    const n = S.randInt(4, 6), list = [];
    for (let i = 0; i < n; i++) list.push({ dx: (i / (n - 1) - 0.5) * 1.5 + S.rand(-0.1, 0.1), dy: S.rand(-0.35, 0.15) - (i > 0 && i < n - 1 ? 0.25 : 0), r: S.rand(0.45, 0.7) });
    return list;
  }

  const cloudR = (c) => 20 + c.water * 18;

  function startGame() { level = 1; score = 0; hud.score(0); fx.clear(); fl.clear(); buildLevel(); state = 'play'; }

  function update(dt) {
    t += dt;
    const w = st.w, h = st.h;
    if (state === 'play') timeLeft -= dt;

    for (const f of fields) f.raining = false;
    for (const c of clouds) {
      // Wind vom Zeiger
      if (ptr.inside && state !== 'menu') {
        const dx = c.x - ptr.x, dy = c.y - ptr.y, d = Math.hypot(dx, dy) || 1;
        const R = 175;
        if (d < R) { const f = (1 - d / R) * 1100; c.vx += (dx / d) * f * dt; c.vy += (dy / d) * f * dt; }
      }
      // sanfte Strömung
      c.vx += Math.sin(t * 0.3 + c.y * 0.01 + c.ph) * 9 * dt;
      c.vy += Math.cos(t * 0.25 + c.x * 0.01 + c.ph) * 9 * dt;
      // Abstand zu anderen Wolken
      for (const o of clouds) {
        if (o === c) continue;
        const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy) || 1, min = cloudR(c) + cloudR(o);
        if (d < min) { const f = (1 - d / min) * 300; c.vx += (dx / d) * f * dt; c.vy += (dy / d) * f * dt; }
      }
      // Ränder
      const m = 30;
      if (c.x < m) c.vx += (m - c.x) * 8 * dt; if (c.x > w - m) c.vx -= (c.x - (w - m)) * 8 * dt;
      if (c.y < m) c.vy += (m - c.y) * 8 * dt; if (c.y > h - m) c.vy -= (c.y - (h - m)) * 8 * dt;
      const drag = Math.exp(-1.7 * dt); c.vx *= drag; c.vy *= drag;
      const sp = Math.hypot(c.vx, c.vy); if (sp > 320) { c.vx *= 320 / sp; c.vy *= 320 / sp; }
      c.x += c.vx * dt; c.y += c.vy * dt;

      // See: Wasser tanken
      const lx = (c.x - lake.x) / lake.rx, ly = (c.y - lake.y) / lake.ry;
      if (lx * lx + ly * ly < 1.1 && c.water < 1) {
        c.water = Math.min(1, c.water + 0.42 * dt);
        if (Math.random() < 0.3) fx.burst(c.x + S.rand(-10, 10), c.y + cloudR(c), P.blue, 1, 40, 0.5, 2);
      }
      // Regen über Feld
      c.rain = false;
      if (c.water > 0.03 && state === 'play') {
        for (const f of fields) {
          if (f.bloom) continue;
          if (c.x > f.x - 8 && c.x < f.x + f.w + 8 && c.y > f.y - 8 && c.y < f.y + f.h + 8) {
            c.rain = true; f.raining = true;
            c.water = Math.max(0, c.water - 0.16 * dt);
            f.m = Math.min(1, f.m + 0.21 * dt);
            if (f.m >= 1 && !f.bloom) bloom(f);
            break;
          }
        }
      }
      if (c.rain && Math.random() < dt * 40) drops.push({ x: c.x + S.rand(-cloudR(c), cloudR(c)) * 0.8, y: c.y + 6, vy: S.rand(160, 220), life: 0.35 });
    }
    for (const f of fields) if (!f.bloom && !f.raining) f.m = Math.max(0, f.m - 0.022 * dt);
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.y += d.vy * dt; d.life -= dt; if (d.life <= 0) drops.splice(i, 1); }

    if (state === 'play') {
      if (fields.every((f) => f.bloom)) {
        const bonus = Math.floor(timeLeft) * 2;
        score += bonus; hud.score(score); hud.best(score);
        fl.add(st.w / 2, 60, `Zeitbonus +${bonus}`, P.ink);
        state = 'between';
        setTimeout(() => { level++; buildLevel(); state = 'play'; }, 1600);
      } else if (timeLeft <= 0) {
        timeLeft = 0; state = 'over';
        const rec = hud.best(score);
        setTimeout(() => ov.show(rec && score > 0 ? 'Neuer Rekord!' : 'Die Sonne ist unter',
          `Tag <b>${level}</b>, <b>${score}</b> Punkte. Rekord: <b>${hud.bestValue}</b>.`, 'Neuer Tag', startGame), 500);
      }
    }
    fx.update(dt, 0); fl.update(dt);
  }

  function bloom(f) {
    f.bloom = true; score += 10; hud.score(score);
    for (let i = 0; i < Math.floor((f.w * f.h) / 380); i++) f.flowers.push({ x: S.rand(6, f.w - 6), y: S.rand(6, f.h - 6), c: S.pick([P.pink, P.yellow, P.paper]), s: S.rand(2, 4) });
    fx.burst(f.x + f.w / 2, f.y + f.h / 2, P.green, 22, 180, 0.9, 4);
    fl.add(f.x + f.w / 2, f.y - 6, '+10', P.ink);
  }

  function hatch(f, color, gap) {
    ctx.save(); ctx.beginPath(); ctx.rect(f.x, f.y, f.w, f.h); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let k = -f.h; k < f.w; k += gap) { ctx.moveTo(f.x + k, f.y + f.h); ctx.lineTo(f.x + k + f.h, f.y); }
    ctx.stroke(); ctx.restore();
  }

  function draw() {
    const w = st.w, h = st.h;
    ctx.fillStyle = P.paper; ctx.fillRect(0, 0, w, h);
    // Graspunkte
    ctx.fillStyle = P.line;
    for (let y = 12; y < h; y += 26) for (let x = (y / 26) % 2 ? 6 : 19; x < w; x += 26) ctx.fillRect(x, y, 2, 4);

    // See
    if (lake) {
      ctx.fillStyle = P.pink; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.ellipse(lake.x + 4, lake.y + 3, lake.rx, lake.ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = P.blue;
      ctx.beginPath(); ctx.ellipse(lake.x, lake.y, lake.rx, lake.ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P.paper; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        for (let x = -lake.rx * 0.55; x <= lake.rx * 0.55; x += 4) ctx.lineTo(lake.x + x, lake.y + i * lake.ry * 0.38 + Math.sin(x * 0.12 + t * 2 + i) * 2.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Felder
    for (const f of fields) {
      if (f.bloom) {
        ctx.fillStyle = P.green; ctx.fillRect(f.x, f.y, f.w, f.h);
        for (const fl2 of f.flowers) { ctx.fillStyle = fl2.c; ctx.beginPath(); ctx.arc(f.x + fl2.x, f.y + fl2.y, fl2.s, 0, Math.PI * 2); ctx.fill(); }
      } else {
        ctx.fillStyle = P.paper2; ctx.fillRect(f.x, f.y, f.w, f.h);
        hatch(f, P.orange, 9);
        // Feuchtigkeit steigt von unten
        const mh = f.h * f.m;
        ctx.globalAlpha = 0.75; ctx.fillStyle = P.blue; ctx.fillRect(f.x, f.y + f.h - mh, f.w, mh); ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.strokeRect(f.x, f.y, f.w, f.h);
      if (!f.bloom) {
        ctx.fillStyle = P.ink; ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'left';
        ctx.fillText(`${Math.floor(f.m * 100)}%`, f.x + 5, f.y + 14);
      }
    }

    // Regen
    ctx.strokeStyle = P.blue; ctx.lineWidth = 1.5;
    ctx.beginPath(); for (const d of drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1.5, d.y + 7); } ctx.stroke();

    // Wolken: Schatten, dann Körper
    for (const c of clouds) {
      const r = cloudR(c);
      ctx.fillStyle = P.ink; ctx.globalAlpha = 0.08;
      ctx.beginPath(); ctx.ellipse(c.x + 14, c.y + r * 1.25, r * 1.2, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const c of clouds) {
      const r = cloudR(c), bob = Math.sin(t * 1.4 + c.ph) * 2;
      const body = () => { ctx.beginPath(); for (const p of c.puffs) { ctx.moveTo(c.x + p.dx * r + p.r * r, c.y + bob + p.dy * r); ctx.arc(c.x + p.dx * r, c.y + bob + p.dy * r, p.r * r, 0, Math.PI * 2); } };
      const shade = P.dark ? '#cfd6e6' : '#ffffff';
      const full = P.dark ? '#8f9bb8' : '#c9d3ea';
      ctx.save(); ctx.translate(3, 3); ctx.fillStyle = P.blue; body(); ctx.fill(); ctx.restore();
      ctx.fillStyle = c.water > 0.66 ? full : shade; body(); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; body(); ctx.stroke();
      // Wasserstand als kleiner Balken
      ctx.fillStyle = P.ink; ctx.fillRect(c.x - 12, c.y + bob + r * 0.55, 24, 4);
      ctx.fillStyle = P.blue; ctx.fillRect(c.x - 11, c.y + bob + r * 0.55 + 1, 22 * c.water, 2);
    }

    // Wind am Zeiger
    if (ptr.inside && state !== 'menu') {
      ctx.save(); ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + (i * Math.PI * 2) / 3, r = 16 + i * 6;
        ctx.beginPath(); ctx.arc(ptr.x, ptr.y, r, a, a + 1.4); ctx.stroke();
      }
      ctx.restore();
    }

    fx.draw(ctx); fl.draw(ctx);

    // Sonnenbogen als Uhr
    if (state === 'play' || state === 'between') {
      const total = 40 + fields.length * 11;
      const k = 1 - timeLeft / total;
      const ax = w / 2, ay = 46, ar = Math.min(110, w * 0.2);
      ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.25; ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.arc(ax, ay + ar * 0.5, ar, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      const sa = Math.PI * 1.15 + k * Math.PI * 0.7;
      const sx = ax + Math.cos(sa) * ar, sy = ay + ar * 0.5 + Math.sin(sa) * ar;
      S.riso(ctx, () => { ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); }, P.pink, timeLeft < 10 ? P.orange : P.yellow, 2, 2);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = P.ink; ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
      const label = `Tag ${level} · ${Math.ceil(timeLeft)} s · ${fields.filter((f) => f.bloom).length}/${fields.length} Felder`;
      const lw = ctx.measureText(label).width + 20;
      ctx.fillStyle = P.card; ctx.fillRect(ax - lw / 2, h - 34, lw, 22); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.strokeRect(ax - lw / 2, h - 34, lw, 22);
      ctx.fillStyle = P.ink; ctx.fillText(label, ax, h - 19);
      ctx.textAlign = 'left';
    }
  }

  buildLevel();
  ov.show('Wolkenhirte',
    'Du bist der Wind. Wolken <b>weichen deinem Zeiger aus</b>, so treibst du sie über die trockenen Felder, bis dort alles blüht. Leere Wolken tanken am See neues Wasser. Schaffe alle Felder, bevor die Sonne untergeht.',
    'Wehen', startGame);

  S.loop((dt) => { update(dt); draw(); });
})();
