/* Imported from NEXORA-Arcade (1).html; scripts retain their original order.
   Keep legacy browser saves, and isolate Nexora from the existing Casino. */
(function migrateNexoraSaves() {
  try {
    Object.keys(localStorage).forEach(function (key) {
      var next = key.indexOf('pixelkiste_') === 0
        ? 'labtoso-games:nexora:' + key.slice('pixelkiste_'.length)
        : key === 'nexora_favs' ? 'labtoso-games:nexora:favs' : null;
      if (next && localStorage.getItem(next) === null) {
        localStorage.setItem(next, localStorage.getItem(key));
      }
    });
  } catch (e) { /* Games also work when browser storage is unavailable. */ }
})();


(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  /* ---------- Speicher für Rekorde ---------- */
  function load(k, d) { try { var v = localStorage.getItem('labtoso-games:nexora:' + k); var n = parseFloat(v); return Number.isFinite(n) ? n : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('labtoso-games:nexora:' + k, String(v)); } catch (e) {} }
  function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  var best = {
    snake: load('snake', 0),
    memory: load('memory', 0),
    reaktion: load('reaktion', 0),
    klick: load('klick', 0),
    merge: load('merge', 0),
    flug: load('flug', 0)
  };
  function showBest() {
    $('[data-best="snake"]').textContent = best.snake ? best.snake + ' Pkt' : '–';
    $('[data-best="memory"]').textContent = best.memory ? best.memory + ' Züge' : '–';
    $('[data-best="reaktion"]').textContent = best.reaktion ? best.reaktion + ' ms' : '–';
    $('[data-best="klick"]').textContent = best.klick ? best.klick + ' Treffer' : '–';
    $('#snake-best').textContent = best.snake;
    $('#rx-best').textContent = best.reaktion ? best.reaktion + ' ms' : '–';
    $('#hunt-best').textContent = best.klick;
    $('[data-best="merge"]').textContent = best.merge ? best.merge + ' Pkt' : '–';
    $('[data-best="flug"]').textContent = best.flug ? best.flug + ' Pkt' : '–';
    $('#m-best').textContent = best.merge;
    $('#f-best').textContent = best.flug;
  }

  /* ---------- Reiter ---------- */
  var arcade = ['snake', 'memory', 'reaktion', 'klick', 'merge', 'flug', 'tictactoe', 'whack', 'simon', 'lights', 'guess', 'pong'];
  var casino = ['slots', 'roulette', 'rad', 'blackjack', 'wuerfel', 'hilo', 'crash', 'muenze', 'entenrennen', 'plinko', 'minen', 'rubbel', 'dragon'];
  var games = arcade.concat(casino);
  var lastA = 'snake', lastC = 'slots';
  var current = 'snake';
  var stoppers = {};
  function show(name) {
    if (games.indexOf(name) < 0) name = 'snake';
    if (stoppers[current] && current !== name) stoppers[current]();
    current = name;
    var isC = casino.indexOf(name) >= 0;
    $('#tabs').hidden = isC; $('#ctabs').hidden = !isC; $('#wallet').hidden = !isC;
    if (isC) lastC = name; else lastA = name;
    $$('#modebar button').forEach(function (b) { b.setAttribute('aria-selected', (b.dataset.mode === 'casino') === isC ? 'true' : 'false'); });
    games.forEach(function (g) { $('#g-' + g).hidden = g !== name; });
    var activeStage = $('#g-' + name);
    if (activeStage) { activeStage.classList.remove('stage-enter'); void activeStage.offsetWidth; activeStage.classList.add('stage-enter'); }
    $$('#tabs button, #ctabs button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.game === name ? 'true' : 'false'); });
    if (isC) {
      try { updateChipLabels(); } catch (e) {}
    }
  }
  $$('#tabs button, #ctabs button').forEach(function (b) {
    b.addEventListener('click', function () { show(b.dataset.game); try { history.replaceState(null, '', '#' + b.dataset.game); } catch (e) {} });
  });
  window.addEventListener('hashchange', function () { show(location.hash.replace('#', '')); });

  /* ---------- SNAKE ---------- */
  (function () {
    var cv = $('#snake-canvas'), ctx = cv.getContext('2d');
    var N = 20, S = cv.width / N;
    var snake, dir, nextDir, food, score, timer, running, over;

    function hint(t) { $('#snake-hint').innerHTML = t; }
    function placeFood() {
      var free = [];
      for (var x = 0; x < N; x++) for (var y = 0; y < N; y++) {
        if (!snake.some(function (s) { return s.x === x && s.y === y; })) free.push({ x: x, y: y });
      }
      food = free[Math.floor(Math.random() * free.length)];
    }
    function reset() {
      clearInterval(timer);
      snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      dir = { x: 1, y: 0 }; nextDir = dir; score = 0; running = false; over = false;
      placeFood(); $('#snake-score').textContent = '0';
      hint('Drücke eine Richtung, um loszulegen.');
      draw();
    }
    function speed() { return Math.max(65, 140 - score * 4); }
    function begin() {
      if (running) return;
      running = true; over = false;
      hint('Sammle die rosa Punkte und meide Wand und Schwanz.');
      clearInterval(timer); timer = setInterval(tick, speed());
    }
    function stop() { clearInterval(timer); running = false; }
    stoppers.snake = function () { if (running) { stop(); hint('Pausiert. Drücke eine Richtung zum Weiterspielen.'); } };

    function tick() {
      dir = nextDir;
      var h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      var hit = h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || snake.some(function (s) { return s.x === h.x && s.y === h.y; });
      if (hit) {
        stop(); over = true;
        if (score > best.snake) { best.snake = score; save('snake', score); showBest(); hint('<strong>Neuer Rekord: ' + score + ' Punkte!</strong> Drücke eine Richtung für eine neue Runde.'); }
        else hint('Game Over mit ' + score + ' Punkten. Drücke eine Richtung für eine neue Runde.');
        draw(); return;
      }
      snake.unshift(h);
      if (h.x === food.x && h.y === food.y) {
        score++; $('#snake-score').textContent = score;
        if (snake.length >= N * N) { stop(); over = true; hint('<strong>Das ganze Feld ist voll. Perfekt!</strong>'); draw(); return; }
        placeFood();
        clearInterval(timer); timer = setInterval(tick, speed());
      } else snake.pop();
      draw();
    }
    function setDir(x, y) {
      if (over) reset();
      if (!running) begin();
      if (x === -dir.x && y === -dir.y) return;
      nextDir = { x: x, y: y };
    }
    function draw() {
      var cD = cssv('--deep'), cP = cssv('--pink'), cC = cssv('--cyan');
      ctx.fillStyle = cD; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = cssv('--line'); ctx.lineWidth = 1;
      for (var i = 1; i < N; i++) {
        ctx.beginPath(); ctx.moveTo(i * S, 0); ctx.lineTo(i * S, cv.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * S); ctx.lineTo(cv.width, i * S); ctx.stroke();
      }
      ctx.shadowColor = cP; ctx.shadowBlur = 14; ctx.fillStyle = cP;
      ctx.fillRect(food.x * S + 4, food.y * S + 4, S - 8, S - 8);
      ctx.shadowColor = cC; ctx.shadowBlur = 8;
      snake.forEach(function (s, i) {
        ctx.fillStyle = i === 0 ? cssv('--fg') : cC;
        ctx.globalAlpha = i === 0 ? 1 : Math.max(0.45, 1 - i * 0.025);
        ctx.fillRect(s.x * S + 1, s.y * S + 1, S - 2, S - 2);
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      if (over) {
        ctx.globalAlpha = 0.75; ctx.fillStyle = cD; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1;
        ctx.fillStyle = cssv('--yellow'); ctx.font = '700 30px Silkscreen, monospace'; ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', cv.width / 2, cv.height / 2 - 6);
        ctx.fillStyle = cssv('--fg'); ctx.font = '700 18px Silkscreen, monospace';
        ctx.fillText(score + ' Punkte', cv.width / 2, cv.height / 2 + 26);
      }
    }

    document.addEventListener('keydown', function (e) {
      if (current !== 'snake') return;
      var map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
      var m = map[e.key];
      if (!m) return;
      e.preventDefault(); setDir(m[0], m[1]);
    });
    $$('.dpad button').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[b.dataset.dir];
        setDir(d[0], d[1]);
      });
    });
    var tx = 0, ty = 0;
    cv.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    cv.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0); else setDir(0, dy > 0 ? 1 : -1);
    }, { passive: true });
    $('#snake-start').addEventListener('click', function () { reset(); });
    window.addEventListener('pk-skin', function () { draw(); });
    reset();
  })();

  /* ---------- MEMORY ---------- */
  (function () {
    var SYM = [['◆', '#ff3d9a'], ['●', '#3df0ff'], ['▲', '#ffe14d'], ['■', '#4dff9a'], ['★', '#ff9a3d'], ['✚', '#b58cff'], ['☾', '#7dd3ff'], ['♥', '#ff5468']];
    var box = $('#mem-cards');
    var deck, first, lock, moves, pairs, t0, tmr, mismatchTimer = null;

    function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
    function stopTimer() { clearInterval(tmr); tmr = null; }
    stoppers.memory = function () { stopTimer(); clearTimeout(mismatchTimer); mismatchTimer = null; lock = false; };

    function build() {
      stopTimer();
      var items = SYM.concat(SYM).map(function (s) { return { s: s[0], c: s[1], open: false, done: false }; });
      for (var i = items.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = items[i]; items[i] = items[j]; items[j] = t; }
      deck = items; first = null; lock = false; moves = 0; pairs = 0; t0 = 0;
      $('#mem-moves').textContent = '0'; $('#mem-time').textContent = '0:00';
      $('#mem-hint').textContent = 'Finde alle acht Paare mit möglichst wenigen Zügen.';
      box.innerHTML = '';
      deck.forEach(function (c, idx) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'card'; b.style.setProperty('--c', c.c);
        b.setAttribute('aria-label', 'Karte ' + (idx + 1));
        b.addEventListener('click', function () { flip(c); });
        c.el = b; box.appendChild(b);
      });
    }
    function paint(c) { c.el.className = 'card' + (c.done ? ' done' : c.open ? ' up' : ''); c.el.textContent = (c.open || c.done) ? c.s : ''; }
    function flip(c) {
      if (lock || c.open || c.done) return;
      if (!t0) { t0 = Date.now(); tmr = setInterval(function () { $('#mem-time').textContent = fmt(Date.now() - t0); }, 500); }
      c.open = true; paint(c);
      if (!first) { first = c; return; }
      moves++; $('#mem-moves').textContent = moves;
      var a = first; first = null;
      if (a.s === c.s) {
        a.done = c.done = true; a.open = c.open = false; paint(a); paint(c); pairs++;
        if (pairs === SYM.length) win();
      } else {
        lock = true;
        mismatchTimer = setTimeout(function () { a.open = c.open = false; paint(a); paint(c); lock = false; mismatchTimer = null; }, 800);
      }
    }
    function win() {
      stopTimer(); $('#mem-time').textContent = fmt(Date.now() - t0);
      var msg = 'Geschafft in ' + moves + ' Zügen und ' + fmt(Date.now() - t0) + ' Minuten.';
      if (!best.memory || moves < best.memory) { best.memory = moves; save('memory', moves); showBest(); msg = 'Neuer Rekord! ' + msg; }
      $('#mem-hint').innerHTML = '<strong>' + msg + '</strong>';
    }
    $('#mem-restart').addEventListener('click', build);
    build();
  })();

  /* ---------- REAKTION ---------- */
  (function () {
    var pad = $('#rx-pad'), state = 'idle', t0 = 0, to = null, times = [];
    function set(cls, html) { pad.className = cls; pad.innerHTML = '<span>' + html + '</span>'; }
    stoppers.reaktion = function () { clearTimeout(to); if (state === 'wait' || state === 'go') { state = 'idle'; set('', 'Tippen zum Starten'); } };
    function renderHistory() {
      var ul = $('#rx-history'); ul.innerHTML = '';
      times.slice(-5).forEach(function (t) { var li = document.createElement('li'); li.textContent = t + ' ms'; ul.appendChild(li); });
      if (times.length) {
        var recent = times.slice(-5);
        $('#rx-avg').textContent = Math.round(recent.reduce(function (a, b) { return a + b; }, 0) / recent.length) + ' ms';
      }
    }
    pad.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (state === 'idle' || state === 'result' || state === 'early') {
        state = 'wait'; set('wait', 'Warte auf Grün<small>Noch nicht tippen.</small>');
        to = setTimeout(function () { state = 'go'; t0 = performance.now(); set('go', 'Jetzt!'); }, 1500 + Math.random() * 2500);
      } else if (state === 'wait') {
        clearTimeout(to); state = 'early';
        set('', 'Zu früh!<small>Tippe zum Neustart.</small>');
      } else if (state === 'go') {
        var ms = Math.round(performance.now() - t0); state = 'result';
        times.push(ms); renderHistory();
        var extra = '';
        if (!best.reaktion || ms < best.reaktion) { best.reaktion = ms; save('reaktion', ms); showBest(); extra = ' Neuer Rekord!'; }
        set('result', ms + ' ms<small>' + extra + ' Tippe für die nächste Runde.</small>');
      }
    });
    pad.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pad.dispatchEvent(new Event('pointerdown')); } });
  })();

  /* ---------- KLICK-JAGD ---------- */
  (function () {
    var area = $('#hunt-area'), target = $('#hunt-target'), bar = $('#hunt-bar');
    var TOTAL = 20000, score = 0, running = false, tmr = null, endAt = 0;
    function place() {
      var r = area.getBoundingClientRect();
      var size = Math.max(32, 72 - score * 1.8);
      target.style.width = target.style.height = size + 'px';
      var pad = size / 2 + 4;
      target.style.left = (pad + Math.random() * Math.max(1, r.width - pad * 2)) + 'px';
      target.style.top = (pad + Math.random() * Math.max(1, r.height - pad * 2)) + 'px';
    }
    function finish() {
      clearInterval(tmr); running = false; target.hidden = true; bar.style.transform = 'scaleX(0)';
      var msg = score + ' Treffer in 20 Sekunden.';
      if (score > best.klick) { best.klick = score; save('klick', score); showBest(); msg = 'Neuer Rekord! ' + msg; }
      $('#hunt-hint').innerHTML = '<strong>' + msg + '</strong>';
      $('#hunt-start').textContent = 'Nochmal';
    }
    stoppers.klick = function () { if (running) { clearInterval(tmr); running = false; target.hidden = true; $('#hunt-hint').textContent = 'Abgebrochen. Starte eine neue Runde.'; $('#hunt-start').textContent = 'Start'; } };
    function start() {
      score = 0; running = true; $('#hunt-score').textContent = '0';
      $('#hunt-hint').textContent = 'Los! Triff das Ziel so oft du kannst.';
      target.hidden = false; place();
      endAt = Date.now() + TOTAL; bar.style.transform = 'scaleX(1)';
      clearInterval(tmr);
      tmr = setInterval(function () {
        var left = endAt - Date.now();
        if (left <= 0) finish(); else bar.style.transform = 'scaleX(' + (left / TOTAL) + ')';
      }, 50);
    }
    target.addEventListener('pointerdown', function (e) {
      e.preventDefault(); if (!running) return;
      score++; $('#hunt-score').textContent = score; place();
    });
    $('#hunt-start').addEventListener('click', start);
  })();

  /* ================= CASINO ================= */
  $$('#modebar button').forEach(function (b) {
    b.addEventListener('click', function () {
      var g = b.dataset.mode === 'casino' ? lastC : lastA;
      show(g); try { history.replaceState(null, '', '#' + g); } catch (e) {}
    });
  });

  var bank = load('bank', 1000);
  if (!(bank >= 0)) bank = 1000;
  var deltaTimer = null;
  function isLucky() {
    try {
      var L = window.__nexoraLuck;
      return !!(L && L.until > Date.now() && L.power > 1);
    } catch (e) { return false; }
  }
  function rnd(n) {
    /* Fair random only — luck is applied per-game, never by poisoning Math.random */
    return Math.floor(Math.random() * n);
  }
  function fmtC(n) { return Math.round(n).toLocaleString('de-AT'); }
  function fm(x) { return '×' + (Math.round(x * 100) / 100).toString().replace('.', ','); }
  function renderBank(delta) {
    $('#bank').textContent = fmtC(bank);
    if (delta) {
      var d = $('#bank-delta');
      d.textContent = (delta > 0 ? '+' : '−') + fmtC(Math.abs(delta));
      d.className = delta > 0 ? 'up' : 'down';
      clearTimeout(deltaTimer);
      deltaTimer = setTimeout(function () { d.textContent = ''; }, 2500);
    }
  }
  function setBank(v, delta) {
    bank = Math.min(1e12, Math.max(0, Math.round(v)));
    save('bank', bank);
    renderBank(delta);
    try { updateBetDisplay(); } catch (e) {}
  }
  function spend(n) { setBank(bank - n, -n); }
  function pay(n) { if (n > 0) setBank(bank + n, n); }
  /* Max stake = ~1% of bank; chips offer Min / ¼ / ½ / Max of that */
  var MAX_BET_SHARE = 0.01;
  var MIN_BET = 1;
  function maxBetFor(game) {
    var cap = Math.max(MIN_BET, Math.floor(bank * MAX_BET_SHARE));
    return Math.max(MIN_BET, Math.min(cap, bank));
  }
  function minBetFor() {
    return Math.min(MIN_BET, maxBetFor(current));
  }
  function betPresets() {
    var mx = maxBetFor(current);
    var mn = Math.min(MIN_BET, mx);
    return {
      min: mn,
      quarter: Math.max(mn, Math.floor(mx * 0.25)),
      half: Math.max(mn, Math.floor(mx * 0.5)),
      max: mx
    };
  }
  function updateBetDisplay() {
    var el = $('#bet-display');
    var mode = $('#bet-mode-label');
    if (!el) return;
    var p = betPresets();
    var v = Math.floor(parseFloat($('#bet').value) || 0);
    if (alwaysMaxBet) v = p.max;
    v = Math.max(p.min, Math.min(v || p.min, p.max, bank));
    $('#bet').value = String(v);
    el.textContent = fmtC(v) + ' Chips';
    if (mode) mode.textContent = alwaysMaxBet ? '· immer Max' : '';
  }
  function updateChipLabels() { updateBetDisplay(); }
  var alwaysMaxBet = false;
  try { alwaysMaxBet = sessionStorage.getItem('nexora_always_max') === '1'; } catch (e) {}
  var betReady = false;
  var lastActionBtn = null;
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('button');
    if (!t) return;
    if (t.closest('#nexora-bet-modal') || t.closest('#nexora-cat-menu') || t.closest('#settings')) return;
    lastActionBtn = t;
  }, true);

  function validateBet(v, out) {
    var p = betPresets();
    v = Math.floor(v);
    if (!(v > 0)) { if (out) out('Gib einen Einsatz ein.'); return 0; }
    if (v < p.min) { if (out) out('Mindesteinsatz: ' + p.min + '.'); return 0; }
    if (v > bank) { if (out) out('Nicht genug Chips.'); return 0; }
    if (v > p.max) { if (out) out('Maximal ' + p.max + ' Chips (1% vom Guthaben).'); return 0; }
    return v;
  }

  function openBetModal(out) {
    var existing = document.getElementById('nexora-bet-modal');
    if (existing) existing.remove();
    var p = betPresets();
    var chosen = Math.min(p.max, Math.max(p.min, Math.floor(parseFloat($('#bet').value) || p.min)));
    var modal = document.createElement('div');
    modal.id = 'nexora-bet-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<div class="nx-bet-card">' +
      '<div class="nx-bet-top"><h3>:3  Einsatz wählen</h3><button type="button" class="nx-bet-x" aria-label="Schließen">×</button></div>' +
      '<p class="nx-bet-sub">Wähle deinen Einsatz. Max. ' + p.max + ' · Guthaben ' + fmtC(bank) + ' Chips.</p>' +
      '<div class="nx-bet-presets">' +
      '<button type="button" data-v="' + p.min + '">Min<br><strong>' + p.min + '</strong></button>' +
      '<button type="button" data-v="' + p.quarter + '">¼<br><strong>' + p.quarter + '</strong></button>' +
      '<button type="button" data-v="' + p.half + '">½<br><strong>' + p.half + '</strong></button>' +
      '<button type="button" data-v="' + p.max + '">Max<br><strong>' + p.max + '</strong></button>' +
      '</div>' +
      '<label class="nx-bet-label" for="nx-bet-input">Eigener Einsatz</label>' +
      '<input id="nx-bet-input" class="nx-no-spin" type="text" inputmode="numeric" pattern="[0-9]*" value="' + chosen + '" autocomplete="off">' +
      '<label class="nx-bet-always"><input type="checkbox" id="nx-bet-always"' + (alwaysMaxBet ? ' checked' : '') + '> Immer maximalen Einsatz verwenden</label>' +
      '<div class="nx-bet-actions">' +
      '<button type="button" class="nx-bet-cancel">Abbrechen</button>' +
      '<button type="button" class="nx-bet-ok">Spielen</button>' +
      '</div></div>';

    function close() { modal.remove(); }
    function setVal(v) {
      chosen = validateBet(v, null) || p.min;
      modal.querySelector('#nx-bet-input').value = String(chosen);
    }
    modal.querySelectorAll('[data-v]').forEach(function (b) {
      b.addEventListener('click', function () { setVal(+b.dataset.v); });
    });
    modal.querySelector('#nx-bet-always').addEventListener('change', function (e) {
      alwaysMaxBet = !!e.target.checked;
      try { sessionStorage.setItem('nexora_always_max', alwaysMaxBet ? '1' : '0'); } catch (err) {}
    });
    modal.querySelector('.nx-bet-x').addEventListener('click', close);
    modal.querySelector('.nx-bet-cancel').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('.nx-bet-ok').addEventListener('click', function () {
      var v = validateBet(modal.querySelector('#nx-bet-input').value, out);
      if (!v) return;
      if (alwaysMaxBet) v = p.max;
      v = validateBet(v, out);
      if (!v) return;
      $('#bet').value = String(v);
      betReady = true;
      updateBetDisplay();
      close();
      var btn = lastActionBtn;
      if (btn && typeof btn.click === 'function' && !btn.id?.includes('bet-change')) {
        setTimeout(function () { btn.click(); }, 20);
      }
    });
    document.body.appendChild(modal);
    modal.querySelector('#nx-bet-input').focus();
  }

  function betAmount(out) {
    var p = betPresets();
    if (alwaysMaxBet && !betReady) {
      var mx = validateBet(p.max, out);
      if (!mx) return 0;
      $('#bet').value = String(mx);
      updateBetDisplay();
      return mx;
    }
    if (betReady) {
      betReady = false;
      var v = validateBet($('#bet').value, out);
      updateBetDisplay();
      return v;
    }
    /* If a stake is already chosen and "always max" is off, still ask each time
       unless user only wanted display — open modal every start without always-max */
    openBetModal(out || function () {});
    return 0;
  }

  var betChangeBtn = $('#bet-change-btn');
  if (betChangeBtn) {
    betChangeBtn.addEventListener('click', function () {
      /* Always open modal to change stake (even if always-max is on) */
      lastActionBtn = null;
      betReady = false;
      openBetModal(function () {});
    });
  }
  updateBetDisplay();
  var SUITS = ['♠', '♥', '♦', '♣'];
  function cardEl(c, hidden, big) {
    var s = document.createElement('span');
    s.className = 'pc' + (big ? ' big' : '') + (hidden ? ' back' : (c.s === '♥' || c.s === '♦' ? ' red' : ''));
    if (!hidden) s.innerHTML = c.r + '<br>' + c.s;
    return s;
  }
  function pushHistory(ul, text, cls, max) {
    var li = document.createElement('li'); li.textContent = text; li.className = cls || '';
    ul.insertBefore(li, ul.firstChild);
    while (ul.children.length > (max || 8)) ul.removeChild(ul.lastChild);
  }

  function claimChips(amount) {
    var v = Math.floor(amount);
    if (!(v > 0)) return;
    var room = Math.max(0, 1000 - bank);
    if (room <= 0) {
      var d = $('#bank-delta');
      if (d) { d.textContent = 'Max. 1.000'; d.className = 'down'; }
      return;
    }
    pay(Math.min(v, room));
  }
  function openChipsMenu() {
    var existing = document.getElementById('nexora-chips-modal');
    if (existing) existing.remove();
    var room = Math.max(0, 1000 - bank);
    var minC = room > 0 ? 1 : 0;
    var maxC = room;
    var modal = document.createElement('div');
    modal.id = 'nexora-chips-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<div class="nx-bet-card nx-chips-card">' +
      '<div class="nx-bet-top"><h3>Chips</h3><button type="button" class="nx-bet-x" aria-label="Schließen">×</button></div>' +
      '<p class="nx-bet-sub">Guthaben: <strong>' + fmtC(bank) + '</strong><br>Noch bis 1.000: <strong>' + fmtC(room) + '</strong></p>' +
      (room > 0
        ? '<div class="nx-bet-presets nx-chips-presets">' +
          '<button type="button" data-v="1">Min<br><strong>1</strong></button>' +
          '<button type="button" data-v="' + maxC + '">Max<br><strong>' + maxC + '</strong></button>' +
          '</div>' +
          '<label class="nx-bet-label" for="nx-chips-input">Eigene Menge</label>' +
          '<input id="nx-chips-input" class="nx-no-spin" type="text" inputmode="numeric" pattern="[0-9]*" value="' + maxC + '" autocomplete="off">' +
          '<div class="nx-bet-actions" style="margin-bottom:12px">' +
          '<button type="button" class="nx-bet-ok" id="nx-chips-claim" style="width:100%">Chips holen</button>' +
          '</div>'
        : '<p class="nx-bet-sub">Du hast bereits das Maximum (1.000). Zum Neustart zurücksetzen.</p>') +
      '<button type="button" class="nx-chips-reset-btn" id="nx-chips-reset">Auf 1.000 zurücksetzen</button>' +
      '</div>';
    function close() { modal.remove(); }
    function setVal(v) {
      var n = Math.floor(+v);
      if (!(n > 0)) n = 1;
      if (maxC > 0 && n > maxC) n = maxC;
      var inp = modal.querySelector('#nx-chips-input');
      if (inp) inp.value = String(n);
    }
    modal.querySelector('.nx-bet-x').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelectorAll('[data-v]').forEach(function (b) {
      b.addEventListener('click', function () { setVal(b.dataset.v); });
    });
    var claimBtn = modal.querySelector('#nx-chips-claim');
    if (claimBtn) {
      claimBtn.addEventListener('click', function () {
        claimChips(modal.querySelector('#nx-chips-input').value);
        close();
        updateBetDisplay();
      });
    }
    modal.querySelector('#nx-chips-reset').addEventListener('click', function () {
      setBank(1000, 0);
      close();
      updateBetDisplay();
    });
    document.body.appendChild(modal);
    var inp = modal.querySelector('#nx-chips-input');
    if (inp) {
      inp.addEventListener('input', function () { inp.value = inp.value.replace(/\D/g, ''); });
      inp.focus();
    }
  }
  var chipsBtn = $('#chips-menu-btn');
  if (chipsBtn) chipsBtn.addEventListener('click', openChipsMenu);
  renderBank(0);

  /* ---------- SLOTS ---------- */
  (function () {
    var SY = [['7', '#ff3d9a', 25, 1], ['★', '#ffe14d', 15, 2], ['♥', '#ff5468', 10, 3], ['◆', '#3df0ff', 6, 4], ['▲', '#4dff9a', 4, 5], ['●', '#b58cff', 3, 6]];
    var pool = [];
    SY.forEach(function (s, i) { for (var k = 0; k < s[3]; k++) pool.push(i); });
    var reels = $$('#reels .reel'), btn = $('#slots-spin'), hint = $('#slots-hint'), busy = false;
    function setReel(i, k) { var symbol=reels[i].querySelector('span'); if(!symbol){symbol=document.createElement('span');reels[i].replaceChildren(symbol);} symbol.textContent=SY[k][0]; reels[i].style.color = SY[k][1]; }
    [0, 1, 2].forEach(function (i) { setReel(i, [0, 1, 3][i]); });
    btn.addEventListener('click', function () {
      if (busy) return;
      var b = betAmount(function (m) { hint.textContent = m; });
      if (!b) return;
      spend(b); busy = true; btn.disabled = true;
      reels.forEach(function (r) { r.classList.remove('win'); });
      hint.textContent = 'Die Walzen laufen …'; reels.forEach(function(r){r.classList.add('spinning');});
      var fin = [pool[rnd(pool.length)], pool[rnd(pool.length)], pool[rnd(pool.length)]];
      if (isLucky()) {
        var roll = Math.random();
        if (roll < 0.45) fin = [0, 0, 0]; /* triple 7 */
        else if (roll < 0.75) fin = [1, 1, 1]; /* triple star */
        else if (roll < 0.92) { var s = 2 + rnd(4); fin = [s, s, s]; }
        else { fin[1] = fin[0]; } /* at least a pair */
      }
      var stopped = [false, false, false];
      var iv = setInterval(function () { for (var i = 0; i < 3; i++) if (!stopped[i]) setReel(i, rnd(SY.length)); }, 80);
      function settle() {
        reels.forEach(function(r){r.classList.remove('spinning');});
        var mult = 0, msg;
        if (fin[0] === fin[1] && fin[1] === fin[2]) { mult = SY[fin[0]][2]; msg = 'Dreimal ' + SY[fin[0]][0] + '!'; reels.forEach(function (r) { r.classList.add('win'); }); }
        else if (fin[0] === fin[1] || fin[1] === fin[2] || fin[0] === fin[2]) { mult = 1.5; msg = 'Zwei gleiche.'; }
        var win = Math.floor(b * mult);
        pay(win);
        $('#slots-last').textContent = fmtC(win);
        hint.textContent = win ? msg + ' Du gewinnst ' + fmtC(win) + ' Chips (' + fm(mult) + ').' : 'Nichts getroffen. Versuch es nochmal.';
        busy = false; btn.disabled = false;
      }
      [0, 1, 2].forEach(function (i) {
        setTimeout(function () { stopped[i] = true; setReel(i, fin[i]); reels[i].classList.remove('spinning'); if (i === 2) { clearInterval(iv); settle(); } }, 700 + i * 500);
      });
    });
  })();

  /* ---------- ROULETTE ---------- */
  (function () {
    var RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    var ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    var SPIN_MS = 3600, SPIN_TURNS = 5;
    function col(n) { return n === 0 ? 'green' : (RED.indexOf(n) >= 0 ? 'red' : 'black'); }
    var TYPES = [
      ['rot', 'Rot', 2, function (n) { return col(n) === 'red'; }],
      ['schwarz', 'Schwarz', 2, function (n) { return col(n) === 'black'; }],
      ['gerade', 'Gerade', 2, function (n) { return n > 0 && n % 2 === 0; }],
      ['ungerade', 'Ungerade', 2, function (n) { return n % 2 === 1; }],
      ['tief', '1 bis 18', 2, function (n) { return n >= 1 && n <= 18; }],
      ['hoch', '19 bis 36', 2, function (n) { return n >= 19; }],
      ['d1', '1. Dutzend (1–12)', 3, function (n) { return n >= 1 && n <= 12; }],
      ['d2', '2. Dutzend (13–24)', 3, function (n) { return n >= 13 && n <= 24; }],
      ['d3', '3. Dutzend (25–36)', 3, function (n) { return n >= 25; }],
      ['zahl', 'Einzelne Zahl', 36, null]
    ];
    var sel = $('#rl-type'), num = $('#rl-num'), ball = $('#rl-ball'), wheel = $('#rl-wheel'), hint = $('#rl-hint'), btn = $('#rl-spin'), busy = false;
    var rot = 0;
    if (wheel) {
      var stops = ORDER.map(function (n, i) {
        var c = col(n) === 'red' ? '#c4154f' : col(n) === 'black' ? '#1a1a22' : '#138a4d';
        var a0 = (i / ORDER.length) * 360, a1 = ((i + 1) / ORDER.length) * 360;
        return c + ' ' + a0 + 'deg ' + a1 + 'deg';
      });
      wheel.style.background = 'conic-gradient(from -0.5deg, ' + stops.join(',') + ')';
      wheel.innerHTML = ORDER.map(function (n, i) {
        var ang = (i + 0.5) / ORDER.length * 360;
        return '<span class="nx-wheel-label nx-wheel-num" style="--a:' + ang + 'deg">' + n + '</span>';
      }).join('');
      wheel.style.transform = 'rotate(0deg)';
    }
    TYPES.forEach(function (t) { var o = document.createElement('option'); o.value = t[0]; o.textContent = t[1] + ' · ' + fm(t[2]); sel.appendChild(o); });
    sel.addEventListener('change', function () { num.hidden = sel.value !== 'zahl'; });
    function pickWinningNumber(t, pick) {
      if (t[0] === 'zahl') return pick;
      var pool = [];
      for (var n = 0; n <= 36; n++) if (t[3](n)) pool.push(n);
      return pool[rnd(pool.length)] || 0;
    }
    function spinTo(idx, done) {
      if (!wheel) { done(); return; }
      var seg = 360 / ORDER.length;
      var want = (360 - (idx * seg + seg / 2)) % 360;
      var cur = ((rot % 360) + 360) % 360;
      var delta = (want - cur + 360) % 360;
      rot = rot + SPIN_TURNS * 360 + delta;
      wheel.style.transition = 'none';
      wheel.style.transform = 'rotate(' + (rot - SPIN_TURNS * 360 - delta) + 'deg)';
      void wheel.offsetWidth;
      wheel.style.transition = 'transform ' + (SPIN_MS / 1000) + 's cubic-bezier(0.12, 0.78, 0.08, 1)';
      wheel.style.transform = 'rotate(' + rot + 'deg)';
      setTimeout(done, SPIN_MS + 40);
    }
    btn.addEventListener('click', function () {
      if (busy) return;
      var t = TYPES.filter(function (x) { return x[0] === sel.value; })[0];
      var pick = Math.floor(parseFloat(num.value));
      if (t[0] === 'zahl' && !(pick >= 0 && pick <= 36)) { hint.textContent = 'Wähle eine Zahl von 0 bis 36.'; return; }
      var b = betAmount(function (m) { hint.textContent = m; });
      if (!b) return;
      spend(b); busy = true; btn.disabled = true; hint.textContent = 'Das Rad dreht sich …';
      var res = isLucky() ? pickWinningNumber(t, pick) : rnd(37);
      var idx = ORDER.indexOf(res); if (idx < 0) idx = 0;
      spinTo(idx, function () {
        ball.textContent = res; ball.className = 'rball ' + col(res);
        var won = t[0] === 'zahl' ? res === pick : t[3](res);
        var win = won ? b * t[2] : 0;
        pay(win);
        pushHistory($('#rl-history'), String(res), col(res), 10);
        hint.textContent = won
          ? res + ' · Gewonnen: ' + fmtC(win) + ' Chips.'
          : res + ' · Leider verloren.';
        busy = false; btn.disabled = false;
      });
    });
  })();

  /* ---------- GLÜCKSRAD ---------- */
  (function () {
    var SEGS = [
      { m: 0, c: '#3a3a48', l: '×0' },
      { m: 1.2, c: '#2a6f7a', l: '×1,2' },
      { m: 1.5, c: '#3d6b4f', l: '×1,5' },
      { m: 2, c: '#4a6aa8', l: '×2' },
      { m: 0.5, c: '#5a4a3a', l: '×0,5' },
      { m: 3, c: '#7a4a9a', l: '×3' },
      { m: 1.2, c: '#2a6f7a', l: '×1,2' },
      { m: 5, c: '#a84a2a', l: '×5' },
      { m: 1.5, c: '#3d6b4f', l: '×1,5' },
      { m: 10, c: '#c9a000', l: '×10' },
      { m: 0, c: '#3a3a48', l: '×0' },
      { m: 2, c: '#4a6aa8', l: '×2' }
    ];
    var SPIN_MS = 3600, SPIN_TURNS = 5;
    var wheel = $('#rad-wheel'), resEl = $('#rad-result'), hint = $('#rad-hint'), btn = $('#rad-spin'), busy = false, rot = 0;
    if (wheel) {
      var stops = SEGS.map(function (s, i) {
        var a0 = (i / SEGS.length) * 360, a1 = ((i + 1) / SEGS.length) * 360;
        return s.c + ' ' + a0 + 'deg ' + a1 + 'deg';
      });
      wheel.style.background = 'conic-gradient(from -0.5deg, ' + stops.join(',') + ')';
      wheel.innerHTML = SEGS.map(function (s, i) {
        var ang = (i + 0.5) / SEGS.length * 360;
        return '<span class="nx-wheel-label nx-wheel-mult" style="--a:' + ang + 'deg">' + s.l + '</span>';
      }).join('');
      wheel.style.transform = 'rotate(0deg)';
    }
    function spinTo(idx, done) {
      if (!wheel) { done(); return; }
      var seg = 360 / SEGS.length;
      var want = (360 - (idx * seg + seg / 2)) % 360;
      var cur = ((rot % 360) + 360) % 360;
      var delta = (want - cur + 360) % 360;
      rot = rot + SPIN_TURNS * 360 + delta;
      wheel.style.transition = 'none';
      wheel.style.transform = 'rotate(' + (rot - SPIN_TURNS * 360 - delta) + 'deg)';
      void wheel.offsetWidth;
      wheel.style.transition = 'transform ' + (SPIN_MS / 1000) + 's cubic-bezier(0.12, 0.78, 0.08, 1)';
      wheel.style.transform = 'rotate(' + rot + 'deg)';
      setTimeout(done, SPIN_MS + 40);
    }
    btn.addEventListener('click', function () {
      if (busy) return;
      var b = betAmount(function (m) { hint.textContent = m; }); if (!b) return;
      spend(b); busy = true; btn.disabled = true; hint.textContent = 'Das Glücksrad dreht sich …';
      var idx;
      if (isLucky()) {
        var good = [];
        SEGS.forEach(function (s, i) { if (s.m >= 2) good.push(i); });
        idx = good[rnd(good.length)] || 0;
      } else {
        idx = rnd(SEGS.length);
      }
      spinTo(idx, function () {
        var s = SEGS[idx];
        var win = Math.floor(b * s.m);
        pay(win);
        resEl.textContent = s.l;
        resEl.className = 'rball ' + (s.m >= 2 ? 'green' : s.m > 0 ? '' : 'black');
        pushHistory($('#rad-history'), s.l, s.m >= 1 ? 'win' : 'lose', 10);
        hint.textContent = win
          ? 'Landung auf ' + s.l + ' · Gewinn: ' + fmtC(win) + ' Chips.'
          : 'Landung auf ' + s.l + ' · kein Gewinn.';
        busy = false; btn.disabled = false;
      });
    });
  })();

  /* ---------- BLACKJACK ---------- */
  (function () {
    var RK = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    var deck = [], P = [], D = [], bet = 0, phase = 'idle';
    var eD = $('#bj-dealer'), eP = $('#bj-player'), vD = $('#bj-dval'), vP = $('#bj-pval'), hint = $('#bj-hint');
    var bDeal = $('#bj-deal'), bHit = $('#bj-hit'), bStand = $('#bj-stand'), bDbl = $('#bj-double');
    function say(t) { hint.textContent = t; }
    function fresh() {
      deck = [];
      SUITS.forEach(function (s) { RK.forEach(function (r) { deck.push({ s: s, r: r }); }); });
      for (var i = deck.length - 1; i > 0; i--) { var j = rnd(i + 1); var t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
    }
    function draw() { if (deck.length < 12) fresh(); return deck.pop(); }
    function val(h) {
      var t = 0, a = 0;
      h.forEach(function (c) {
        if (c.r === 'A') { a++; t += 11; } else if (['10', 'J', 'Q', 'K'].indexOf(c.r) >= 0) t += 10; else t += parseInt(c.r, 10);
      });
      while (t > 21 && a > 0) { t -= 10; a--; }
      return t;
    }
    function render(reveal) {
      eD.innerHTML = ''; eP.innerHTML = '';
      D.forEach(function (c, i) { eD.appendChild(cardEl(c, !reveal && i === 1)); });
      P.forEach(function (c) { eP.appendChild(cardEl(c, false)); });
      vD.textContent = D.length ? (reveal ? val(D) : val([D[0]])) : '';
      vP.textContent = P.length ? val(P) : '';
      bDeal.disabled = phase === 'play';
      bHit.disabled = phase !== 'play'; bStand.disabled = phase !== 'play';
      bDbl.disabled = phase !== 'play' || P.length !== 2 || bank < bet;
    }
    function finish(result, extra) {
      phase = 'done'; render(true);
      var msg;
      if (result === 'bj') { pay(Math.floor(bet * 2.5)); msg = 'Blackjack! Du gewinnst ' + fmtC(Math.floor(bet * 1.5)) + ' Chips.'; }
      else if (result === 'win') { pay(bet * 2); msg = (extra || 'Gewonnen!') + ' Du bekommst ' + fmtC(bet) + ' Chips dazu.'; }
      else if (result === 'push') { pay(bet); msg = (extra || 'Unentschieden.') + ' Dein Einsatz geht zurück.'; }
      else msg = (extra || 'Verloren.') + ' Der Einsatz ist weg.';
      say(msg);
    }
    function stand() {
      while (val(D) < 17) D.push(draw());
      var pv = val(P), dv = val(D);
      phase = 'done';
      if (dv > 21) finish('win', 'Der Dealer überkauft mit ' + dv + '.');
      else if (pv > dv) finish('win', 'Du hast ' + pv + ' gegen ' + dv + '.');
      else if (pv === dv) finish('push', 'Beide haben ' + pv + '.');
      else finish('lose', 'Der Dealer hat ' + dv + ' gegen deine ' + pv + '.');
    }
    bDeal.addEventListener('click', function () {
      if (phase === 'play') return;
      var b = betAmount(say); if (!b) return;
      bet = b; spend(b);
      P = [draw(), draw()]; D = [draw(), draw()]; phase = 'play';
      var pv = val(P), dv = val(D);
      if (pv === 21 || dv === 21) {
        if (pv === 21 && dv === 21) finish('push', 'Beide haben Blackjack.');
        else if (pv === 21) finish('bj');
        else finish('lose', 'Der Dealer hat Blackjack.');
        return;
      }
      render(false); say('Karte, halten oder verdoppeln?');
    });
    bHit.addEventListener('click', function () {
      if (phase !== 'play') return;
      P.push(draw());
      var pv = val(P);
      if (pv > 21) finish('lose', 'Überkauft mit ' + pv + '.');
      else if (pv === 21) stand();
      else { render(false); say('Du hast ' + pv + '. Noch eine Karte?'); }
    });
    bStand.addEventListener('click', function () { if (phase === 'play') stand(); });
    bDbl.addEventListener('click', function () {
      if (phase !== 'play' || P.length !== 2 || bank < bet) return;
      spend(bet); bet *= 2; P.push(draw());
      if (val(P) > 21) finish('lose', 'Verdoppelt und überkauft mit ' + val(P) + '.'); else stand();
    });
    render(false);
  })();

  /* ---------- WÜRFELN ---------- */
  (function () {
    var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    var dice = $$('#dice .die'), hint = $('#dice-hint'), sumEl = $('#dice-sum'), busy = false;
    var OPT = {
      under: { m: 2.3, t: function (s) { return s < 7; } },
      seven: { m: 5.5, t: function (s) { return s === 7; } },
      over: { m: 2.3, t: function (s) { return s > 7; } }
    };
    function paint(el, v) {
      el.innerHTML = '';
      for (var i = 0; i < 9; i++) { var p = document.createElement('i'); if (PIPS[v].indexOf(i) >= 0) p.className = 'on'; el.appendChild(p); }
    }
    paint(dice[0], 3); paint(dice[1], 4); sumEl.textContent = 'Summe 7';
    $$('#g-wuerfel [data-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (busy) return;
        var o = OPT[btn.dataset.pick];
        var pick = btn.dataset.pick;
        var b = betAmount(function (m) { hint.textContent = m; });
        if (!b) return;
        spend(b); busy = true; hint.textContent = 'Die Würfel rollen …';
        var a = 1 + rnd(6), c = 1 + rnd(6);
        if (isLucky() && Math.random() < 0.92) {
          if (pick === 'seven') { a = 3; c = 4; }
          else if (pick === 'under') { a = 1 + rnd(3); c = 1 + rnd(Math.max(1, 5 - a)); }
          else if (pick === 'over') { a = 4 + rnd(3); c = Math.min(6, 4 + rnd(3)); if (a + c < 8) c = 6; }
        }
        var n = 0;
        var iv = setInterval(function () {
          n++;
          if (n >= 10) {
            clearInterval(iv); paint(dice[0], a); paint(dice[1], c);
            var s = a + c; sumEl.textContent = 'Summe ' + s;
            var win = o.t(s) ? Math.floor(b * o.m) : 0;
            pay(win);
            hint.textContent = win ? 'Treffer! Du gewinnst ' + fmtC(win) + ' Chips (' + fm(o.m) + ').' : 'Daneben. Die Summe war ' + s + '.';
            busy = false;
          } else { paint(dice[0], 1 + rnd(6)); paint(dice[1], 1 + rnd(6)); }
        }, 90);
      });
    });
  })();

  /* ---------- HOCH ODER TIEF ---------- */
  (function () {
    var RK = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    var cur, pot = 0, active = false;
    var hint = $('#hilo-hint'), box = $('#hilo-card'), potEl = $('#hilo-pot');
    var bUp = $('#hilo-up'), bDown = $('#hilo-down'), bStart = $('#hilo-start'), bCash = $('#hilo-cash');
    var stake0 = 0;
    function mk() { var i = rnd(13); return { i: i, r: RK[i], s: SUITS[rnd(4)] }; }
    function pUp(c) { return (12 - c.i) / 13; }
    function pDown(c) { return c.i / 13; }
    function mult(p) {
      if (p <= 0) return 0;
      var m = 0.90 / p;
      return Math.min(1.55, Math.max(1.05, Math.round(m * 100) / 100));
    }
    function showCard(c) { box.innerHTML = ''; box.appendChild(cardEl(c, false, true)); }
    function ui() {
      bStart.disabled = active; bCash.disabled = !active;
      if (active) {
        var mu = mult(pUp(cur)), md = mult(pDown(cur));
        bUp.disabled = !mu; bDown.disabled = !md;
        bUp.textContent = mu ? 'Höher ' + fm(mu) : 'Höher (unmöglich)';
        bDown.textContent = md ? 'Tiefer ' + fm(md) : 'Tiefer (unmöglich)';
        potEl.textContent = 'Pot: ' + fmtC(pot) + ' Chips';
      } else {
        bUp.disabled = true; bDown.disabled = true; bUp.textContent = 'Höher'; bDown.textContent = 'Tiefer';
      }
    }
    bStart.addEventListener('click', function () {
      if (active) return;
      var b = betAmount(function (m) { hint.textContent = m; }); if (!b) return;
      spend(b); pot = b; stake0 = b; active = true; cur = mk(); showCard(cur);
      hint.textContent = 'Höher oder tiefer? Gleiche Karten verlieren. Max. Pot: 10× Einsatz.'; ui();
    });
    function guess(up) {
      if (!active) return;
      var p = up ? pUp(cur) : pDown(cur), m = mult(p);
      var nx = mk();
      if (isLucky()) {
        var pool = [];
        for (var i = 0; i < 13; i++) {
          if (up ? i > cur.i : i < cur.i) pool.push(i);
        }
        if (pool.length) {
          var idx = pool[Math.floor(Math.random() * pool.length)];
          nx = { i: idx, r: RK[idx], s: SUITS[Math.floor(Math.random() * 4)] };
        }
      }
      var ok = up ? nx.i > cur.i : nx.i < cur.i;
      showCard(nx);
      if (ok) {
        pot = Math.floor(pot * m);
        if (stake0 > 0) pot = Math.min(pot, stake0 * 10);
        cur = nx;
        hint.textContent = 'Richtig! Der Pot wächst auf ' + fmtC(pot) + ' Chips. Weiter oder auszahlen?'; ui();
      } else {
        active = false; potEl.textContent = 'Pot verloren';
        hint.textContent = nx.i === cur.i ? 'Gleiche Karte, das verliert. Starte eine neue Runde.' : 'Falsch geraten. Starte eine neue Runde.'; ui();
      }
    }
    bUp.addEventListener('click', function () { guess(true); });
    bDown.addEventListener('click', function () { guess(false); });
    bCash.addEventListener('click', function () {
      if (!active) return;
      active = false; pay(pot); potEl.textContent = 'Ausgezahlt: ' + fmtC(pot) + ' Chips';
      hint.textContent = 'Ausgezahlt. Starte eine neue Runde, wenn du willst.'; ui();
    });
    ui();
  })();

  /* ---------- CRASH ---------- */
  (function () {
    var num = $('#crash-num'), btn = $('#crash-btn'), hint = $('#crash-hint');
    var tmr = null, t0 = 0, crashAt = 1, bet = 0, active = false;
    function f(x) { return x.toFixed(2).replace('.', ',') + '×'; }
    function cur() { return Math.exp(0.1 * (Date.now() - t0) / 1000); }
    function end(cls) { clearInterval(tmr); active = false; num.className = 'crash ' + cls; btn.textContent = 'Einsatz platzieren'; }
    function crashed() {
      end('dead'); num.textContent = f(crashAt);
      pushHistory($('#crash-history'), f(crashAt), crashAt >= 2 ? 'win' : 'lose', 8);
      hint.textContent = 'Abgestürzt bei ' + f(crashAt) + '. Dein Einsatz ist weg.';
    }
    function tick() {
      var m = cur();
      if (m >= crashAt) { crashed(); return; }
      num.textContent = f(m); num.className = 'crash' + (m >= 2 ? ' hot' : '');
    }
    btn.addEventListener('click', function () {
      if (!active) {
        var b = betAmount(function (m) { hint.textContent = m; }); if (!b) return;
        bet = b; spend(b); active = true;
        if (isLucky()) {
          /* MEGA LUCK: crash very late, roughly 50×–100× */
          crashAt = Math.round((50 + Math.random() * 50) * 100) / 100;
        } else {
          crashAt = Math.min(1000, Math.max(1, Math.floor(97 / (1 - Math.random())) / 100));
        }
        t0 = Date.now(); btn.textContent = 'Auszahlen'; hint.textContent = 'Der Faktor steigt. Zahle rechtzeitig aus.';
        num.className = 'crash'; num.textContent = f(1);
        clearInterval(tmr); tmr = setInterval(tick, 50);
        if (crashAt <= 1) crashed();
      } else {
        var m = cur();
        if (m >= crashAt) { crashed(); return; }
        var win = Math.floor(bet * m); pay(win);
        end('won'); num.textContent = f(m);
        hint.textContent = 'Ausgezahlt bei ' + f(m) + ': ' + fmtC(win) + ' Chips. Der Absturz kam bei ' + f(crashAt) + '.';
        pushHistory($('#crash-history'), f(crashAt), crashAt >= 2 ? 'win' : 'lose', 8);
      }
    });
  })();

  /* ---------- MÜNZWURF ---------- */
  (function () {
    var coin = $('#coin'), hint = $('#coin-hint'), busy = false;
    $$('#g-muenze [data-side]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (busy) return;
        var pick = btn.dataset.side;
        var b = betAmount(function (m) { hint.textContent = m; }); if (!b) return;
        spend(b); busy = true; hint.textContent = 'Die Münze wirbelt …';
        var res = isLucky() ? pick : (Math.random() < 0.5 ? 'K' : 'Z');
        var n = 0;
        var iv = setInterval(function () {
          n++;
          if (n >= 12) {
            clearInterval(iv); coin.textContent = res;
            var won = res === pick, win = won ? Math.floor(b * 1.95) : 0;
            pay(win);
            pushHistory($('#coin-history'), res === 'K' ? 'Kopf' : 'Zahl', won ? 'win' : 'lose', 10);
            hint.textContent = (res === 'K' ? 'Kopf' : 'Zahl') + (won ? '! Du gewinnst ' + fmtC(win) + ' Chips.' : '. Leider falsch geraten.');
            busy = false;
          } else coin.textContent = n % 2 ? 'Z' : 'K';
        }, 80);
      });
    });
  })();

  /* ---------- 2048 ---------- */
  (function () {
    var boardEl = $('#m-board'), hint = $('#m-hint'), G, score, over, reached;
    function idx(d, k, j) {
      var r, c;
      if (d === 0) { r = k; c = j; } else if (d === 2) { r = k; c = 3 - j; } else if (d === 1) { r = j; c = k; } else { r = 3 - j; c = k; }
      return r * 4 + c;
    }
    function add() {
      var e = [];
      G.forEach(function (v, i) { if (!v) e.push(i); });
      if (e.length) G[e[rnd(e.length)]] = Math.random() < 0.9 ? 2 : 4;
    }
    function slide(a) {
      var f = a.filter(Boolean), o = [], g = 0;
      for (var i = 0; i < f.length; i++) {
        if (f[i] === f[i + 1]) { o.push(f[i] * 2); g += f[i] * 2; i++; } else o.push(f[i]);
      }
      while (o.length < 4) o.push(0);
      return [o, g];
    }
    function render() {
      boardEl.innerHTML = '';
      G.forEach(function (v) {
        var t = document.createElement('div');
        t.className = 'tile' + (v >= 1024 ? ' small' : '');
        if (v) { t.textContent = v; t.style.background = 'hsl(' + ((Math.log(v) / Math.LN2 * 32 + 300) % 360) + ',85%,62%)'; }
        boardEl.appendChild(t);
      });
      $('#m-score').textContent = score;
    }
    function canMove() {
      if (G.indexOf(0) >= 0) return true;
      for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
        var v = G[r * 4 + c];
        if (c < 3 && G[r * 4 + c + 1] === v) return true;
        if (r < 3 && G[(r + 1) * 4 + c] === v) return true;
      }
      return false;
    }
    function move(d) {
      if (over) return;
      var moved = false, gain = 0;
      for (var k = 0; k < 4; k++) {
        var line = [], ids = [];
        for (var j = 0; j < 4; j++) { var id = idx(d, k, j); ids.push(id); line.push(G[id]); }
        var r = slide(line);
        for (var q = 0; q < 4; q++) if (G[ids[q]] !== r[0][q]) { moved = true; G[ids[q]] = r[0][q]; }
        gain += r[1];
      }
      if (!moved) return;
      score += gain; add(); render();
      if (score > best.merge) { best.merge = score; save('merge', score); showBest(); }
      if (!reached && G.indexOf(2048) >= 0) { reached = true; hint.innerHTML = '<strong>2048 erreicht!</strong> Du kannst weiterspielen.'; }
      if (!canMove()) { over = true; hint.innerHTML = '<strong>Keine Züge mehr.</strong> Endstand: ' + score + ' Punkte.'; }
    }
    function newGame() {
      G = []; for (var i = 0; i < 16; i++) G.push(0);
      score = 0; over = false; reached = false; add(); add(); render();
      hint.textContent = 'Schiebe mit Pfeiltasten, WASD oder Wischen. Gleiche Zahlen verschmelzen.';
    }
    document.addEventListener('keydown', function (e) {
      if (current !== 'merge') return;
      var map = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3, a: 0, w: 1, d: 2, s: 3, A: 0, W: 1, D: 2, S: 3 };
      if (!(e.key in map)) return;
      e.preventDefault(); move(map[e.key]);
    });
    var sx = 0, sy = 0;
    boardEl.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    boardEl.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 2 : 0); else move(dy > 0 ? 3 : 1);
    }, { passive: true });
    $('#m-new').addEventListener('click', newGame);
    newGame();
  })();

  /* ---------- FLAPPY ENTE ---------- */
  (function () {
    var cv = $('#f-canvas'), ctx = cv.getContext('2d'), W = 360, H = 480, HALF = 68, PW = 54;
    var state = 'idle', duck, pipes, score, frame, acc, last, raf = null, diedAt = 0;
    function reset() { duck = { y: H / 2, v: 0 }; pipes = []; score = 0; frame = 0; acc = 0; $('#f-score').textContent = '0'; }
    function die() {
      state = 'over'; diedAt = Date.now();
      if (raf) cancelAnimationFrame(raf); raf = null;
      var h = $('#f-hint');
      if (score > best.flug) { best.flug = score; save('flug', score); showBest(); h.innerHTML = '<strong>Neuer Rekord: ' + score + ' Punkte!</strong> Tippe für eine neue Runde.'; }
      else h.textContent = 'Platsch! ' + score + ' Punkte. Tippe für eine neue Runde.';
      draw();
    }
    function step() {
      duck.v += 0.42; duck.y += duck.v; frame++;
      if (frame % 90 === 1) pipes.push({ x: W + 10, g: 130 + rnd(H - 260), p: false });
      pipes.forEach(function (p) { p.x -= 2.4; });
      pipes = pipes.filter(function (p) { return p.x > -PW - 10; });
      if (duck.y < 14 || duck.y > H - 14) { die(); return; }
      for (var i = 0; i < pipes.length; i++) {
        var p = pipes[i];
        if (90 + 12 > p.x && 90 - 12 < p.x + PW && (duck.y - 11 < p.g - HALF || duck.y + 11 > p.g + HALF)) { die(); return; }
        if (!p.p && p.x + PW < 90) { p.p = true; score++; $('#f-score').textContent = score; }
      }
    }
    function loop(ts) {
      if (!last) last = ts;
      acc += Math.min(ts - last, 100); last = ts;
      while (acc >= 16.67 && state === 'play') { step(); acc -= 16.67; }
      draw();
      if (state === 'play') raf = requestAnimationFrame(loop);
    }
    function start() {
      reset(); state = 'play'; last = 0; duck.v = -7;
      $('#f-hint').textContent = 'Flattere durch die Lücken.';
      raf = requestAnimationFrame(loop);
    }
    function input() {
      if (state === 'idle' || (state === 'over' && Date.now() - diedAt > 400)) start();
      else if (state === 'play') duck.v = -7;
    }
    function draw() {
      ctx.fillStyle = cssv('--deep'); ctx.fillRect(0, 0, W, H);
      var green = cssv('--green');
      pipes.forEach(function (p) {
        ctx.fillStyle = green;
        ctx.fillRect(p.x, 0, PW, p.g - HALF); ctx.fillRect(p.x, p.g + HALF, PW, H - p.g - HALF);
        ctx.fillRect(p.x - 4, p.g - HALF - 14, PW + 8, 14); ctx.fillRect(p.x - 4, p.g + HALF, PW + 8, 14);
      });
      ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(90, duck.y, 13, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.moveTo(101, duck.y - 3); ctx.lineTo(113, duck.y + 1); ctx.lineTo(101, duck.y + 5); ctx.fill();
      ctx.fillStyle = '#10091a'; ctx.beginPath(); ctx.arc(94, duck.y - 4, 2.2, 0, 6.283); ctx.fill();
      ctx.fillStyle = cssv('--fg'); ctx.font = '700 40px Silkscreen, monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(score), W / 2, 60);
      if (state !== 'play') {
        ctx.font = '700 20px Silkscreen, monospace'; ctx.fillStyle = cssv('--yellow');
        ctx.fillText(state === 'idle' ? 'TIPPEN ZUM START' : 'GAME OVER', W / 2, H / 2 + 80);
      }
    }
    stoppers.flug = function () { if (state === 'play') { state = 'idle'; if (raf) cancelAnimationFrame(raf); raf = null; reset(); draw(); $('#f-hint').textContent = 'Tippe, klicke oder drücke die Leertaste, um zu flattern.'; } };
    cv.addEventListener('pointerdown', function (e) { e.preventDefault(); input(); });
    document.addEventListener('keydown', function (e) {
      if (current !== 'flug') return;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); input(); }
    });
    window.addEventListener('pk-skin', function () { if (state !== 'play') draw(); });
    reset(); draw();
  })();

  /* ---------- TIC-TAC-TOE ---------- */
  (function () {
    var L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    var boardEl = $('#t-board'), hint = $('#t-hint'), lvl = $('#t-level');
    var B, over, line, tally = { w: load('ttt_w', 0), d: load('ttt_d', 0), l: load('ttt_l', 0) };
    function result(b) {
      for (var i = 0; i < L.length; i++) { var a = L[i]; if (b[a[0]] && b[a[0]] === b[a[1]] && b[a[1]] === b[a[2]]) return { w: b[a[0]], line: a }; }
      return b.indexOf('') < 0 ? { w: 'D' } : null;
    }
    function mm(b, turn) {
      var r = result(b);
      if (r) return r.w === 'O' ? 1 : r.w === 'X' ? -1 : 0;
      var bs = turn === 'O' ? -2 : 2;
      for (var i = 0; i < 9; i++) if (!b[i]) {
        b[i] = turn; var s = mm(b, turn === 'O' ? 'X' : 'O'); b[i] = '';
        bs = turn === 'O' ? Math.max(bs, s) : Math.min(bs, s);
      }
      return bs;
    }
    function ai() {
      var emp = [];
      for (var i = 0; i < 9; i++) if (!B[i]) emp.push(i);
      if (lvl.value === 'leicht' && Math.random() < 0.55) return emp[rnd(emp.length)];
      var bs = -2, mv = [];
      emp.forEach(function (i) {
        B[i] = 'O'; var s = mm(B, 'X'); B[i] = '';
        if (s > bs) { bs = s; mv = [i]; } else if (s === bs) mv.push(i);
      });
      return mv[rnd(mv.length)];
    }
    function stats() {
      $('#t-w').textContent = tally.w; $('#t-d').textContent = tally.d; $('#t-l').textContent = tally.l;
      $('[data-best="tictactoe"]').textContent = tally.w + ' Siege';
    }
    function render() {
      boardEl.innerHTML = '';
      B.forEach(function (v, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'cell' + (v === 'X' ? ' x' : v === 'O' ? ' o' : '') + (line && line.indexOf(i) >= 0 ? ' hit' : '');
        b.textContent = v; b.disabled = over || !!v; b.setAttribute('aria-label', 'Feld ' + (i + 1));
        b.addEventListener('click', function () { play(i); });
        boardEl.appendChild(b);
      });
    }
    function end() {
      var r = result(B); if (!r) return false;
      over = true; line = r.line || null;
      if (r.w === 'X') { tally.w++; save('ttt_w', tally.w); hint.innerHTML = '<strong>Du hast gewonnen!</strong>'; }
      else if (r.w === 'O') { tally.l++; save('ttt_l', tally.l); hint.textContent = 'Der Computer gewinnt.'; }
      else { tally.d++; save('ttt_d', tally.d); hint.textContent = 'Unentschieden.'; }
      stats(); return true;
    }
    function play(i) {
      if (over || B[i]) return;
      B[i] = 'X';
      if (!end()) { B[ai()] = 'O'; end(); }
      render();
    }
    function reset() { B = ['', '', '', '', '', '', '', '', '']; over = false; line = null; hint.textContent = 'Du spielst X und beginnst.'; render(); stats(); }
    $('#t-new').addEventListener('click', reset);
    reset();
  })();

  /* ---------- ENTENRENNEN ---------- */
  (function () {
    var NAMES = ['Quaki', 'Paddel-Paul', 'Frau Federn', 'Schnabel-Sepp', 'Flossi'];
    var COL = ['#ffe14d', '#ff9a3d', '#ff7ac7', '#7affc9', '#b9a3ff'];
    var track = $('#duck-track'), hint = $('#duck-hint'), go = $('#duck-go');
    var odds = [], probs = [], sel = -1, running = false, picks = [], ducks = [], raceRaf = null;
    function svg(c) {
      return '<svg class="duck" viewBox="0 0 40 32" aria-hidden="true"><ellipse cx="17" cy="21" rx="14" ry="9" fill="' + c + '"/><circle cx="28" cy="11" r="7" fill="' + c + '"/><polygon points="33,9 40,12 33,15" fill="#ff8a1f"/><circle cx="29.5" cy="9" r="1.4" fill="#10091a"/><ellipse cx="14" cy="21" rx="7" ry="4" fill="rgba(0,0,0,0.2)"/></svg>';
    }
    NAMES.forEach(function (n, i) {
      var lane = document.createElement('div'); lane.className = 'lane';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pick'; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<span><b>' + (i + 1) + '</b> ' + n + '</span><em></em>';
      b.addEventListener('click', function () {
        if (running) return;
        sel = i; picks.forEach(function (p, j) { p.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
        hint.textContent = n + ' ist dein Tipp mit Quote ' + fm(odds[i]) + '.';
      });
      var w = document.createElement('div'); w.className = 'water'; w.innerHTML = svg(COL[i]);
      lane.appendChild(b); lane.appendChild(w); track.appendChild(lane);
      picks.push(b); ducks.push(w.firstChild);
    });
    function newOdds() {
      var w = NAMES.map(function () { return 0.6 + Math.random() * 1.4; });
      var s = w.reduce(function (a, b) { return a + b; }, 0);
      probs = w.map(function (x) { return x / s; });
      odds = probs.map(function (p) { return Math.max(1.3, Math.round(0.9 / p * 10) / 10); });
      picks.forEach(function (b, i) { b.querySelector('em').textContent = fm(odds[i]); });
    }
    function place(i, p) { ducks[i].style.left = 'calc(' + (p * 100) + '% - ' + (p * 44) + 'px)'; }
    go.addEventListener('click', function () {
      if (running) return;
      if (sel < 0) { hint.textContent = 'Tippe zuerst auf deine Ente.'; return; }
      var b = betAmount(function (m) { hint.textContent = m; }); if (!b) return;
      spend(b); running = true; go.disabled = true; hint.textContent = 'Und sie schwimmen …';
      var r = Math.random(), acc = 0, win = 0;
      if (isLucky()) {
        win = sel; /* chosen duck always boosted to win */
      } else {
        for (var i = 0; i < probs.length; i++) { acc += probs[i]; if (r <= acc) { win = i; break; } win = i; }
      }
      var T = [], A = [], PH = [], maxT = 0, mine = sel, o = odds[mine];
      for (var d = 0; d < NAMES.length; d++) {
        T[d] = d === win ? 6.5 : 6.5 + 0.35 + Math.random() * 1.6;
        A[d] = 2.5 + Math.random() * 2.5; PH[d] = Math.random() * 6.28; maxT = Math.max(maxT, T[d]); place(d, 0);
      }
      var prev = NAMES.map(function () { return 0; }), t0 = performance.now();
      (function frame(now) {
        var t = (now - t0) / 1000;
        for (var d2 = 0; d2 < NAMES.length; d2++) {
          var base = Math.min(1, t / T[d2]);
          var p = Math.min(1, Math.max(prev[d2], base + 0.03 * Math.sin(t * A[d2] + PH[d2]) * (1 - base)));
          prev[d2] = p; place(d2, p);
        }
        if (t < maxT) { raceRaf = requestAnimationFrame(frame); return; }
        var won = mine === win, pay_ = won ? Math.floor(b * o) : 0;
        pay(pay_);
        pushHistory($('#duck-history'), NAMES[win], won ? 'win' : 'lose', 8);
        hint.textContent = 'Sieger: ' + NAMES[win] + '. ' + (won ? 'Du gewinnst ' + fmtC(pay_) + ' Chips (' + fm(o) + ').' : 'Deine Ente war leider nicht vorn.');
        raceRaf = null; running = false; go.disabled = false; newOdds();
      })(performance.now());
    });
    stoppers.entenrennen = function () {
      if (raceRaf !== null) cancelAnimationFrame(raceRaf);
      raceRaf = null;
      if (running) { running = false; go.disabled = false; hint.textContent = 'Rennen abgebrochen. Du kannst ein neues Rennen starten.'; }
    };
    newOdds();
  })();

  /* ---------- PLINKO ---------- */
  (function () {
    var cv = $('#p-canvas'), ctx = cv.getContext('2d'), W = 360, H = 400, ROWS = 8, DX = 40, Y0 = 60, DY = 36, SEG = 140;
    var MULT = [10, 3, 1.4, 0.6, 0.4, 0.6, 1.4, 3, 10], balls = [], raf = null;
    function px(r, k) { return 180 + (2 * k - r) * DX / 2; }
    function py(r) { return Y0 + r * DY; }
    function draw() {
      var deep = cssv('--deep'), line = cssv('--line'), fg = cssv('--fg'), pink = cssv('--pink'), cy = cssv('--cyan'), ye = cssv('--yellow'), ink = cssv('--ink');
      ctx.fillStyle = deep; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = cssv('--mute');
      for (var r = 0; r < ROWS; r++) for (var k = 0; k <= r; k++) { ctx.beginPath(); ctx.arc(px(r, k), py(r), 3.5, 0, 6.283); ctx.fill(); }
      ctx.textAlign = 'center'; ctx.font = '700 13px "Space Grotesk", sans-serif';
      for (var b = 0; b <= ROWS; b++) {
        var m = MULT[b], x = px(ROWS, b);
        ctx.fillStyle = m >= 3 ? pink : m >= 1 ? cy : line;
        ctx.fillRect(x - 18, py(ROWS) - 14, 36, 32);
        ctx.fillStyle = m >= 1 ? ink : fg;
        ctx.fillText(String(m).replace('.', ','), x, py(ROWS) + 6);
      }
      ctx.fillStyle = ye;
      balls.forEach(function (ball) { var p = pos(ball); ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.283); ctx.fill(); });
    }
    function pos(ball) {
      var e = performance.now() - ball.t0, s = Math.min(Math.floor(e / SEG), ball.pts.length - 2);
      var f = Math.min(1, (e - s * SEG) / SEG), a = ball.pts[s], c = ball.pts[s + 1];
      return { x: a.x + (c.x - a.x) * f, y: a.y + (c.y - a.y) * f * f };
    }
    function loop() {
      var now = performance.now(), keep = [];
      balls.forEach(function (ball) {
        if (now - ball.t0 >= (ball.pts.length - 1) * SEG) land(ball); else keep.push(ball);
      });
      balls = keep; $('#p-live').textContent = balls.length; draw();
      raf = balls.length ? requestAnimationFrame(loop) : null;
    }
    function land(ball) {
      var m = MULT[ball.k], win = Math.floor(ball.bet * m);
      pay(win);
      pushHistory($('#p-history'), fm(m), m >= 1 ? 'win' : 'lose', 10);
      $('#p-hint').textContent = 'Landung bei ' + fm(m) + ': ' + (win ? fmtC(win) + ' Chips zurück.' : 'nichts zurück.');
    }
    $('#p-drop').addEventListener('click', function () {
      var b = betAmount(function (m) { $('#p-hint').textContent = m; }); if (!b) return;
      spend(b);
      var pts = [{ x: 180, y: 20 }, { x: px(0, 0), y: py(0) }], k = 0;
      /* Subtle edge bias under luck (~62% toward one side, still looks natural) */
      var side = Math.random() < 0.5 ? 0 : 1;
      for (var r = 0; r < ROWS; r++) {
        if (isLucky()) {
          k += (Math.random() < 0.62 ? side : 1 - side);
        } else {
          k += rnd(2);
        }
        pts.push({ x: px(r + 1, k), y: py(r + 1) });
      }
      balls.push({ bet: b, k: k, pts: pts, t0: performance.now() });
      if (!raf) raf = requestAnimationFrame(loop);
    });
    window.addEventListener('pk-skin', function () { draw(); });
    draw();
  })();

  /* ---------- MINEN ---------- */
  (function () {
    var grid = $('#mn-grid'), hint = $('#mn-hint'), bStart = $('#mn-start'), bCash = $('#mn-cash'), cnt = $('#mn-count'), mEl = $('#mn-mult');
    var cells = [], mines = [], active = false, k = 0, m = 3, bet = 0;
    function mult(n) {
      var x = 0.97;
      for (var i = 0; i < n; i++) x *= (25 - i) / (25 - m - i);
      /* Cap so payouts stay sane (was exploding to millions) */
      return Math.min(25, Math.max(1, x));
    }
    for (var i = 0; i < 25; i++) (function (i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'mcell'; b.disabled = true; b.setAttribute('aria-label', 'Feld ' + (i + 1));
      b.addEventListener('click', function () { reveal(i); });
      grid.appendChild(b); cells.push(b);
    })(i);
    function update() {
      mEl.textContent = fm(mult(k));
      bCash.disabled = !active || k === 0;
      bCash.textContent = k ? 'Auszahlen ' + fmtC(Math.floor(bet * mult(k))) : 'Auszahlen';
    }
    function finish() {
      active = false; cnt.disabled = false; bStart.disabled = false;
      cells.forEach(function (c, i) {
        c.disabled = true;
        if (!c.classList.contains('gem') && !c.classList.contains('bomb')) {
          c.className = 'mcell dim ' + (mines[i] ? 'bomb' : 'gem'); c.textContent = mines[i] ? '✖' : '◆';
        }
      });
    }
    function cash() {
      var win = Math.floor(bet * mult(k)); pay(win);
      hint.innerHTML = '<strong>Ausgezahlt: ' + fmtC(win) + ' Chips bei ' + fm(mult(k)) + '.</strong>';
      finish(); update();
    }
    function reveal(i) {
      if (!active || cells[i].disabled) return;
      cells[i].disabled = true;
      /* MEGA LUCK: never hit a mine on click */
      if (mines[i] && isLucky()) mines[i] = false;
      if (mines[i]) {
        cells[i].className = 'mcell bomb'; cells[i].textContent = '✖';
        hint.textContent = 'Boom! Das war eine Mine. Der Einsatz ist weg.';
        k = 0; finish(); mEl.textContent = '×1'; bCash.textContent = 'Auszahlen'; bCash.disabled = true;
        return;
      }
      cells[i].className = 'mcell gem'; cells[i].textContent = '◆'; k++;
      if (k === 25 - m) { cash(); return; }
      hint.textContent = 'Sicher! Nächster Treffer: ' + fm(mult(k + 1)) + '. Weiter oder auszahlen?';
      update();
    }
    bStart.addEventListener('click', function () {
      if (active) return;
      var b = betAmount(function (t) { hint.textContent = t; }); if (!b) return;
      spend(b); bet = b; m = parseInt(cnt.value, 10); k = 0; active = true;
      mines = []; for (var i = 0; i < 25; i++) mines.push(false);
      var placed = 0; while (placed < m) { var r = rnd(25); if (!mines[r]) { mines[r] = true; placed++; } }
      cells.forEach(function (c) { c.className = 'mcell'; c.textContent = ''; c.disabled = false; });
      cnt.disabled = true; bStart.disabled = true;
      hint.textContent = 'Finde die Edelsteine. ' + m + ' Minen sind versteckt.'; update();
    });
    bCash.addEventListener('click', function () { if (active && k > 0) cash(); });
  })();

  /* ---------- RUBBELLOS ---------- */
  (function () {
    var SYM = [['●', '#b58cff', 2, 100], ['▲', '#4dff9a', 3, 50], ['◆', '#3df0ff', 5, 25], ['★', '#ffe14d', 10, 8], ['♥', '#ff5468', 25, 2], ['7', '#ff3d9a', 100, 0.5]];
    var grid = $('#rb-grid'), hint = $('#rb-hint'), bBuy = $('#rb-buy'), bAll = $('#rb-all'), ticket = null, els = [];
    function shuffleInPlace(arr) {
      for (var j = arr.length - 1; j > 0; j--) { var q = rnd(j + 1), t = arr[j]; arr[j] = arr[q]; arr[q] = t; }
      return arr;
    }
    function gen() {
      var cells = [], cnt = [0, 0, 0, 0, 0, 0], tier = -1;
      var lucky = false;
      try {
        var L = window.__nexoraLuck;
        lucky = !!(L && L.until > Date.now() && L.power > 1);
      } catch (e) {}
      /* With MEGA LUCK: almost only triple 7s */
      if (lucky && Math.random() < 0.92) {
        tier = 5; /* 7 */
        cells = [5, 5, 5];
        cnt[5] = 3;
        while (cells.length < 6) {
          var c = rnd(5); /* fillers: never another 7 pair path */
          if (cnt[c] < 2) { cnt[c]++; cells.push(c); }
        }
        shuffleInPlace(cells);
        return { cells: cells, tier: tier, opened: [false, false, false, false, false, false], settled: false, bet: 0 };
      }
      if (Math.random() < 0.25) {
        var tw = SYM.reduce(function (a, s) { return a + s[3]; }, 0), r = Math.random() * tw, acc = 0;
        for (var i = 0; i < SYM.length; i++) { acc += SYM[i][3]; if (r <= acc) { tier = i; break; } }
        if (tier < 0) tier = 0;
        cells = [tier, tier, tier]; cnt[tier] = 3;
      }
      while (cells.length < 6) {
        var c2 = rnd(6);
        if (cnt[c2] < 2) { cnt[c2]++; cells.push(c2); }
      }
      shuffleInPlace(cells);
      return { cells: cells, tier: tier, opened: [false, false, false, false, false, false], settled: false, bet: 0 };
    }
    for (var n = 0; n < 6; n++) (function (n) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sc'; b.disabled = true; b.setAttribute('aria-label', 'Rubbelfeld ' + (n + 1));
      b.addEventListener('click', function () { open(n); });
      grid.appendChild(b); els.push(b);
    })(n);
    function open(n) {
      if (!ticket || ticket.settled || ticket.opened[n]) return;
      ticket.opened[n] = true;
      var s = SYM[ticket.cells[n]];
      els[n].className = 'sc open'; els[n].style.setProperty('--c', s[1]); els[n].textContent = s[0]; els[n].disabled = true;
      if (ticket.opened.every(Boolean)) settle();
    }
    function settle() {
      ticket.settled = true; bBuy.disabled = false; bAll.disabled = true;
      var win = 0;
      if (ticket.tier >= 0) {
        win = Math.floor(ticket.bet * SYM[ticket.tier][2]); pay(win);
        ticket.cells.forEach(function (c, i) { if (c === ticket.tier) els[i].classList.add('hit'); });
        hint.innerHTML = '<strong>Dreimal ' + SYM[ticket.tier][0] + '! Du gewinnst ' + fmtC(win) + ' Chips (' + fm(SYM[ticket.tier][2]) + ').</strong>';
      } else hint.textContent = 'Kein Dreier. Das nächste Los gewinnt vielleicht.';
      $('#rb-last').textContent = fmtC(win);
    }
    function openAll() { if (ticket && !ticket.settled) for (var i = 0; i < 6; i++) open(i); }
    bBuy.addEventListener('click', function () {
      if (ticket && !ticket.settled) return;
      var b = betAmount(function (t) { hint.textContent = t; }); if (!b) return;
      spend(b); ticket = gen(); ticket.bet = b;
      els.forEach(function (e) { e.className = 'sc'; e.textContent = ''; e.disabled = false; });
      bBuy.disabled = true; bAll.disabled = false; hint.textContent = 'Tippe auf die Felder, um sie aufzurubbeln.';
    });
    bAll.addEventListener('click', openAll);
    stoppers.rubbel = openAll;
  })();


  /* ---------- DRAGON TOWER ---------- */
  (function(){
    var floor=0,dragon=[],stake=0,mult=1,active=false,stepMult=[1.22,1.52,1.9,2.38,2.98,3.74,4.7,5.9,7.4,9.3];
    var levels=$$('#dt-levels .tower-level'),doors=$$('#dt-levels .tower-door');
    function render(){
      $('#dt-floor').textContent=floor+' / 10';$('#dt-mult').textContent='×'+mult.toFixed(2);
      levels.forEach(function(level,i){level.classList.toggle('current',active&&i===floor);level.classList.toggle('done',i<floor);level.classList.toggle('locked',i>floor);level.querySelector('.tower-level-state').textContent=i<floor?'CLEARED':(active&&i===floor?'CHOOSE':'LOCKED');level.querySelectorAll('.tower-door').forEach(function(b){b.disabled=!(active&&i===floor);});});
      $('#dt-cash').disabled=!active||floor===0;$('#dt-start').disabled=active;
    }
    function resetDoors(){doors.forEach(function(b){b.textContent='';b.className='tower-door';});}
    $('#dt-start').onclick=function(){var b=betAmount(function(t){$('#dt-hint').textContent=t;});if(!b)return;var oldAlert=$('#g-dragon .dt-dragon-alert');if(oldAlert)oldAlert.remove();$('#g-dragon').classList.remove('dragon-hit');spend(b);stake=b;floor=0;mult=1;active=true;dragon=Array.from({length:10},function(){return -1;});resetDoors();$('#dt-status').textContent='Choose a door on Floor 1';$('#dt-hint').textContent='All ten floors are visible. Choose one door on the highlighted floor.';render();};
    doors.forEach(function(btn){btn.onclick=function(){if(!active||+btn.dataset.floor!==floor)return;var f=floor,pick=+btn.dataset.door,group=levels[f].querySelectorAll('.tower-door');group.forEach(function(x){x.disabled=true;});
      /* Dragon position is rolled only when you click — with MEGA LUCK never on your door */
      var isDragon = isLucky() ? false : (Math.random() < 0.25);
      var dragonDoor = isDragon ? pick : (pick + 1 + Math.floor(Math.random() * 3)) % 4;
      dragon[f] = dragonDoor;
      if(pick===dragon[f]){btn.textContent='';btn.classList.add('dragon');active=false;$('#dt-status').textContent='The dragon caught you';$('#dt-hint').textContent='Run over. Your virtual-chip stake was lost.';render();var tower=$('#g-dragon');tower.classList.remove('dragon-hit');void tower.offsetWidth;tower.classList.add('dragon-hit');var alert=document.createElement('div');alert.className='dt-dragon-alert';alert.setAttribute('role','alert');alert.innerHTML='<div class="dt-dragon-card"><span class="dt-dragon-emoji" aria-hidden="true">🐉</span><div class="dt-dragon-title">DRAGON FOUND YOU!</div><p class="dt-dragon-sub">Run over — the tower has defeated you.</p></div>';tower.appendChild(alert);window.setTimeout(function(){if(alert.parentNode){alert.classList.add('dt-alert-out');window.setTimeout(function(){if(alert.parentNode)alert.remove();},220);}tower.classList.remove('dragon-hit');},1000);return;}btn.textContent='';btn.classList.add('safe');floor++;mult=stepMult[f];if(floor>=10){active=false;pay(Math.floor(stake*mult));$('#dt-status').textContent='Tower cleared!';$('#dt-hint').textContent='All ten floors cleared. Payout: '+fmtC(Math.floor(stake*mult))+' chips.';}else{$('#dt-status').textContent='Floor '+floor+' cleared';$('#dt-hint').textContent='Choose a door on the next highlighted floor, or cash out.';}render();};});
    $('#dt-cash').onclick=function(){if(!active||floor===0)return;var win=Math.floor(stake*mult);active=false;pay(win);$('#dt-status').textContent='Cashed out';$('#dt-hint').textContent='You secured '+fmtC(win)+' chips.';render();};
    stoppers.dragon=function(){};render();
  })();

  /* ---------- EINSTELLUNGEN ---------- */
  (function () {
    var DEF = { effect: 'snow', skin: 'neon', font: 'pixel', size: '1', accent: '', round: 'eckig', grid: 'an', fx: 'an', glass: 'aus', contrast: 'normal', motion: 'an', border: 'normal', language: 'de', cursor: 'default', cursorImage: '', snow: 'an', compact: 'aus', animations: 'an', glow: 'an', particles: 'an' };
    var cfg = {}, k0;
    for (k0 in DEF) cfg[k0] = DEF[k0];
    try {
      var raw = localStorage.getItem('labtoso-games:nexora:settings');
      if (raw) { var o = JSON.parse(raw); for (k0 in DEF) if (typeof o[k0] === 'string') cfg[k0] = o[k0]; }
    } catch (e) {}
    var OPTS = [
      { k: 'skin', l: 'Farbwelt', o: [['neon', 'Neon'], ['terminal', 'Terminal'], ['sunset', 'Sunset'], ['ocean', 'Ocean'], ['matrix', 'Matrix'], ['midnight', 'Midnight'], ['lavender', 'Lavender'], ['ember', 'Ember'], ['papier', 'Hell'], ['cloud', 'Cloud White'], ['pearl', 'Pearl'], ['sakura', 'Sakura'], ['mint', 'Mint'], ['ice', 'Ice Blue']] },
      { k: 'font', l: 'Schriftart', o: [['pixel', 'Pixel'], ['modern', 'Modern'], ['mono', 'Monospace'], ['serif', 'Serif'], ['rund', 'Rund']] },
      { k: 'size', l: 'Schriftgröße', o: [['0.9', 'Klein'], ['1', 'Normal'], ['1.15', 'Groß'], ['1.3', 'Sehr groß']] },
      { k: 'accent', l: 'Akzentfarbe', swatch: true, o: [['', 'Standard'], ['#ff3d9a', 'Pink'], ['#3df0ff', 'Cyan'], ['#ffe14d', 'Gelb'], ['#4dff9a', 'Grün'], ['#b58cff', 'Lila']] },
      { k: 'round', l: 'Ecken', o: [['eckig', 'Eckig'], ['rund', 'Rund']] },
      { k: 'grid', l: 'Hintergrundraster', o: [['an', 'An'], ['aus', 'Aus']] },
      { k: 'fx', l: 'Leuchten und Schatten', o: [['an', 'An'], ['aus', 'Aus']] },
      { k: 'glass', l: 'Glass-Effekt', o: [['aus', 'Aus'], ['an', 'An']] },
      { k: 'contrast', l: 'Kontrast', o: [['normal', 'Normal'], ['hoch', 'Hoch']] },
      { k: 'motion', l: 'Bewegungen', o: [['an', 'An'], ['aus', 'Reduziert']] },
      { k: 'border', l: 'Rahmen', o: [['normal', 'Normal'], ['stark', 'Extra stark']] },
      { k: 'effect', l: 'Background effect', o: [['none','None'],['snow','Snow'],['stars','Starfield'],['aurora','Aurora'],['embers','Embers'],['bubbles','Bubbles']] },

      { k: 'compact', l: 'Kompakter Modus', o: [['aus','Aus'],['an','An']] },
      { k: 'animations', l: 'Zusätzliche Animationen', o: [['an','An'],['aus','Aus']] },
      { k: 'glow', l: 'Glow-Effekte', o: [['an','An'],['aus','Aus']] },
      { k: 'particles', l: 'Snow', o: [['an','An'],['aus','Aus']] },
    ];
    function lum(h) { var n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; }
    function apply() {
      var r = document.documentElement;
      r.setAttribute('data-skin', cfg.skin); r.setAttribute('data-font', cfg.font); r.setAttribute('data-round', cfg.round);
      r.setAttribute('data-grid', cfg.grid); r.setAttribute('data-fx', cfg.fx);
      document.body.setAttribute('data-cursor', cfg.cursor || 'default');
      if(cfg.cursorImage){r.style.setProperty('--custom-cursor','url(\"'+cfg.cursorImage+'\") 4 4');}else{r.style.removeProperty('--custom-cursor');}
      r.setAttribute('data-compact',cfg.compact); r.setAttribute('data-glow',cfg.glow); r.setAttribute('data-particles',cfg.particles); r.setAttribute('data-snow',cfg.snow); r.setAttribute('data-animations',cfg.animations);
      r.setAttribute('data-glass', cfg.glass); r.setAttribute('data-contrast', cfg.contrast); r.setAttribute('data-motion', cfg.motion); r.setAttribute('data-border', cfg.border);
      r.style.setProperty('--fs', cfg.size);
      if (cfg.accent) { r.style.setProperty('--pink', cfg.accent); r.style.setProperty('--ink', lum(cfg.accent) > 0.45 ? '#14061a' : '#ffffff'); }
      else { r.style.removeProperty('--pink'); r.style.removeProperty('--ink'); }
      window.dispatchEvent(new Event('pk-skin'));
    }
    function persist() { try { localStorage.setItem('labtoso-games:nexora:settings', JSON.stringify(cfg)); } catch (e) {} }
    var panel = $('#settings'), content = $('#settings-content'), sbtn = $('#settings-btn'), closeBtn = $('#settings-close');
    panel.hidden = true; panel.style.display = 'none';
    function sync() {
      $$('#settings .seg button').forEach(function (b) { if(b.dataset.switch==='true'){var on=cfg[b.dataset.k]==='an';b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-checked',String(on));b.dataset.state=on?'An':'Aus';b.title=on?'Eingeschaltet':'Ausgeschaltet';}else{b.setAttribute('aria-pressed', cfg[b.dataset.k] === b.dataset.v ? 'true' : 'false');} });
    }
    OPTS.forEach(function (op, opIndex) {

      var row = document.createElement('div'); row.className = 'srow'; row.style.setProperty('--row-index', opIndex);
      var lab = document.createElement('span'); lab.textContent = op.l;
      var seg = document.createElement('div'); seg.className = 'seg';
      var isToggle = op.o.length === 2 && op.o.every(function(x){ return x[0] === 'an' || x[0] === 'aus'; });
      if (isToggle) {
        row.dataset.toggleRow = 'true';
        var b = document.createElement('button'); b.type='button'; b.dataset.k=op.k; b.dataset.switch='true'; b.setAttribute('role','switch'); b.setAttribute('aria-label',op.l); b.setAttribute('aria-checked',cfg[op.k]==='an'?'true':'false'); b.setAttribute('aria-pressed',cfg[op.k]==='an'?'true':'false'); b.title=cfg[op.k]==='an'?'Eingeschaltet':'Ausgeschaltet';
        b.addEventListener('click',function(){cfg[op.k]=cfg[op.k]==='an'?'aus':'an';persist();apply();sync();}); seg.appendChild(b);
      } else {
        row.dataset.choiceRow='true';
        op.o.forEach(function (p) {
          var b = document.createElement('button'); b.type = 'button'; b.dataset.k = op.k; b.dataset.v = p[0];
          if(op.k==='skin'){b.className='theme-choice';var light=['papier','cloud','pearl','sakura','mint','ice'].indexOf(p[0])>=0; b.style.setProperty('--preview',({neon:'linear-gradient(90deg,#ff3d9a,#3df0ff)',terminal:'#33ff77',sunset:'linear-gradient(90deg,#ff6a3d,#ffc857)',papier:'linear-gradient(90deg,#d4135f,#0a6f93)',ocean:'linear-gradient(90deg,#00d9ff,#70ffe1)',matrix:'#35ff55',midnight:'linear-gradient(90deg,#7295ff,#70e1ff)',lavender:'linear-gradient(90deg,#e58cff,#8ce7ff)',ember:'linear-gradient(90deg,#ff7043,#ffc078)',cloud:'linear-gradient(90deg,#637ff4,#45b9c9)',pearl:'linear-gradient(90deg,#c77c91,#72aeb1)',sakura:'linear-gradient(90deg,#e47da7,#78bfc7)',mint:'linear-gradient(90deg,#48a98b,#55b8c4)',ice:'linear-gradient(90deg,#668de0,#4cb9d0)'})[p[0]]); b.dataset.group=light?'light':'dark';}
          if(op.k==='font') b.className='font-choice';
          if (op.swatch) { var dot = document.createElement('i'); dot.className = 'dot'; if (p[0]) dot.style.setProperty('--c', p[0]); b.appendChild(dot); }
          b.dataset.originalLabel = p[1]; b.appendChild(document.createTextNode(p[1]));
          b.addEventListener('click', function () { cfg[op.k] = p[0]; persist(); apply(); sync(); });
          seg.appendChild(b);
        });
      }
      row.appendChild(lab); row.appendChild(seg); content.appendChild(row);
      if(op.k==='skin'){
        var darkTitle=document.createElement('div');darkTitle.className='theme-group-title';darkTitle.textContent='Dunkle Themes';seg.insertBefore(darkTitle,seg.querySelector('[data-group="dark"]'));
        var lightTitle=document.createElement('div');lightTitle.className='theme-group-title';lightTitle.textContent='Helle Themes';lightTitle.dataset.groupTitle='light';seg.insertBefore(lightTitle,seg.querySelector('[data-group="light"]'));
      }
      if(op.k==='font') {var ft=document.createElement('div');ft.className='theme-group-title';ft.textContent='Schrift-Vorschau';row.insertBefore(ft,seg);}

    });

    /* Language and cursor controls */
    var langTitle=document.createElement('h3');langTitle.className='settings-section-title';langTitle.textContent='Language / Sprache';content.appendChild(langTitle);
    var langRow=document.createElement('div');langRow.className='srow';var langLab=document.createElement('span');langLab.textContent='Sprache / Language';
    var langSel=document.createElement('select');langSel.className='settings-select';langSel.style.maxWidth='220px';
    [['de','Deutsch'],['en','English'],['fr','Français'],['es','Español'],['it','Italiano']].forEach(function(x){var o=document.createElement('option');o.value=x[0];o.textContent=x[1];langSel.appendChild(o)});
    langSel.value=cfg.language||'de';langSel.addEventListener('change',function(){cfg.language=langSel.value;persist();try{location.reload()}catch(e){applyLanguage()}});langRow.appendChild(langLab);langRow.appendChild(langSel);content.appendChild(langRow);
    function applyLanguage(){
      var en=cfg.language==='en', fr=cfg.language==='fr', es=cfg.language==='es', it=cfg.language==='it';
      var dict={
        'LOOK & FEEL':en?'LOOK & FEEL':fr?'APPARENCE':es?'ASPECTO':it?'ASPETTO':'LOOK & FEEL',
        'Mach NEXORA zu deinem eigenen Casino-Spot.':en?'Make NEXORA your own arcade space.':fr?'Personnalisez votre espace NEXORA.':es?'Personaliza tu espacio NEXORA.':it?'Personalizza il tuo spazio NEXORA.':'Mach NEXORA zu deinem eigenen Casino-Spot.',
        'Farbwelt':en?'Theme':fr?'Thème':es?'Tema':it?'Tema':'Farbwelt','Dunkle Themes':en?'Dark themes':fr?'Thèmes sombres':es?'Temas oscuros':it?'Temi scuri':'Dunkle Themes','Helle Themes':en?'Light themes':fr?'Thèmes clairs':es?'Temas claros':it?'Temi chiari':'Helle Themes',
        'Schriftart':en?'Font':fr?'Police':es?'Tipografía':it?'Carattere':'Schriftart','Schriftgröße':en?'Font size':fr?'Taille du texte':es?'Tamaño de fuente':it?'Dimensione carattere':'Schriftgröße','Akzentfarbe':en?'Accent color':fr?'Couleur d’accent':es?'Color de acento':it?'Colore accento':'Akzentfarbe',
        'Ecken':en?'Corners':fr?'Coins':es?'Esquinas':it?'Angoli':'Ecken','Hintergrundraster':en?'Background grid':fr?'Grille de fond':es?'Cuadrícula de fondo':it?'Griglia sfondo':'Hintergrundraster','Leuchten und Schatten':en?'Glow and shadows':fr?'Lueurs et ombres':es?'Brillos y sombras':it?'Bagliori e ombre':'Leuchten und Schatten','Glass-Effekt':en?'Glass effect':fr?'Effet verre':es?'Efecto cristal':it?'Effetto vetro':'Glass-Effekt','Kontrast':en?'Contrast':fr?'Contraste':es?'Contraste':it?'Contrasto':'Kontrast','Bewegungen':en?'Motion':fr?'Mouvement':es?'Movimiento':it?'Movimento':'Bewegungen','Rahmen':en?'Borders':fr?'Bordures':es?'Bordes':it?'Bordi':'Rahmen',
        'Schneefall im Hintergrund':en?'Background snowfall':fr?'Neige en arrière-plan':es?'Nieve de fondo':it?'Neve sullo sfondo':'Schneefall im Hintergrund','Soundeffekte':en?'Sound effects':fr?'Effets sonores':es?'Efectos de sonido':it?'Effetti sonori':'Soundeffekte','Kompakter Modus':en?'Compact mode':fr?'Mode compact':es?'Modo compacto':it?'Modalità compatta':'Kompakter Modus','Zusätzliche Animationen':en?'Extra animations':fr?'Animations supplémentaires':es?'Animaciones extra':it?'Animazioni extra':'Zusätzliche Animationen','Glow-Effekte':en?'Glow effects':fr?'Effets lumineux':es?'Efectos de brillo':it?'Effetti luminosi':'Glow-Effekte','Hintergrund-Partikel':en?'Background particles':fr?'Particules de fond':es?'Partículas de fondo':it?'Particelle di sfondo':'Hintergrund-Partikel',
        'Standard wiederherstellen':en?'Restore defaults':fr?'Réinitialiser':es?'Restablecer':it?'Ripristina predefiniti':'Standard wiederherstellen'
      };
      var optionTranslations = {
        en: { 'Klein':'Small','Normal':'Normal','Groß':'Large','Sehr groß':'Very large','Standard':'Default','Eckig':'Square','Rund':'Rounded','Hoch':'High','Extra stark':'Extra strong','Pixel':'Pixel','Modern':'Modern','Monospace':'Monospace','Serif':'Serif','Gelb':'Yellow','Grün':'Green','Lila':'Purple' },
        fr: { 'Klein':'Petit','Normal':'Normal','Groß':'Grand','Sehr groß':'Très grand','Standard':'Par défaut','Eckig':'Carré','Rund':'Arrondi','Hoch':'Élevé','Extra stark':'Très épais','Pixel':'Pixel','Modern':'Moderne','Monospace':'Monospace','Serif':'Sérif','Gelb':'Jaune','Grün':'Vert','Lila':'Violet' },
        es: { 'Klein':'Pequeño','Normal':'Normal','Groß':'Grande','Sehr groß':'Muy grande','Standard':'Predeterminado','Eckig':'Cuadrado','Rund':'Redondeado','Hoch':'Alto','Extra stark':'Extra grueso','Pixel':'Píxel','Modern':'Moderno','Monospace':'Monoespaciado','Serif':'Serif','Gelb':'Amarillo','Grün':'Verde','Lila':'Morado' },
        it: { 'Klein':'Piccolo','Normal':'Normale','Groß':'Grande','Sehr groß':'Molto grande','Standard':'Predefinito','Eckig':'Squadrato','Rund':'Arrotondato','Hoch':'Alto','Extra stark':'Molto marcato','Pixel':'Pixel','Modern':'Moderno','Monospace':'Monospazio','Serif':'Serif','Gelb':'Giallo','Grün':'Verde','Lila':'Viola' }
      };
      var optionMap = optionTranslations[cfg.language] || {};
      content.querySelectorAll('.srow button[data-k][data-v]').forEach(function(btn){
        var original=btn.dataset.originalLabel || btn.textContent;
        btn.dataset.originalLabel=original;
        var translated=optionMap[original] || original;
        var dot=btn.querySelector('.dot');
        btn.textContent='';
        if(dot) btn.appendChild(dot);
        btn.appendChild(document.createTextNode(translated));
      });
      content.querySelectorAll('.srow > span').forEach(function(el){var original=el.dataset.original||el.textContent;el.dataset.original=original;el.textContent=dict[original]||original;});
      content.querySelectorAll('.theme-group-title').forEach(function(el){var original=el.dataset.original||el.textContent;el.dataset.original=original;el.textContent=dict[original]||original;});
      langLab.textContent=({de:'Sprache',en:'Language',fr:'Langue',es:'Idioma',it:'Lingua'})[cfg.language]||'Sprache';
      langTitle.textContent=({de:'SPRACHE',en:'LANGUAGE',fr:'LANGUE',es:'IDIOMA',it:'LINGUA'})[cfg.language]||'SPRACHE';
      curTitle.textContent=({de:'CURSOR',en:'CURSOR',fr:'CURSEUR',es:'CURSOR',it:'CURSORE'})[cfg.language]||'CURSOR';
      curHelp.textContent=({de:'Wähle einen Cursor oder lade ein eigenes PNG / GIF / SVG hoch.',en:'Choose a cursor or upload your own PNG / GIF / SVG.',fr:'Choisissez un curseur ou importez votre PNG / GIF / SVG.',es:'Elige un cursor o sube tu propio PNG / GIF / SVG.',it:'Scegli un cursore o carica il tuo PNG / GIF / SVG.'})[cfg.language];
      var ui={de:{design:'Design',casino:'✦ Casino',arcade:'Arcade',search:'Spiel suchen …',favorites:'★ Favoriten'},en:{design:'Settings',casino:'✦ Casino',arcade:'Arcade',search:'Search games …',favorites:'★ Favorites'},fr:{design:'Paramètres',casino:'✦ Casino',arcade:'Arcade',search:'Rechercher un jeu …',favorites:'★ Favoris'},es:{design:'Ajustes',casino:'✦ Casino',arcade:'Arcade',search:'Buscar juegos …',favorites:'★ Favoritos'},it:{design:'Impostazioni',casino:'✦ Casino',arcade:'Arcade',search:'Cerca giochi …',favorites:'★ Preferiti'}}[cfg.language]||{};
      var resetLabel={de:'Standard wiederherstellen',en:'Restore defaults',fr:'Réinitialiser les paramètres',es:'Restablecer ajustes',it:'Ripristina impostazioni'}[cfg.language]||'Standard wiederherstellen';var resetButton=content.querySelector('.settings-reset-button');if(resetButton)resetButton.textContent=resetLabel;
      $('#settings-btn').textContent='☰';
      var modes=$$('#modebar button');if(modes[0])modes[0].textContent=ui.casino||'✦ Casino';if(modes[1])modes[1].textContent=ui.arcade||'Arcade';
      $('#game-search').placeholder=ui.search||'Spiel suchen …';
      var fav=$('#fav-filter');if(fav&&!fav.getAttribute('aria-pressed') || (fav&&fav.getAttribute('aria-pressed')==='false'))fav.textContent=ui.favorites||'★ Favoriten';
    }
    var curTitle=document.createElement('h3');curTitle.className='settings-section-title';curTitle.textContent='CURSOR';content.appendChild(curTitle);
    var curHelp=document.createElement('p');curHelp.className='settings-help';curHelp.textContent='Wähle einen Cursor oder lade ein eigenes PNG / GIF / SVG hoch.';content.appendChild(curHelp);
    var curGrid=document.createElement('div');curGrid.className='cursor-grid';
    [['default','Standard','↖'],['crosshair','Crosshair','＋'],['precision','Precision','⊕'],['help','Help','?']].forEach(function(x){var b=document.createElement('button');b.type='button';b.dataset.cursor=x[0];b.textContent=x[2]+'  '+x[1];b.setAttribute('aria-pressed',String(cfg.cursor===x[0]));b.addEventListener('click',function(){cfg.cursor=x[0];cfg.cursorImage='';persist();apply();curGrid.querySelectorAll('button').forEach(function(z){z.setAttribute('aria-pressed',String(z===b));});});curGrid.appendChild(b)});content.appendChild(curGrid);
    var upWrap=document.createElement('div');upWrap.className='cursor-upload';var file=document.createElement('input');file.type='file';file.accept='image/png,image/gif,image/svg+xml,image/webp';file.className='settings-file';file.setAttribute('aria-label','Eigenen Cursor hochladen');
    var preview=document.createElement('div');preview.className='cursor-preview';preview.textContent='↖';upWrap.appendChild(file);upWrap.appendChild(preview);content.appendChild(upWrap);
    file.addEventListener('change',function(){var f=file.files&&file.files[0];if(!f)return;if(f.size>150000){alert('Bitte ein Cursor-Bild unter 150 KB wählen.');file.value='';return;}var rd=new FileReader();rd.onload=function(){cfg.cursor='custom';cfg.cursorImage=String(rd.result);persist();apply();preview.textContent='✓';curGrid.querySelectorAll('button').forEach(function(z){z.setAttribute('aria-pressed','false')});};rd.readAsDataURL(f)});
    var extraTitle=document.createElement('h3');extraTitle.className='settings-section-title';extraTitle.textContent='EXTRA';content.appendChild(extraTitle);
    var extraHelp=document.createElement('p');extraHelp.className='settings-help';extraHelp.textContent='Weitere Optionen für Darstellung und Atmosphäre.';content.appendChild(extraHelp);
    applyLanguage();

    var rs = document.createElement('div'); rs.className = 'row';
    var rb = document.createElement('button'); rb.type = 'button'; rb.className = 'btn ghost settings-reset-button'; rb.textContent = 'Standard wiederherstellen';
    rb.addEventListener('click', function () { for (var k in DEF) cfg[k] = DEF[k]; persist(); apply(); sync(); langSel.value=cfg.language; curGrid.querySelectorAll('button').forEach(function(z){z.setAttribute('aria-pressed',String(z.dataset.cursor==='default'))}); preview.textContent='↖'; applyLanguage(); });
    rs.appendChild(rb); content.appendChild(rs); applyLanguage();
    function closeSettings(){ panel.hidden=true; panel.style.display='none'; sbtn.setAttribute('aria-expanded','false'); }
    sbtn.addEventListener('click', function () { panel.hidden = false; panel.style.display = 'flex'; sbtn.setAttribute('aria-expanded', 'true'); closeBtn.focus(); });
    closeBtn.addEventListener('click', closeSettings);
    panel.addEventListener('click', function(e){ if(e.target===panel) closeSettings(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { closeSettings(); sbtn.focus(); }
    });
    apply(); sync();
  })();


  /* Consistent visual overhaul for every game panel */
  document.querySelectorAll('.stage').forEach(function(el){el.classList.add('game-overhaul');});

  /* ---------- FAVORITEN, SUCHE UND EXTRA-GAMES ---------- */
  (function(){
    var favs=[];try{favs=JSON.parse(localStorage.getItem('labtoso-games:nexora:favs')||'[]')}catch(e){}
    if(!Array.isArray(favs))favs=[];
    var filter=false, search=$('#game-search'), fbtn=$('#fav-filter');
    function store(){try{localStorage.setItem('labtoso-games:nexora:favs',JSON.stringify(favs))}catch(e){}}
    function decorate(){
      $$('#tabs button,#ctabs button').forEach(function(b){var star=b.querySelector('.fav-star');if(!star){star=document.createElement('span');star.className='fav-star';star.title='Favorit umschalten';star.setAttribute('role','button');star.setAttribute('tabindex','0');star.setAttribute('aria-label','Favorit umschalten');b.appendChild(star);}
        star.textContent=favs.indexOf(b.dataset.game)>=0?'★':'☆';star.onclick=function(e){e.stopPropagation();var id=b.dataset.game,ix=favs.indexOf(id);if(ix>=0)favs.splice(ix,1);else favs.push(id);store();decorate();};star.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();star.onclick(e);}};});
      var q=(search.value||'').toLowerCase(),count=0;
      $$('#tabs button,#ctabs button').forEach(function(b){var ok=(!filter||favs.indexOf(b.dataset.game)>=0)&&(!q||b.textContent.toLowerCase().indexOf(q)>=0);b.hidden=!ok;if(ok)count++;});
      $('#game-count').textContent=count+' Spiele';fbtn.setAttribute('aria-pressed',String(filter));fbtn.textContent=filter?'★ Favoriten anzeigen':'★ Favoriten';
    }
    search.addEventListener('input',decorate);fbtn.addEventListener('click',function(){filter=!filter;decorate();});decorate();
    function makeGrid(id,n,cls,handler){var root=$(id);for(var i=0;i<n;i++){var b=document.createElement('button');b.type='button';b.className=cls;b.dataset.i=i;b.addEventListener('click',handler);root.appendChild(b);}}
    // Whack-a-mole
    var whOn=false,whScore=0,whLeft=20,whTimer=null,whTick=null,whTarget=-1;makeGrid('#wh-grid',9,'',function(){if(!whOn)return;var i=+this.dataset.i;if(i===whTarget){whScore++;$('#wh-score').textContent=whScore;whTarget=-1;paintWh();}});
    function paintWh(){ $$('#wh-grid button').forEach(function(b,i){b.textContent=i===whTarget?'🎯':'';b.style.borderColor=i===whTarget?'var(--yellow)':'var(--line)';}); }
    $('#wh-start').onclick=function(){clearInterval(whTimer);clearInterval(whTick);whOn=true;whScore=0;whLeft=20;$('#wh-score').textContent='0';$('#wh-time').textContent='20';whTimer=setInterval(function(){whLeft--;$('#wh-time').textContent=whLeft;if(whLeft<=0){whOn=false;clearInterval(whTimer);clearInterval(whTick);$('#wh-hint').textContent='Zeit vorbei! Deine Treffer: '+whScore;}},1000);whTick=setInterval(function(){whTarget=Math.floor(Math.random()*9);paintWh();},650);};
    stoppers.whack=function(){whOn=false;clearInterval(whTimer);clearInterval(whTick);};
    // Simon
    var seq=[],pos=0,accept=false;var sb=$$('#si-grid button');function flash(i){sb[i].classList.add('lit');setTimeout(function(){sb[i].classList.remove('lit')},280)}
    function playSeq(){accept=false;var j=0;var t=setInterval(function(){if(j>=seq.length){clearInterval(t);accept=true;pos=0;return;}flash(seq[j++]);},520);}
    $('#si-start').onclick=function(){seq=[];$('#si-level').textContent='0';$('#si-hint').textContent='Schau genau hin …';next();};function next(){seq.push(Math.floor(Math.random()*4));$('#si-level').textContent=seq.length;playSeq();}
    sb.forEach(function(b){b.onclick=function(){if(!accept)return;var v=+b.dataset.color;flash(v);if(v!==seq[pos]){$('#si-hint').textContent='Leider falsch! Erreichtes Level: '+seq.length;accept=false;return;}pos++;if(pos===seq.length){accept=false;$('#si-hint').textContent='Richtig! Nächste Runde …';setTimeout(next,650);}};});
    // Lights Out
    var lights=[],moves=0;function drawLights(){var root=$('#li-grid');root.innerHTML='';lights.forEach(function(v,i){var b=document.createElement('button');b.className=v?'on':'';b.setAttribute('aria-label','Licht '+(i+1));b.onclick=function(){var x=i%5,y=Math.floor(i/5);[[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var xx=x+d[0],yy=y+d[1];if(xx>=0&&xx<5&&yy>=0&&yy<5){var z=yy*5+xx;lights[z]=!lights[z];}});moves++;$('#li-moves').textContent=moves;drawLights();if(lights.every(function(a){return !a;}))$('#li-hint').textContent='Geschafft in '+moves+' Zügen!';};root.appendChild(b);});}
    function newLights(){lights=Array.from({length:25},function(){return false});for(var k=0;k<18;k++){var i=Math.floor(Math.random()*25),x=i%5,y=Math.floor(i/5);[[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var xx=x+d[0],yy=y+d[1];if(xx>=0&&xx<5&&yy>=0&&yy<5){var z=yy*5+xx;lights[z]=!lights[z];}});}moves=0;$('#li-moves').textContent='0';$('#li-hint').textContent='Schalte alle Lichter aus.';drawLights();}$('#li-new').onclick=newLights;newLights();
    // Number guessing
    var secret=0,tries=0;function newGuess(){secret=1+Math.floor(Math.random()*100);tries=0;$('#gu-tries').textContent='0';$('#gu-input').value='';$('#gu-hint').textContent='Neue Zahl gewählt: zwischen 1 und 100.';}$('#gu-new').onclick=newGuess;$('#gu-check').onclick=function(){var n=+$('#gu-input').value;if(!Number.isInteger(n)||n<1||n>100){$('#gu-hint').textContent='Bitte eine ganze Zahl von 1 bis 100 eingeben.';return;}tries++;$('#gu-tries').textContent=tries;$('#gu-hint').textContent=n===secret?'Volltreffer! Du hast die Zahl in '+tries+' Versuchen gefunden.':n<secret?'Zu niedrig!':'Zu hoch!';};newGuess();
    // Pong
    (function(){var c=$('#po-canvas'),ctx=c.getContext('2d'),py=140,ay=140,bx=300,by=180,vx=4,vy=3,ps=0,as=0,run=false,raf=0,up=false,down=false;function draw(){ctx.clearRect(0,0,600,360);ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim();ctx.fillRect(14,py,12,80);ctx.fillRect(574,ay,12,80);ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--fg').trim();for(var y=0;y<360;y+=22)ctx.fillRect(298,y,4,12);ctx.fillRect(bx-7,by-7,14,14);$('#po-player').textContent=ps;$('#po-ai').textContent=as;}
      function step(){if(!run)return;if(up)py=Math.max(0,py-6);if(down)py=Math.min(280,py+6);ay+=((by-40)-ay)*.075;bx+=vx;by+=vy;if(by<7||by>353)vy*=-1;if(bx<33&&by>py&&by<py+80){vx=Math.abs(vx)*1.04;vy+=(by-(py+40))*.06;}if(bx>567&&by>ay&&by<ay+80){vx=-Math.abs(vx)*1.04;vy+=(by-(ay+40))*.06;}if(bx<0){as++;resetBall();}if(bx>600){ps++;resetBall();}draw();raf=requestAnimationFrame(step);}
      function resetBall(){bx=300;by=180;vx=(Math.random()>.5?1:-1)*4;vy=(Math.random()-.5)*6;}function start(){cancelAnimationFrame(raf);ps=0;as=0;py=140;ay=140;resetBall();run=true;step();}$('#po-start').onclick=start;$('#po-up').onpointerdown=function(){up=true};$('#po-up').onpointerup=$('#po-up').onpointerleave=function(){up=false};$('#po-down').onpointerdown=function(){down=true};$('#po-down').onpointerup=$('#po-down').onpointerleave=function(){down=false};document.addEventListener('keydown',function(e){if(e.key==='ArrowUp'||e.key.toLowerCase()==='w')up=true;if(e.key==='ArrowDown'||e.key.toLowerCase()==='s')down=true;});document.addEventListener('keyup',function(e){if(e.key==='ArrowUp'||e.key.toLowerCase()==='w')up=false;if(e.key==='ArrowDown'||e.key.toLowerCase()==='s')down=false;});stoppers.pong=function(){run=false;cancelAnimationFrame(raf);};draw();})();
  })();

  showBest();
  show(location.hash.replace('#', '') || 'slots');
})();



(function(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var layer=document.createElement('div'); layer.id='nexora-snow'; layer.setAttribute('aria-hidden','true');
  var count=34;
  for(var i=0;i<count;i++){
    var f=document.createElement('i'); f.className='flake';
    var x=((i*37)%101)+'vw', size=(2+(i%4)*.8)+'px', duration=(13+(i%11)*1.7)+'s', delay=(-((i*7)%240)/10)+'s', drift=(((i%7)-3)*13)+'px', opacity=(.22+(i%5)*.09).toFixed(2);
    f.style.setProperty('--x',x); f.style.setProperty('--s',size); f.style.setProperty('--d',duration); f.style.setProperty('--delay',delay); f.style.setProperty('--drift',drift); f.style.setProperty('--o',opacity);
    layer.appendChild(f);
  }
  document.body.appendChild(layer);
})();



(function(){
  /* Single-row shell: games | chips | active stage — fits one screen */
  var wrap=document.querySelector('.wrap'); if(!wrap||document.querySelector('.nx-layout')) return;
  var tools=wrap.querySelector('.library-tools'), mode=wrap.querySelector('#modebar');
  var tabs=wrap.querySelector('#tabs'), ctabs=wrap.querySelector('#ctabs'), wallet=wrap.querySelector('#wallet');
  var stages=[].slice.call(wrap.querySelectorAll('.stage')); var footer=wrap.querySelector('footer');
  var layout=document.createElement('div'); layout.className='nx-layout';
  var gamesCol=document.createElement('section'); gamesCol.className='nx-games'; gamesCol.setAttribute('aria-label','Spiele');
  var chips=document.createElement('aside'); chips.className='nx-chips nx-sidebar'; chips.setAttribute('aria-label','Chips');
  var main=document.createElement('main'); main.className='nx-main';
  [tools, mode, tabs, ctabs].forEach(function(n){ if(n) gamesCol.appendChild(n); });
  if(wallet) chips.appendChild(wallet);
  stages.forEach(function(n){ main.appendChild(n); });
  layout.append(gamesCol, chips, main);
  if(footer) wrap.insertBefore(layout, footer); else wrap.appendChild(layout);
  // Settings stay in the top-right header as a compact burger menu.
  var settingsBtn=document.getElementById('settings-btn');if(settingsBtn){settingsBtn.textContent='☰';settingsBtn.setAttribute('aria-label','Einstellungen öffnen');settingsBtn.title='Einstellungen';}
  // Odds disclosure controls.
  document.querySelectorAll('[data-odds]').forEach(function(b){b.addEventListener('click',function(){var panel=document.getElementById('odds-'+b.dataset.odds);if(panel)panel.hidden=!panel.hidden;});});
  // Reliable ambient background effect layer; re-renders whenever settings change.
  var effectLayer=document.getElementById('nexora-effect-layer');if(!effectLayer){effectLayer=document.createElement('div');effectLayer.id='nexora-effect-layer';effectLayer.setAttribute('aria-hidden','true');document.body.prepend(effectLayer);}
  function setEffect(){var raw={};try{raw=JSON.parse(localStorage.getItem('labtoso-games:nexora:settings')||'{}')}catch(e){};var effect=(raw.particles==='aus'?'none':(raw.effect||'snow'));effectLayer.replaceChildren();effectLayer.style.display=effect==='none'?'none':'block';var palette={snow:['#dceaff','#ffffff'],stars:['#c5d8ff','#ffffff'],aurora:['#62f4d5','#a78bfa'],embers:['#ff9a54','#ffd166'],bubbles:['#73dfff','#c4a6ff']};var colors=palette[effect]||palette.snow;var count=effect==='stars'?75:effect==='none'?0:34;for(var i=0;i<count;i++){var dot=document.createElement('i');dot.className='particle';dot.style.setProperty('--x',Math.random()*100+'%');dot.style.setProperty('--s',(effect==='bubbles'?8+Math.random()*20:2+Math.random()*5)+'px');dot.style.setProperty('--o',(.2+Math.random()*.55).toFixed(2));dot.style.setProperty('--dur',(effect==='stars'?14+Math.random()*28:8+Math.random()*18)+'s');dot.style.setProperty('--delay',(-Math.random()*25)+'s');dot.style.setProperty('--drift',(-70+Math.random()*140)+'px');dot.style.setProperty('--particle-color',colors[i%colors.length]);if(effect==='stars'){dot.style.top=Math.random()*100+'%';dot.style.animation='none';dot.style.opacity=(.15+Math.random()*.8).toFixed(2)}else if(effect==='aurora'){dot.style.width=(90+Math.random()*180)+'px';dot.style.height=(30+Math.random()*70)+'px';dot.style.filter='blur(28px)';dot.style.borderRadius='50%';}effectLayer.appendChild(dot);}}
  setEffect();window.addEventListener('storage',setEffect);window.addEventListener('pk-skin',setEffect);document.addEventListener('click',function(e){if(e.target.closest('.settings-content .seg button'))setTimeout(setEffect,0)});
})();



(function(){
  var seq=0;
  var selectBackdrop=null;
  function getSelectBackdrop(){
    if(!selectBackdrop){
      selectBackdrop=document.createElement('div');
      selectBackdrop.className='nx-select-backdrop';
      selectBackdrop.addEventListener('click',function(){
        document.querySelectorAll('.nx-select.open').forEach(function(w){
          w.classList.remove('open');
          var t=w.querySelector('.nx-select-trigger');
          if(t)t.setAttribute('aria-expanded','false');
        });
        document.querySelectorAll('body > .nx-select-menu').forEach(function(m){m.classList.remove('nx-select-menu-open');});
        selectBackdrop.classList.remove('show');
      });
      document.body.appendChild(selectBackdrop);
    }
    return selectBackdrop;
  }
  function enhance(sel){
    if(!sel || sel.dataset.nxEnhanced || !sel.options || !sel.options.length) return;
    sel.dataset.nxEnhanced='1';
    var wrap=document.createElement('div');wrap.className='nx-select';
    if(sel.classList.contains('settings-select'))wrap.classList.add('nx-settings-select');
    sel.parentNode.insertBefore(wrap,sel);wrap.appendChild(sel);sel.classList.add('nx-select-native-hidden');
    var trigger=document.createElement('button');trigger.type='button';trigger.className='nx-select-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.id='nx-select-trigger-'+(++seq);
    var label=document.createElement('span');var arrow=document.createElement('i');arrow.className='nx-select-arrow';arrow.setAttribute('aria-hidden','true');trigger.append(label,arrow);
    var menu=document.createElement('div');menu.className='nx-select-menu';menu.id='nx-select-menu-'+seq;menu.setAttribute('role','listbox');trigger.setAttribute('aria-controls',menu.id);wrap.append(trigger,menu);
    function sync(){var o=sel.options[sel.selectedIndex];label.textContent=o?o.textContent:'Bitte auswählen';trigger.disabled=sel.disabled;trigger.setAttribute('aria-label',sel.getAttribute('aria-label')||sel.labels&&sel.labels[0]&&sel.labels[0].textContent||label.textContent);}
    function close(){
      wrap.classList.remove('open');
      trigger.setAttribute('aria-expanded','false');
      menu.classList.remove('nx-select-menu-open');
      if(menu.parentNode===document.body)wrap.appendChild(menu);
      if(!document.querySelector('.nx-select.open'))getSelectBackdrop().classList.remove('show');
    }
    function openSelect(){
      document.querySelectorAll('.nx-select.open').forEach(function(x){
        x.classList.remove('open');
        var t=x.querySelector('.nx-select-trigger');if(t)t.setAttribute('aria-expanded','false');
        var m=x.querySelector('.nx-select-menu');if(m&&m.parentNode===document.body)x.appendChild(m);
        if(m)m.classList.remove('nx-select-menu-open');
      });
      render();
      document.body.appendChild(menu);
      menu.classList.add('nx-select-menu-open');
      wrap.classList.add('open');
      trigger.setAttribute('aria-expanded','true');
      getSelectBackdrop().classList.add('show');
    }
    function render(){menu.replaceChildren();Array.from(sel.options).forEach(function(o,i){if(o.parentElement&&o.parentElement.tagName==='OPTGROUP'){/* optgroup options stay visually grouped by label below */}
      var b=document.createElement('button');b.type='button';b.className='nx-select-option';b.setAttribute('role','option');b.setAttribute('aria-selected',o.selected?'true':'false');b.disabled=o.disabled;b.textContent=o.textContent;
      b.addEventListener('click',function(){if(o.disabled)return;sel.selectedIndex=i;sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}));sync();render();close();trigger.focus();});menu.appendChild(b);
    });}
    trigger.addEventListener('click',function(){
      if(trigger.disabled)return;
      if(wrap.classList.contains('open'))close();
      else openSelect();
    });
    trigger.addEventListener('keydown',function(e){
      if(e.key==='ArrowDown'||e.key==='Enter'||e.key===' '){
        e.preventDefault();
        if(!wrap.classList.contains('open'))openSelect();
        var first=menu.querySelector('.nx-select-option:not(:disabled)');
        if(first)first.focus();
      }else if(e.key==='Escape')close();
    });
    menu.addEventListener('keydown',function(e){var opts=Array.from(menu.querySelectorAll('.nx-select-option:not(:disabled)')),i=opts.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();opts[Math.min(i+1,opts.length-1)]?.focus()}else if(e.key==='ArrowUp'){e.preventDefault();opts[Math.max(i-1,0)]?.focus()}else if(e.key==='Escape'){e.preventDefault();close();trigger.focus()}});
    sel.addEventListener('change',function(){sync();render()});
    new MutationObserver(function(){sync();render()}).observe(sel,{childList:true,subtree:true,attributes:true});
    sync();render();
  }
  function scan(root){(root||document).querySelectorAll('select').forEach(enhance)}
  scan(document);new MutationObserver(function(records){records.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType===1){if(n.matches&&n.matches('select'))enhance(n);scan(n)}})})}).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',function(e){if(!e.target.closest('.nx-select'))document.querySelectorAll('.nx-select.open').forEach(function(w){w.classList.remove('open');var t=w.querySelector('.nx-select-trigger');if(t)t.setAttribute('aria-expanded','false')})});
  document.addEventListener('keydown',function(e){if(e.key==='Tab')document.querySelectorAll('.nx-select.open').forEach(function(w){if(!w.contains(document.activeElement)){w.classList.remove('open');var t=w.querySelector('.nx-select-trigger');if(t)t.setAttribute('aria-expanded','false')}})});
})();



