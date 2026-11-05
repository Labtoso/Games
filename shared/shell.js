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
        el.querySelectorAll('.extra').forEach((x) => x.remove()); h.textContent = title; p.innerHTML = html; b.textContent = label; cb = fn; el.hidden = false;
        setTimeout(() => b.focus({ preventScroll: true }), 40);
      },
      extra(html) { const d = document.createElement('div'); d.className = 'extra'; d.innerHTML = html; p.after(d); return d; },
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

  S.ease = {
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outElastic: (x) => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  };

  /* Kleine Klänge, live erzeugt */
  S.sound = (function () {
    let ac = null, master = null;
    let muted = S.store.get('muted', false);
    function ensure() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = 0.32; master.connect(ac.destination);
      return ac;
    }
    addEventListener('pointerdown', ensure, { once: false, passive: true });
    addEventListener('keydown', ensure);
    function tone(f, d = 0.12, type = 'sine', v = 0.5, slide = 0, delay = 0) {
      if (muted || !ensure()) return;
      const t0 = ac.currentTime + delay;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + d);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + d + 0.02);
    }
    function noise(d = 0.2, v = 0.3, freq = 1200, delay = 0) {
      if (muted || !ensure()) return;
      const t0 = ac.currentTime + delay;
      const len = Math.floor(ac.sampleRate * d), buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf; flt.type = 'bandpass'; flt.frequency.value = freq; g.gain.value = v;
      src.connect(flt); flt.connect(g); g.connect(master); src.start(t0);
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
      const paint = () => { b.textContent = muted ? 'Ton aus' : 'Ton an'; b.setAttribute('aria-pressed', String(!muted)); };
      paint();
      b.addEventListener('click', () => { api.toggle(); paint(); b.blur(); });
    }
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', bindButton); else bindButton();
    return api;
  })();

  /* ---------- Texturen, alle im Code erzeugt (siehe STYLEGUIDE.md) ---------- */
  S.tex = (function () {
    const cache = new Map();
    function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

    // Papierkorn: Flecken und kurze Fasern
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

    // Korn über die ganze Fläche legen (am Ende eines Frames)
    function grain(ctx, w, h, ink, alpha = 1, ox = 0, oy = 0) {
      const tile = paperTile(ink || '#23202c');
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(-((ox % 256) + 256) % 256, -((oy % 256) + 256) % 256);
      ctx.fillStyle = pattern(ctx, tile); ctx.fillRect(0, 0, w + 256, h + 256); ctx.restore();
    }

    // Rasterpunkte innerhalb einer Form, dichter auf der Schattenseite
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

    // Rasterpunkte in einem Rechteck, Dichte 0..1 (oder Funktion)
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

    // Schraffur
    function hatch(ctx, x, y, w, h, color, gap = 8, angle = -Math.PI / 4, width = 1.4) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.translate(x + w / 2, y + h / 2); ctx.rotate(angle);
      const L = Math.hypot(w, h);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      for (let k = -L; k < L; k += gap) { ctx.moveTo(k, -L); ctx.lineTo(k, L); }
      ctx.stroke(); ctx.restore();
    }

    // Wertrauschen für Nebel und Höhlengestein
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

    // Nebelbild: farbige Wolken als Rasterpunkte auf dunklem Grund
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

    // Einmal zeichnen, danach als Bild wiederverwenden
    function cached(key, w, h, paint) {
      const k = `c:${key}:${w}x${h}`;
      if (cache.has(k)) return cache.get(k);
      const c = canvas(Math.max(1, w), Math.max(1, h)); paint(c.getContext('2d'), w, h);
      cache.set(k, c); return c;
    }

    return { cached, paperTile, grain, halftoneCircle, halftoneRect, hatch, noiseField, nebula, canvas, rng };
  })();

  window.Shell = S;
})();
