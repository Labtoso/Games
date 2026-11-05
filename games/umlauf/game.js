/* Umlauf: kreise, löse dich, lass dich einfangen */
(() => {
  const S = Shell, E = S.ease, snd = S.sound;
  const cv = document.getElementById('c');
  let P = S.palette();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { P = S.palette(); });
  const st = S.stage(cv);
  const ctx = st.ctx;
  const hud = S.hud('umlauf');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  const ZONES = [
    { name: 'Heimatbahn', types: ['normal'], comets: 0, holes: 0 },
    { name: 'Eisgürtel', types: ['normal', 'ice', 'ice'], comets: 0, holes: 0 },
    { name: 'Riesenfeld', types: ['normal', 'giant', 'ice', 'pulsar'], comets: 0.25, holes: 0 },
    { name: 'Pulsarnebel', types: ['normal', 'pulsar', 'pulsar', 'ice', 'giant'], comets: 0.4, holes: 0.12 },
    { name: 'Schlund', types: ['normal', 'pulsar', 'ice', 'giant'], comets: 0.55, holes: 0.25 },
  ];
  const ZONE_LEN = 18;
  const diff = S.difficulty('umlauf');
  const D = () => diff.pick({ leicht: { span: 1.45, cap: 1.15, comet: 0.5 }, normal: { span: 1, cap: 1, comet: 1 }, schwer: { span: 0.72, cap: 0.88, comet: 1.5 } });

  let planets = [], sparks = [], comets = [], holes = [], powers = [];
  let ship = null, camY = 0, score = 0, planetsDone = 0, combo = 1, state = 'menu', nextY = 0, shake = 0, t = 0, flyTime = 0;
  let shield = false, magnet = 0, banner = null, zoneIdx = 0, spawned = 0;

  const W = () => st.w, H = () => st.h;
  const zoneFor = (i) => ZONES[Math.min(ZONES.length - 1, Math.floor(i / ZONE_LEN))];

  function addPlanet() {
    const w = W();
    const z = zoneFor(spawned);
    const type = spawned === 0 ? 'normal' : S.pick(z.types);
    const small = w < 520 ? 0.85 : 1;
    let r = S.rand(15, 27) * small;
    if (type === 'giant') r *= 1.45;
    if (type === 'ice') r *= 0.85;
    const R = (type === 'giant' ? r * 2.1 + 40 : r * 2.3 + 26) * D().cap;
    const margin = R * 0.6 + 8;
    const prev = planets[planets.length - 1];
    let x = S.rand(margin, w - margin);
    if (prev) { let tries = 0; while (Math.abs(x - prev.x) < w * 0.18 && tries++ < 8) x = S.rand(margin, w - margin); }
    const p = {
      x, y: nextY, r, R, type, life: 1, visited: false, crumble: 0, idx: spawned,
      drift: spawned > 7 && Math.random() < Math.min(0.5, 0.12 + spawned * 0.012) ? S.rand(25, 40 + Math.min(spawned, 60)) * (Math.random() < 0.5 ? 1 : -1) : 0,
      bands: S.randInt(0, 2), ph: Math.random() * 6,
    };
    planets.push(p);
    // Funken und Extras zwischen den Planeten
    if (prev) {
      const mx = (p.x + prev.x) / 2, my = (p.y + prev.y) / 2;
      if (Math.random() < 0.65) sparks.push({ x: mx + S.rand(-24, 24), y: my + S.rand(-14, 14), got: false, ph: Math.random() * 6, vx: 0, vy: 0 });
      if (spawned > 4 && Math.random() < 0.09) powers.push({ x: S.rand(40, w - 40), y: my, kind: Math.random() < 0.5 ? 'shield' : 'magnet', got: false, ph: Math.random() * 6 });
      if (Math.random() < z.holes && spawned > 2) {
        const hx = p.x < w / 2 ? S.rand(w * 0.6, w - 40) : S.rand(40, w * 0.4);
        holes.push({ x: hx, y: my - S.rand(20, 60), r: 9, pull: 150 });
      }
    }
    spawned++;
    const gap = S.clamp(H() * 0.27, 150, 230);
    nextY -= gap + S.rand(-10, 30) + Math.min(spawned * 0.8, 40);
  }

  function reset() {
    planets = []; sparks = []; comets = []; holes = []; powers = []; fx.clear(); fl.clear();
    score = 0; planetsDone = 0; combo = 1; hud.score(0); shake = 0; flyTime = 0; spawned = 0; zoneIdx = 0;
    if (S.debug.on && S.debug.start > 1) { spawned = (Math.min(S.debug.start, ZONES.length) - 1) * ZONE_LEN; zoneIdx = Math.min(S.debug.start, ZONES.length) - 1; }
    shield = false; magnet = 0; banner = null;
    nextY = H() * 0.68;
    addPlanet();
    const p0 = planets[0];
    p0.visited = true;
    ship = { mode: 'orbit', p: p0, a: -Math.PI / 2, rad: p0.r + 24, dir: 1, x: 0, y: 0, vx: 0, vy: 0, from: null, trail: [] };
    camY = 0;
    while (nextY > camY - H() * 1.2) addPlanet();
  }

  function angSpeed(p) { return Math.min(2.3 + planetsDone * 0.03, 3.6) * (p && p.type === 'ice' ? 1.45 : p && p.type === 'giant' ? 0.75 : 1); }
  function flySpeed() { return Math.min(330 + planetsDone * 4, 500); }
  const pulsarOpen = (p) => p.type !== 'pulsar' || Math.sin(t * 2.4 + p.ph) > -0.25;

  function release() {
    if (state !== 'play' || ship.mode !== 'orbit') return;
    const tx = -Math.sin(ship.a) * ship.dir, ty = Math.cos(ship.a) * ship.dir;
    const v = flySpeed();
    ship.vx = tx * v; ship.vy = ty * v;
    ship.from = ship.p; ship.p = null; ship.mode = 'fly'; flyTime = 0;
    snd.noise(0.18, 0.18, 900);
  }

  function capture(p, d) {
    const dx = ship.x - p.x, dy = ship.y - p.y;
    const cross = dx * ship.vy - dy * ship.vx;
    ship.mode = 'orbit'; ship.p = p; ship.a = Math.atan2(dy, dx); ship.rad = d; ship.dir = cross >= 0 ? 1 : -1;
    if (!p.visited) {
      p.visited = true; planetsDone++;
      const perfect = Math.abs(d - (p.r + 24)) < 13;
      combo = perfect ? Math.min(combo + 1, 6) : 1;
      const pts = combo;
      score += pts; hud.score(score);
      const col = p.type === 'giant' ? P.yellow : p.type === 'ice' ? P.green : p.type === 'pulsar' ? P.pink : P.blue;
      fx.burst(p.x, p.y, col, 18, 180, 0.8, 4);
      fl.add(p.x, p.y - p.r - 14, perfect && combo > 1 ? `Perfekt ×${combo}` : `+${pts}`, P.ink);
      snd.tone(330 * Math.pow(1.122, combo - 1), 0.16, 'triangle', 0.3);
      const zi = Math.min(ZONES.length - 1, Math.floor(p.idx / ZONE_LEN));
      if (zi > zoneIdx) { zoneIdx = zi; banner = { text: `Zone ${zi + 1}: ${ZONES[zi].name}`, t: 0 }; snd.chord([392, 494, 587], 0.4, 'triangle', 0.18); }
    } else snd.tone(260, 0.08, 'sine', 0.15);
  }

  function die(reason) {
    if (shield || (S.debug.on && S.debug.god)) {
      if (!(S.debug.on && S.debug.god)) shield = false; shake = 0.25;
      fx.burst(ship.x, ship.y, P.blue, 22, 200, 0.7, 3);
      snd.tone(520, 0.3, 'sine', 0.25, 0.5);
      // zurück zum letzten Planeten
      const back = ship.from && ship.from.crumble === 0 ? ship.from : planets.find((p) => p.visited && p.crumble === 0 && p.y - camY < H()) || planets.find((p) => p.crumble === 0);
      ship.mode = 'orbit'; ship.p = back; ship.rad = back.r + 24; ship.a = -Math.PI / 2; back.life = Math.max(back.life, 0.6);
      fl.add(back.x, back.y - back.r - 20, 'Schild!', P.ink);
      return;
    }
    over(reason);
  }

  function over() {
    state = 'over'; shake = 0.4;
    fx.burst(ship.x, ship.y, P.pink, 24, 220, 0.9, 4);
    snd.tone(220, 0.5, 'sawtooth', 0.2, 0.3);
    const rec = hud.best(score);
    setTimeout(() => ov.show(
      rec && score > 0 ? 'Neuer Rekord!' : 'Abgedriftet',
      `<b>${score}</b> Punkte, <b>${planetsDone}</b> Planeten, bis <b>Zone ${zoneIdx + 1}</b> (${diff.label}). Rekord: <b>${hud.bestValue}</b>.`,
      'Nochmal', start), 650);
    setTimeout(() => diff.mount(ov), 660);
  }

  function start() { reset(); state = 'play'; banner = { text: 'Zone 1: Heimatbahn', t: 0 }; }

  function update(dt) {
    t += dt;
    const w = W(), h = H();
    for (const p of planets) {
      if (p.drift) { p.x += p.drift * dt; if (p.x < p.R * 0.6 || p.x > w - p.R * 0.6) { p.drift *= -1; p.x = S.clamp(p.x, p.R * 0.6, w - p.R * 0.6); } }
      if (p.crumble > 0) p.crumble += dt;
    }
    // Kometen
    const z = zoneFor(planetsDone);
    if (state === 'play' && z.comets && Math.random() < z.comets * D().comet * dt * 0.5) {
      const fromLeft = Math.random() < 0.5;
      comets.push({ x: fromLeft ? -30 : w + 30, y: camY + S.rand(h * 0.05, h * 0.6), vx: (fromLeft ? 1 : -1) * S.rand(110, 180), vy: S.rand(20, 60), trail: [] });
      snd.noise(0.4, 0.05, 400);
    }
    for (const c of comets) { c.x += c.vx * dt; c.y += c.vy * dt; c.trail.push(c.x, c.y); if (c.trail.length > 30) c.trail.splice(0, 2); }
    comets = comets.filter((c) => c.x > -60 && c.x < w + 60 && c.y - camY < h + 60);

    if (state === 'play' || state === 'menu') {
      if (ship.mode === 'orbit') {
        const p = ship.p;
        ship.a += ship.dir * angSpeed(p) * dt;
        ship.rad = S.lerp(ship.rad, p.r + 24, Math.min(1, dt * 4));
        ship.x = p.x + Math.cos(ship.a) * ship.rad;
        ship.y = p.y + Math.sin(ship.a) * ship.rad;
        if (state === 'play' && planetsDone > 0) {
          const span = D().span * Math.max(2.1, 4.6 - planetsDone * 0.05) * (p.type === 'giant' ? 1.5 : p.type === 'ice' ? 0.8 : 1);
          p.life -= dt / span;
          if (p.life <= 0 && p.crumble === 0) {
            p.crumble = 0.001;
            fx.burst(p.x, p.y, P.soft, 20, 120, 0.9, 3);
            snd.noise(0.35, 0.2, 300);
            release();
          }
        }
      } else {
        flyTime += dt;
        // Schwarze Löcher ziehen
        for (const ho of holes) {
          const dx = ho.x - ship.x, dy = ho.y - ship.y, d = Math.hypot(dx, dy);
          if (d < 140) { const f = (ho.pull * 60) / Math.max(d, 20); ship.vx += (dx / d) * f * dt; ship.vy += (dy / d) * f * dt; }
          if (d < ho.r + 4 && state === 'play') { die('hole'); break; }
        }
        ship.x += ship.vx * dt; ship.y += ship.vy * dt;
        if (ship.mode === 'fly') for (const p of planets) {
          if (p === ship.from || p.crumble > 0 || !pulsarOpen(p)) continue;
          const d = Math.hypot(ship.x - p.x, ship.y - p.y);
          if (d < p.R) { capture(p, d); break; }
        }
        if (state === 'play' && ship.mode === 'fly' && (ship.x < -30 || ship.x > w + 30 || ship.y - camY > h + 30 || ship.y - camY < -60 || flyTime > 3.2)) die('drift');
      }
      if (state === 'play') {
        for (const c of comets) if (Math.hypot(c.x - ship.x, c.y - ship.y) < 14) { c.x = -999; die('comet'); break; }
        if (magnet > 0) magnet -= dt;
        for (const s of sparks) {
          if (s.got) continue;
          const d = Math.hypot(ship.x - s.x, ship.y - s.y);
          if (magnet > 0 && d < 220) { s.x += ((ship.x - s.x) / d) * 380 * dt; s.y += ((ship.y - s.y) / d) * 380 * dt; }
          if (d < 20) {
            s.got = true; score += 1; hud.score(score);
            fx.burst(s.x, s.y, P.yellow, 10, 140, 0.6, 3);
            fl.add(s.x, s.y - 12, '+1', P.ink);
            snd.tone(990, 0.08, 'sine', 0.18);
          }
        }
        for (const pw of powers) {
          if (!pw.got && Math.hypot(ship.x - pw.x, ship.y - pw.y) < 24) {
            pw.got = true;
            if (pw.kind === 'shield') { shield = true; fl.add(pw.x, pw.y - 14, 'Schild', P.ink); }
            else { magnet = 9; fl.add(pw.x, pw.y - 14, 'Magnet', P.ink); }
            fx.burst(pw.x, pw.y, P.blue, 16, 160, 0.7, 3);
            snd.chord([523, 784], 0.25, 'triangle', 0.2);
          }
        }
      }
      ship.trail.push(ship.x, ship.y);
      if (ship.trail.length > 70) ship.trail.splice(0, 2);
    }

    if (ship && state !== 'over') camY = S.lerp(camY, ship.y - h * 0.62, Math.min(1, dt * 2.6));
    while (nextY > camY - h * 1.2) addPlanet();
    planets = planets.filter((p) => p.y - camY < h + 200 || p === (ship && ship.p) || p === (ship && ship.from));
    sparks = sparks.filter((s) => s.y - camY < h + 100);
    holes = holes.filter((s) => s.y - camY < h + 160);
    powers = powers.filter((s) => s.y - camY < h + 100);
    if (banner) { banner.t += dt; if (banner.t > 2.6) banner = null; }

    fx.update(dt); fl.update(dt);
    if (shake > 0) shake = Math.max(0, shake - dt);
  }

  function circle(x, y, r) { return () => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }; }

  function draw() {
    const w = W(), h = H();
    S.tex.paperBg(ctx, w, h, P);
    // Zonenfarbe als zarter Schleier
    const zc = [null, P.green, P.yellow, P.pink, P.ink][zoneIdx];
    if (zc) { ctx.globalAlpha = 0.06; ctx.fillStyle = zc; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    ctx.save();
    if (shake > 0) ctx.translate(S.rand(-1, 1) * shake * 14, S.rand(-1, 1) * shake * 14);

    const gs = 30, off = ((-camY * 0.4) % gs + gs) % gs;
    ctx.fillStyle = P.line;
    for (let y = off - gs; y < h + gs; y += gs) for (let x = gs / 2; x < w; x += gs) ctx.fillRect(x, y, 2, 2);

    ctx.translate(0, -camY);

    // Schwarze Löcher
    for (const ho of holes) {
      ctx.save(); ctx.translate(ho.x, ho.y);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(t * 0.9 + i);
        ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.18 + i * 0.08; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 60 - i * 13, 0, Math.PI * 1.2); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(0, 0, ho.r + Math.sin(t * 5) * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Planeten
    for (const p of planets) {
      if (p.crumble > 0.8) continue;
      const k = p.crumble > 0 ? 1 - p.crumble / 0.8 : 1;
      const open = pulsarOpen(p);
      if (!p.visited && p.crumble === 0) {
        ctx.save();
        ctx.setLineDash(p.type === 'pulsar' ? [8, 5] : [3, 7]); ctx.lineDashOffset = -t * 12;
        ctx.strokeStyle = p.type === 'pulsar' ? P.pink : P.soft; ctx.globalAlpha = open ? 0.6 : 0.12; ctx.lineWidth = p.type === 'pulsar' ? 2 : 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      const col = p.type === 'giant' ? P.yellow : p.type === 'ice' ? P.green : p.type === 'pulsar' ? P.ink : P.blue;
      ctx.globalAlpha = k;
      S.riso(ctx, circle(p.x, p.y, p.r * k), P.pink, col, 3, 2.5, p);
      ctx.globalAlpha = 0.55 * k;
      S.tex.halftoneCircle(ctx, p.x, p.y, p.r * k, P.ink, -2.3, Math.max(3.2, p.r / 6));
      ctx.globalAlpha = k;
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k, 0, Math.PI * 2); ctx.clip();
      if (p.type === 'ice') {
        ctx.strokeStyle = P.paper; ctx.globalAlpha = 0.55 * k; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(p.x - p.r, p.y - p.r * 0.6 + i * p.r * 0.6); ctx.lineTo(p.x + p.r, p.y - p.r * 0.2 + i * p.r * 0.5); ctx.stroke(); }
      } else if (p.type === 'pulsar') {
        ctx.fillStyle = P.pink; ctx.globalAlpha = (open ? 0.9 : 0.3) * k;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = P.paper; ctx.globalAlpha = 0.35 * k; ctx.lineWidth = 3;
        for (let i = 0; i < p.bands; i++) { ctx.beginPath(); ctx.ellipse(p.x, p.y + (i - 0.5) * p.r * 0.55, p.r * 1.4, p.r * 0.22, 0.3, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      if (ship && ship.p === p && state === 'play' && p.life < 1) {
        ctx.strokeStyle = p.life < 0.3 ? P.pink : P.ink; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
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
    // Extras
    for (const pw of powers) {
      if (pw.got) continue;
      const bob = Math.sin(t * 3 + pw.ph) * 4;
      ctx.save(); ctx.translate(pw.x, pw.y + bob);
      ctx.fillStyle = P.card; ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-13, -13, 26, 26, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = P.blue; ctx.lineWidth = 2.5;
      if (pw.kind === 'shield') { ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(0, -1, 6, Math.PI, 0); ctx.moveTo(-6, -1); ctx.lineTo(-6, 6); ctx.moveTo(6, -1); ctx.lineTo(6, 6); ctx.stroke(); }
      ctx.restore();
    }
    // Kometen
    for (const c of comets) {
      for (let i = 2; i < c.trail.length; i += 2) {
        ctx.globalAlpha = (i / c.trail.length) * 0.6; ctx.strokeStyle = P.orange; ctx.lineWidth = 5 * (i / c.trail.length);
        ctx.beginPath(); ctx.moveTo(c.trail[i - 2], c.trail[i - 1]); ctx.lineTo(c.trail[i], c.trail[i + 1]); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.orange; ctx.beginPath(); ctx.arc(c.x - 2, c.y - 2, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Spur und Schiff
    if (ship && state !== 'over') {
      const tr = ship.trail;
      ctx.lineCap = 'round';
      for (let i = 2; i < tr.length; i += 2) {
        ctx.globalAlpha = (i / tr.length) * 0.8;
        ctx.strokeStyle = combo > 2 ? P.yellow : P.pink; ctx.lineWidth = 3 * (i / tr.length) * (1 + (combo - 1) * 0.15);
        ctx.beginPath(); ctx.moveTo(tr[i - 2], tr[i - 1]); ctx.lineTo(tr[i], tr[i + 1]); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const ang = ship.mode === 'orbit' ? ship.a + (ship.dir * Math.PI) / 2 : Math.atan2(ship.vy, ship.vx);
      ctx.save(); ctx.translate(ship.x, ship.y);
      if (shield) { ctx.strokeStyle = P.blue; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + Math.sin(t * 6) * 0.2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      if (magnet > 0) { ctx.strokeStyle = P.yellow; ctx.setLineDash([2, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 26 + Math.sin(t * 8) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, 6); ctx.lineTo(-4, 0); ctx.lineTo(-7, -6); ctx.closePath();
      ctx.fillStyle = P.ink; ctx.fill();
      ctx.restore();
      if (ship.mode === 'orbit' && state === 'play') {
        const tx = -Math.sin(ship.a) * ship.dir, ty = Math.cos(ship.a) * ship.dir;
        ctx.save(); ctx.setLineDash([2, 8]); ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ship.x + tx * 14, ship.y + ty * 14); ctx.lineTo(ship.x + tx * 80, ship.y + ty * 80); ctx.stroke();
        ctx.restore();
      }
    }

    if (ship) { S.dbg.circle(ctx, ship.x, ship.y, 6); for (const p of planets) S.dbg.circle(ctx, p.x, p.y, p.R, '#ff0'); for (const c of comets) S.dbg.circle(ctx, c.x, c.y, 14, '#f0f'); }
    fx.draw(ctx); fl.draw(ctx);
    ctx.restore();
    S.tex.grain(ctx, w, h, P.ink, P.dark ? 0.5 : 1, 0, camY * 0.4);

    // Anzeigen
    if (state === 'play') {
      ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.fillStyle = P.ink; ctx.textAlign = 'left';
      ctx.fillText(`Zone ${zoneIdx + 1} · ${planetsDone} Planeten`, 14, 22);
      if (combo > 1) { ctx.fillStyle = P.pink; ctx.fillText(`Kombo ×${combo}`, 14, 40); }
      if (magnet > 0) { ctx.fillStyle = P.ink; ctx.fillText(`Magnet ${Math.ceil(magnet)} s`, 14, combo > 1 ? 58 : 40); }
    }
    if (banner) {
      const k = banner.t < 0.4 ? E.outBack(banner.t / 0.4) : banner.t > 2.2 ? 1 - (banner.t - 2.2) / 0.4 : 1;
      ctx.save(); ctx.globalAlpha = S.clamp(k, 0, 1); ctx.translate(w / 2, h * 0.2); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
      ctx.font = '400 28px "Young Serif", Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = P.ink;
      ctx.fillText(banner.text, 0, 0);
      ctx.restore(); ctx.textAlign = 'left';
    }
  }

  const ptr = S.pointer(cv);
  ptr.onDown = () => release();
  S.keys((k) => { if ((k === ' ' || k === 'ArrowUp' || k === 'w') && !ov.open) release(); });

  S.dbg.next = () => { spawned = Math.max(spawned, (zoneIdx + 1) * ZONE_LEN); };
  reset();
  ov.show('Umlauf',
    'Dein Schiff kreist um einen Planeten. <b>Tippe</b>, um dich zu lösen, und lass dich vom nächsten Schwerefeld einfangen. Planeten zerfallen, wenn du zu lange bleibst.<ul><li>Knapp an der Umlaufbahn einfangen gibt <b>Kombos</b></li><li>Eisplaneten drehen schnell, Riesen langsam</li><li>Pulsare fangen nur, wenn ihr Feld leuchtet</li><li>Weiter oben: Kometen, schwarze Löcher, Schild und Magnet</li></ul>',
    'Starten', start);
  diff.mount(ov);

  S.loop((dt) => { update(dt); draw(); });
})();
