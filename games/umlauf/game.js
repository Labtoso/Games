/* Umlauf: kreise, löse dich, lass dich einfangen */
(() => {
  const S = Shell;
  const cv = document.getElementById('c');
  let P = S.palette();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { P = S.palette(); });
  const st = S.stage(cv);
  const ctx = st.ctx;
  const hud = S.hud('umlauf');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  let planets = [], sparks = [], ship = null, camY = 0, score = 0, state = 'menu', nextY = 0, shake = 0, t = 0, flyTime = 0;

  const W = () => st.w, H = () => st.h;

  function addPlanet() {
    const w = W();
    const small = w < 520 ? 0.85 : 1;
    const r = S.rand(15, 28) * small;
    const R = r * 2.3 + 26;
    const margin = R * 0.6 + 8;
    const prev = planets[planets.length - 1];
    let x = S.rand(margin, w - margin);
    if (prev) { // nicht direkt übereinander, sonst zu leicht
      let tries = 0;
      while (Math.abs(x - prev.x) < w * 0.18 && tries++ < 8) x = S.rand(margin, w - margin);
    }
    const level = planets.length;
    const p = {
      x, y: nextY, r, R, life: 1, visited: false, crumble: 0,
      drift: level > 7 && Math.random() < Math.min(0.55, 0.15 + level * 0.02) ? S.rand(25, 45 + level) * (Math.random() < 0.5 ? 1 : -1) : 0,
      tint: Math.random() < 0.22 ? 'yellow' : 'blue',
      bands: S.randInt(0, 2), seed: Math.random() * 10,
    };
    planets.push(p);
    if (prev && Math.random() < 0.65) {
      sparks.push({ x: (p.x + prev.x) / 2 + S.rand(-24, 24), y: (p.y + prev.y) / 2 + S.rand(-14, 14), got: false, ph: Math.random() * 6 });
    }
    const gap = S.clamp(H() * 0.27, 150, 230);
    nextY -= gap + S.rand(-10, 30) + Math.min(level * 1.2, 40);
  }

  function reset() {
    planets = []; sparks = []; fx.clear(); fl.clear();
    score = 0; hud.score(0); shake = 0; flyTime = 0;
    nextY = H() * 0.68;
    addPlanet();
    const p0 = planets[0];
    p0.visited = true;
    ship = { mode: 'orbit', p: p0, a: -Math.PI / 2, rad: p0.r + 24, dir: 1, x: 0, y: 0, vx: 0, vy: 0, from: null, trail: [] };
    camY = 0;
    while (nextY > camY - H() * 1.2) addPlanet();
  }

  function angSpeed() { return Math.min(2.3 + score * 0.035, 3.6); }
  function flySpeed() { return Math.min(330 + score * 5, 500); }

  function release() {
    if (state !== 'play' || ship.mode !== 'orbit') return;
    const tx = -Math.sin(ship.a) * ship.dir, ty = Math.cos(ship.a) * ship.dir;
    const v = flySpeed();
    ship.vx = tx * v; ship.vy = ty * v;
    ship.from = ship.p; ship.p = null; ship.mode = 'fly'; flyTime = 0;
  }

  function capture(p, d) {
    const dx = ship.x - p.x, dy = ship.y - p.y;
    const cross = dx * ship.vy - dy * ship.vx;
    ship.mode = 'orbit'; ship.p = p; ship.a = Math.atan2(dy, dx); ship.rad = d; ship.dir = cross >= 0 ? 1 : -1;
    if (!p.visited) {
      p.visited = true; score += 1; hud.score(score);
      fx.burst(p.x, p.y, p.tint === 'yellow' ? P.yellow : P.blue, 18, 180, 0.8, 4);
      fl.add(p.x, p.y - p.r - 14, '+1', P.ink);
    }
  }

  function over() {
    state = 'over'; shake = 0.4;
    fx.burst(ship.x, ship.y, P.pink, 24, 220, 0.9, 4);
    const rec = hud.best(score);
    setTimeout(() => ov.show(
      rec && score > 0 ? 'Neuer Rekord!' : 'Abgedriftet',
      `Du hast <b>${score}</b> ${score === 1 ? 'Punkt' : 'Punkte'} gesammelt. Rekord: <b>${hud.bestValue}</b>.`,
      'Nochmal', start), 650);
  }

  function start() { reset(); state = 'play'; }

  function update(dt) {
    t += dt;
    for (const p of planets) {
      if (p.drift) { p.x += p.drift * dt; if (p.x < p.R * 0.6 || p.x > W() - p.R * 0.6) { p.drift *= -1; p.x = S.clamp(p.x, p.R * 0.6, W() - p.R * 0.6); } }
      if (p.crumble > 0) p.crumble += dt;
    }

    if (state === 'play' || state === 'menu') {
      if (ship.mode === 'orbit') {
        const p = ship.p;
        ship.a += ship.dir * angSpeed() * dt;
        ship.rad = S.lerp(ship.rad, p.r + 24, Math.min(1, dt * 4));
        ship.x = p.x + Math.cos(ship.a) * ship.rad;
        ship.y = p.y + Math.sin(ship.a) * ship.rad;
        if (state === 'play' && p !== planets[0] || (state === 'play' && score > 0)) {
          p.life -= dt / Math.max(2.2, 4.6 - score * 0.07);
          if (p.life <= 0 && p.crumble === 0) {
            p.crumble = 0.001;
            fx.burst(p.x, p.y, P.soft, 20, 120, 0.9, 3);
            release();
          }
        }
      } else {
        flyTime += dt;
        ship.x += ship.vx * dt; ship.y += ship.vy * dt;
        for (const p of planets) {
          if (p === ship.from || p.crumble > 0) continue;
          const d = Math.hypot(ship.x - p.x, ship.y - p.y);
          if (d < p.R) { capture(p, d); break; }
        }
        if (state === 'play' && (ship.x < -30 || ship.x > W() + 30 || ship.y - camY > H() + 30 || ship.y - camY < -60 || flyTime > 3.2)) over();
      }
      for (const s of sparks) {
        if (!s.got && Math.hypot(ship.x - s.x, ship.y - s.y) < 20 && state === 'play') {
          s.got = true; score += 1; hud.score(score);
          fx.burst(s.x, s.y, P.yellow, 10, 140, 0.6, 3);
          fl.add(s.x, s.y - 12, '+1', P.ink);
        }
      }
      ship.trail.push(ship.x, ship.y);
      if (ship.trail.length > 70) ship.trail.splice(0, 2);
    }

    // Kamera folgt nach oben
    if (ship && state !== 'over') {
      const target = Math.min(ship.y - H() * 0.62, camY + 9999);
      camY = S.lerp(camY, target, Math.min(1, dt * 2.6));
    }
    while (nextY > camY - H() * 1.2) addPlanet();
    planets = planets.filter((p) => p.y - camY < H() + 200 || p === (ship && ship.p) || p === (ship && ship.from));
    sparks = sparks.filter((s) => s.y - camY < H() + 100);

    fx.update(dt); fl.update(dt);
    if (shake > 0) shake = Math.max(0, shake - dt);
  }

  function circle(x, y, r) { return () => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }; }

  function draw() {
    const w = W(), h = H();
    ctx.fillStyle = P.paper; ctx.fillRect(0, 0, w, h);
    ctx.save();
    if (shake > 0) ctx.translate(S.rand(-1, 1) * shake * 14, S.rand(-1, 1) * shake * 14);

    // Punktraster mit leichter Parallaxe
    const gs = 30, off = ((-camY * 0.4) % gs + gs) % gs;
    ctx.fillStyle = P.line;
    for (let y = off - gs; y < h + gs; y += gs) for (let x = gs / 2; x < w; x += gs) ctx.fillRect(x, y, 2, 2);

    ctx.translate(0, -camY);

    // Planeten
    for (const p of planets) {
      if (p.crumble > 0.8) continue;
      const k = p.crumble > 0 ? 1 - p.crumble / 0.8 : 1;
      if (!p.visited && p.crumble === 0) {
        ctx.save();
        ctx.setLineDash([3, 7]); ctx.lineDashOffset = -t * 12;
        ctx.strokeStyle = P.soft; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      const col = p.tint === 'yellow' ? P.yellow : P.blue;
      ctx.globalAlpha = k;
      S.riso(ctx, circle(p.x, p.y, p.r * k), P.pink, col, 3, 2.5);
      // Bänder
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = P.paper; ctx.globalAlpha = 0.35 * k; ctx.lineWidth = 3;
      for (let i = 0; i < p.bands; i++) { ctx.beginPath(); ctx.ellipse(p.x, p.y + (i - 0.5) * p.r * 0.55, p.r * 1.4, p.r * 0.22, 0.3, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      ctx.globalAlpha = 1;
      // Zerfallsanzeige
      if (ship && ship.p === p && state === 'play' && p.life < 1) {
        ctx.strokeStyle = P.ink; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, p.life)); ctx.stroke();
      }
    }

    // Funken
    for (const s of sparks) {
      if (s.got) continue;
      const pulse = 1 + Math.sin(t * 4 + s.ph) * 0.15;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(t * 0.8 + s.ph); ctx.scale(pulse, pulse);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const rr = i % 2 ? 3 : 9; const a = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = P.yellow; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }

    // Spur und Schiff
    if (ship && state !== 'over') {
      const tr = ship.trail;
      ctx.lineCap = 'round';
      for (let i = 2; i < tr.length; i += 2) {
        ctx.globalAlpha = (i / tr.length) * 0.8;
        ctx.strokeStyle = P.pink; ctx.lineWidth = 3 * (i / tr.length);
        ctx.beginPath(); ctx.moveTo(tr[i - 2], tr[i - 1]); ctx.lineTo(tr[i], tr[i + 1]); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const ang = ship.mode === 'orbit' ? ship.a + (ship.dir * Math.PI) / 2 : Math.atan2(ship.vy, ship.vx);
      ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, 6); ctx.lineTo(-4, 0); ctx.lineTo(-7, -6); ctx.closePath();
      ctx.fillStyle = P.ink; ctx.fill();
      ctx.restore();
      // Vorschau der Flugbahn im Orbit
      if (ship.mode === 'orbit' && state === 'play') {
        const tx = -Math.sin(ship.a) * ship.dir, ty = Math.cos(ship.a) * ship.dir;
        ctx.save(); ctx.setLineDash([2, 8]); ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ship.x + tx * 14, ship.y + ty * 14); ctx.lineTo(ship.x + tx * 70, ship.y + ty * 70); ctx.stroke();
        ctx.restore();
      }
    }

    fx.draw(ctx); fl.draw(ctx);
    ctx.restore();
  }

  const ptr = S.pointer(cv);
  ptr.onDown = () => release();
  S.keys((k) => { if ((k === ' ' || k === 'ArrowUp' || k === 'w') && !ov.open) release(); });

  reset();
  ov.show('Umlauf',
    'Dein Schiff kreist um einen Planeten. <b>Tippe</b>, um dich zu lösen, und lass dich vom Schwerefeld des nächsten einfangen. Bleib nicht zu lange: Planeten zerfallen. Funken unterwegs geben Extrapunkte.',
    'Starten', start);

  S.loop((dt) => { update(dt); draw(); });
})();
