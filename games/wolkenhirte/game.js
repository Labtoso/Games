/* Rainmaker: you are the wind, the clouds are your herd */
(() => {
  const S = Shell, E = S.ease, snd = S.sound;
  const cv = document.getElementById('c');
  let P = S.palette();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { P = S.palette(); });
  const st = S.stage(cv, () => { if (state !== 'play') buildLevel(); });
  const ctx = st.ctx;
  const hud = S.hud('wolkenhirte');
  const T = {
    title: 'Rainmaker', play: 'Blow', retry: 'New day', record: 'New best', lost: 'Sundown',
    intro: 'Clouds drift away from your pointer. Push them over dry fields until they bloom. Empty clouds refill over the lake.',
    over: (d, s, b) => `Day <b>${d}</b>, <b>${s}</b> points. Best: <b>${b}</b>.`,
    day: (d) => `Day ${d}`, heat: 'Heatwave', bolt: 'Lightning', boltLoss: 'Lightning −5', bonus: (n) => `Time bonus +${n}`,
    hud: (d, s, a, b) => `Day ${d} · ${s}s · ${a}/${b} fields`, crops: { wheat: 'Wheat', rice: 'Rice', orchard: 'Orchard' },
  };
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  const CROPS = {
    wheat: { name: 'Wheat', fill: 1, dry: 1, pts: 10 },
    rice: { name: 'Rice', fill: 0.6, dry: 0.7, pts: 15 },
    orchard: { name: 'Orchard', fill: 0.85, dry: 1.6, pts: 20 },
  };

  let clouds = [], storms = [], fields = [], lake = null, drops = [], bolts = [], level = 1, score = 0, timeLeft = 0, total = 1, state = 'menu', t = 0;
  let heat = 0, heatNext = 0, banner = null, rainSnd = 0, flash = 0;
  const ptr = S.pointer(cv);
  const diff = S.difficulty('wolkenhirte');
  const D = () => diff.pick({ easy: { time: 1.3, dry: 0.7 }, normal: { time: 1, dry: 1 }, hard: { time: 0.8, dry: 1.3 } });

  function rectsOverlap(a, b, m) { return a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y; }

  function buildLevel() {
    const w = st.w, h = st.h;
    const unit = Math.min(w, h);
    const corner = S.randInt(2, 3); // See unten, oben bleibt frei für die Sonne
    const lr = { rx: Math.max(60, unit * 0.16), ry: Math.max(42, unit * 0.11) };
    lake = { x: corner % 2 ? w - lr.rx - 20 : lr.rx + 20, y: h - lr.ry - 46, ...lr };
    const lakeBox = { x: lake.x - lake.rx, y: lake.y - lake.ry, w: lake.rx * 2, h: lake.ry * 2 };
    const sunBox = { x: w / 2 - 130, y: 0, w: 260, h: 70 };
    const want = Math.min(2 + level, 8);
    fields = [];
    const pool = ['wheat', 'wheat', ...(level >= 2 ? ['rice'] : []), ...(level >= 3 ? ['orchard'] : [])];
    for (let tries = 0; tries < 800 && fields.length < want; tries++) {
      const crop = S.pick(pool);
      const big = crop === 'orchard' ? 1.25 : 1;
      const fw = S.rand(unit * 0.15, unit * 0.23) * big, fh = S.rand(unit * 0.11, unit * 0.17) * big;
      const f = { x: S.rand(16, w - fw - 16), y: S.rand(70, h - fh - 52), w: fw, h: fh, m: 0, bloom: false, raining: false, crop, flowers: [], burnt: 0, trees: [] };
      if (rectsOverlap(f, lakeBox, 40) || rectsOverlap(f, sunBox, 10)) continue;
      if (fields.some((o) => rectsOverlap(f, o, 22))) continue;
      if (crop === 'orchard') for (let i = 0; i < 5; i++) f.trees.push({ x: S.rand(10, fw - 10), y: S.rand(12, fh - 8) });
      fields.push(f);
    }
    clouds = [];
    const nc = Math.min(3 + Math.floor(level / 2), 7);
    for (let i = 0; i < nc; i++) {
      const a = (i / nc) * Math.PI * 2;
      clouds.push(mkCloud(w / 2 + Math.cos(a) * unit * 0.12, h / 2 + Math.sin(a) * unit * 0.1, 0.6));
    }
    storms = [];
    const ns = level >= 3 ? Math.min(1 + Math.floor((level - 3) / 2), 3) : 0;
    for (let i = 0; i < ns; i++) { const c = mkCloud(S.rand(40, w - 40), S.rand(80, h * 0.4), 1); c.storm = true; c.zap = S.rand(1.5, 3); storms.push(c); }
    total = (40 + fields.length * 11 + (fields.filter((f) => f.crop !== 'wheat').length * 6)) * D().time;
    timeLeft = total;
    heat = 0; heatNext = level >= 2 ? S.rand(12, 20) : Infinity;
    drops = []; bolts = [];
  }

  function mkCloud(x, y, water) {
    const n = S.randInt(4, 6), puffs = [];
    for (let i = 0; i < n; i++) puffs.push({ dx: (i / (n - 1) - 0.5) * 1.5 + S.rand(-0.1, 0.1), dy: S.rand(-0.35, 0.15) - (i > 0 && i < n - 1 ? 0.25 : 0), r: S.rand(0.45, 0.7) });
    return { x, y, vx: 0, vy: 0, water, puffs, ph: Math.random() * 6 };
  }

  const cloudR = (c) => (c.storm ? 34 : 20 + c.water * 18);

  function startGame() { level = S.debug.on ? Math.max(1, S.debug.start) : 1; score = 0; hud.score(0); fx.clear(); fl.clear(); buildLevel(); state = 'play'; banner = { text: T.day(1), t: 0 }; }

  function moveCloud(c, dt, w, h, all) {
    if (ptr.inside && state !== 'menu') {
      const dx = c.x - ptr.x, dy = c.y - ptr.y, d = Math.hypot(dx, dy) || 1;
      const R = c.storm ? 150 : 175;
      if (d < R) { const f = (1 - d / R) * (c.storm ? 700 : 1100); c.vx += (dx / d) * f * dt; c.vy += (dy / d) * f * dt; }
    }
    c.vx += Math.sin(t * 0.3 + c.y * 0.01 + c.ph) * (c.storm ? 22 : 9) * dt;
    c.vy += Math.cos(t * 0.25 + c.x * 0.01 + c.ph) * (c.storm ? 22 : 9) * dt;
    for (const o of all) {
      if (o === c) continue;
      const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy) || 1, min = cloudR(c) + cloudR(o);
      if (d < min) { const f = (1 - d / min) * 300; c.vx += (dx / d) * f * dt; c.vy += (dy / d) * f * dt; }
    }
    const m = 30;
    if (c.x < m) c.vx += (m - c.x) * 8 * dt; if (c.x > w - m) c.vx -= (c.x - (w - m)) * 8 * dt;
    if (c.y < m + 30) c.vy += (m + 30 - c.y) * 8 * dt; if (c.y > h - m) c.vy -= (c.y - (h - m)) * 8 * dt;
    const drag = Math.exp(-1.7 * dt); c.vx *= drag; c.vy *= drag;
    const sp = Math.hypot(c.vx, c.vy), mx = c.storm ? 200 : 320; if (sp > mx) { c.vx *= mx / sp; c.vy *= mx / sp; }
    c.x += c.vx * dt; c.y += c.vy * dt;
  }

  const over = (c, f) => c.x > f.x - 8 && c.x < f.x + f.w + 8 && c.y > f.y - 8 && c.y < f.y + f.h + 8;

  function update(dt) {
    t += dt;
    const w = st.w, h = st.h;
    if (state === 'play' && !(S.debug.on && S.debug.god)) timeLeft -= dt;
    // Hitzewelle
    if (state === 'play') {
      heatNext -= dt;
      if (heatNext <= 0 && heat <= 0) { heat = 8; heatNext = S.rand(18, 28); banner = { text: T.heat, t: 0 }; snd.tone(180, 0.8, 'sawtooth', 0.06, 0.6); }
      if (heat > 0) heat -= dt;
    }
    const all = clouds.concat(storms);
    for (const f of fields) f.raining = false;
    let anyRain = false;
    for (const c of clouds) {
      moveCloud(c, dt, w, h, all);
      const lx = (c.x - lake.x) / lake.rx, ly = (c.y - lake.y) / lake.ry;
      if (lx * lx + ly * ly < 1.1 && c.water < 1) {
        c.water = Math.min(1, c.water + 0.42 * dt);
        if (Math.random() < 0.3) fx.burst(c.x + S.rand(-10, 10), c.y + cloudR(c), P.blue, 1, 40, 0.5, 2);
      }
      c.rain = false;
      if (c.water > 0.03 && state === 'play') {
        for (const f of fields) {
          if (f.bloom || !over(c, f)) continue;
          c.rain = true; f.raining = true; anyRain = true;
          c.water = Math.max(0, c.water - 0.16 * dt);
          f.m = Math.min(1, f.m + 0.21 * CROPS[f.crop].fill * dt);
          if (f.m >= 1 && !f.bloom) bloom(f);
          break;
        }
      }
      if (c.rain && Math.random() < dt * 40) drops.push({ x: c.x + S.rand(-cloudR(c), cloudR(c)) * 0.8, y: c.y + 6, vy: S.rand(160, 220), life: 0.35 });
    }
    // Gewitter
    for (const s of storms) {
      moveCloud(s, dt, w, h, all);
      s.zap -= dt;
      if (s.zap <= 0 && state === 'play') {
        s.zap = S.rand(2.2, 3.6);
        const f = fields.find((ff) => over(s, ff));
        const tx = f ? S.rand(f.x + 8, f.x + f.w - 8) : s.x + S.rand(-30, 30), ty = f ? S.rand(f.y + 8, f.y + f.h - 8) : s.y + S.rand(50, 90);
        const pts = [[s.x, s.y + 16]];
        const segs = 6;
        for (let i = 1; i <= segs; i++) pts.push([S.lerp(s.x, tx, i / segs) + (i < segs ? S.rand(-12, 12) : 0), S.lerp(s.y + 16, ty, i / segs)]);
        bolts.push({ pts, life: 0.35 });
        flash = 0.25;
        snd.noise(0.8, 0.35, 160); snd.noise(0.15, 0.3, 2400);
        if (f) {
          if (f.bloom) { f.bloom = false; f.m = 0.55; f.flowers = []; score = Math.max(0, score - 5); hud.score(score); fl.add(tx, ty - 10, T.boltLoss, P.ink); }
          else { f.m = Math.max(0, f.m - 0.4); fl.add(tx, ty - 10, T.bolt, P.ink); }
          f.burnt = 1;
          fx.burst(tx, ty, P.orange, 18, 180, 0.6, 3);
        }
      }
    }
    if (anyRain) { rainSnd -= dt; if (rainSnd <= 0) { rainSnd = 0.22; snd.noise(0.25, 0.04, 3000); } }
    const dry = (heat > 0 ? 3 : 1) * D().dry;
    for (const f of fields) { if (!f.bloom && !f.raining) f.m = Math.max(0, f.m - 0.022 * CROPS[f.crop].dry * dry * dt); if (f.burnt > 0) f.burnt = Math.max(0, f.burnt - dt * 0.4); }
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.y += d.vy * dt; d.life -= dt; if (d.life <= 0) drops.splice(i, 1); }
    for (let i = bolts.length - 1; i >= 0; i--) { bolts[i].life -= dt; if (bolts[i].life <= 0) bolts.splice(i, 1); }
    flash = Math.max(0, flash - dt);
    if (banner) { banner.t += dt; if (banner.t > 2.4) banner = null; }

    if (state === 'play') {
      if (fields.every((f) => f.bloom)) {
        const bonus = Math.floor(timeLeft) * 2;
        score += bonus; hud.score(score); hud.best(score);
        fl.add(st.w / 2, 90, T.bonus(bonus), P.ink);
        snd.chord([523, 659, 784, 1046], 0.5, 'triangle', 0.2);
        state = 'between';
        setTimeout(() => { level++; buildLevel(); state = 'play'; banner = { text: T.day(level), t: 0 }; }, 1600);
      } else if (timeLeft <= 0) {
        timeLeft = 0; state = 'over';
        const rec = hud.best(score);
        snd.tone(330, 0.8, 'sine', 0.15, 0.5);
        setTimeout(() => ov.show(rec && score > 0 ? T.record : T.lost,
          T.over(level, score, hud.bestValue), T.retry, startGame), 500);
        setTimeout(() => diff.mount(ov), 510);
      }
    }
    fx.update(dt, 0); fl.update(dt);
  }

  function bloom(f) {
    f.bloom = true; const pts = CROPS[f.crop].pts; score += pts; hud.score(score);
    for (let i = 0; i < Math.floor((f.w * f.h) / 380); i++) f.flowers.push({ x: S.rand(6, f.w - 6), y: S.rand(6, f.h - 6), c: S.pick([P.pink, P.yellow, P.paper]), s: S.rand(2, 4), d: Math.random() * 0.6 });
    f.bloomT = 0;
    fx.burst(f.x + f.w / 2, f.y + f.h / 2, P.green, 22, 180, 0.9, 4);
    fl.add(f.x + f.w / 2, f.y - 6, `+${pts}`, P.ink);
    snd.chord([392, 523, 659], 0.35, 'triangle', 0.2, 0.05);
  }

  function drawField(f) {
    const tx = S.tex;
    if (f.bloom) {
      f.bloomT = (f.bloomT || 0) + 1 / 60;
      ctx.fillStyle = P.green; ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.globalAlpha = 0.25; tx.halftoneRect(ctx, f.x, f.y, f.w, f.h, P.ink, (u, v) => 0.15 + v * 0.35, 6); ctx.globalAlpha = 1;
      for (const fl2 of f.flowers) {
        const k = E.outBack(S.clamp((f.bloomT - fl2.d) / 0.4, 0, 1));
        if (k <= 0) continue;
        ctx.fillStyle = fl2.c; ctx.beginPath(); ctx.arc(f.x + fl2.x, f.y + fl2.y, fl2.s * k, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = P.paper2; ctx.fillRect(f.x, f.y, f.w, f.h);
      if (f.crop === 'wheat') tx.hatch(ctx, f.x, f.y, f.w, f.h, P.orange, 9, -Math.PI / 4, 1.5);
      else if (f.crop === 'rice') { tx.hatch(ctx, f.x, f.y, f.w, f.h, P.green, 7, 0, 1.2); tx.hatch(ctx, f.x, f.y, f.w, f.h, P.orange, 14, Math.PI / 2, 1); }
      else { ctx.globalAlpha = 0.6; tx.halftoneRect(ctx, f.x, f.y, f.w, f.h, P.orange, 0.45, 7); ctx.globalAlpha = 1; }
      const mh = f.h * f.m;
      ctx.globalAlpha = 0.72; ctx.fillStyle = P.blue; ctx.fillRect(f.x, f.y + f.h - mh, f.w, mh); ctx.globalAlpha = 1;
      if (mh > 2) { ctx.strokeStyle = P.paper; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = 0; x <= f.w; x += 4) ctx.lineTo(f.x + x, f.y + f.h - mh + Math.sin(x * 0.2 + t * 3) * 1.5); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    if (f.crop === 'orchard') for (const tr of f.trees) {
      ctx.fillStyle = P.ink; ctx.fillRect(f.x + tr.x - 1, f.y + tr.y, 2, 6);
      S.riso(ctx, () => { ctx.beginPath(); ctx.arc(f.x + tr.x, f.y + tr.y - 2, f.bloom ? 7 : 5, 0, Math.PI * 2); }, P.ink, f.bloom ? P.green : P.soft, 1.5, 1.5, f);
      if (f.bloom) { ctx.fillStyle = P.pink; ctx.beginPath(); ctx.arc(f.x + tr.x + 2, f.y + tr.y - 3, 1.8, 0, Math.PI * 2); ctx.fill(); }
    }
    if (f.burnt > 0) { ctx.globalAlpha = f.burnt * 0.6; tx.halftoneRect(ctx, f.x, f.y, f.w, f.h, P.ink, 0.7, 5); ctx.globalAlpha = 1; }
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.strokeRect(f.x, f.y, f.w, f.h);
    if (!f.bloom) {
      ctx.font = '600 11px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'; ctx.textAlign = 'left';
      const label = `${CROPS[f.crop].name} ${Math.floor(f.m * 100)}%`;
      const lw = ctx.measureText(label).width + 8;
      ctx.fillStyle = P.card; ctx.fillRect(f.x + 3, f.y + 3, lw, 15);
      ctx.fillStyle = P.ink; ctx.fillText(label, f.x + 7, f.y + 14);
    }
  }

  function drawCloud(c) {
    const r = cloudR(c), bob = Math.sin(t * 1.4 + c.ph) * 2;
    const body = () => { ctx.beginPath(); for (const p of c.puffs) { ctx.moveTo(c.x + p.dx * r + p.r * r, c.y + bob + p.dy * r); ctx.arc(c.x + p.dx * r, c.y + bob + p.dy * r, p.r * r, 0, Math.PI * 2); } };
    let fill;
    if (c.storm) fill = P.dark ? '#4a4658' : '#6b6577';
    else fill = c.water > 0.66 ? (P.dark ? '#8f9bb8' : '#c9d3ea') : (P.dark ? '#cfd6e6' : '#ffffff');
    ctx.save(); ctx.translate(3, 3); ctx.fillStyle = c.storm ? P.ink : P.blue; body(); ctx.fill(); ctx.restore();
    ctx.fillStyle = fill; body(); ctx.fill();
    // Rasterschatten auf der Unterseite
    ctx.save(); body(); ctx.clip(); ctx.globalAlpha = c.storm ? 0.5 : 0.28;
    S.tex.halftoneRect(ctx, c.x - r * 1.6, c.y + bob - r, r * 3.2, r * 2, c.storm ? P.ink : P.blue, (u, v) => (v - 0.45) * 1.6, 4.5);
    ctx.restore();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; body(); ctx.stroke();
    if (c.storm) {
      ctx.fillStyle = P.yellow; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(c.x + 2, c.y + bob - 10); ctx.lineTo(c.x - 6, c.y + bob + 2); ctx.lineTo(c.x, c.y + bob + 2); ctx.lineTo(c.x - 3, c.y + bob + 12); ctx.lineTo(c.x + 7, c.y + bob - 1); ctx.lineTo(c.x + 1, c.y + bob - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = P.ink; ctx.fillRect(c.x - 12, c.y + bob + r * 0.55, 24, 4);
      ctx.fillStyle = P.blue; ctx.fillRect(c.x - 11, c.y + bob + r * 0.55 + 1, 22 * c.water, 2);
    }
  }

  function draw() {
    const w = st.w, h = st.h;
    S.tex.paperBg(ctx, w, h, P);
    if (heat > 0) { ctx.globalAlpha = Math.min(1, heat) * 0.12; ctx.fillStyle = P.orange; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    ctx.fillStyle = P.line;
    if (false) for (let y = 12; y < h; y += 26) for (let x = (y / 26) % 2 ? 6 : 19; x < w; x += 26) ctx.fillRect(x, y, 2, 4);

    if (lake) {
      ctx.fillStyle = P.pink; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.ellipse(lake.x + 4, lake.y + 3, lake.rx, lake.ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = P.blue;
      ctx.beginPath(); ctx.ellipse(lake.x, lake.y, lake.rx, lake.ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(lake.x, lake.y, lake.rx, lake.ry, 0, 0, Math.PI * 2); ctx.clip();
      ctx.globalAlpha = 0.3; S.tex.halftoneRect(ctx, lake.x - lake.rx, lake.y - lake.ry, lake.rx * 2, lake.ry * 2, P.ink, (u, v) => v * 0.7, 5);
      ctx.restore();
      ctx.strokeStyle = P.paper; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        for (let x = -lake.rx * 0.55; x <= lake.rx * 0.55; x += 4) ctx.lineTo(lake.x + x, lake.y + i * lake.ry * 0.38 + Math.sin(x * 0.12 + t * 2 + i) * 2.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    for (const f of fields) drawField(f);

    ctx.strokeStyle = P.blue; ctx.lineWidth = 1.5;
    ctx.beginPath(); for (const d of drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1.5, d.y + 7); } ctx.stroke();

    const all = clouds.concat(storms);
    for (const c of all) {
      const r = cloudR(c);
      ctx.fillStyle = P.ink; ctx.globalAlpha = c.storm ? 0.14 : 0.08;
      ctx.beginPath(); ctx.ellipse(c.x + 14, c.y + r * 1.25, r * 1.2, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const c of all) drawCloud(c);

    for (const b of bolts) {
      ctx.strokeStyle = P.yellow; ctx.lineWidth = 5; ctx.globalAlpha = b.life / 0.35; ctx.lineJoin = 'round';
      ctx.beginPath(); b.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (ptr.inside && state !== 'menu') {
      ctx.save(); ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const a = t * 3 + (i * Math.PI * 2) / 3, r = 16 + i * 6; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, r, a, a + 1.4); ctx.stroke(); }
      ctx.restore();
    }

    fx.draw(ctx); fl.draw(ctx);
    S.tex.grain(ctx, w, h, P.ink, P.dark ? 0.5 : 1);
    if (flash > 0) { ctx.globalAlpha = flash * 1.6; S.tex.paperBg(ctx, w, h, P); ctx.globalAlpha = 1; }

    if (state === 'play' || state === 'between') {
      const k = 1 - timeLeft / total;
      const ax = w / 2, ay = 46, ar = Math.min(110, w * 0.2);
      ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.25; ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.arc(ax, ay + ar * 0.5, ar, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      const sa = Math.PI * 1.15 + k * Math.PI * 0.7;
      const sx = ax + Math.cos(sa) * ar, sy = ay + ar * 0.5 + Math.sin(sa) * ar;
      const sr = heat > 0 ? 13 + Math.sin(t * 8) * 1.5 : 10;
      if (heat > 0) { ctx.strokeStyle = P.orange; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * (sr + 3), sy + Math.sin(a) * (sr + 3)); ctx.lineTo(sx + Math.cos(a) * (sr + 8), sy + Math.sin(a) * (sr + 8)); ctx.stroke(); } }
      S.riso(ctx, () => { ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); }, P.pink, timeLeft < 10 || heat > 0 ? P.orange : P.yellow, 2, 2);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.stroke();
      ctx.font = '600 12px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'; ctx.textAlign = 'center';
      const label = T.hud(level, Math.ceil(timeLeft), fields.filter((f) => f.bloom).length, fields.length);
      const lw = ctx.measureText(label).width + 20;
      ctx.fillStyle = P.card; ctx.fillRect(ax - lw / 2, h - 34, lw, 22); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.strokeRect(ax - lw / 2, h - 34, lw, 22);
      ctx.fillStyle = P.ink; ctx.fillText(label, ax, h - 19);
      ctx.textAlign = 'left';
    }
    if (banner) {
      const k = banner.t < 0.4 ? E.outBack(banner.t / 0.4) : banner.t > 2 ? 1 - (banner.t - 2) / 0.4 : 1;
      ctx.save(); ctx.globalAlpha = S.clamp(k, 0, 1); ctx.translate(w / 2, h * 0.32); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
      ctx.font = '700 32px "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = P.ink; ctx.fillText(banner.text, 0, 0);
      ctx.restore(); ctx.textAlign = 'left';
    }
  }

  S.dbg.next = () => { if (state === 'play') for (const f of fields) if (!f.bloom) bloom(f); };
  buildLevel();
  ov.show(T.title, T.intro, T.play, startGame);
  diff.mount(ov);

  S.loop((dt) => { update(dt); draw(); });
})();