(function(){
  var settings=document.getElementById('settings'),content=document.getElementById('settings-content'),burger=document.getElementById('settings-btn');
  if(burger){burger.textContent='☰';burger.setAttribute('aria-label','Open settings');burger.title='Settings';}
  // Split the existing settings into useful sections without changing their controls/state.
  if(content&&!content.dataset.categorized){
    content.dataset.categorized='1';
    var children=Array.from(content.children),groups={appearance:[],interface:[],effects:[],general:[]};
    children.forEach(function(el){
      var key=el.querySelector&&el.querySelector('[data-k]')?.dataset.k;
      if(key==='skin'||key==='font'||key==='size'||key==='accent'||key==='round')groups.appearance.push(el);
      else if(key==='grid'||key==='fx'||key==='glass'||key==='contrast'||key==='motion'||key==='border'||key==='compact')groups.interface.push(el);
      else if(key==='effect'||key==='snow'||key==='animations'||key==='glow'||key==='particles')groups.effects.push(el);
      else groups.general.push(el);
    });
    var labels={de:['Design','Oberfläche','Interface','Effekte','Allgemein'],en:['Settings','Appearance','Interface','Effects','General'],fr:['Paramètres','Apparence','Interface','Effets','Général'],es:['Ajustes','Apariencia','Interfaz','Efectos','General'],it:['Impostazioni','Aspetto','Interfaccia','Effetti','Generale']};
    var nav=document.createElement('div');nav.className='settings-categories';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Settings categories');
    var panes={};var keys=['appearance','interface','effects','general'];
    keys.forEach(function(k,i){var b=document.createElement('button');b.type='button';b.className='settings-category';b.dataset.category=k;b.setAttribute('role','tab');b.setAttribute('aria-selected',i===0?'true':'false');b.textContent=labels.de[i+1];nav.appendChild(b);var pane=document.createElement('section');pane.className='settings-pane';pane.dataset.pane=k;pane.setAttribute('role','tabpanel');pane.hidden=i!==0;var h=document.createElement('h3');h.className='settings-pane-title';h.textContent=labels.de[i+1];pane.appendChild(h);groups[k].forEach(function(el){pane.appendChild(el)});content.appendChild(pane);panes[k]=pane;b.addEventListener('click',function(){nav.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-selected',String(x===b))});keys.forEach(function(x){panes[x].hidden=x!==k})});});
    content.insertBefore(nav,content.firstChild);
    function updateCategoryLanguage(){var lang='de';try{lang=JSON.parse(localStorage.getItem('labtoso-games:nexora:settings')||'{}').language||'de'}catch(e){};var l=labels[lang]||labels.de;nav.querySelectorAll('button').forEach(function(b,i){b.textContent=l[i+1]});keys.forEach(function(k,i){panes[k].querySelector('.settings-pane-title').textContent=l[i+1]});}
    updateCategoryLanguage();window.addEventListener('pk-skin',updateCategoryLanguage);var langSelect=content.querySelector('select.settings-select');if(langSelect)langSelect.addEventListener('change',updateCategoryLanguage);
  }
  // Translate game-facing static copy and frequently updated status messages in all supported languages.
  var D={
    'Choose a game, set your chips and start playing. Virtual chips only — no real money.':['Wähle ein Spiel, setze deine Chips und leg los. Nur virtuelle Chips – kein echtes Geld.','Choisis un jeu, mise tes jetons et joue. Jetons virtuels uniquement – aucun argent réel.','Elige un juego, apuesta tus fichas y empieza. Solo fichas virtuales, sin dinero real.','Scegli un gioco, imposta le fiches e inizia. Solo fiches virtuali, niente denaro reale.'],
    'Choose a door on Floor 1':['Wähle eine Tür auf Etage 1','Choisis une porte au niveau 1','Elige una puerta en el piso 1','Scegli una porta al piano 1'],
    'All ten floors are visible. Choose one door on the highlighted floor.':['Alle zehn Etagen sind sichtbar. Wähle eine Tür auf der markierten Etage.','Les dix niveaux sont visibles. Choisis une porte au niveau surligné.','Los diez pisos están visibles. Elige una puerta en el piso resaltado.','Tutti e dieci i piani sono visibili. Scegli una porta al piano evidenziato.'],
    'Choose a door on the next highlighted floor, or cash out.':['Wähle eine Tür auf der nächsten markierten Etage oder zahle aus.','Choisis une porte au prochain niveau indiqué ou encaisse.','Elige una puerta en el siguiente piso resaltado o cobra.','Scegli una porta al prossimo piano evidenziato oppure incassa.'],
    'The dragon caught you':['Der Drache hat dich erwischt','Le dragon t’a attrapé','El dragón te atrapó','Il drago ti ha preso'],
    'Run over. Your virtual-chip stake was lost.':['Runde vorbei. Dein virtueller Einsatz ist verloren.','Partie terminée. Ta mise virtuelle est perdue.','Fin de la partida. Has perdido tu apuesta virtual.','Partita terminata. La puntata virtuale è persa.'],
    'DRAGON FOUND YOU!':['DER DRACHE HAT DICH GEFUNDEN!','LE DRAGON T’A TROUVÉ !','¡EL DRAGÓN TE ENCONTRÓ!','IL DRAGO TI HA TROVATO!'],
    'Run over — the tower has defeated you.':['Runde vorbei – der Turm hat dich besiegt.','Partie terminée – la tour t’a vaincu.','Fin de la partida: la torre te ha vencido.','Partita finita: la torre ti ha sconfitto.'],
    'Choose one door per floor. One door is safe; the others hide the dragon. Cash out after any safe floor.':['Wähle pro Etage eine Tür. Eine ist sicher, hinter den anderen lauert der Drache. Nach jeder sicheren Etage kannst du auszahlen.','Choisis une porte par niveau. Une seule est sûre ; les autres cachent le dragon. Encaisse après chaque niveau réussi.','Elige una puerta por piso. Una es segura; las demás esconden al dragón. Puedes cobrar tras cada piso seguro.','Scegli una porta per piano. Una è sicura; le altre nascondono il drago. Puoi incassare dopo ogni piano superato.'],
    'Find the gems.':['Finde die Edelsteine.','Trouve les gemmes.','Encuentra las gemas.','Trova le gemme.'],
    'Boom! That was a mine. Your stake is gone.':['Bumm! Das war eine Mine. Dein Einsatz ist weg.','Boum ! C’était une mine. Ta mise est perdue.','¡Bum! Era una mina. Has perdido la apuesta.','Boom! Era una mina. La puntata è persa.'],
    'Safe! Next hit:':['Sicher! Nächster Treffer:','En sécurité ! Prochain gain :','¡A salvo! Siguiente premio:','Al sicuro! Prossimo premio:'],
    'Continue or cash out?':['Weiter oder auszahlen?','Continuer ou encaisser ?','¿Seguir o cobrar?','Continuare o incassare?'],
    'Find the secret number':['Finde die geheime Zahl','Trouve le nombre secret','Encuentra el número secreto','Trova il numero segreto'],
    'Please enter a whole number between 1 and 100.':['Bitte gib eine ganze Zahl zwischen 1 und 100 ein.','Saisis un nombre entier entre 1 et 100.','Introduce un número entero entre 1 y 100.','Inserisci un numero intero tra 1 e 100.'],
    'Too low!':['Zu niedrig!','Trop bas !','¡Demasiado bajo!','Troppo basso!'],'Too high!':['Zu hoch!','Trop haut !','¡Demasiado alto!','Troppo alto!'],
    'Correct! Next round …':['Richtig! Nächste Runde …','Correct ! Manche suivante…','¡Correcto! Siguiente ronda…','Corretto! Prossimo turno…'],
    'Unfortunately wrong! Reached level:':['Leider falsch! Erreichtes Level:','Incorrect ! Niveau atteint :','¡Incorrecto! Nivel alcanzado:','Sbagliato! Livello raggiunto:'],
    'Time is up! Your hits:':['Zeit vorbei! Deine Treffer:','Temps écoulé ! Tes réussites :','¡Se acabó el tiempo! Tus aciertos:','Tempo scaduto! I tuoi colpi:'],
    'Turn all the lights off.':['Schalte alle Lichter aus.','Éteins toutes les lumières.','Apaga todas las luces.','Spegni tutte le luci.'],
    'Game over!':['Spiel vorbei!','Partie terminée !','¡Fin del juego!','Partita finita!'],
    'Start':['Starten','Démarrer','Empezar','Avvia'],'New game':['Neues Spiel','Nouvelle partie','Nuevo juego','Nuova partita'],
    'Cash out':['Auszahlen','Encaisser','Cobrar','Incassa'],'Buy ticket':['Los kaufen','Acheter un ticket','Comprar boleto','Compra biglietto'],
    'Reveal all':['Alle aufdecken','Tout révéler','Revelar todo','Scopri tutto'],'Spin':['Drehen','Tourner','Girar','Gira'],
    'Bet':['Einsatz','Mise','Apuesta','Puntata'],'Balance':['Guthaben','Solde','Saldo','Saldo'],
    'Search games …':['Spiele suchen …','Rechercher des jeux…','Buscar juegos…','Cerca giochi…'],
    'Favorites':['Favoriten','Favoris','Favoritos','Preferiti'],
    'Steuern mit Pfeiltasten oder WASD, am Handy wischen oder die Tasten unten nutzen.':['Steuere mit Pfeiltasten oder WASD. Am Handy kannst du wischen oder die Tasten unten nutzen.','Utilise les flèches ou WASD. Sur mobile, fais glisser ou utilise les boutons ci-dessous.','Usa las flechas o WASD. En móvil, desliza o utiliza los botones de abajo.','Usa le frecce o WASD. Sul telefono, scorri o usa i pulsanti qui sotto.'],
    'Finde alle acht Paare mit möglichst wenigen Zügen.':['Finde alle acht Paare mit möglichst wenigen Zügen.','Trouve les huit paires en un minimum de coups.','Encuentra las ocho parejas con el menor número de movimientos.','Trova tutte e otto le coppie con il minor numero di mosse.'],
    'War­te auf Grün und tippe so schnell du kannst. Zu früh geklickt zählt nicht.':['Warte auf Grün und tippe so schnell du kannst. Zu frühes Klicken zählt nicht.','Attends le vert et appuie aussi vite que possible. Un clic trop tôt ne compte pas.','Espera a que aparezca el verde y pulsa lo más rápido posible. Un clic anticipado no cuenta.','Aspetta il verde e tocca il più velocemente possibile. Un clic anticipato non conta.'],
    'Warte auf Grün und tippe so schnell du kannst. Zu früh geklickt zählt nicht.':['Warte auf Grün und tippe so schnell du kannst. Zu frühes Klicken zählt nicht.','Attends le vert et appuie aussi vite que possible. Un clic trop tôt ne compte pas.','Espera a que aparezca el verde y pulsa lo más rápido posible. Un clic anticipado no cuenta.','Aspetta il verde e tocca il più velocemente possibile. Un clic anticipato non conta.'],
    '20 Sekunden Zeit. Das Ziel wird mit jedem Treffer kleiner.':['Du hast 20 Sekunden. Das Ziel wird mit jedem Treffer kleiner.','Tu as 20 secondes. La cible rétrécit à chaque réussite.','Tienes 20 segundos. El objetivo se hace más pequeño con cada acierto.','Hai 20 secondi. Il bersaglio diventa più piccolo a ogni colpo.'],
    'Three reels. One big moment.':['Drei Walzen. Ein großer Moment.','Trois rouleaux. Un grand moment.','Tres rodillos. Un gran momento.','Tre rulli. Un grande momento.'],
    'Set your bet and spin the reels.':['Lege deinen Einsatz fest und drehe die Walzen.','Définis ta mise et fais tourner les rouleaux.','Elige tu apuesta y gira los rodillos.','Imposta la puntata e gira i rulli.'],
    'Each reel is drawn independently from a pool of 21 symbols.':['Jede Walze wird unabhängig aus 21 Symbolen gezogen.','Chaque rouleau est tiré indépendamment parmi 21 symboles.','Cada rodillo se genera de forma independiente entre 21 símbolos.','Ogni rullo viene estratto in modo indipendente da 21 simboli.'],
    'Europäisch, 0 bis 36':['European roulette, 0 to 36','Roulette européenne, de 0 à 36','Ruleta europea, del 0 al 36','Roulette europea, da 0 a 36'],
    'Wähle eine Wette und lass die Kugel rollen.':['Wähle eine Wette und lass die Kugel rollen.','Choisis une mise et lance la bille.','Elige una apuesta y deja girar la bola.','Scegli una puntata e fai girare la pallina.'],
    'Dealer hält bei 17':['Der Dealer bleibt bei 17 stehen.','Le croupier reste à 17.','La banca se planta en 17.','Il banco si ferma a 17.'],
    'Teile aus. Wer 21 am nächsten kommt, ohne zu überkaufen, gewinnt.':['Teile aus. Wer 21 am nächsten kommt, ohne darüber zu gehen, gewinnt.','Distribue les cartes. Le plus proche de 21 sans dépasser gagne.','Reparte las cartas. Gana quien se acerque más a 21 sin pasarse.','Distribuisci le carte. Vince chi si avvicina di più a 21 senza sballare.'],
    'Zwei Würfel, Summe 2 bis 12':['Two dice, total from 2 to 12','Deux dés, total de 2 à 12','Dos dados, suma de 2 a 12','Due dadi, somma da 2 a 12'],
    'Tippe, ob die Summe unter, genau auf oder über 7 landet.':['Tippe, ob die Summe unter, genau bei oder über 7 liegt.','Devine si le total sera inférieur, égal ou supérieur à 7.','Adivina si la suma será menor, igual o mayor que 7.','Indovina se la somma sarà inferiore, uguale o superiore a 7.'],
    'Ass ist die höchste Karte':['Ace is the highest card','L’as est la carte la plus haute','El as es la carta más alta','L’asso è la carta più alta'],
    'Starte mit deinem Einsatz. Rate, ob die nächste Karte höher oder tiefer ist. Gleiche Karten verlieren.':['Starte mit deinem Einsatz. Rate, ob die nächste Karte höher oder tiefer ist. Gleiche Karten verlieren.','Commence avec ta mise. Devine si la prochaine carte sera plus haute ou plus basse. Les égalités font perdre.','Empieza con tu apuesta. Adivina si la siguiente carta será mayor o menor. Los empates hacen perder.','Inizia con la puntata. Indovina se la prossima carta sarà più alta o più bassa. Le carte uguali fanno perdere.'],
    'Zahle aus, bevor es kracht':['Cash out before the crash','Encaisse avant le crash','Retira antes del choque','Incassa prima del crash'],
    'Der Faktor steigt. Je länger du wartest, desto mehr gewinnst du, bis er plötzlich abstürzt.':['Der Multiplikator steigt. Je länger du wartest, desto höher der Gewinn – bis er plötzlich abstürzt.','Le multiplicateur augmente. Plus tu attends, plus tu gagnes, jusqu’au crash soudain.','El multiplicador sube. Cuanto más esperes, más ganas, hasta que se desploma.','Il moltiplicatore sale. Più aspetti, più vinci, finché crolla all’improvviso.'],
    'Kopf oder Zahl. Eine Münze, eine Entscheidung.':['Kopf oder Zahl. Eine Münze, eine Entscheidung.','Pile ou face. Une pièce, une décision.','Cara o cruz. Una moneda, una decisión.','Testa o croce. Una moneta, una decisione.'],
    'Schiebe mit Pfeiltasten, WASD oder Wischen. Gleiche Zahlen verschmelzen.':['Schiebe mit Pfeiltasten, WASD oder Wischen. Gleiche Zahlen verschmelzen.','Déplace avec les flèches, WASD ou un glissement. Les mêmes nombres fusionnent.','Desliza con las flechas, WASD o gestos. Los números iguales se fusionan.','Muovi con le frecce, WASD o scorrendo. I numeri uguali si fondono.'],
    'Tippe, klicke oder drücke die Leertaste, um zu flattern.':['Tippe, klicke oder drücke die Leertaste zum Flattern.','Appuie, clique ou utilise la barre espace pour voler.','Toca, haz clic o pulsa espacio para volar.','Tocca, clicca o premi spazio per volare.'],
    'Du spielst X und beginnst.':['You play X and start first.','Tu joues X et tu commences.','Juegas con X y empiezas.','Giochi con X e inizi tu.'],
    'Wähle eine Ente, setze deinen Einsatz und starte das Rennen. Die Quote sinkt mit der Gewinnchance.':['Wähle eine Ente, setze deinen Einsatz und starte das Rennen. Die Quote sinkt mit der Gewinnchance.','Choisis un canard, mise et lance la course. La cote baisse avec les chances de gagner.','Elige un pato, apuesta y comienza la carrera. La cuota baja cuando aumentan las posibilidades de ganar.','Scegli un’anatra, punta e avvia la gara. La quota diminuisce quando aumentano le probabilità di vittoria.'],
    'Lass Kugeln fallen. Je weiter außen sie landen, desto mehr zahlen sie.':['Lass Kugeln fallen. Je weiter außen sie landen, desto mehr zahlen sie.','Laisse tomber les billes. Plus elles atterrissent à l’extérieur, plus elles rapportent.','Deja caer las bolas. Cuanto más afuera caigan, mayor será el premio.','Lascia cadere le palline. Più cadono verso l’esterno, più pagano.'],
    'Decke Edelsteine auf und zahle aus, bevor du eine Mine erwischst. Mehr Minen bedeuten höhere Faktoren.':['Decke Edelsteine auf und zahle aus, bevor du eine Mine erwischst. Mehr Minen bedeuten höhere Multiplikatoren.','Découvre les gemmes et encaisse avant de trouver une mine. Plus de mines signifie des multiplicateurs plus élevés.','Descubre gemas y cobra antes de encontrar una mina. Más minas significan multiplicadores más altos.','Scopri le gemme e incassa prima di trovare una mina. Più mine significano moltiplicatori più alti.'],
    'Kaufe ein Los und rubble die sechs Felder auf. Drei gleiche Symbole gewinnen.':['Kaufe ein Los und rubbele die sechs Felder frei. Drei gleiche Symbole gewinnen.','Achète un ticket et gratte les six cases. Trois symboles identiques gagnent.','Compra un boleto y raspa las seis casillas. Tres símbolos iguales ganan.','Compra un biglietto e gratta le sei caselle. Tre simboli uguali vincono.'],
    'Triff so viele Ziele wie möglich in 20 Sekunden.':['Triff in 20 Sekunden so viele Ziele wie möglich.','Touche autant de cibles que possible en 20 secondes.','Acierta tantos objetivos como puedas en 20 segundos.','Colpisci più bersagli possibile in 20 secondi.'],
    'Merke dir die Reihenfolge und wiederhole sie.':['Merke dir die Reihenfolge und wiederhole sie.','Mémorise la séquence et répète-la.','Memoriza la secuencia y repítela.','Memorizza la sequenza e ripetila.'],
    'Jeder Klick verändert auch die Nachbarfelder.':['Jeder Klick verändert auch die benachbarten Felder.','Chaque clic change aussi les cases voisines.','Cada clic también cambia las casillas vecinas.','Ogni clic cambia anche le caselle vicine.'],
    'Ich denke an eine Zahl zwischen 1 und 100.':['Ich denke an eine Zahl zwischen 1 und 100.','Je pense à un nombre entre 1 et 100.','Estoy pensando en un número entre 1 y 100.','Sto pensando a un numero tra 1 e 100.'],
    'Steuere deinen Schläger mit W/S oder ↑/↓. Am Handy die Buttons verwenden.':['Steuere deinen Schläger mit W/S oder ↑/↓. Am Handy kannst du die Buttons verwenden.','Déplace ta raquette avec W/S ou ↑/↓. Sur mobile, utilise les boutons.','Controla tu pala con W/S o ↑/↓. En móvil, usa los botones.','Muovi la racchetta con W/S o ↑/↓. Sul telefono usa i pulsanti.'],
    'Wähle eine Tür pro Etage. Hinter einer Tür wartet der Drache. Du kannst nach jeder sicheren Etage auszahlen.':['Wähle eine Tür pro Etage. Hinter einer Tür wartet der Drache. Du kannst nach jeder sicheren Etage auszahlen.','Choisis une porte par étage. Le dragon se cache derrière l’une d’elles. Tu peux encaisser après chaque étage sûr.','Elige una puerta por piso. El dragón espera detrás de una puerta. Puedes cobrar después de cada piso seguro.','Scegli una porta per piano. Il drago si nasconde dietro una porta. Puoi incassare dopo ogni piano sicuro.'],
    'Run starten':['Run starten','Lancer la partie','Iniciar partida','Avvia partita'],'Rennen starten':['Start race','Lancer la course','Iniciar carrera','Avvia gara'],
    'Kugel rollen':['Spin the ball','Lancer la bille','Girar la bola','Fai girare la pallina'],'Kugel fallen lassen':['Drop ball','Laisser tomber la bille','Dejar caer la bola','Lascia cadere la pallina'],
    'Einsatz platzieren':['Place bet','Placer la mise','Realizar apuesta','Piazza puntata'],'Karte':['Hit','Tirer','Pedir carta','Carta'],'Halten':['Stand','Rester','Plantarse','Stai'],'Verdoppeln':['Double','Doubler','Doblar','Raddoppia'],
    'Höher':['Higher','Plus haut','Mayor','Più alta'],'Tiefer':['Lower','Plus bas','Menor','Più bassa'],'Neu mischen':['Shuffle again','Mélanger à nouveau','Barajar de nuevo','Mescola di nuovo'],
    'Neues Rätsel':['New puzzle','Nouveau puzzle','Nuevo rompecabezas','Nuovo schema'],'Prüfen':['Check','Vérifier','Comprobar','Controlla'],'Neu':['New','Nouveau','Nuevo','Nuovo']
  };
  var langIndex={de:-1,en:0,fr:1,es:2,it:3};
  function getLang(){try{return JSON.parse(localStorage.getItem('labtoso-games:nexora:settings')||'{}').language||'de'}catch(e){return'de'}}
  function translateElement(el){if(!el||el.nodeType!==1)return;var idx=langIndex[getLang()];if(idx===undefined)return;
    if(el.children.length===0){var current=el.textContent.trim(),last=el.dataset.nxLastTranslated;if(!el.dataset.nxOriginalText|| (last!==undefined&&current!==last)){el.dataset.nxOriginalText=current;}var original=el.dataset.nxOriginalText;if(D[original]){var next=idx<0?original:D[original][idx];if(current!==next){el.textContent=next;}el.dataset.nxLastTranslated=next;}}
    ['placeholder','title','aria-label'].forEach(function(a){var v=el.getAttribute(a);if(!v)return;var orig=el.dataset['nxOrig'+a]||v;if(!el.dataset['nxOrig'+a])el.dataset['nxOrig'+a]=orig;if(D[orig])el.setAttribute(a,idx<0?orig:D[orig][idx]);});
  }
  function translateGames(){var idx=langIndex[getLang()];if(idx===undefined)return;document.querySelectorAll('.stage button,.stage label,.stage p,.stage h2,.stage h3,.stage small,.stage span,.stage input,.library-tools input,.library-tools button,#wallet button,#wallet label,#wallet span,#wallet p,#wallet strong,#tabs button,#ctabs button,#modebar button').forEach(translateElement);}
  /* One-shot translate on load — no body-wide MutationObserver (that made the page crawl) */
  if(getLang()!=='de')translateGames();
  window.addEventListener('pk-skin',function(){if(getLang()!=='de')translateGames()});
})();



(function(){
  var content=document.getElementById('settings-content');if(!content)return;
  function sync(){
    var toggle=content.querySelector('[data-k="particles"]');
    var effectButton=content.querySelector('[data-k="effect"]');
    var row=effectButton&&effectButton.closest('.srow');
    var on=!!(toggle&&toggle.getAttribute('aria-checked')==='true');
    if(row)row.hidden=!on;
    var snowRow=content.querySelector('[data-k="snow"]');if(snowRow&&snowRow.closest('.srow'))snowRow.closest('.srow').hidden=true;
  }
  content.addEventListener('click',function(e){if(e.target.closest('[data-k="particles"]'))setTimeout(sync,0)});
  window.addEventListener('pk-skin',sync);
  sync();
})();



(function(){
  var side=document.querySelector('.nx-sidebar'), mode=document.getElementById('modebar');
  function resetPickerScroll(){var active=document.querySelector('.nx-sidebar #tabs:not([hidden]),.nx-sidebar #ctabs:not([hidden])');if(active)active.scrollTop=0;if(side)side.scrollTop=0;}
  if(mode)mode.addEventListener('click',function(){requestAnimationFrame(resetPickerScroll)});
  document.querySelectorAll('#tabs button,#ctabs button').forEach(function(b){b.addEventListener('click',function(){var active=document.querySelector('.nx-sidebar #tabs:not([hidden]),.nx-sidebar #ctabs:not([hidden])');if(active){var r=b.getBoundingClientRect(),p=active.getBoundingClientRect();if(r.top<p.top||r.bottom>p.bottom)active.scrollTop+=r.top<p.top?r.top-p.top:r.bottom-p.bottom;}})});
  var translations={
    'Reaktion':['Reaction','Réaction','Reacción','Reazione'],'Klick-Jagd':['Click Hunt','Chasse aux clics','Caza de clics','Caccia al clic'],'Flappy Ente':['Flappy Duck','Canard volant','Pato volador','Anatra volante'],'Zahlenjagd':['Number Hunt','Chasse aux nombres','Caza de números','Caccia ai numeri'],'Würfeln':['Dice Roll','Dés','Dados','Dadi'],'Hoch oder Tief':['Higher or Lower','Plus ou moins','Mayor o menor','Più o meno'],'Münzwurf':['Coin Flip','Pile ou face','Lanzamiento de moneda','Lancio della moneta'],'Entenrennen':['Duck Race','Course de canards','Carrera de patos','Gara delle anatre'],'Rubbellos':['Scratch Card','Ticket à gratter','Rasca y gana','Gratta e vinci'],
    'Rekord:':['Best:','Record :','Récord:','Record:'],'Siege':['Wins','Victoires','Victorias','Vittorie'],'gegen den Computer':['vs. computer','contre l’ordinateur','contra el ordenador','contro il computer'],'Triff die auftauchenden Ziele':['Hit the appearing targets','Touche les cibles qui apparaissent','Golpea los objetivos que aparecen','Colpisci i bersagli che appaiono'],'Merke dir die Farbfolge':['Remember the color sequence','Mémorise la séquence de couleurs','Recuerda la secuencia de colores','Ricorda la sequenza di colori'],'Schalte alle Lichter aus':['Turn off all lights','Éteins toutes les lumières','Apaga todas las luces','Spegni tutte le luci'],'Finde die geheime Zahl':['Find the secret number','Trouve le nombre secret','Encuentra el número secreto','Trova il numero segreto'],'Schlage den Computer':['Beat the computer','Bats l’ordinateur','Vence al ordenador','Batti il computer'],'Steig Etage für Etage':['Climb floor by floor','Monte étage par étage','Sube piso a piso','Sali piano dopo piano'],'Du bestimmst das Risiko':['You set the risk','Tu choisis le risque','Tú decides el riesgo','Decidi tu il rischio'],'Quoten wechseln':['Odds change','Les cotes cambian','Las cuotas cambian','Le quote cambiano'],'Zeitpunkt wählen':['Choose when to cash out','Choisis quand encaisser','Elige cuándo cobrar','Scegli quando incassare'],
    'Bitte eine ganze Zahl von 1 bis 100 eingeben.':['Enter a whole number from 1 to 100.','Saisis un nombre entier de 1 à 100.','Introduce un número entero del 1 al 100.','Inserisci un numero intero da 1 a 100.'],'Zeit vorbei! Deine Treffer:':['Time is up! Your hits:','Temps écoulé ! Tes réussites :','¡Se acabó el tiempo! Tus aciertos:','Tempo scaduto! I tuoi colpi:'],'Leider falsch! Erreichtes Level:':['Incorrect! Level reached:','Incorrect ! Niveau atteint :','¡Incorrecto! Nivel alcanzado:','Sbagliato! Livello raggiunto:'],'Richtig! Nächste Runde …':['Correct! Next round …','Correct ! Manche suivante…','¡Correcto! Siguiente ronda…','Corretto! Prossimo turno…'],'Volltreffer! Du hast die Zahl in':['Bullseye! You found the number in','Bravo ! Tu as trouvé le nombre en','¡Acertaste! Encontraste el número en','Centro! Hai trovato il numero in'],
    'Spiel suchen …':['Search games …','Rechercher des jeux …','Buscar juegos …','Cerca giochi …'],'★ Favoriten':['★ Favorites','★ Favoris','★ Favoritos','★ Preferiti'],'18 Spiele':['18 games','18 jeux','18 juegos','18 giochi'],
    'Chip balance':['Chip balance','Solde de jetons','Saldo de fichas','Saldo fiche'],
    'Aktueller Einsatz':['Current bet','Mise actuelle','Apuesta actual','Puntata attuale'],
    'Einsatz ändern':['Change bet','Changer la mise','Cambiar apuesta','Cambia puntata'],
    'Chips':['Chips','Jetons','Fichas','Fiches'],
    'Einsatz steuerst du über „Einsatz ändern“.':['Control your bet via “Change bet”.','Gère ta mise via « Changer la mise ».','Controla tu apuesta con « Cambiar apuesta ».','Gestisci la puntata con « Cambia puntata ».'],
    'Einsatz wählen':['Choose bet','Choisir la mise','Elegir apuesta','Scegli puntata'],
    'Eigener Einsatz':['Custom bet','Mise perso','Apuesta personalizada','Puntata personalizzata'],
    'Immer maximalen Einsatz verwenden':['Always use maximum bet','Toujours utiliser la mise max','Usar siempre la apuesta máxima','Usa sempre la puntata massima'],
    'Abbrechen':['Cancel','Annuler','Cancelar','Annulla'],
    'Spielen':['Play','Jouer','Jugar','Gioca'],
    'Chips holen':['Get chips','Obtenir des jetons','Conseguir fichas','Ottieni fiche'],
    'Auf 1.000 zurücksetzen':['Reset to 1,000','Réinitialiser à 1 000','Restablecer a 1.000','Reimposta a 1.000'],
    'Eigene Menge':['Custom amount','Montant perso','Cantidad personalizada','Importo personalizzato'],
    'Min':['Min','Min','Mín','Min'],
    'Max':['Max','Max','Máx','Max'],
    'DREHEN':['SPIN','TOURNER','GIRAR','GIRA'],
    'Drehen':['Spin','Tourner','Girar','Gira'],
    'Auszahlen':['Cash out','Encaisser','Cobrar','Incassa'],
    'Kopf':['Heads','Face','Cara','Testa'],
    'Zahl':['Tails','Pile','Cruz','Croce'],
    'Schließen':['Close','Fermer','Cerrar','Chiudi'],
    'Casino':['Casino','Casino','Casino','Casino'],
    'Arcade':['Arcade','Arcade','Arcade','Arcade'],
    'Slots':['Slots','Machines à sous','Tragamonedas','Slot'],
    'Roulette':['Roulette','Roulette','Ruleta','Roulette'],
    'Glücksrad':['Wheel of Fortune','Roue de la fortune','Ruleta de la fortuna','Ruota della fortuna'],
    'Blackjack':['Blackjack','Blackjack','Blackjack','Blackjack'],
    'Crash':['Crash','Crash','Crash','Crash'],
    'Plinko':['Plinko','Plinko','Plinko','Plinko'],
    'Minen':['Mines','Mines','Minas','Mine'],
    'Dragon Tower':['Dragon Tower','Tour du dragon','Torre del dragón','Torre del drago'],
    'Snake':['Snake','Snake','Snake','Snake'],
    'Pong':['Pong','Pong','Pong','Pong'],
    'Whack-a-Mole':['Whack-a-Mole','Whack-a-Mole','Whack-a-Mole','Whack-a-Mole'],
    'Simon Says':['Simon Says','Simon','Simon dice','Simon dice'],
    'Lights Out':['Lights Out','Lights Out','Lights Out','Lights Out'],
    '2048':['2048','2048','2048','2048']
  };
  var langs={de:-1,en:0,fr:1,es:2,it:3};
  function lang(){try{return JSON.parse(localStorage.getItem('labtoso-games:nexora:settings')||'{}').language||'de'}catch(e){return'de'}}
  var originals=new WeakMap(),textOriginals=new WeakMap();
  function translate(el){if(!el||el.nodeType!==1)return;var idx=langs[lang()];if(idx===undefined)return;
    Array.prototype.forEach.call(el.childNodes,function(node){if(node.nodeType===3){if(!textOriginals.has(node))textOriginals.set(node,node.nodeValue);var raw=textOriginals.get(node).trim();if(translations[raw])node.nodeValue=(idx<0?raw:translations[raw][idx]);}});
    if(!originals.has(el))originals.set(el,el.textContent);
    var orig=originals.get(el).trim();
    if(translations[orig]){var value=idx<0?orig:translations[orig][idx];if(el.children.length===0)el.textContent=value;}
    if(el.children.length===0){Object.keys(translations).forEach(function(k){if(orig.indexOf(k)===0&&k.endsWith(':')){var tail=orig.slice(k.length);el.textContent=(idx<0?k:translations[k][idx])+tail;}})}
    ['placeholder','aria-label','title'].forEach(function(a){var key='nx-lang-'+a;if(!el.dataset[key])el.dataset[key]=el.getAttribute(a)||'';var v=el.dataset[key];if(translations[v])el.setAttribute(a,idx<0?v:translations[v][idx]);});
  }
  function run(){document.querySelectorAll('#tabs button,#tabs button small,#ctabs button,#ctabs button small,.stage button,.stage label,.stage p,.stage h2,.stage h3,.stage small,.stage span,.library-tools input,.library-tools button').forEach(translate);}
  /* Translate once on load if needed — no continuous DOM observer */
  if(lang()!=='de')run();
  window.addEventListener('pk-skin',function(){if(lang()!=='de')run()});
})();



(function () {
  if (window.__nexoraCatEgg) return;
  window.__nexoraCatEgg = true;

  var CORNERS = [
    { top: '18px', left: '18px', right: 'auto', bottom: 'auto' },
    { top: '18px', left: 'auto', right: '18px', bottom: 'auto' },
    { top: 'auto', left: '18px', right: 'auto', bottom: '22px' },
    { top: 'auto', left: 'auto', right: '18px', bottom: '22px' }
  ];

  var catEl = null, menuEl = null, badgeEl = null;
  var realRandom = Math.random.bind(Math);

  function luckOn() {
    var L = window.__nexoraLuck;
    return !!(L && L.until > Date.now() && L.power > 1);
  }

  /* No global Math.random override — that broke probability checks (dragon always hit, HiLo inverted). */

  function loadLuck() {
    try {
      var raw = sessionStorage.getItem('nexora_luck');
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.until > Date.now()) {
          window.__nexoraLuck = o;
        } else sessionStorage.removeItem('nexora_luck');
      }
    } catch (e) {}
  }
  function saveLuck() {
    try {
      if (window.__nexoraLuck && window.__nexoraLuck.until > Date.now())
        sessionStorage.setItem('nexora_luck', JSON.stringify(window.__nexoraLuck));
      else sessionStorage.removeItem('nexora_luck');
    } catch (e) {}
  }
  loadLuck();

  function lang() {
    try { return JSON.parse(localStorage.getItem('labtoso-games:nexora:settings') || '{}').language || 'de'; }
    catch (e) { return 'de'; }
  }
  var I18N = {
    de: {
      title: ':3  Katzen-Segen',
      sub: 'Die Katze schenkt dir reines Glück — Jackpot-Chancen steigen massiv (ca. ×100). Nur Luck, keine Chip-Geschenke.',
      boost: 'MEGA LUCK ×100',
      boostHint: 'Alle Casino-Züge stark begünstigt · 3 Minuten',
      already: 'Bereits aktiv',
      active: 'Aktiv!',
      close: 'Schließen',
      badge: function (p, t) { return ':3 MEGA LUCK ×' + p + ' · ' + t; },
      toastOn: ':3 MEGA LUCK ×100 — 3 Minuten',
      toastTest: 'Katzen-Test — Ctrl+Alt+C',
      catLabel: 'Katzen-Easter-Egg'
    },
    en: {
      title: ':3  Cat Blessing',
      sub: 'The cat grants pure luck — jackpot odds rise massively (about ×100). Luck only, no free chips.',
      boost: 'MEGA LUCK ×100',
      boostHint: 'All casino outcomes heavily boosted · 3 minutes',
      already: 'Already active',
      active: 'Active!',
      close: 'Close',
      badge: function (p, t) { return ':3 MEGA LUCK ×' + p + ' · ' + t; },
      toastOn: ':3 MEGA LUCK ×100 — 3 minutes',
      toastTest: 'Cat test — Ctrl+Alt+C',
      catLabel: 'Cat Easter egg'
    },
    fr: {
      title: ':3  Bénédiction du chat',
      sub: 'Le chat t’offre pure chance — les jackpots deviennent bien plus probables (≈ ×100). Seulement la chance, pas de jetons gratuits.',
      boost: 'MEGA LUCK ×100',
      boostHint: 'Tous les jeux casino fortement favorisés · 3 minutes',
      already: 'Déjà actif',
      active: 'Actif !',
      close: 'Fermer',
      badge: function (p, t) { return ':3 MEGA LUCK ×' + p + ' · ' + t; },
      toastOn: ':3 MEGA LUCK ×100 — 3 minutes',
      toastTest: 'Test chat — Ctrl+Alt+C',
      catLabel: 'Easter egg chat'
    },
    es: {
      title: ':3  Bendición del gato',
      sub: 'El gato te da pura suerte — las probabilidades de jackpot suben mucho (aprox. ×100). Solo suerte, sin fichas gratis.',
      boost: 'MEGA LUCK ×100',
      boostHint: 'Todos los juegos de casino muy favorecidos · 3 minutos',
      already: 'Ya activo',
      active: '¡Activo!',
      close: 'Cerrar',
      badge: function (p, t) { return ':3 MEGA LUCK ×' + p + ' · ' + t; },
      toastOn: ':3 MEGA LUCK ×100 — 3 minutos',
      toastTest: 'Prueba del gato — Ctrl+Alt+C',
      catLabel: 'Easter egg del gato'
    },
    it: {
      title: ':3  Benedizione del gatto',
      sub: 'Il gatto ti regala pura fortuna — le chance di jackpot salgono moltissimo (circa ×100). Solo luck, niente fiches gratis.',
      boost: 'MEGA LUCK ×100',
      boostHint: 'Tutti i giochi casino fortemente favoriti · 3 minuti',
      already: 'Già attivo',
      active: 'Attivo!',
      close: 'Chiudi',
      badge: function (p, t) { return ':3 MEGA LUCK ×' + p + ' · ' + t; },
      toastOn: ':3 MEGA LUCK ×100 — 3 minuti',
      toastTest: 'Test gatto — Ctrl+Alt+C',
      catLabel: 'Easter egg gatto'
    }
  };
  function t() { return I18N[lang()] || I18N.de; }

  function fmtLeft(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60); s = s % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function updateBadge() {
    if (!luckOn()) {
      window.__nexoraLuck = null;
      saveLuck();
      if (badgeEl) badgeEl.hidden = true;
      return;
    }
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.id = 'nexora-luck-badge';
      badgeEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(badgeEl);
    }
    badgeEl.hidden = false;
    badgeEl.textContent = t().badge(window.__nexoraLuck.power, fmtLeft(window.__nexoraLuck.until - Date.now()));
  }
  setInterval(updateBadge, 1000);
  updateBadge();
  window.addEventListener('pk-skin', updateBadge);
  document.addEventListener('change', function (e) {
    if (e.target && e.target.matches && e.target.matches('#settings-content select')) setTimeout(updateBadge, 30);
  });

  function removeCat() {
    if (catEl && catEl.parentNode) catEl.parentNode.removeChild(catEl);
    catEl = null;
  }

  function spawnCat(forced) {
    if (catEl) removeCat();
    catEl = document.createElement('button');
    catEl.id = 'nexora-cat';
    catEl.type = 'button';
    catEl.setAttribute('aria-label', t().catLabel);
    catEl.title = forced ? 'Ctrl+Alt+C / Ctrl+Shift+3' : ':3';
    catEl.textContent = ':3';
    catEl.style.cssText = 'position:fixed;z-index:10050;pointer-events:auto;top:50%;left:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);';
    catEl.addEventListener('click', function () { removeCat(); openMenu(); });
    document.body.appendChild(catEl);
    setTimeout(function () { if (catEl) removeCat(); }, 45000);
  }
  window.nexoraSpawnCat = function () { spawnCat(true); };

  function openMenu() {
    if (menuEl) menuEl.remove();
    var L = t();
    var already = luckOn();
    menuEl = document.createElement('div');
    menuEl.id = 'nexora-cat-menu';
    menuEl.setAttribute('role', 'dialog');
    menuEl.setAttribute('aria-modal', 'true');
    menuEl.setAttribute('aria-label', L.title);
    menuEl.innerHTML =
      '<div class="nx-cat-card">' +
      '<h3>' + L.title + '</h3>' +
      '<p class="nx-cat-sub">' + L.sub + '</p>' +
      '<button type="button" class="nx-cat-boost" data-boost="mega"' + (already ? ' disabled' : '') + '>' +
      '<strong>' + L.boost + '</strong>' +
      '<span>' + (already ? L.already : L.boostHint) + '</span>' +
      '</button>' +
      '<button type="button" class="nx-cat-close">' + L.close + '</button>' +
      '</div>';

    function close() { if (menuEl) menuEl.remove(); menuEl = null; }
    menuEl.querySelector('.nx-cat-close').addEventListener('click', close);
    menuEl.addEventListener('click', function (e) { if (e.target === menuEl) close(); });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });
    var btn = menuEl.querySelector('[data-boost="mega"]');
    if (btn && !already) {
      btn.addEventListener('click', function () {
        window.__nexoraLuck = { power: 100, until: Date.now() + 3 * 60 * 1000 };
        saveLuck();
        updateBadge();
        toast(L.toastOn);
        btn.disabled = true;
        btn.querySelector('span').textContent = L.active;
        setTimeout(close, 600);
      });
    }
    document.body.appendChild(menuEl);
    menuEl.querySelector('.nx-cat-close').focus();
  }

  function toast(msg) {
    var el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:10000;padding:10px 16px;border-radius:12px;background:#2a1830;border:1px solid #ff7ab8;color:#ffe0ef;font:700 .9rem system-ui;box-shadow:0 12px 30px #0008;';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  }

  setInterval(function () {
    if (realRandom() < 0.01) spawnCat(false);
  }, 60 * 1000);

  function isCatHotkey(e) {
    var code = e.code || '';
    var key = (e.key || '').toLowerCase();
    /* Ctrl+Alt+C  or  Ctrl+Shift+3  or  Ctrl+Alt+3 */
    if (e.ctrlKey && e.altKey && !e.shiftKey && (code === 'KeyC' || key === 'c')) return true;
    if (e.ctrlKey && e.shiftKey && !e.altKey && (code === 'Digit3' || key === '3' || e.key === '§')) return true;
    if (e.ctrlKey && e.altKey && (code === 'Digit3' || key === '3')) return true;
    return false;
  }
  document.addEventListener('keydown', function (e) {
    if (!isCatHotkey(e)) return;
    e.preventDefault();
    e.stopPropagation();
    spawnCat(true);
    toast(t().toastTest);
  }, true);
})();
