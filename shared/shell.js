/* Kleine Helfer, die alle Spiele teilen */
(function () {
  const S = {};

  S.css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  S.palette = () => ({
    paper: S.css('--paper'), paper2: S.css('--paper-2'), ink: S.css('--ink'), soft: S.css('--ink-soft'),
    line: S.css('--line'), pink: S.css('--pink'), blue: S.css('--blue'), yellow: S.css('--yellow'),
    green: S.css('--green'), orange: S.css('--orange'), card: S.css('--card'),
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
  });

  S.rand = (a, b) => a + Math.random() * (b - a);
  S.randInt = (a, b) => Math.floor(S.rand(a, b + 1));
  S.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  S.lerp = (a, b, t) => a + (b - a) * t;
  S.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  S.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  /* Canvas passt sich dem Container an, scharf auf Retina */
  S.stage = function (canvas, onResize) {
    const ctx = canvas.getContext('2d');
    const st = { ctx, w: 1, h: 1, dpr: 1 };
    function fit(silent) {
      const r = canvas.parentElement.getBoundingClientRect();
      st.dpr = Math.min(window.devicePixelRatio || 1, 2);
      st.w = Math.max(1, Math.floor(r.width));
      st.h = Math.max(1, Math.floor(r.height));
      canvas.width = Math.floor(st.w * st.dpr);
      canvas.height = Math.floor(st.h * st.dpr);
      canvas.style.width = st.w + 'px';
      canvas.style.height = st.h + 'px';
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      if (onResize && silent !== true) onResize(st.w, st.h);
    }
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(canvas.parentElement);
    else addEventListener('resize', fit);
    fit(true);
    return st;
  };

  /* Spielschleife mit begrenztem Zeitschritt */
  S.loop = function (step) {
    let last = performance.now();
    function frame(t) {
      const dt = Math.min(0.04, Math.max(0, (t - last) / 1000));
      last = t;
      step(dt, t / 1000);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  S.store = {
    get(k, d) { try { const v = localStorage.getItem('labtoso-games:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('labtoso-games:' + k, JSON.stringify(v)); } catch (e) { /* egal */ } },
  };

  S.hud = function (slug) {
    const sc = document.querySelector('[data-score]');
    const be = document.querySelector('[data-best]');
    let best = S.store.get(slug + ':best', 0);
    if (be) be.textContent = best;
    return {
      score(n) { if (sc) sc.textContent = n; },
      best(n) {
        if (n > best) { best = n; S.store.set(slug + ':best', n); if (be) be.textContent = n; return true; }
        return false;
      },
      get bestValue() { return best; },
    };
  };

  S.overlay = function () {
    const el = document.querySelector('.overlay');
    const h = el.querySelector('h2'), p = el.querySelector('p'), b = el.querySelector('button');
    let cb = null;
    b.addEventListener('click', () => { el.hidden = true; const f = cb; cb = null; if (f) f(); });
    return {
      show(title, html, label, fn) {
        h.textContent = title; p.innerHTML = html; b.textContent = label; cb = fn; el.hidden = false;
        setTimeout(() => b.focus({ preventScroll: true }), 40);
      },
      hide() { el.hidden = true; },
      get open() { return !el.hidden; },
    };
  };

  /* Zeiger (Maus und Touch) relativ zum Canvas */
  S.pointer = function (canvas) {
    const p = { x: -9999, y: -9999, down: false, inside: false, type: 'mouse', onDown: null, onUp: null };
    function pos(e) { const r = canvas.getBoundingClientRect(); p.x = e.clientX - r.left; p.y = e.clientY - r.top; p.type = e.pointerType; }
    canvas.addEventListener('pointerdown', (e) => {
      pos(e); p.down = true; p.inside = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* egal */ }
      if (p.onDown) p.onDown(p.x, p.y, e);
    });
    canvas.addEventListener('pointermove', (e) => { pos(e); p.inside = true; });
    const up = (e) => { if (!p.down) return; pos(e); p.down = false; if (e.pointerType !== 'mouse') p.inside = false; if (p.onUp) p.onUp(p.x, p.y, e); };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') p.inside = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    return p;
  };

  /* Tasten, die gerade gedrückt sind */
  S.keys = function (onPress) {
    const down = new Set();
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|BUTTON/.test(e.target.tagName) && (e.key === ' ' || e.key === 'Enter')) return;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      if (!down.has(e.key) && onPress) onPress(e.key, e);
      down.add(e.key);
    });
    addEventListener('keyup', (e) => down.delete(e.key));
    addEventListener('blur', () => down.clear());
    return down;
  };

  /* Druckfehler-Optik: Form zweimal leicht versetzt */
  S.riso = function (ctx, draw, under, over, dx = 2.5, dy = 2) {
    ctx.save(); ctx.translate(dx, dy); ctx.fillStyle = under; draw(); ctx.fill(); ctx.restore();
    ctx.fillStyle = over; draw(); ctx.fill();
  };

  /* Kleine Partikel */
  S.particles = function () {
    const list = [];
    return {
      list,
      burst(x, y, color, n = 14, speed = 160, life = 0.7, size = 3) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.65);
          list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: size * (0.6 + Math.random() * 0.8) });
        }
      },
      update(dt, gravity = 0) {
        for (let i = list.length - 1; i >= 0; i--) {
          const q = list[i]; q.life -= dt;
          if (q.life <= 0) { list.splice(i, 1); continue; }
          q.vx *= Math.exp(-2.5 * dt); q.vy = q.vy * Math.exp(-2.5 * dt) + gravity * dt;
          q.x += q.vx * dt; q.y += q.vy * dt;
        }
      },
      draw(ctx) {
        for (const q of list) {
          ctx.globalAlpha = Math.max(0, q.life / q.max);
          ctx.fillStyle = q.color;
          ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
        }
        ctx.globalAlpha = 1;
      },
      clear() { list.length = 0; },
    };
  };

  /* Schwebende Texte (+1 usw.) */
  S.floaters = function () {
    const list = [];
    return {
      add(x, y, text, color) { list.push({ x, y, text, color, t: 0 }); },
      update(dt) { for (let i = list.length - 1; i >= 0; i--) { list[i].t += dt; if (list[i].t > 0.9) list.splice(i, 1); } },
      draw(ctx) {
        ctx.save();
        ctx.font = '600 15px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        for (const f of list) {
          ctx.globalAlpha = 1 - f.t / 0.9;
          ctx.fillStyle = f.color;
          ctx.fillText(f.text, f.x, f.y - f.t * 38);
        }
        ctx.restore();
      },
      clear() { list.length = 0; },
    };
  };

  window.Shell = S;
})();
