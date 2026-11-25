/* Casino · play credits only. Rules: STYLEGUIDE.md */
(function () {
  'use strict';
  const Sh = window.Shell;
  const E = Sh.ease;
  const $ = (id) => document.getElementById(id);
  const RED = Sh.reduced;

  /* ---------- strings and tuning ---------- */
  const T = {
    ready: 'Ready', spinning: 'Spinning…', noWin: 'No win', close: 'So close…',
    place: 'Place a bet', flying: 'Cash out before it crashes', crashed: (m) => 'Crashed at ' + m,
    cashed: (p) => '+' + fmt(p) + ' secured', yourTurn: 'Your move', bust: 'Bust', push: 'Push',
    dealerBj: 'Dealer has blackjack', bj: 'Blackjack!', youWin: 'You win', dealerWins: 'Dealer wins',
    big: ['Big win', 'Huge win', 'Mega win', 'Epic win'],
    broke: 'Not enough credits', claimed: 'Come back tomorrow', level: 'Level up',
  };
  const START = 1000;
  const DAILY = [500, 750, 1000, 1500, 2000, 3000, 5000];
  const XP_NEED = (l) => Math.round(120 * Math.pow(l, 1.45));
  const LEVEL_REWARD = (l) => 150 + 100 * l;
  const CASHBACK = (l) => Math.min(0.03, 0.01 + 0.001 * l);
  const STREAK_BOOST = (s) => 1 + Math.min(s, 8) * 0.15;

  /* ---------- state ---------- */
  const KEY = 'casino:state';
  const fresh = () => ({
    v: 1, balance: START, cashback: 0, streak: 0, bestStreak: 0, xp: 0, level: 1,
    history: [START], peak: START, sessionStart: START, turbo: false,
    stats: { bets: 0, wagered: 0, won: 0, bigMult: 0, crashOuts: 0, games: {} },
    ach: {}, daily: { last: '', day: 0 }, recent: [],
  });
  let st = Sh.store.get(KEY, null);
  if (!st) {
    st = fresh();
    try { // carry the balance over from the first version of this page
      const old = JSON.parse(localStorage.getItem('labtoso_casino_v4') || 'null');
      if (old && typeof old.balance === 'number' && !Sh.debug.on) {
        st.balance = st.peak = st.sessionStart = Math.max(0, Math.round(old.balance));
        st.history = [st.balance];
        st.turbo = !!old.turbo;
      }
    } catch (e) { /* ignore */ }
  }
  st = Object.assign(fresh(), st);
  st.stats = Object.assign(fresh().stats, st.stats);
  if (Sh.debug.on && Sh.debug.money) st.balance = Sh.debug.money;
  const save = () => Sh.store.set(KEY, st);

  const fmt = (n) => {
    const r = Math.round(n * 100) / 100;
    return r.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 });
  };
  const fmtM = (m) => (m >= 100 ? Math.round(m) : m.toFixed(2)) + '×';
  const r2 = (n) => Math.round(n * 100) / 100;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const speed = () => (st.turbo ? 0.45 : 1);

  /* ---------- sound ---------- */
  const snd = Sh.sound;
  const NOTE = (n) => 220 * Math.pow(2, n / 12);
  const sfx = {
    click() { snd.tone(900, 0.03, 'square', 0.08); },
    chip() { snd.tone(1400, 0.04, 'triangle', 0.12); snd.tone(1900, 0.05, 'triangle', 0.08, 0, 0.03); },
    tick(i) { snd.tone(300 + i * 40, 0.025, 'square', 0.05); },
    stop(i) { snd.tone(140 + i * 10, 0.09, 'triangle', 0.35, 0.6); snd.noise(0.05, 0.12, 2600); },
    tease(i) { snd.tone(NOTE(12 + i * 3), 0.22, 'sawtooth', 0.06, 1.25); },
    win(m) {
      const base = m >= 10 ? [0, 4, 7, 12, 16, 19, 24] : m >= 3 ? [0, 4, 7, 12, 16] : [0, 4, 7];
      base.forEach((n, i) => snd.tone(NOTE(24 + n), 0.18, 'triangle', 0.22, 0, i * 0.055));
    },
    small() { snd.tone(NOTE(24), 0.08, 'triangle', 0.18); snd.tone(NOTE(31), 0.12, 'triangle', 0.16, 0, 0.06); },
    lose() { snd.tone(180, 0.22, 'sawtooth', 0.09, 0.55); },
    crash() { snd.noise(0.6, 0.5, 400); snd.tone(120, 0.5, 'sawtooth', 0.25, 0.3); },
    peg(x) { snd.tone(1800 + Math.random() * 600, 0.03, 'sine', 0.06, 0, 0, x); },
    bucket(m) { snd.tone(m >= 1 ? NOTE(19 + Math.min(m, 30) / 2) : NOTE(7), 0.12, 'triangle', 0.18); },
    card() { snd.noise(0.06, 0.25, 3200); },
    flip() { snd.noise(0.09, 0.2, 1800); snd.tone(600, 0.05, 'triangle', 0.08); },
    coin(i) { snd.tone(NOTE(31 + (i % 5) * 2), 0.06, 'square', 0.05); },
    level() { [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((n, i) => snd.tone(NOTE(19 + n), 0.16, 'square', 0.09, 0, i * 0.07)); },
    ach() { [12, 16, 19, 24].forEach((n, i) => snd.tone(NOTE(24 + n), 0.22, 'triangle', 0.18, 0, i * 0.08)); },
    rise(m) { snd.tone(200 + Math.min(m, 50) * 40, 0.05, 'triangle', 0.08); },
  };

  /* ---------- fx: particles from a fixed pool ---------- */
  const fx = $('fx'), fctx = fx.getContext('2d');
  let fw = 0, fh = 0, fdpr = 1;
  function fitFx() { fdpr = Math.min(devicePixelRatio || 1, 2); fw = innerWidth; fh = innerHeight; fx.width = fw * fdpr; fx.height = fh * fdpr; }
  addEventListener('resize', fitFx); fitFx();
  const POOL = 360;
  const parts = Array.from({ length: POOL }, () => ({ on: false }));
  const INK = { yellow: '#ffd056', pink: '#ff5e95', green: '#3dcc8c', orange: '#ff8d58', blue: '#6f96ff', ink: '#efe7d7' };
  function burst(x, y, n, colors, power = 1, kind = 'coin') {
    n = RED ? Math.ceil(n / 4) : n;
    for (const p of parts) {
      if (n <= 0) break;
      if (p.on) continue;
      const a = Math.random() * Math.PI * 2, s = (2 + Math.random() * 7) * power;
      Object.assign(p, {
        on: true, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4 * power, life: 1,
        decay: 0.008 + Math.random() * 0.012, size: kind === 'coin' ? 6 + Math.random() * 5 : 2 + Math.random() * 3,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0], kind,
      });
      n--;
    }
    if (!fxRunning) { fxRunning = true; requestAnimationFrame(fxLoop); }
  }
  let fxRunning = false, fxLast = 0;
  function fxLoop(t) {
    const dt = Math.min(2, fxLast ? (t - fxLast) / 16.7 : 1); fxLast = t;
    fctx.setTransform(fdpr, 0, 0, fdpr, 0, 0);
    fctx.clearRect(0, 0, fw, fh);
    let alive = 0;
    for (const p of parts) {
      if (!p.on) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.32 * dt; p.vx *= 0.99; p.rot += p.vr * dt; p.life -= p.decay * dt;
      if (p.life <= 0 || p.y > fh + 20) { p.on = false; continue; }
      alive++;
      fctx.globalAlpha = Math.min(1, p.life * 1.6);
      fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot);
      if (p.kind === 'coin') {
        const w = p.size * Math.abs(Math.cos(p.rot * 2)) + 1;
        fctx.fillStyle = 'rgba(0,0,0,0.45)'; fctx.fillRect(-w / 2 + 2, -p.size / 2 + 2, w, p.size);
        fctx.fillStyle = p.c; fctx.fillRect(-w / 2, -p.size / 2, w, p.size);
        fctx.strokeStyle = '#1a1820'; fctx.lineWidth = 1.5; fctx.strokeRect(-w / 2, -p.size / 2, w, p.size);
      } else { fctx.fillStyle = p.c; fctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); }
      fctx.restore();
    }
    fctx.globalAlpha = 1;
    if (alive) requestAnimationFrame(fxLoop); else { fxRunning = false; fxLast = 0; fctx.clearRect(0, 0, fw, fh); }
  }
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  function shake(big) {
    if (RED) return;
    const s = $('stage');
    s.classList.remove('shake', 'big'); void s.offsetWidth;
    s.classList.add('shake'); if (big) s.classList.add('big');
  }

  /* ---------- account HUD ---------- */
  let shownBal = st.balance, balAnim = 0;
  function paintBalance() {
    const el = $('balance');
    const from = shownBal, to = st.balance;
    if (from === to) { el.textContent = fmt(to); return; }
    el.classList.toggle('up', to > from); el.classList.toggle('down', to < from);
    const t0 = performance.now(), dur = RED ? 0 : Math.min(900, 250 + Math.abs(to - from) / 5);
    const id = ++balAnim;
    const step = (t) => {
      if (id !== balAnim) return;
      const k = dur ? Math.min(1, (t - t0) / dur) : 1;
      shownBal = from + (to - from) * E.outCubic(k);
      el.textContent = fmt(k < 1 ? Math.round(shownBal) : to);
      if (k < 1) requestAnimationFrame(step); else { shownBal = to; setTimeout(() => el.classList.remove('up', 'down'), 300); }
    };
    requestAnimationFrame(step);
  }
  function paintHud() {
    paintBalance();
    $('refill').hidden = !(st.balance < 1);
    $('level').textContent = st.level;
    const need = XP_NEED(st.level);
    $('xpfill').style.width = Math.min(100, (st.xp / need) * 100) + '%';
    $('xptext').textContent = fmt(Math.floor(st.xp)) + ' / ' + fmt(need) + ' XP';
    $('streak').textContent = st.streak;
    $('streakboost').textContent = 'XP ×' + STREAK_BOOST(st.streak).toFixed(2).replace(/0$/, '');
    $('streakbox').classList.toggle('hot', st.streak >= 3);
    $('streakbox').classList.toggle('blazing', st.streak >= 6);
    $('cbrate').textContent = (CASHBACK(st.level) * 100).toFixed(1) + '%';
    $('cbamount').textContent = fmt(Math.floor(st.cashback * 100) / 100);
    $('cashback').disabled = st.cashback < 0.01;
    $('turbo').setAttribute('aria-pressed', String(st.turbo));
    paintSession();
  }
  function paintSession() {
    const p = st.balance - st.sessionStart;
    const el = $('sprofit');
    el.textContent = (p > 0 ? '+' : p < 0 ? '−' : '±') + fmt(Math.abs(p));
    el.className = 'num ' + (p > 0 ? 'pos' : p < 0 ? 'neg' : '');
    $('speak').textContent = fmt(st.peak);
    drawChart();
  }
  const chart = $('chart');
  function drawChart() {
    const box = chart.parentElement.getBoundingClientRect();
    const d = Math.min(devicePixelRatio || 1, 2), w = Math.max(1, box.width | 0), h = Math.max(1, box.height | 0);
    chart.width = w * d; chart.height = h * d; chart.style.width = w + 'px'; chart.style.height = h + 'px';
    const c = chart.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
    const pts = st.history; if (pts.length < 2) return;
    const mn = Math.min(...pts, st.sessionStart), mx = Math.max(...pts, st.sessionStart), rg = mx - mn || 1;
    const Y = (v) => h - 5 - ((v - mn) / rg) * (h - 10);
    c.strokeStyle = 'rgba(239,231,215,0.25)'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(0, Y(st.sessionStart)); c.lineTo(w, Y(st.sessionStart)); c.stroke(); c.setLineDash([]);
    c.strokeStyle = pts[pts.length - 1] >= st.sessionStart ? INK.green : INK.orange; c.lineWidth = 2; c.beginPath();
    pts.forEach((v, i) => { const x = (i / (pts.length - 1)) * w; i ? c.lineTo(x, Y(v)) : c.moveTo(x, Y(v)); });
    c.stroke();
  }

  /* ---------- toasts ---------- */
  function toast(kind, title, sub, cls) {
    const el = document.createElement('div');
    el.className = 'toast ' + (cls || '');
    el.innerHTML = '<div class="k"></div><b></b><span></span>';
    el.children[0].textContent = kind; el.children[1].textContent = title; el.children[2].textContent = sub || '';
    $('toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3600);
  }

  /* ---------- achievements ---------- */
  const A = [
    ['first', 'First chip', 'Place your first bet', 100, () => st.stats.bets >= 1],
    ['firstwin', 'Beginner’s luck', 'Win a bet', 100, () => st.stats.won >= 1],
    ['tourist', 'Tourist', 'Play all four games', 400, () => Object.keys(st.stats.games).length >= 4, () => [Object.keys(st.stats.games).length, 4]],
    ['b100', 'Regular', 'Place 100 bets', 500, () => st.stats.bets >= 100, () => [st.stats.bets, 100]],
    ['b1000', 'Night shift', 'Place 1,000 bets', 3000, () => st.stats.bets >= 1000, () => [st.stats.bets, 1000]],
    ['x10', 'Ten times', 'Win 10× your bet or more', 500, () => st.stats.bigMult >= 10],
    ['x50', 'Fifty times', 'Win 50× your bet or more', 2000, () => st.stats.bigMult >= 50],
    ['x100', 'Hundredfold', 'Win 100× your bet or more', 5000, () => st.stats.bigMult >= 100],
    ['s5', 'Hot hand', 'Win 5 bets in a row', 750, () => st.bestStreak >= 5, () => [st.streak, 5]],
    ['s10', 'On fire', 'Win 10 bets in a row', 3000, () => st.bestStreak >= 10, () => [st.streak, 10]],
    ['moon', 'Moonshot', 'Cash out Crash at 10× or more', 2000, () => !!st.ach._moon],
    ['steady', 'Steady hands', 'Cash out Crash 25 times', 600, () => st.stats.crashOuts >= 25, () => [st.stats.crashOuts, 25]],
    ['edge', 'Edge of the board', 'Land a Plinko ball in an outer bucket', 1500, () => !!st.ach._edge],
    ['natural', 'Natural', 'Get a blackjack', 500, () => !!st.ach._natural],
    ['five', 'Five cards', 'Win a hand of blackjack with five cards', 1000, () => !!st.ach._five],
    ['dbl', 'Doubled up', 'Win a doubled blackjack hand', 300, () => !!st.ach._dbl],
    ['w10k', 'High roller', 'Bet 10,000 credits in total', 1000, () => st.stats.wagered >= 1e4, () => [st.stats.wagered, 1e4]],
    ['w100k', 'Whale', 'Bet 100,000 credits in total', 10000, () => st.stats.wagered >= 1e5, () => [st.stats.wagered, 1e5]],
    ['l5', 'Known face', 'Reach level 5', 1000, () => st.level >= 5, () => [st.level, 5]],
    ['l10', 'Fixture', 'Reach level 10', 3000, () => st.level >= 10, () => [st.level, 10]],
    ['l25', 'Legend', 'Reach level 25', 15000, () => st.level >= 25, () => [st.level, 25]],
    ['k10', 'Five figures', 'Hold 10,000 credits', 1000, () => st.balance >= 1e4, () => [st.peak, 1e4]],
    ['k100', 'Six figures', 'Hold 100,000 credits', 5000, () => st.balance >= 1e5, () => [st.peak, 1e5]],
    ['d7', 'Every day', 'Claim the daily bonus 7 days in a row', 3000, () => st.daily.day >= 7, () => [st.daily.day, 7]],
    ['refill', 'Back on your feet', 'Use a refill', 100, () => !!st.ach._refill],
  ];
  function checkAch() {
    let got = 0;
    for (const [id, name, , reward, test] of A) {
      if (st.ach[id] || !test()) continue;
      st.ach[id] = Date.now();
      st.balance = r2(st.balance + reward);
      got++;
      setTimeout(() => { toast('Achievement', name, '+' + fmt(reward) + ' credits'); sfx.ach(); burst(fw - 140, fh - 60, 26, [INK.yellow, INK.pink]); }, got * 500);
    }
    if (got) { save(); paintHud(); paintAch(); }
  }
  function paintAch() {
    const ul = $('achlist'); ul.innerHTML = '';
    const order = A.slice().sort((a, b) => (!!st.ach[a[0]]) - (!!st.ach[b[0]]));
    for (const [id, name, desc, reward, , prog] of order) {
      const li = document.createElement('li');
      if (st.ach[id]) li.className = 'got';
      li.innerHTML = '<b></b><span class="rw"></span><small></small>';
      li.children[0].textContent = name; li.children[1].textContent = '+' + fmt(reward); li.children[2].textContent = desc;
      if (!st.ach[id] && prog) {
        const [a, b] = prog();
        const bar = document.createElement('div'); bar.className = 'bar2';
        bar.innerHTML = '<i style="width:' + Math.min(100, (a / b) * 100) + '%"></i>';
        li.appendChild(bar);
      }
      ul.appendChild(li);
    }
    $('achcount').textContent = A.filter((a) => st.ach[a[0]]).length + ' / ' + A.length;
  }

  /* ---------- daily bonus ---------- */
  const dayKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => dayKey(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const dailyMult = () => 1 + (st.level - 1) * 0.05;
  function nextDailyIndex() {
    if (st.daily.last === today()) return -1;
    if (st.daily.last === yesterday()) return st.daily.day % 7;
    return 0;
  }
  function paintDaily() {
    const idx = nextDailyIndex();
    const streakDay = idx < 0 ? st.daily.day : idx; // days already done in this run of 7
    const shown = idx < 0 ? ((st.daily.day - 1) % 7) + 1 : idx; // filled boxes
    const ol = $('dailytrack'); ol.innerHTML = '';
    DAILY.forEach((v, i) => {
      const li = document.createElement('li');
      li.innerHTML = 'Day ' + (i + 1) + '<b>' + (v >= 1000 ? v / 1000 + 'K' : v) + '</b>';
      if (i < shown) li.className = 'done';
      if (idx >= 0 && i === idx) li.className = 'now';
      ol.appendChild(li);
    });
    $('dailyday').textContent = idx < 0 ? 'Claimed today' : 'Day ' + (idx + 1) + ' of 7';
    const btn = $('dailyclaim');
    btn.disabled = idx < 0;
    btn.classList.toggle('ready', idx >= 0);
    btn.textContent = idx < 0 ? T.claimed : 'Claim ' + fmt(Math.round(DAILY[idx] * dailyMult()));
    $('dailynext').hidden = idx >= 0;
    if (idx < 0) {
      const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
      const m = Math.ceil((mid - now) / 60000);
      $('dailynext').textContent = 'Next bonus in ' + Math.floor(m / 60) + ' h ' + (m % 60) + ' min. Missing a day starts again at day 1.';
    }
    return streakDay;
  }
  $('dailyclaim').addEventListener('click', () => {
    const idx = nextDailyIndex(); if (idx < 0) return;
    const amt = Math.round(DAILY[idx] * dailyMult());
    st.daily = { last: today(), day: st.daily.last === yesterday() ? st.daily.day + 1 : 1 };
    st.balance = r2(st.balance + amt);
    st.history.push(st.balance); trimHistory();
    save(); paintHud(); paintDaily();
    sfx.win(10);
    const [x, y] = centerOf($('dailyclaim'));
    burst(x, y, 60, [INK.yellow, INK.yellow, INK.pink], 1.2);
    toast('Daily bonus', '+' + fmt(amt) + ' credits', 'Day ' + st.daily.day + (st.daily.day < 7 ? '. Tomorrow pays more.' : '.'));
    checkAch();
  });
  setInterval(paintDaily, 60000);

  /* ---------- bets ---------- */
  const betEl = $('bet');
  const getBet = () => { const v = parseFloat(betEl.value); return isNaN(v) || v < 1 ? 1 : Math.floor(v * 100) / 100; };
  const setBet = (v) => { betEl.value = Math.max(1, Math.min(Math.floor(v * 100) / 100, Math.max(1, Math.floor(st.balance)))); };
  document.querySelectorAll('[data-bet]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.bet;
    if (k === 'max') setBet(st.balance); else if (k === 'half') setBet(getBet() / 2); else if (k === 'double') setBet(getBet() * 2); else setBet(+k);
    sfx.chip(); b.blur();
  }));
  betEl.addEventListener('change', () => setBet(getBet()));

  function trimHistory() { if (st.history.length > 60) st.history.splice(0, st.history.length - 60); }

  function wager(game, amount) {
    if (amount > st.balance + 1e-9 || amount <= 0) {
      shake(); sfx.lose();
      flashMsg(game, T.broke);
      return false;
    }
    st.balance = r2(st.balance - amount);
    st.cashback = st.cashback + amount * CASHBACK(st.level);
    st.stats.bets++; st.stats.wagered += amount; st.stats.games[game] = 1;
    // XP grows with the bet but flattens out, so tiny and huge bets both level up
    gainXp(Math.max(2, Math.sqrt(amount) * 4) * STREAK_BOOST(st.streak));
    save(); paintHud();
    return true;
  }
  function gainXp(x) {
    st.xp += x;
    let ups = 0;
    while (st.xp >= XP_NEED(st.level)) {
      st.xp -= XP_NEED(st.level); st.level++; ups++;
      const reward = LEVEL_REWARD(st.level);
      st.balance = r2(st.balance + reward);
      const lv = st.level;
      setTimeout(() => {
        toast(T.level, 'Level ' + lv, '+' + fmt(reward) + ' credits · cashback ' + (CASHBACK(lv) * 100).toFixed(1) + '%', 'level');
        sfx.level();
        const [x, y] = centerOf($('level'));
        burst(x, y, 40, [INK.pink, INK.yellow], 1);
        const xb = document.querySelector('.xpbar'); xb.classList.add('flash'); setTimeout(() => xb.classList.remove('flash'), 600);
      }, 250 + ups * 400);
    }
    if (ups) paintDaily();
  }
  /* Settle a finished bet. payout is the total paid back (0 when lost). */
  function settle(game, bet, payout, opts = {}) {
    const mult = bet ? payout / bet : 0;
    st.balance = r2(st.balance + payout);
    if (payout > bet) {
      st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); st.stats.won++;
      const bump = $('streakbox'); bump.classList.remove('bump'); void bump.offsetWidth; bump.classList.add('bump');
      if (st.streak >= 3 && (st.streak === 3 || st.streak % 5 === 0)) toast('Win streak', st.streak + ' in a row', 'XP ×' + STREAK_BOOST(st.streak).toFixed(2).replace(/0$/, ''));
    } else if (payout < bet) {
      st.streak = 0;
    }
    st.stats.bigMult = Math.max(st.stats.bigMult, mult);
    if (st.balance > st.peak) st.peak = st.balance;
    st.history.push(st.balance); trimHistory();
    st.recent.unshift([game, bet, payout]); st.recent.length = Math.min(st.recent.length, 14);
    save(); paintHud(); paintRecent();
    if (!opts.quiet) {
      if (mult >= 10) bigWin(payout, mult);
      else if (payout > bet) { sfx.win(mult); if (mult >= 3) { shake(); const [x, y] = centerOf($('stage')); burst(x, y, 30, [INK.yellow, INK.green]); } }
      else if (payout === 0) sfx.lose();
    }
    checkAch();
    return mult;
  }
  function paintRecent() {
    const ul = $('recent'); ul.innerHTML = '';
    if (!st.recent.length) { ul.innerHTML = '<li class="empty tiny">Nothing yet.</li>'; return; }
    for (const [g, b, p] of st.recent) {
      const li = document.createElement('li');
      const net = p - b;
      li.innerHTML = '<span></span><span></span>';
      li.children[0].textContent = g + ' · ' + fmt(b) + (p > 0 ? ' · ' + fmtM(p / b) : '');
      li.children[1].textContent = (net > 0 ? '+' : net < 0 ? '−' : '±') + fmt(Math.abs(net));
      li.children[1].className = net > 0 ? 'pos' : net < 0 ? 'neg' : '';
      ul.appendChild(li);
    }
  }

  /* ---------- big win ---------- */
  let bwDone = null;
  function bigWin(amount, mult) {
    const tier = mult >= 100 ? 3 : mult >= 50 ? 2 : mult >= 25 ? 1 : 0;
    const el = $('bigwin');
    el.hidden = false; el.classList.toggle('mega', tier >= 2);
    $('bwtitle').textContent = T.big[tier];
    $('bwmult').textContent = fmtM(mult);
    const amt = $('bwamount');
    const dur = RED ? 300 : (1200 + tier * 700) * speed();
    const t0 = performance.now();
    let lastCoin = 0, i = 0, ended = false;
    shake(true);
    sfx.win(mult);
    const [x, y] = centerOf($('stage'));
    burst(x, y, 70 + tier * 40, [INK.yellow, INK.yellow, INK.pink, INK.green], 1.3 + tier * 0.2);
    const step = (t) => {
      if (ended) return;
      const k = Math.min(1, (t - t0) / dur);
      amt.textContent = fmt(Math.round(amount * E.outCubic(k)));
      if (t - lastCoin > 70 && k < 1) { lastCoin = t; sfx.coin(i++); if (i % 4 === 0) burst(x, y - 40, 8, [INK.yellow], 0.9); }
      if (k < 1) requestAnimationFrame(step); else { amt.textContent = fmt(amount); bwDone = setTimeout(close, 1400 * speed()); }
    };
    const close = () => { ended = true; clearTimeout(bwDone); el.hidden = true; el.onclick = null; };
    el.onclick = () => { if (amt.textContent !== fmt(amount)) { ended = true; amt.textContent = fmt(amount); bwDone = setTimeout(close, 700); } else close(); };
    requestAnimationFrame(step);
    if (autoSpin) { autoSpin = false; $('auto').checked = false; }
  }

  function flashMsg(game, text) {
    const id = { Slots: 'slotmsg', Plinko: 'plinkomsg', Blackjack: 'bjmsg', Crash: 'crashsub' }[game];
    if (id) { const el = $(id); el.textContent = text; el.className = id === 'crashsub' ? '' : 'msg lose'; }
  }

  /* ---------- tabs ---------- */
  let current = 'slots';
  function switchTab(name) {
    current = name;
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== name));
    document.querySelectorAll('[data-ctl]').forEach((v) => (v.hidden = v.dataset.ctl !== name));
    sfx.click();
    if (name === 'crash') crashDraw();
    if (name === 'plinko') plinkoDraw();
    try { localStorage.setItem('labtoso-games:casino:tab', JSON.stringify(name)); } catch (e) { /* ignore */ }
  }
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { switchTab(b.dataset.tab); b.blur(); }));

  /* ================= SLOTS ================= */
  // [label, weight, ×5, ×4, ×3]. Return per spin 96.4 % (five lines, payouts are times the bet).
  const SYM = [
    ['7', 3, 250, 50, 12], ['◆', 6, 100, 25, 6], ['♛', 10, 50, 12, 4],
    ['BAR', 16, 20, 6, 2.5], ['●', 24, 10, 4, 2], ['▲', 32, 7, 3, 1.5],
  ];
  const WSUM = SYM.reduce((a, s) => a + s[1], 0);
  const LINES = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2]];
  const LINE_INK = [INK.yellow, INK.pink, INK.blue, INK.green, INK.orange];
  const pickSym = () => { let r = Math.random() * WSUM; for (let i = 0; i < SYM.length; i++) { if (r < SYM[i][1]) return i; r -= SYM[i][1]; } return SYM.length - 1; };
  let grid = [0, 1, 2, 3, 4].map(() => [pickSym(), pickSym(), pickSym()]);
  let spinning = false, autoSpin = false;
  const reelsEl = $('reels');
  function cellHtml(s) { return '<div class="cell s' + s + (s === 3 ? ' bar' : '') + '"><span>' + SYM[s][0] + '</span></div>'; }
  function buildReels() {
    reelsEl.innerHTML = '';
    for (let c = 0; c < 5; c++) {
      const r = document.createElement('div'); r.className = 'reel';
      r.innerHTML = '<div class="strip">' + grid[c].map(cellHtml).join('') + '</div>';
      reelsEl.appendChild(r);
    }
  }
  buildReels();
  const cellH = () => reelsEl.querySelector('.cell').getBoundingClientRect().height;

  function evaluate(g) {
    const wins = [];
    LINES.forEach((ln, li) => {
      const f = g[0][ln[0]]; let k = 1;
      while (k < 5 && g[k][ln[k]] === f) k++;
      if (k >= 3) wins.push({ li, k, sym: f, mult: SYM[f][2 + (5 - k)] });
    });
    return wins;
  }
  // Reels that should build suspense: a line already shows two matching top symbols.
  function teaseFrom(g) {
    for (const ln of LINES) { const a = g[0][ln[0]]; if (a <= 1 && g[1][ln[1]] === a) return 2; }
    return 99;
  }

  function spinReel(c, target, dur, tease) {
    return new Promise((res) => {
      const reel = reelsEl.children[c];
      const h = cellH();
      const filler = Math.max(6, Math.round(dur / 45));
      const syms = target.slice();
      for (let i = 0; i < filler; i++) syms.push(Math.floor(Math.random() * SYM.length));
      syms.push(...grid[c]);
      const strip = document.createElement('div'); strip.className = 'strip blur';
      strip.innerHTML = syms.map(cellHtml).join('');
      reel.replaceChildren(strip);
      if (tease) { reel.classList.add('tease'); sfx.tease(c); }
      const start = -(syms.length - 3) * h;
      strip.style.transform = 'translateY(' + start + 'px)';
      const t0 = performance.now();
      let lastTick = 0;
      const spinEase = (x) => { const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const y = start * (1 - spinEase(k));
        strip.style.transform = 'translateY(' + y + 'px)';
        if (k > 0.75) strip.classList.remove('blur');
        const cellIdx = Math.floor(-y / h);
        if (cellIdx !== lastTick && k < 0.9) { lastTick = cellIdx; if (cellIdx % 2 === 0) sfx.tick(c); }
        if (k < 1) requestAnimationFrame(step);
        else {
          strip.innerHTML = target.map(cellHtml).join(''); strip.style.transform = '';
          reel.classList.remove('tease', 'land'); void reel.offsetWidth; reel.classList.add('land');
          sfx.stop(c);
          res();
        }
      };
      requestAnimationFrame(step);
    });
  }

  async function spin() {
    if (spinning || $('bigwin').hidden === false) return;
    const bet = getBet();
    if (!wager('Slots', bet)) { autoSpin = false; $('auto').checked = false; return; }
    spinning = true;
    $('spin').disabled = true;
    const msg = $('slotmsg'); msg.textContent = T.spinning; msg.className = 'msg';
    $('lines').innerHTML = '';
    const out = [0, 1, 2, 3, 4].map(() => [pickSym(), pickSym(), pickSym()]);
    const tFrom = teaseFrom(out);
    const sp = RED ? 0.5 : speed();
    const jobs = [];
    let teased = false;
    for (let c = 0; c < 5; c++) {
      const tease = c >= tFrom;
      if (tease) teased = true;
      let dur = (650 + c * 210) * sp;
      if (tease) dur += (c - tFrom + 1) * 750 * sp;
      jobs.push(spinReel(c, out[c], dur, false).then(() => {
        if (c + 1 < 5 && c + 1 >= tFrom && c + 1 >= 2) { reelsEl.children[c + 1].classList.add('tease'); sfx.tease(c + 1); msg.textContent = T.close; msg.className = 'msg hot'; }
      }));
    }
    await Promise.all(jobs);
    grid = out;
    const wins = evaluate(out);
    const total = wins.reduce((a, w) => a + w.mult, 0);
    const payout = r2(bet * total);
    showLines(wins);
    if (payout > 0) {
      msg.textContent = 'Win ' + fmtM(total); msg.className = 'msg win';
      $('lastwin').textContent = '+' + fmt(payout) + ' (' + fmtM(total) + ')';
      $('lastwin').className = 'num pos';
    } else {
      msg.textContent = teased ? 'Almost' : T.noWin; msg.className = 'msg lose';
    }
    settle('Slots', bet, payout);
    spinning = false; $('spin').disabled = false;
    if (autoSpin) setTimeout(() => { if (autoSpin && current === 'slots') spin(); }, (payout > 0 ? 900 : 350) * speed());
  }
  function showLines(wins) {
    const svg = $('lines');
    const cells = reelsEl.querySelectorAll('.cell');
    cells.forEach((c) => c.classList.remove('win', 'dim'));
    if (!wins.length) { svg.innerHTML = ''; return; }
    const box = svg.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
    const mark = new Set();
    let html = '';
    wins.forEach((w, n) => {
      const pts = [];
      LINES[w.li].forEach((row, c) => {
        const cell = reelsEl.children[c].querySelectorAll('.cell')[row];
        const r = cell.getBoundingClientRect();
        pts.push((r.left + r.width / 2 - box.left).toFixed(1) + ',' + (r.top + r.height / 2 - box.top).toFixed(1));
        if (c < w.k) { mark.add(cell); cell.style.setProperty('--d', (n * 160 + c * 60) + 'ms'); }
      });
      html += '<polyline points="' + pts.join(' ') + '" stroke="' + LINE_INK[w.li] + '" style="animation-delay:' + n * 160 + 'ms"/>';
      setTimeout(() => sfx.small(), n * 160);
    });
    svg.innerHTML = html;
    cells.forEach((c) => c.classList.add(mark.has(c) ? 'win' : 'dim'));
  }
  $('spin').addEventListener('click', (e) => { e.currentTarget.blur(); spin(); });
  $('auto').addEventListener('change', (e) => { autoSpin = e.target.checked; e.target.blur(); if (autoSpin && !spinning) spin(); });

  /* ================= CRASH ================= */
  const crashC = $('crashc');
  const crashStage = Sh.stage(crashC, () => crashDraw());
  let cr = { on: false, out: false, bet: 0, m: 1, point: 1, t0: 0, outAt: 0, lastInt: 1, trail: [] };
  const crashHist = [];
  // 1 % of rounds end at 1.00×, the rest follow 0.97 / (1 − r): return 96 %.
  const crashPoint = () => (Math.random() < 0.01 ? 1 : Math.max(1, Math.floor((0.97 / (1 - Math.random())) * 100) / 100));
  const growth = () => (st.turbo ? 0.00014 : 0.00009);
  function crashBtn() {
    const b = $('crashgo');
    if (!cr.on) { b.innerHTML = 'Bet <kbd>Space</kbd>'; b.className = 'go'; b.disabled = false; }
    else if (!cr.out) { b.innerHTML = 'Cash out ' + fmt(r2(cr.bet * cr.m)) + ' <kbd>Space</kbd>'; b.className = 'go cash'; }
    else { b.textContent = 'Cashed out'; b.className = 'go wait'; b.disabled = true; }
  }
  function crashAction() {
    if (!cr.on) crashStart(); else if (!cr.out) crashCash();
  }
  function crashStart() {
    const bet = getBet();
    if (!wager('Crash', bet)) return;
    cr = { on: true, out: false, bet, m: 1, point: crashPoint(), t0: performance.now(), outAt: 0, lastInt: 1, trail: [] };
    $('crashbet').textContent = fmt(bet);
    $('crashsub').textContent = T.flying;
    $('crashmult').className = 'num';
    sfx.chip();
    crashBtn();
    requestAnimationFrame(crashLoop);
  }
  function crashCash(at) {
    if (!cr.on || cr.out) return;
    cr.out = true; cr.outAt = at || cr.m;
    const payout = r2(cr.bet * cr.outAt);
    st.stats.crashOuts++;
    if (cr.outAt >= 10) st.ach._moon = 1;
    $('crashsub').textContent = T.cashed(payout);
    $('crashmult').classList.add('safe');
    crashBtn();
    settle('Crash', cr.bet, payout);
  }
  function crashLoop(t) {
    if (!cr.on) return;
    cr.m = Math.floor(Math.pow(Math.E, growth() * (t - cr.t0)) * 100) / 100;
    const auto = parseFloat($('autoco').value) || 0;
    if (!cr.out && auto >= 1.01 && cr.m >= auto && auto < cr.point) crashCash(auto);
    if (cr.m >= cr.point) {
      cr.m = cr.point; cr.on = false;
      const el = $('crashmult'); el.textContent = fmtM(cr.point); el.className = 'num dead';
      sfx.crash(); shake(true);
      const r = crashC.getBoundingClientRect(), hp = crashHead();
      burst(r.left + hp[0], r.top + hp[1], 50, [INK.orange, INK.pink, INK.yellow], 1.1, 'spark');
      if (!cr.out) { $('crashsub').textContent = T.crashed(fmtM(cr.point)); settle('Crash', cr.bet, 0, { quiet: true }); }
      else $('crashsub').textContent = 'Cashed at ' + fmtM(cr.outAt) + ' · crashed at ' + fmtM(cr.point);
      crashHist.unshift(cr.point); crashHist.length = Math.min(crashHist.length, 9);
      $('crashhist').innerHTML = crashHist.map((m) => '<span class="num ' + (m >= 10 ? 'great' : m >= 2 ? 'good' : '') + '">' + fmtM(m) + '</span>').join('');
      crashDraw(true);
      setTimeout(crashBtn, 500 * speed());
      return;
    }
    const el = $('crashmult');
    el.textContent = fmtM(cr.m);
    if (!cr.out) el.className = 'num' + (cr.m >= 10 ? ' t10' : cr.m >= 5 ? ' t5' : cr.m >= 2 ? ' t2' : '');
    const whole = Math.floor(cr.m * 2) / 2; // every half step
    if (whole > cr.lastInt) {
      cr.lastInt = whole; sfx.rise(cr.m);
      if (!RED) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    }
    if (!cr.out) crashBtn();
    crashDraw();
    requestAnimationFrame(crashLoop);
  }
  function crashView() {
    const el = cr.on || cr.m > 1 ? (Math.log(cr.m) / growth()) : 0;
    const tMax = Math.max(9000, el * 1.15);
    const mMax = Math.max(2.2, cr.m * 1.25);
    return { tMax, mMax, el };
  }
  function crashXY(tms, m, v) {
    const { w, h } = crashStage, pad = 36;
    return [pad + (tms / v.tMax) * (w - pad * 2), h - pad - ((m - 1) / (v.mMax - 1)) * (h - pad * 2)];
  }
  function crashHead() { const v = crashView(); return crashXY(v.el, cr.m, v); }
  function crashDraw(dead) {
    const { ctx: c, w, h } = crashStage;
    c.clearRect(0, 0, w, h);
    const v = crashView();
    // grid: fine ink lines with labelled multipliers
    c.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--mono');
    c.fillStyle = 'rgba(239,231,215,0.45)'; c.strokeStyle = 'rgba(239,231,215,0.1)'; c.lineWidth = 1;
    const stepM = v.mMax > 20 ? 5 : v.mMax > 8 ? 2 : v.mMax > 4 ? 1 : 0.5;
    for (let m = 1; m <= v.mMax; m += stepM) {
      const [, y] = crashXY(0, m, v);
      c.beginPath(); c.moveTo(36, y); c.lineTo(w - 10, y); c.stroke();
      c.fillText(m.toFixed(m % 1 ? 1 : 0) + '×', 4, y + 4);
    }
    if (!(cr.on || dead || cr.m > 1)) return;
    // the curve
    const col = dead ? INK.orange : cr.out ? INK.green : INK.yellow;
    c.beginPath();
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const tt = (v.el * i) / N, m = Math.pow(Math.E, growth() * tt);
      const [x, y] = crashXY(tt, Math.min(m, cr.m), v);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    const [hx, hy] = crashXY(v.el, cr.m, v);
    // hatched fill under the curve
    c.save(); c.lineTo(hx, h - 36); c.lineTo(36, h - 36); c.closePath(); c.clip();
    c.strokeStyle = col; c.globalAlpha = 0.22; c.lineWidth = 1;
    for (let x = -h; x < w; x += 7) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + h, 0); c.stroke(); }
    c.restore();
    c.beginPath();
    for (let i = 0; i <= N; i++) {
      const tt = (v.el * i) / N, m = Math.pow(Math.E, growth() * tt);
      const [x, y] = crashXY(tt, Math.min(m, cr.m), v);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.strokeStyle = INK.pink; c.lineWidth = 4; c.globalAlpha = 0.6; c.save(); c.translate(2, 2); c.stroke(); c.restore();
    c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 4; c.stroke();
    // cash out flag
    if (cr.out) {
      const tt = Math.log(cr.outAt) / growth(), [fx2, fy] = crashXY(tt, cr.outAt, v);
      c.fillStyle = INK.green; c.fillRect(fx2 - 1, fy - 26, 2, 26);
      c.beginPath(); c.moveTo(fx2 + 1, fy - 26); c.lineTo(fx2 + 16, fy - 21); c.lineTo(fx2 + 1, fy - 16); c.fill();
    }
    // head
    c.save(); c.translate(hx, hy);
    if (dead) {
      c.strokeStyle = INK.orange; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-8, -8); c.lineTo(8, 8); c.moveTo(8, -8); c.lineTo(-8, 8); c.stroke();
    } else {
      const ang = Math.atan2(-(growth() * cr.m) * ((h - 72) / (v.mMax - 1)), (w - 72) / v.tMax);
      c.rotate(ang);
      c.fillStyle = '#1a1820'; c.beginPath(); c.moveTo(13, 2); c.lineTo(-7, 9); c.lineTo(-4, 2); c.lineTo(-7, -5); c.closePath(); c.fill();
      c.fillStyle = col; c.beginPath(); c.moveTo(11, 0); c.lineTo(-9, 7); c.lineTo(-6, 0); c.lineTo(-9, -7); c.closePath(); c.fill();
      if (!RED && cr.on) { c.fillStyle = INK.orange; c.fillRect(-14 - Math.random() * 8, -2, 6, 4); }
    }
    c.restore();
  }
  $('crashgo').addEventListener('click', (e) => { e.currentTarget.blur(); crashAction(); });

  /* ================= PLINKO ================= */
  // 12 rows, 13 buckets. Each table returns 99 % on average.
  const PM = {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    med: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  };
  const ROWS = 12;
  let risk = 'high';
  const plC = $('plinkoc');
  const plStage = Sh.stage(plC, () => plinkoDraw());
  const balls = [];
  const pegFlash = new Map();
  let plRunning = false, plLast = 0;
  function geo() {
    const { w, h } = plStage;
    const gap = Math.min(w / (ROWS + 3), (h - 30) / (ROWS + 0.6));
    return { gap, top: 18 + gap * 0.3, cx: w / 2, r: Math.max(2.2, gap * 0.1), br: Math.max(4, gap * 0.22) };
  }
  const pegPos = (row, i, g) => [g.cx + (i - (row + 2) / 2) * g.gap, g.top + row * g.gap];
  function paintBuckets() {
    const box = $('buckets'); box.innerHTML = '';
    PM[risk].forEach((m, i) => {
      const d = document.createElement('div');
      d.className = 'num ' + (m >= 20 ? 'b4' : m >= 4 ? 'b3' : m >= 1.5 ? 'b2' : m >= 1 ? 'b1' : '');
      d.textContent = m + '×'; d.dataset.i = i;
      box.appendChild(d);
    });
    document.querySelectorAll('[data-risk]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.risk === risk)));
  }
  document.querySelectorAll('[data-risk]').forEach((b) => b.addEventListener('click', () => { risk = b.dataset.risk; paintBuckets(); sfx.click(); b.blur(); }));
  function drop() {
    const bet = getBet();
    if (!wager('Plinko', bet)) return;
    const path = []; let rights = 0;
    for (let i = 0; i < ROWS; i++) { const d = Math.random() < 0.5 ? 0 : 1; path.push(d); rights += d; }
    balls.push({ bet, mults: PM[risk], path, bucket: rights, step: -1, k: 0, trail: [], jitter: (Math.random() - 0.5) * 0.3 });
    sfx.chip();
    if (!plRunning) { plRunning = true; plLast = 0; requestAnimationFrame(plLoop); }
  }
  function ballPos(b, g) {
    // position before row 0 is above the first peg; afterwards between pegs of the row
    let rights = 0; for (let s = 0; s < Math.max(0, b.step); s++) rights += b.path[s];
    const at = (step, r) => step < 0 ? [g.cx + b.jitter * g.gap * 0.2, g.top - g.gap * 0.9] : [g.cx + (r - step / 2) * g.gap, g.top + step * g.gap - g.br - g.r];
    const [x0, y0] = at(b.step, rights);
    const nr = b.step >= 0 ? rights + b.path[b.step] : 0;
    const [x1, y1] = at(b.step + 1, nr);
    const k = b.k;
    return [x0 + (x1 - x0) * E.inOutQuad(k), y0 + (y1 - y0) * k * k - Math.sin(k * Math.PI) * g.gap * 0.35];
  }
  function plLoop(t) {
    const dt = plLast ? Math.min(50, t - plLast) : 16; plLast = t;
    const g = geo();
    const rate = (st.turbo ? 0.011 : 0.0062) * (RED ? 1.4 : 1);
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.k += dt * rate;
      if (b.k >= 1) {
        b.k = 0; b.step++;
        if (b.step >= ROWS) { balls.splice(i, 1); land(b); continue; }
        {
          let rights = 0; for (let s = 0; s < b.step; s++) rights += b.path[s];
          pegFlash.set(b.step + ':' + (rights + 1), t);
          sfx.peg(((rights + 1) / (b.step + 2)) * 2 - 1);
        }
      }
      const p = ballPos(b, g);
      b.trail.push(p); if (b.trail.length > 7) b.trail.shift();
    }
    plinkoDraw(t);
    if (balls.length) requestAnimationFrame(plLoop); else { plRunning = false; plinkoDraw(); }
  }
  function land(b) {
    const m = b.mults[b.bucket];
    const payout = r2(b.bet * m);
    const el = $('buckets').children[b.bucket];
    if (el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 180); }
    sfx.bucket(m);
    const msg = $('plinkomsg');
    msg.textContent = fmtM(m) + ' · ' + (payout >= b.bet ? '+' : '−') + fmt(Math.abs(payout - b.bet));
    msg.className = 'msg ' + (m >= 1 ? 'win' : 'lose');
    if (b.bucket === 0 || b.bucket === ROWS) st.ach._edge = 1;
    if (m >= 4 && el) { const [x, y] = centerOf(el); burst(x, y, m >= 20 ? 50 : 18, [INK.yellow, INK.pink]); }
    settle('Plinko', b.bet, payout, { quiet: m < 10 });
  }
  function plinkoDraw(t) {
    const { ctx: c, w, h } = plStage;
    c.clearRect(0, 0, w, h);
    const g = geo(); t = t || performance.now();
    $('buckets').style.width = Math.round(g.gap * (ROWS + 1)) + 'px';
    for (let r = 0; r < ROWS; r++) {
      for (let i = 0; i < r + 3; i++) {
        const [x, y] = pegPos(r, i, g);
        const f = pegFlash.get(r + ':' + i);
        const k = f ? Math.max(0, 1 - (t - f) / 260) : 0;
        c.fillStyle = k > 0 ? INK.yellow : 'rgba(239,231,215,0.75)';
        c.beginPath(); c.arc(x, y, g.r * (1 + k * 0.9), 0, Math.PI * 2); c.fill();
      }
    }
    for (const b of balls) {
      b.trail.forEach((p, i) => { c.globalAlpha = (i / b.trail.length) * 0.35; c.fillStyle = INK.pink; c.beginPath(); c.arc(p[0], p[1], g.br * 0.8, 0, Math.PI * 2); c.fill(); });
      c.globalAlpha = 1;
      const [x, y] = ballPos(b, g);
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.arc(x + 2, y + 2, g.br, 0, Math.PI * 2); c.fill();
      c.fillStyle = INK.pink; c.beginPath(); c.arc(x, y, g.br, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff8ea'; c.beginPath(); c.arc(x - g.br * 0.35, y - g.br * 0.35, g.br * 0.3, 0, Math.PI * 2); c.fill();
    }
  }
  $('drop').addEventListener('click', (e) => { e.currentTarget.blur(); drop(); });

  /* ================= BLACKJACK ================= */
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  let bj = { on: false, busy: false, deck: [], p: [], d: [], bet: 0, doubled: false };
  const deck = () => Sh.shuffle(SUITS.flatMap((s) => RANKS.map((r) => ({ s, r }))));
  const val = (c) => (c.r === 'A' ? 11 : 'KQJ'.includes(c.r) ? 10 : +c.r);
  function score(hand) { let t = 0, a = 0; for (const c of hand) { t += val(c); if (c.r === 'A') a++; } while (t > 21 && a) { t -= 10; a--; } return t; }
  const isBj = (h) => h.length === 2 && score(h) === 21;
  function cardEl(c, down) {
    const el = document.createElement('div');
    el.className = 'card' + (down ? ' down' : '');
    const red = c.s === '♥' || c.s === '♦';
    el.innerHTML = '<div class="in"><div class="face' + (red ? ' red' : '') + '"><span class="c">' + c.r + '</span><span class="m">' + c.s + '</span><span class="c b">' + c.r + '</span></div><div class="back"></div></div>';
    return el;
  }
  function bjScores(reveal) {
    $('pscore').textContent = bj.p.length ? score(bj.p) : '';
    $('dscore').textContent = bj.d.length ? (reveal ? score(bj.d) : score([bj.d[0]])) : '';
  }
  async function give(who, down) {
    const c = bj.deck.pop();
    (who === 'p' ? bj.p : bj.d).push(c);
    $(who === 'p' ? 'pcards' : 'dcards').appendChild(cardEl(c, down));
    sfx.card();
    bjScores(false);
    await wait(260 * speed());
  }
  function bjButtons() {
    const playing = bj.on && !bj.busy;
    $('deal').hidden = bj.on;
    $('bjact').hidden = !bj.on;
    document.querySelectorAll('[data-bj]').forEach((b) => (b.disabled = !playing));
    $('bjdouble').disabled = !playing || bj.p.length !== 2 || st.balance < bj.bet;
  }
  async function bjDeal() {
    if (bj.on || bj.busy) return;
    const bet = getBet();
    if (!wager('Blackjack', bet)) return;
    bj = { on: true, busy: true, deck: deck(), p: [], d: [], bet, doubled: false };
    $('pcards').innerHTML = ''; $('dcards').innerHTML = '';
    $('bjbet').textContent = fmt(bet);
    const msg = $('bjmsg'); msg.textContent = '…'; msg.className = 'msg';
    bjButtons();
    await give('p'); await give('d'); await give('p'); await give('d', true);
    // dealer peeks for blackjack when showing an ace or a ten
    if (isBj(bj.d) || isBj(bj.p)) return bjEnd();
    bj.busy = false; msg.textContent = T.yourTurn; bjButtons();
  }
  async function bjHit() {
    if (!bj.on || bj.busy) return;
    bj.busy = true; bjButtons();
    await give('p');
    const s = score(bj.p);
    if (s > 21) return bjEnd();
    if (s === 21) return bjStand(true);
    bj.busy = false; bjButtons();
  }
  async function bjDouble() {
    if (!bj.on || bj.busy || bj.p.length !== 2 || st.balance < bj.bet) return;
    if (!wager('Blackjack', bj.bet)) return;
    bj.bet *= 2; bj.doubled = true; bj.busy = true;
    $('bjbet').textContent = fmt(bj.bet);
    bjButtons();
    await give('p');
    if (score(bj.p) > 21) return bjEnd();
    bjStand(true);
  }
  async function bjStand(already) {
    if (!bj.on || (bj.busy && !already)) return;
    bj.busy = true; bjButtons();
    await reveal();
    while (score(bj.d) < 17) await give('d');
    bjScores(true);
    bjEnd();
  }
  async function reveal() {
    const hole = $('dcards').children[1];
    if (hole && hole.classList.contains('down')) { hole.classList.remove('down'); sfx.flip(); bjScores(true); await wait(380 * speed()); }
  }
  async function bjEnd() {
    await reveal();
    bjScores(true);
    const ps = score(bj.p), ds = score(bj.d), msg = $('bjmsg');
    let payout = 0, text;
    const pBj = isBj(bj.p), dBj = isBj(bj.d);
    if (pBj && dBj) { payout = bj.bet; text = T.push + ', both blackjack'; }
    else if (pBj) { payout = bj.bet * 2.5; text = T.bj; st.ach._natural = 1; }
    else if (dBj) { text = T.dealerBj; }
    else if (ps > 21) { text = T.bust + ' (' + ps + ')'; }
    else if (ds > 21 || ps > ds) { payout = bj.bet * 2; text = T.youWin + ' ' + ps + ' to ' + (ds > 21 ? 'bust' : ds); if (bj.p.length >= 5) st.ach._five = 1; if (bj.doubled) st.ach._dbl = 1; }
    else if (ps === ds) { payout = bj.bet; text = T.push + ' (' + ps + ')'; }
    else { text = T.dealerWins + ' ' + ds + ' to ' + ps; }
    msg.textContent = text;
    msg.className = 'msg ' + (payout > bj.bet ? 'win' : payout === bj.bet ? 'hot' : 'lose');
    if (payout > bj.bet) {
      const z = $('pcards'); [...z.children].forEach((c, i) => setTimeout(() => { c.style.transform = 'translateY(-10px)'; setTimeout(() => (c.style.transform = ''), 220); }, i * 60));
      if (pBj) { const [x, y] = centerOf(z); burst(x, y, 40, [INK.yellow, INK.green]); }
    }
    bj.on = false; bj.busy = false;
    settle('Blackjack', bj.bet, r2(payout));
    bjButtons();
  }
  $('deal').addEventListener('click', (e) => { e.currentTarget.blur(); bjDeal(); });
  document.querySelectorAll('[data-bj]').forEach((b) => b.addEventListener('click', () => {
    b.blur();
    ({ hit: bjHit, stand: () => bjStand(), double: bjDouble })[b.dataset.bj]();
  }));

  /* ---------- account buttons ---------- */
  const busy = () => spinning || cr.on || balls.length > 0 || bj.on;
  $('refill').addEventListener('click', () => {
    if (st.balance >= 1 || busy()) return;
    st.balance = START; st.ach._refill = 1; st.history.push(st.balance); trimHistory();
    save(); paintHud(); sfx.win(3);
    const [x, y] = centerOf($('balance')); burst(x, y, 30, [INK.yellow]);
    checkAch();
  });
  $('cashback').addEventListener('click', () => {
    const amt = Math.floor(st.cashback * 100) / 100;
    if (amt < 0.01) return;
    st.balance = r2(st.balance + amt); st.cashback -= amt;
    st.history.push(st.balance); trimHistory();
    save(); paintHud(); sfx.win(3);
    const [x, y] = centerOf($('cashback')); burst(x, y, 24, [INK.green, INK.yellow]);
    checkAch();
  });
  $('turbo').addEventListener('click', (e) => { st.turbo = !st.turbo; save(); paintHud(); sfx.click(); e.currentTarget.blur(); });
  $('sreset').addEventListener('click', () => { st.sessionStart = st.balance; st.peak = st.balance; st.history = [st.balance]; save(); paintHud(); });

  /* ---------- keyboard ---------- */
  let spaceTimer = null;
  function primary() {
    if (!$('bigwin').hidden) { $('bigwin').click(); return; }
    if (current === 'slots') spin();
    else if (current === 'crash') crashAction();
    else if (current === 'plinko') drop();
    else if (current === 'blackjack' && !bj.on) bjDeal();
  }
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      primary();
      if (st.turbo && current !== 'crash' && current !== 'blackjack') spaceTimer = setInterval(primary, 160);
    } else if (current === 'blackjack' && bj.on) {
      const k = e.key.toLowerCase();
      if (k === 'h') bjHit(); else if (k === 's') bjStand(); else if (k === 'd') bjDouble();
    }
  });
  addEventListener('keyup', (e) => { if (e.code === 'Space') { clearInterval(spaceTimer); spaceTimer = null; } });
  addEventListener('blur', () => { clearInterval(spaceTimer); spaceTimer = null; });
  addEventListener('resize', () => { drawChart(); if (current === 'plinko') plinkoDraw(); });

  /* ---------- start ---------- */
  st.sessionStart = st.balance; st.history = [st.balance]; st.peak = st.balance;
  paintBuckets(); paintHud(); paintAch(); paintDaily(); paintRecent(); bjButtons(); crashBtn();
  let tab = 'slots';
  try { tab = JSON.parse(localStorage.getItem('labtoso-games:casino:tab')) || 'slots'; } catch (e) { /* ignore */ }
  if (!['slots', 'crash', 'plinko', 'blackjack'].includes(tab)) tab = 'slots';
  switchTab(tab);
  crashDraw();
  if (Sh.debug.on) Sh.dbg.next = () => { st.balance += 10000; paintHud(); };
})();
