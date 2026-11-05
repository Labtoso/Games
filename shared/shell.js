/* Shared helpers for every game. Rules: STYLEGUIDE.md */
(function () {
  const S = {};

  S.css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  S.palette = () => {
    const p = {
      paper: S.css('--paper'), paper2: S.css('--paper-2'), ink: S.css('--ink'), soft: S.css('--ink-soft'),
      line: S.css('--line'), pink: S.css('--pink'), blue: S.css('--blue'), yellow: S.css('--yellow'),
      green: S.css('--green'), orange: S.css('--orange'), card: S.css('--card'),
      dark: true, // the whole arcade is printed on black paper
    };
    S.wearColor = p.paper;
    return p;
  };
  S.wearColor = '#131116';
  S.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Art foundation: one palette family, one light direction, three line weights */
  S.art = {
    pal: {
      paper: '#f1eadb', paper2: '#e5dcc8', paperShade: '#cfc3aa', ink: '#221f2b', inkSoft: '#5f5967',
      night: '#121019', night2: '#1d1a26', nightLine: '#3a3546',
      pink: '#f2457f', pinkDeep: '#b8285a', blue: '#2a5fc4', blueDeep: '#1b3e86',
      yellow: '#f6bf31', yellowDeep: '#c48c12', green: '#139a63', greenDeep: '#0c6a44', orange: '#f2702f', light: '#fff8ea',
    },
    light: { x: -0.7071, y: -0.7071 },
    lw: { outline: 2.5, detail: 1.5, fine: 0.75 },
    shadow(ctx, on = true) {
      if (!on) { ctx.shadowColor = 'transparent'; return; }
      ctx.shadowColor = 'rgba(20,16,30,0.28)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
    },
  };

  /* Short freeze on big hits; the loop keeps drawing with dt = 0 */
  let hold = 0;
  S.hitstop = (ms = 50) => { hold = Math.max(hold, ms / 1000); };
  S.shakeScale = S.reduced ? 0 : 1;
  S.setWear = (c) => { S.wearColor = c; };

  S.rand = (a, b) => a + Math.random() * (b - a);
  S.randInt = (a, b) => Math.floor(S.rand(a, b + 1));
  S.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  S.lerp = (a, b, t) => a + (b - a) * t;
  S.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  S.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  /* Canvas fills its container, sharp on high-density screens */
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

  /* Game loop with a capped time step */
  S.loop = function (step) {
    let last = performance.now(), frames = 0, acc = 0;
    function frame(t) {
      const raw = Math.max(0, (t - last) / 1000);
      let dt = Math.min(0.04, raw);
      last = t;
      if (hold > 0) { hold -= raw; dt = 0; }
      if (S.debug.on) {
        dt *= S.debug.speed || 1;
        frames++; acc += raw;
        if (acc > 0.5) { if (S.debug.el && S.debug.fps) S.debug.el.textContent = Math.round(frames / acc); frames = 0; acc = 0; }
      }
      step(dt, t / 1000);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /* Storage. In debug sessions every game key is written to a separate "debug:" space,
     so normal saves and highscores stay untouched. Settings (mute, debug) are shared. */
  const raw = {
    get(k, d) { try { const v = localStorage.getItem('labtoso-games:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('labtoso-games:' + k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
  };
  const shared = (k) => k === 'muted' || k === 'debug';
  S.store = {
    get(k, d) {
      if (S.debug && S.debug.on && !shared(k)) { const v = raw.get('debug:' + k, undefined); if (v !== undefined) return v; }
      return raw.get(k, d);
    },
    set(k, v) { raw.set(S.debug && S.debug.on && !shared(k) ? 'debug:' + k : k, v); },
    raw,
  };

  /* Debug mode: set up on /debug, or pass ?debug=1&level=3&diff=hard&god=1&fps=1&hitbox=1&money=500 */
  S.debug = (function () {
    const q = new URLSearchParams(location.search);
    let d = raw.get('debug', null);
    if (q.get('debug') === '0') { d = null; raw.set('debug', null); }
    else if (q.has('debug')) { d = Object.assign({}, d || {}, { on: true }); raw.set('debug', d); }
    const base = { on: false, god: false, fps: true, hitbox: false, speed: 1, textures: true, start: 1, diff: '', money: 0, solution: false };
    const out = Object.assign(base, d || {});
    if (out.on) {
      const num = (k) => (q.has(k) ? Number(q.get(k)) : null);
      const bool = (k) => (q.has(k) ? q.get(k) !== '0' && q.get(k) !== 'false' : null);
      if (num('level') != null) out.start = Math.max(1, num('level') | 0);
      if (num('money') != null) out.money = Math.max(0, num('money') | 0);
      if (num('speed') != null) out.speed = S.clamp(num('speed'), 0.1, 4);
      ['god', 'fps', 'hitbox', 'textures', 'solution'].forEach((k) => { if (bool(k) != null) out[k] = bool(k); });
      if (q.has('diff')) out.diff = q.get('diff');
      out.params = q;
    }
    return out;
  })();
  S.dbg = {
    next: null,
    circle(ctx, x, y, r, c = '#00e5ff') { if (!S.debug.on || !S.debug.hitbox) return; ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); },
    rect(ctx, x, y, w, h, c = '#00e5ff') { if (!S.debug.on || !S.debug.hitbox) return; ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); ctx.restore(); },
  };
  if (S.debug.on) {
    const mount = () => {
      const el = document.createElement('div');
      el.className = 'debug-hud';
      el.innerHTML = '<b>DEBUG</b> <span data-fps>–</span> fps · <kbd>N</kbd> skip · <a href="../../debug/">Settings</a>';
      document.body.appendChild(el);
      S.debug.el = el.querySelector('[data-fps]');
    };
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount); else mount();
    addEventListener('keydown', (e) => { if ((e.key === 'n' || e.key === 'N') && S.dbg.next) S.dbg.next(); });
  }

  /* Highscores are kept per difficulty: <slug>:best:<diff>.
     The old single key <slug>:best is read as the Normal score and never removed. */
  S.bestKey = (slug, diff) => slug + ':best:' + diff;
  S.readBest = (slug, diff) => {
    const v = S.store.get(S.bestKey(slug, diff), null);
    if (v != null) return v;
    return diff === 'normal' ? S.store.get(slug + ':best', 0) : 0;
  };
  S.hud = function (slug) {
    const sc = document.querySelector('[data-score]');
    const be = document.querySelector('[data-best]');
    const diff = () => S.currentDiff(slug);
    let best = S.readBest(slug, diff());
    const paint = () => { if (be) be.textContent = best; };
    paint();
    const h = {
      score(n) { if (sc) sc.textContent = n; },
      best(n) {
        if (n > best) { best = n; S.store.set(S.bestKey(slug, diff()), n); paint(); return true; }
        return false;
      },
      refresh() { best = S.readBest(slug, diff()); paint(); },
      get bestValue() { return best; },
    };
    (S._huds[slug] = S._huds[slug] || []).push(h);
    return h;
  };
  S._huds = {};

  S.overlay = function () {
    const el = document.querySelector('.overlay');
    const h = el.querySelector('h2'), p = el.querySelector('p'), b = el.querySelector('button');
    let cb = null;
    b.addEventListener('click', () => { el.hidden = true; const f = cb; cb = null; if (f) f(); });
    return {
      show(title, html, label, fn) {
        el.querySelectorAll('.extra').forEach((x) => x.remove()); h.textContent = title; p.innerHTML = html; b.textContent = label; cb = fn; el.hidden = false;
        setTimeout(() => b.focus({ preventScroll: true }), 40);
      },
      extra(html) { const d = document.createElement('div'); d.className = 'extra'; d.innerHTML = html; p.after(d); return d; },
      hide() { el.hidden = true; },
      get open() { return !el.hidden; },
    };
  };

  /* Pointer (mouse and touch) relative to the canvas */
  S.pointer = function (canvas) {
    const p = { x: -9999, y: -9999, down: false, inside: false, type: 'mouse', onDown: null, onUp: null };
    function pos(e) { const r = canvas.getBoundingClientRect(); p.x = e.clientX - r.left; p.y = e.clientY - r.top; p.type = e.pointerType; }
    canvas.addEventListener('pointerdown', (e) => {
      pos(e); p.down = true; p.inside = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* not supported */ }
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

  /* Keys that are currently held */
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

  /* Misregistration: shape printed twice with an offset, main colour with uneven ink */
  S.riso = function (ctx, draw, under, over, dx = 2.5, dy = 2, anchor) {
    ctx.save(); ctx.translate(dx, dy); ctx.fillStyle = under; draw(); ctx.fill(); ctx.restore();
    ctx.fillStyle = over; draw(); ctx.fill();
    if (S.tex) S.tex.wear(ctx, draw, S.wearColor, 1, anchor);
  };

  /* Particles from a fixed pool: no allocation while playing, capped count,
     and a lot fewer of them with prefers-reduced-motion. */
  S.particles = function (cap = 420) {
    const pool = [], list = [];
    for (let i = 0; i < cap; i++) pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '', size: 1 });
    const scale = S.reduced ? 0.25 : 1;
    return {
      list,
      burst(x, y, color, n = 14, speed = 160, life = 0.7, size = 3) {
        n = Math.max(1, Math.round(n * scale));
        for (let i = 0; i < n && pool.length; i++) {
          const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.65);
          const q = pool.pop();
          q.x = x; q.y = y; q.vx = Math.cos(a) * v; q.vy = Math.sin(a) * v; q.life = life; q.max = life; q.color = color; q.size = size * (0.6 + Math.random() * 0.8);
          list.push(q);
        }
      },
      update(dt, gravity = 0) {
        const k = Math.exp(-2.5 * dt);
        for (let i = list.length - 1; i >= 0; i--) {
          const q = list[i]; q.life -= dt;
          if (q.life <= 0) { list[i] = list[list.length - 1]; list.pop(); pool.push(q); continue; }
          q.vx *= k; q.vy = q.vy * k + gravity * dt;
          q.x += q.vx * dt; q.y += q.vy * dt;
        }
      },
      draw(ctx) {
        for (let i = 0; i < list.length; i++) {
          const q = list[i], t = Math.max(0, q.life / q.max), sz = q.size * (0.4 + 0.6 * t);
          ctx.globalAlpha = t;
          ctx.fillStyle = q.color;
          ctx.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;
      },
      spark(x, y, vx, vy, life, color, size) {
        if (!pool.length || (S.reduced && Math.random() < 0.75)) return;
        const q = pool.pop();
        q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.life = life; q.max = life; q.color = color; q.size = size;
        list.push(q);
      },
      clear() { while (list.length) pool.push(list.pop()); },
    };
  };

  /* Floating score text (+1 and so on) */
  S.floaters = function () {
    const list = [];
    return {
      add(x, y, text, color) { list.push({ x, y, text, color, t: 0 }); },
      update(dt) { for (let i = list.length - 1; i >= 0; i--) { list[i].t += dt; if (list[i].t > 0.9) list.splice(i, 1); } },
      draw(ctx) {
        ctx.save();
        ctx.font = '600 15px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace';
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

  S.ease = {
    inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outElastic: (x) => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  };

  /* Small sounds, synthesised live */
  S.sound = (function () {
    let ac = null, master = null;
    let muted = S.store.get('muted', false);
    let gesture = false;
    const mark = () => { gesture = true; };
    addEventListener('pointerdown', mark, { capture: true, passive: true });
    addEventListener('keydown', mark, { capture: true });
    function ensure() {
      if (!gesture) return null;
      if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = 0.32; master.connect(ac.destination);
      return ac;
    }
    addEventListener('pointerdown', ensure, { once: false, passive: true });
    addEventListener('keydown', ensure);
    function tone(f, d = 0.12, type = 'sine', v = 0.5, slide = 0, delay = 0, pan = 0) {
      if (muted || !ensure()) return;
      const t0 = ac.currentTime + delay;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + d);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g);
      if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = S.clamp(pan, -1, 1); g.connect(p); p.connect(master); } else g.connect(master);
      o.start(t0); o.stop(t0 + d + 0.02);
    }
    function noise(d = 0.2, v = 0.3, freq = 1200, delay = 0, pan = 0) {
      if (muted || !ensure()) return;
      const t0 = ac.currentTime + delay;
      const len = Math.floor(ac.sampleRate * d), buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf; flt.type = 'bandpass'; flt.frequency.value = freq; g.gain.value = v;
      src.connect(flt); flt.connect(g);
      if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = S.clamp(pan, -1, 1); g.connect(p); p.connect(master); } else g.connect(master);
      src.start(t0);
    }
    const api = {
      tone, noise,
      chord(fs, d = 0.3, type = 'triangle', v = 0.25, step = 0.06) { fs.forEach((f, i) => tone(f, d, type, v, 0, i * step)); },
      get muted() { return muted; },
      toggle() { muted = !muted; S.store.set('muted', muted); return muted; },
    };
    function bindButton() {
      const b = document.querySelector('[data-mute]');
      if (!b) return;
      const paint = () => { b.textContent = muted ? 'Sound off' : 'Sound on'; b.setAttribute('aria-pressed', String(!muted)); };
      paint();
      b.addEventListener('click', () => { api.toggle(); paint(); b.blur(); });
    }
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', bindButton); else bindButton();
    return api;
  })();

  /* ---------- Textures, all generated in code (see STYLEGUIDE.md) ---------- */
  S.tex = (function () {
    const cache = new Map();
    function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

    // Paper grain: specks and short fibres
    function paperTile(ink) {
      const key = 'paper' + ink;
      if (cache.has(key)) return cache.get(key);
      const c = canvas(256, 256), x = c.getContext('2d'), r = rng(7);
      const img = x.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = r();
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v > 0.5 ? 255 : 0;
        img.data[i + 3] = Math.floor(Math.pow(Math.abs(v - 0.5) * 2, 3) * 34);
      }
      x.putImageData(img, 0, 0);
      x.strokeStyle = ink; x.lineWidth = 0.6;
      for (let i = 0; i < 70; i++) {
        x.globalAlpha = 0.05 + r() * 0.07;
        const px = r() * 256, py = r() * 256, a = r() * Math.PI, l = 3 + r() * 9;
        x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + r() * 2, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
      }
      cache.set(key, c);
      return c;
    }

    function pattern(ctx, tile) {
      const key = tile;
      if (!tile._pat || tile._ctx !== ctx) { tile._pat = ctx.createPattern(tile, 'repeat'); tile._ctx = ctx; }
      return tile._pat;
    }

    // Lay grain over the whole frame (last step of a frame)
    function grain(ctx, w, h, ink, alpha = 1, ox = 0, oy = 0) {
      if (S.debug && S.debug.on && !S.debug.textures) return;
      const tile = paperTile(ink || '#23202c');
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(-((ox % 256) + 256) % 256, -((oy % 256) + 256) % 256);
      ctx.fillStyle = pattern(ctx, tile); ctx.fillRect(0, 0, w + 256, h + 256); ctx.restore();
    }

    // Halftone dots inside a shape, denser on the shadow side
    function halftoneCircle(ctx, x, y, r, color, light = -2.3, spacing = 4.2, strength = 1) {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = color;
      const lx = Math.cos(light), ly = Math.sin(light);
      const s = Math.max(3, spacing);
      ctx.beginPath();
      for (let gy = -r; gy <= r; gy += s) {
        const row = Math.round(gy / s) % 2 ? s / 2 : 0;
        for (let gx = -r - row; gx <= r; gx += s) {
          const d = Math.hypot(gx, gy) / r; if (d > 1.05) continue;
          const shade = S.clamp(((-(gx * lx + gy * ly) / r) * 0.6 + 0.35 + d * 0.35) * strength, 0, 1);
          const rr = shade * s * 0.55;
          if (rr < 0.35) continue;
          ctx.moveTo(x + gx + rr, y + gy); ctx.arc(x + gx, y + gy, rr, 0, Math.PI * 2);
        }
      }
      ctx.fill(); ctx.restore();
    }

    // Halftone dots in a rectangle, density 0..1 (or a function)
    function halftoneRect(ctx, x, y, w, h, color, density, spacing = 5) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = color; ctx.beginPath();
      for (let gy = 0; gy <= h + spacing; gy += spacing) {
        const row = Math.round(gy / spacing) % 2 ? spacing / 2 : 0;
        for (let gx = -row; gx <= w + spacing; gx += spacing) {
          const dd = typeof density === 'function' ? density(gx / w, gy / h) : density;
          const rr = S.clamp(dd, 0, 1) * spacing * 0.6;
          if (rr < 0.3) continue;
          ctx.moveTo(x + gx + rr, y + gy); ctx.arc(x + gx, y + gy, rr, 0, Math.PI * 2);
        }
      }
      ctx.fill(); ctx.restore();
    }

    // Hatching
    function hatch(ctx, x, y, w, h, color, gap = 8, angle = -Math.PI / 4, width = 1.4) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.translate(x + w / 2, y + h / 2); ctx.rotate(angle);
      const L = Math.hypot(w, h);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      for (let k = -L; k < L; k += gap) { ctx.moveTo(k, -L); ctx.lineTo(k, L); }
      ctx.stroke(); ctx.restore();
    }

    // Value noise for nebulae and cave rock
    function noiseField(w, h, scale, seed, octaves = 4) {
      const r = rng(seed), G = 64, grid = new Float32Array(G * G);
      for (let i = 0; i < grid.length; i++) grid[i] = r();
      const smooth = (t) => t * t * (3 - 2 * t);
      const val = (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
        const g = (a, b) => grid[((b & (G - 1)) * G) + (a & (G - 1))];
        const top = g(xi, yi) * (1 - xf) + g(xi + 1, yi) * xf, bot = g(xi, yi + 1) * (1 - xf) + g(xi + 1, yi + 1) * xf;
        return top * (1 - yf) + bot * yf;
      };
      const out = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = 0, amp = 1, f = 1 / scale, tot = 0;
        for (let o = 0; o < octaves; o++) { v += val(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
        out[y * w + x] = v / tot;
      }
      return out;
    }

    // Nebula: coloured clouds as halftone dots on a dark ground
    function nebula(w, h, colors, seed = 3) {
      const key = `neb${w}x${h}${colors.join()}${seed}`;
      if (cache.has(key)) return cache.get(key);
      const c = canvas(w, h), x = c.getContext('2d');
      const step = 5, nw = Math.ceil(w / step), nh = Math.ceil(h / step);
      colors.forEach((col, ci) => {
        const f = noiseField(nw, nh, 26 + ci * 9, seed + ci * 31);
        x.fillStyle = col; x.beginPath();
        for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
          const v = S.clamp((f[j * nw + i] - 0.52) * 3.2, 0, 1);
          const rr = v * step * 0.62;
          if (rr < 0.35) continue;
          const px = i * step + (j % 2 ? step / 2 : 0), py = j * step;
          x.moveTo(px + rr, py); x.arc(px, py, rr, 0, Math.PI * 2);
        }
        x.globalAlpha = 0.55; x.fill(); x.globalAlpha = 1;
      });
      cache.set(key, c);
      return c;
    }

    // Paint once, then reuse as an image
    function cached(key, w, h, paint) {
      const k = `c:${key}:${w}x${h}`;
      if (cache.has(k)) return cache.get(k);
      const c = canvas(Math.max(1, w), Math.max(1, h)); paint(c.getContext('2d'), w, h);
      cache.set(k, c); return c;
    }

    // Wear: small gaps in the ink like a real print
    function wearTile(color) {
      const key = 'wear' + color;
      if (cache.has(key)) return cache.get(key);
      const c = canvas(192, 192), x = c.getContext('2d'), r = rng(23);
      x.fillStyle = color;
      // fine pores
      for (let i = 0; i < 420; i++) { x.globalAlpha = 0.25 + r() * 0.5; const s = 0.6 + r() * 1.4; x.fillRect(r() * 192, r() * 192, s, s); }
      // a few larger gaps
      for (let i = 0; i < 14; i++) {
        x.globalAlpha = 0.18 + r() * 0.3; x.beginPath();
        const cx = r() * 192, cy = r() * 192, rr = 2 + r() * 5;
        for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, q = rr * (0.6 + r() * 0.6); x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
        x.closePath(); x.fill();
      }
      // scratches
      x.strokeStyle = color; x.lineWidth = 0.7;
      for (let i = 0; i < 10; i++) { x.globalAlpha = 0.2 + r() * 0.3; const px = r() * 192, py = r() * 192, a = r() * Math.PI, l = 6 + r() * 16; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
      cache.set(key, c);
      return c;
    }
    function wear(ctx, draw, color, alpha = 1, anchor) {
      if (S.debug && S.debug.on && !S.debug.textures) return;
      const tile = wearTile(color);
      if (!tile._pats) tile._pats = new WeakMap();
      let pat = tile._pats.get(ctx); if (!pat) { pat = ctx.createPattern(tile, 'repeat'); tile._pats.set(ctx, pat); }
      ctx.save(); draw(); ctx.clip();
      const ax = anchor ? anchor.x : 0, ay = anchor ? anchor.y : 0;
      ctx.translate(ax, ay); ctx.globalAlpha *= alpha; ctx.fillStyle = pat;
      ctx.fillRect(-2000, -2000, 4000, 4000);
      ctx.restore();
    }

    // Paper ground with clouds, fibres and darker edges
    function paperBg(ctx, w, h, P) {
      if (S.debug && S.debug.on && !S.debug.textures) { ctx.fillStyle = P.paper; ctx.fillRect(0, 0, w, h); return; }
      const img = cached('paperbg' + P.paper + P.ink, Math.ceil(w), Math.ceil(h), (x, W, H) => {
        x.fillStyle = P.paper; x.fillRect(0, 0, W, H);
        const sw = Math.ceil(W / 8), sh = Math.ceil(H / 8);
        const nf = noiseField(sw, sh, 9, 5, 4);
        const small = canvas(sw, sh), sx = small.getContext('2d'), id = sx.createImageData(sw, sh);
        const ink = P.dark ? 255 : 40;
        const rim = Math.min(sw, sh) * 0.28;
        for (let i = 0; i < sw * sh; i++) {
          // cloudy fibres plus mottled, darker paper towards the edges (noise, not a gradient)
          const v = nf[i], px = i % sw, py = (i / sw) | 0;
          const e = Math.max(0, 1 - Math.min(px, py, sw - 1 - px, sh - 1 - py) / rim);
          id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = ink;
          id.data[i * 4 + 3] = Math.max(0, (v - 0.45)) * (P.dark ? 40 : 70) + e * e * (0.35 + v * 0.65) * (P.dark ? 60 : 34);
        }
        sx.putImageData(id, 0, 0);
        x.imageSmoothingEnabled = true; x.drawImage(small, 0, 0, W, H);
        const r = rng(91); x.strokeStyle = P.ink; x.lineWidth = 0.6;
        for (let i = 0; i < (W * H) / 2500; i++) {
          x.globalAlpha = 0.04 + r() * 0.06;
          const px = r() * W, py = r() * H, a = r() * Math.PI, l = 4 + r() * 14;
          x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + 2, py + Math.sin(a) * l * 0.5 - 2, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
        }
        x.globalAlpha = 1;
      });
      ctx.drawImage(img, 0, 0, w, h);
    }

    // slightly restless lines, as if drawn by hand
    function wobblyRect(ctx, x, y, w, h, amp = 1.2, seed = 1) {
      const r = rng(Math.floor(seed * 9973) + 1), pts = [];
      const step = 14;
      const edge = (x1, y1, x2, y2) => { const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.ceil(L / step)); for (let i = 0; i < n; i++) { const k = i / n; pts.push([x1 + (x2 - x1) * k + (r() - 0.5) * amp, y1 + (y2 - y1) * k + (r() - 0.5) * amp]); } };
      edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    }
    function wobblyCircle(ctx, x, y, rad, amp = 1, seed = 1) {
      const r = rng(Math.floor(seed * 7919) + 1), n = Math.max(16, Math.floor(rad / 2));
      ctx.beginPath();
      for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, q = rad + (i === n ? 0 : (r() - 0.5) * amp * 2); if (i === n) { ctx.closePath(); break; } ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    }

    return { cached, wear, wearTile, paperBg, wobblyRect, wobblyCircle, paperTile, grain, halftoneCircle, halftoneRect, hatch, noiseField, nebula, canvas, rng };
  })();

  /* Difficulty, remembered per game under <slug>:diff. Older German keys are migrated on read. */
  const OLD = { leicht: 'easy', schwer: 'hard' };
  S.currentDiff = (slug) => {
    if (S.debug.on && S.debug.diff) return S.debug.diff;
    const v = S.store.get(slug + ':diff', 'normal');
    return OLD[v] || v;
  };
  S.difficulty = function (slug, labels = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }) {
    let lv = S.currentDiff(slug);
    if (!(lv in labels)) lv = 'normal' in labels ? 'normal' : Object.keys(labels)[0];
    const set = (v) => {
      lv = v; S.store.set(slug + ':diff', lv);
      if (S.debug.on) S.debug.diff = '';
      (S._huds[slug] || []).forEach((h) => h.refresh());
    };
    return {
      get value() { return lv; },
      get label() { return labels[lv]; },
      pick(map) { return map[lv]; },
      set,
      mount(ov) {
        const box = ov.extra('');
        const render = () => {
          box.innerHTML = `<div class="choice" role="group" aria-label="Difficulty">${Object.keys(labels).map((k) => `<button data-d="${k}" aria-pressed="${k === lv}">${labels[k]}</button>`).join('')}</div>`;
          box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { set(b.dataset.d); S.sound.tone(600, 0.05, 'triangle', 0.15); render(); }));
        };
        render();
        return box;
      },
    };
  };

  window.Shell = S;
})();
