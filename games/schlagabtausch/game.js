/* Schlagabtausch: Ballduell für einen oder zwei Spieler */
(() => {
  const S = Shell, E = S.ease, snd = S.sound;
  const cv = document.getElementById('c');
  let P = S.palette();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { P = S.palette(); });
  const st = S.stage(cv, () => fitCourt());
  const ctx = st.ctx;
  const hud = S.hud('schlagabtausch');
  const ov = S.overlay();
  const fx = S.particles();
  const fl = S.floaters();

  const WIN = 7;
  let mode = S.store.get('schlagabtausch:mode', 'ai'), level = S.store.get('schlagabtausch:level', 'mittel'), extras = S.store.get('schlagabtausch:extras', true);
  let court = { x: 0, y: 0, w: 1, h: 1 }, L, R, balls = [], items = [], state = 'menu', t = 0, shake = 0, serveT = 0, server = 1, rally = 0, bestRally = 0, goalFlash = { side: 0, t: 0 }, itemT = 6, banner = null;
  const AI = { leicht: { speed: 0.55, react: 0.28, err: 60 }, mittel: { speed: 0.8, react: 0.16, err: 30 }, schwer: { speed: 1.05, react: 0.07, err: 10 } };

  function fitCourt() {
    const pad = Math.min(24, st.w * 0.04);
    court = { x: pad, y: pad + 10, w: st.w - pad * 2, h: st.h - pad * 2 - 10 };
    if (L) { L.x = court.x + 22; R.x = court.x + court.w - 22; }
  }

  function paddle(x) { return { x, y: court.y + court.h / 2, vy: 0, h: Math.max(70, court.h * 0.2), w: 12, score: 0, big: 0, aiT: 0, aiY: court.y + court.h / 2 }; }

  function newBall(dir) {
    const a = S.rand(-0.45, 0.45);
    const sp = baseSpeed();
    return { x: court.x + court.w / 2, y: court.y + court.h / 2, vx: Math.cos(a) * sp * dir, vy: Math.sin(a) * sp, r: Math.max(7, Math.min(10, court.h * 0.018)), spin: 0, trail: [], slow: 0 };
  }
  const baseSpeed = () => Math.max(300, court.w * 0.42);

  function startMatch() {
    S.store.set('schlagabtausch:mode', mode); S.store.set('schlagabtausch:level', level); S.store.set('schlagabtausch:extras', extras);
    fitCourt();
    L = paddle(court.x + 22); R = paddle(court.x + court.w - 22);
    balls = []; items = []; rally = 0; bestRally = 0; itemT = 6; fx.clear(); fl.clear();
    server = Math.random() < 0.5 ? -1 : 1; serveT = 1.2; state = 'play';
    hud.score('0 : 0');
    banner = { text: mode === 'ai' ? `Gegen den Computer · ${level}` : 'Zwei Spieler', t: 0 };
  }

  const keys = S.keys((k) => { if (k === 'Escape' && state === 'play') { state = 'pause'; ov.show('Pause', 'Kurz durchatmen.', 'Weiter', () => { state = 'play'; }); } });
  const ptr = S.pointer(cv);
  const touches = new Map();
  cv.addEventListener('pointerdown', (e) => { touches.set(e.pointerId, e); });
  cv.addEventListener('pointermove', (e) => { if (touches.has(e.pointerId)) touches.set(e.pointerId, e); });
  const lift = (e) => touches.delete(e.pointerId);
  cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);

  function movePaddle(p, dir, dt, target, k = 1) {
    const sp = court.h * 1.5 * k;
    const prev = p.y;
    if (target != null) p.y = S.lerp(p.y, target, Math.min(1, dt * 18));
    else p.y += dir * sp * dt;
    const h = p.h * (p.big > 0 ? 1.5 : 1);
    p.y = S.clamp(p.y, court.y + h / 2, court.y + court.h - h / 2);
    p.vy = (p.y - prev) / Math.max(dt, 0.001);
  }

  function aiMove(p, dt) {
    const cfg = AI[level];
    p.aiT -= dt;
    if (p.aiT <= 0) {
      p.aiT = cfg.react;
      // Ball suchen, der auf mich zukommt
      let target = court.y + court.h / 2;
      const incoming = balls.filter((b) => b.vx > 0).sort((a, b) => b.x - a.x)[0];
      if (incoming) {
        // Flugbahn mit Bandenabprall vorhersagen
        let x = incoming.x, y = incoming.y, vy = incoming.vy;
        const tt = (p.x - x) / incoming.vx;
        y += vy * tt;
        const top = court.y + incoming.r, bot = court.y + court.h - incoming.r, span = bot - top;
        let m = ((y - top) % (2 * span) + 2 * span) % (2 * span);
        y = m > span ? top + 2 * span - m : top + m;
        target = y + S.rand(-cfg.err, cfg.err);
      }
      p.aiY = target;
    }
    const diff = p.aiY - p.y;
    const step = court.h * 1.5 * cfg.speed * dt;
    movePaddle(p, Math.abs(diff) < 4 ? 0 : Math.sign(diff), dt, null, Math.min(cfg.speed, Math.abs(diff) / (court.h * 1.5 * dt || 1)));
    void step;
  }

  function hitPaddle(b, p, side) {
    const h = p.h * (p.big > 0 ? 1.5 : 1);
    const px = p.x + (side < 0 ? p.w / 2 : -p.w / 2);
    if ((side < 0 && b.vx < 0 && b.x - b.r <= px && b.x > p.x - p.w) || (side > 0 && b.vx > 0 && b.x + b.r >= px && b.x < p.x + p.w)) {
      if (Math.abs(b.y - p.y) <= h / 2 + b.r) {
        const off = S.clamp((b.y - p.y) / (h / 2), -1, 1);
        const sp = Math.min(Math.hypot(b.vx, b.vy) * 1.05, baseSpeed() * 2.3);
        const ang = off * 0.95;
        b.vx = Math.cos(ang) * sp * -side; b.vy = Math.sin(ang) * sp;
        b.spin = S.clamp(p.vy / 900, -1.2, 1.2);
        b.x = px - side * b.r;
        rally++; bestRally = Math.max(bestRally, rally);
        shake = Math.min(0.25, 0.06 + rally * 0.005);
        fx.burst(b.x, b.y, side < 0 ? P.pink : P.blue, 10, 160, 0.4, 3);
        snd.tone(side < 0 ? 330 : 392, 0.07, 'square', 0.2, 1 + Math.abs(off) * 0.3);
        if (rally > 0 && rally % 10 === 0) { fl.add(court.x + court.w / 2, court.y + 40, `${rally} Ballwechsel!`, P.ink); snd.chord([523, 659], 0.2, 'triangle', 0.15); }
      }
    }
  }

  function goal(side) {
    const scorer = side < 0 ? R : L;
    scorer.score++;
    goalFlash = { side, t: 0.6 };
    shake = 0.4; rally = 0;
    snd.noise(0.4, 0.3, 600); snd.chord(side < 0 ? [392, 523] : [330, 440], 0.3, 'triangle', 0.2);
    hud.score(`${L.score} : ${R.score}`);
    if (scorer.score >= WIN) {
      state = 'over';
      const won = scorer === L;
      if (mode === 'ai' && won) { const pts = { leicht: 1, mittel: 2, schwer: 3 }[level]; const wins = S.store.get('schlagabtausch:wins', 0) + pts; S.store.set('schlagabtausch:wins', wins); hud.best(wins); }
      const title = mode === 'ai' ? (won ? 'Gewonnen!' : 'Verloren') : (won ? 'Links gewinnt!' : 'Rechts gewinnt!');
      setTimeout(() => showMenu(title, `<b>${L.score} : ${R.score}</b>, längster Ballwechsel: <b>${bestRally}</b>.`), 700);
      return;
    }
    server = side < 0 ? 1 : -1; serveT = 1;
  }

  function spawnItem() {
    const kinds = ['big', 'multi', 'slow'];
    items.push({ kind: S.pick(kinds), x: court.x + court.w / 2 + S.rand(-court.w * 0.15, court.w * 0.15), y: S.rand(court.y + 50, court.y + court.h - 50), t: 0 });
  }

  function update(dt) {
    t += dt;
    if (state === 'play') {
      // Linke Seite: W/S (gegen den Computer auch Pfeile)
      let dl = 0, dr = 0;
      if (keys.has('w') || keys.has('W')) dl -= 1;
      if (keys.has('s') || keys.has('S')) dl += 1;
      if (keys.has('ArrowUp')) { if (mode === 'ai') dl -= 1; else dr -= 1; }
      if (keys.has('ArrowDown')) { if (mode === 'ai') dl += 1; else dr += 1; }
      let tl = null, tr = null;
      const rect = cv.getBoundingClientRect();
      for (const e of touches.values()) {
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        if (x < st.w / 2 || mode === 'ai') tl = y; else tr = y;
      }
      movePaddle(L, S.clamp(dl, -1, 1), dt, tl);
      if (mode === 'ai') aiMove(R, dt); else movePaddle(R, S.clamp(dr, -1, 1), dt, tr);
      L.big = Math.max(0, L.big - dt); R.big = Math.max(0, R.big - dt);

      if (serveT > 0) { serveT -= dt; if (serveT <= 0) { balls.push(newBall(server)); snd.tone(523, 0.08, 'sine', 0.2); } }

      for (const b of balls) {
        const slowK = b.slow > 0 ? 0.55 : 1;
        b.slow = Math.max(0, b.slow - dt);
        b.vy += b.spin * 260 * dt; b.spin *= Math.exp(-1.2 * dt);
        b.x += b.vx * dt * slowK; b.y += b.vy * dt * slowK;
        if (b.y - b.r < court.y) { b.y = court.y + b.r; b.vy = Math.abs(b.vy); snd.tone(220, 0.04, 'sine', 0.12); fx.burst(b.x, b.y, P.ink, 4, 60, 0.25, 2); }
        if (b.y + b.r > court.y + court.h) { b.y = court.y + court.h - b.r; b.vy = -Math.abs(b.vy); snd.tone(220, 0.04, 'sine', 0.12); fx.burst(b.x, b.y, P.ink, 4, 60, 0.25, 2); }
        hitPaddle(b, L, -1); hitPaddle(b, R, 1);
        b.trail.push(b.x, b.y); if (b.trail.length > 24) b.trail.splice(0, 2);
        for (const it of items) {
          if (!it.got && Math.hypot(it.x - b.x, it.y - b.y) < 22 + b.r) {
            it.got = true;
            const owner = b.vx > 0 ? L : R;
            if (it.kind === 'big') { owner.big = 8; fl.add(it.x, it.y - 14, 'Großer Schläger', P.ink); }
            else if (it.kind === 'multi') { const nb = newBall(b.vx > 0 ? 1 : -1); nb.x = b.x; nb.y = b.y; nb.vy = -b.vy || 120; nb.vx = b.vx; balls.push(nb); fl.add(it.x, it.y - 14, 'Zweiter Ball', P.ink); }
            else { for (const bb of balls) bb.slow = 4; fl.add(it.x, it.y - 14, 'Zeitlupe', P.ink); }
            fx.burst(it.x, it.y, P.yellow, 16, 160, 0.6, 3);
            snd.chord([659, 880], 0.18, 'triangle', 0.18);
          }
        }
      }
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        if (b.x < court.x - 30 || b.x > court.x + court.w + 30) {
          const side = b.x < court.x ? -1 : 1;
          balls.splice(i, 1);
          fx.burst(side < 0 ? court.x : court.x + court.w, b.y, side < 0 ? P.blue : P.pink, 24, 240, 0.7, 4);
          if (!balls.length) { items = []; goal(side); }
          if (state !== 'play') break;
        }
      }
      if (extras && state === 'play') { itemT -= dt; if (itemT <= 0 && items.filter((i) => !i.got).length < 2 && balls.length) { itemT = S.rand(7, 12); spawnItem(); } }
      for (const it of items) it.t += dt;
      items = items.filter((i) => !i.got && i.t < 10);
    }
    goalFlash.t = Math.max(0, goalFlash.t - dt);
    shake = Math.max(0, shake - dt);
    if (banner) { banner.t += dt; if (banner.t > 2) banner = null; }
    fx.update(dt); fl.update(dt);
  }

  function drawPaddle(p, col, under) {
    const h = p.h * (p.big > 0 ? 1.5 : 1);
    const r = () => { ctx.beginPath(); ctx.roundRect(p.x - p.w / 2, p.y - h / 2, p.w, h, 6); };
    S.riso(ctx, r, under, col, 3, 3, p);
    ctx.save(); r(); ctx.clip(); ctx.globalAlpha = 0.35; S.tex.halftoneRect(ctx, p.x - p.w / 2, p.y - h / 2, p.w, h, P.ink, (u) => u * 0.8, 4); ctx.restore();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2; r(); ctx.stroke();
  }

  function draw() {
    const w = st.w, h = st.h;
    S.tex.paperBg(ctx, w, h, P);
    ctx.save();
    if (shake > 0) ctx.translate(S.rand(-1, 1) * shake * 10, S.rand(-1, 1) * shake * 10);
    const c = court;
    // Spielfeld
    ctx.fillStyle = P.pink; ctx.globalAlpha = 0.35; ctx.fillRect(c.x + 6, c.y + 6, c.w, c.h); ctx.globalAlpha = 1;
    ctx.fillStyle = P.card; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.globalAlpha = 0.07;
    ctx.drawImage(S.tex.cached('court' + P.ink, Math.ceil(c.w), Math.ceil(c.h), (cc, ww, hh) => S.tex.halftoneRect(cc, 0, 0, ww, hh, P.ink, (u) => Math.abs(u - 0.5) * 1.4, 8)), c.x, c.y);
    ctx.globalAlpha = 1;
    if (goalFlash.t > 0) {
      ctx.globalAlpha = goalFlash.t; ctx.fillStyle = goalFlash.side < 0 ? P.blue : P.pink;
      ctx.fillRect(goalFlash.side < 0 ? c.x : c.x + c.w / 2, c.y, c.w / 2, c.h); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.strokeRect(c.x, c.y, c.w, c.h);
    ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(c.x + c.w / 2, c.y + 8); ctx.lineTo(c.x + c.w / 2, c.y + c.h - 8); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(c.x + c.w / 2, c.y + c.h / 2, Math.min(60, c.h * 0.14), 0, Math.PI * 2); ctx.stroke();

    // Stand in großen Ziffern
    if (L) {
      ctx.font = `400 ${Math.min(120, c.h * 0.28)}px "Young Serif", Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.16; ctx.fillStyle = P.ink;
      ctx.fillText(String(L.score), c.x + c.w * 0.25, c.y + c.h / 2);
      ctx.fillText(String(R.score), c.x + c.w * 0.75, c.y + c.h / 2);
      ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
    }

    for (const it of items) {
      const k = E.outBack(S.clamp(it.t / 0.4, 0, 1)) * (it.t > 9 ? 1 - (it.t - 9) : 1);
      ctx.save(); ctx.translate(it.x, it.y + Math.sin(t * 3) * 3); ctx.scale(k, k); ctx.rotate(Math.sin(t * 2) * 0.2);
      S.riso(ctx, () => { ctx.beginPath(); ctx.roundRect(-16, -16, 32, 32, 8); }, P.ink, P.yellow, 3, 3);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-16, -16, 32, 32, 8); ctx.stroke();
      ctx.fillStyle = P.ink; ctx.strokeStyle = P.ink;
      if (it.kind === 'big') { ctx.fillRect(-3, -10, 6, 20); ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-8, 6); ctx.moveTo(8, -6); ctx.lineTo(8, 6); ctx.stroke(); }
      else if (it.kind === 'multi') { ctx.beginPath(); ctx.arc(-5, 0, 4.5, 0, Math.PI * 2); ctx.arc(6, 0, 4.5, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.moveTo(0, 0); ctx.lineTo(0, -6); ctx.moveTo(0, 0); ctx.lineTo(5, 2); ctx.stroke(); }
      ctx.restore();
    }

    if (L) { drawPaddle(L, P.pink, P.ink); drawPaddle(R, P.blue, P.ink); }

    for (const b of balls) {
      for (let i = 2; i < b.trail.length; i += 2) {
        const k = i / b.trail.length;
        ctx.globalAlpha = k * 0.5; ctx.fillStyle = b.vx > 0 ? P.pink : P.blue;
        const s = b.r * k * 1.3; ctx.fillRect(b.trail[i] - s / 2, b.trail[i + 1] - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      S.riso(ctx, () => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); }, P.ink, b.slow > 0 ? P.green : P.yellow, 2, 2, b);
      ctx.globalAlpha = 0.4; S.tex.halftoneCircle(ctx, b.x, b.y, b.r, P.ink, -2.3, 3); ctx.globalAlpha = 1;
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    }
    if (state === 'play' && serveT > 0 && L) {
      ctx.fillStyle = P.ink; ctx.font = '600 13px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(`Aufschlag ${server < 0 ? '←' : '→'}`, c.x + c.w / 2, c.y + c.h / 2 + Math.min(60, c.h * 0.14) + 24);
    }
    for (const b of balls) S.dbg.circle(ctx, b.x, b.y, b.r);
    if (L) for (const p of [L, R]) { const ph = p.h * (p.big > 0 ? 1.5 : 1); S.dbg.rect(ctx, p.x - p.w / 2, p.y - ph / 2, p.w, ph, '#f0f'); }
    fx.draw(ctx); fl.draw(ctx);
    ctx.restore();
    S.tex.grain(ctx, w, h, P.ink, P.dark ? 0.5 : 1);

    if (L) {
      ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.fillStyle = P.soft; ctx.textAlign = 'left';
      ctx.fillText(mode === 'ai' ? 'Du · W/S oder ↑/↓' : 'Links · W/S', c.x + 8, c.y - 6);
      ctx.textAlign = 'right'; ctx.fillText(mode === 'ai' ? `Computer · ${level}` : 'Rechts · ↑/↓', c.x + c.w - 8, c.y - 6);
      ctx.textAlign = 'left';
    }
    if (banner) {
      const k = banner.t < 0.4 ? E.outBack(banner.t / 0.4) : banner.t > 1.6 ? 1 - (banner.t - 1.6) / 0.4 : 1;
      ctx.save(); ctx.globalAlpha = S.clamp(k, 0, 1); ctx.translate(w / 2, court.y + court.h * 0.22);
      ctx.font = '400 28px "Young Serif", Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = P.ink; ctx.fillText(banner.text, 0, 0);
      ctx.restore();
    }
  }

  function showMenu(title, text) {
    ov.show(title, text + ' Wer zuerst sieben Punkte hat, gewinnt. Der Ball wird mit jedem Treffer schneller, und wer den Schläger beim Treffen bewegt, gibt ihm Drall.', 'Spiel starten', startMatch);
    const box = ov.extra('');
    const render = () => {
      const opt = (group, val, label, cur) => `<button data-g="${group}" data-v="${val}" ${cur === val ? 'aria-pressed="true"' : ''}>${label}</button>`;
      box.innerHTML = `<div class="choice"><span>Modus</span>${opt('mode', 'ai', '1 Spieler', mode)}${opt('mode', 'duo', '2 Spieler', mode)}</div>` +
        (mode === 'ai' ? `<div class="choice"><span>Gegner</span>${opt('level', 'leicht', 'Leicht', level)}${opt('level', 'mittel', 'Mittel', level)}${opt('level', 'schwer', 'Schwer', level)}</div>` : '') +
        `<div class="choice"><span>Extras</span>${opt('extras', 'on', 'An', extras ? 'on' : 'off')}${opt('extras', 'off', 'Aus', extras ? 'on' : 'off')}</div>`;
      box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.g === 'mode') mode = b.dataset.v; else if (b.dataset.g === 'level') level = b.dataset.v; else extras = b.dataset.v === 'on';
        snd.tone(600, 0.05, 'triangle', 0.15); render();
      }));
    };
    render();
  }

  S.dbg.next = () => { if (state === 'play' && L) { balls = []; goal(1); } };
  fitCourt();
  L = paddle(court.x + 22); R = paddle(court.x + court.w - 22);
  hud.best(0);
  showMenu('Schlagabtausch', 'Allein gegen den Computer oder zu zweit an einer Tastatur: links <kbd>W</kbd>/<kbd>S</kbd>, rechts <kbd>↑</kbd>/<kbd>↓</kbd>. Am Handy steuert jede Bildschirmhälfte ihren Schläger.');

  S.loop((dt) => { update(dt); draw(); });
})();
