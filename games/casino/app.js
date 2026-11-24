// ==========================================
// STATE & PERSISTENCE
// ==========================================
const DEFAULT_STATE = {
  balance: 1000.00,
  rakeback: 0.00,
  streak: 0,
  xp: 0,
  level: 1,
  nonce: 0,
  seed: Math.random().toString(16).substring(2, 18),
  history: [1000.00],
  peak: 1000.00,
  turbo: false,
  muted: false
};

let state = { ...DEFAULT_STATE, ...JSON.parse(localStorage.getItem('labtoso_casino_v4') || '{}') };
let currentGame = 'slots';
let spaceHeld = false;
let spaceInterval = null;

function saveState() {
  localStorage.setItem('labtoso_casino_v4', JSON.stringify(state));
  updateHUD();
}

function updateHUD() {
  document.getElementById('balance-display').textContent = state.balance.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  document.getElementById('rakeback-display').textContent = state.rakeback.toFixed(2);
  document.getElementById('streak-display').textContent = state.streak + 'x';
  document.getElementById('level-display').textContent = state.level;
  document.getElementById('nonce-display').textContent = state.nonce;
  document.getElementById('seed-display').textContent = state.seed;

  const faucetBtn = document.getElementById('faucet-btn');
  if (state.balance < 10) {
    faucetBtn.classList.remove('hidden');
  } else {
    faucetBtn.classList.add('hidden');
  }

  const profit = state.balance - 1000;
  const profitEl = document.getElementById('session-profit');
  profitEl.textContent = (profit >= 0 ? '+' : '') + profit.toFixed(2);
  profitEl.className = 'tabular-nums ' + (profit > 0 ? 'accent-green' : profit < 0 ? 'accent-red' : 'white');

  if (state.balance > state.peak) state.peak = state.balance;
  document.getElementById('session-peak').textContent = state.peak.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  drawProfitChart();
}

// ==========================================
// TONE.JS PROCEDURAL SOUND ENGINE
// ==========================================
let audioReady = false;
let clickSynth, winSynth, bassSynth, metalSynth;

async function initAudio() {
  if (audioReady || typeof Tone === 'undefined') return;
  await Tone.start();
  clickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.015,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.06, sustain: 0 }
  }).toDestination();
  clickSynth.volume.value = -12;

  winSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0.05, release: 0.3 }
  }).toDestination();
  winSynth.volume.value = -9;

  bassSynth = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0, release: 0.2 }
  }).toDestination();
  bassSynth.volume.value = -10;

  metalSynth = new Tone.MetalSynth({
    frequency: 320,
    envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
    harmonicity: 5.1,
    modulationIndex: 16,
    resonance: 2000,
    octaves: 1
  }).toDestination();
  metalSynth.volume.value = -18;

  audioReady = true;
}

function playSound(type, param = 0) {
  if (state.muted) return;
  initAudio().then(() => {
    if (!audioReady) return;
    const now = Tone.now();
    if (type === 'tick') {
      clickSynth.triggerAttackRelease(140 + param * 18, '32n', now);
    } else if (type === 'reelStop') {
      clickSynth.triggerAttackRelease(95 + param * 12, '16n', now);
    } else if (type === 'tease') {
      winSynth.triggerAttackRelease(440 + param * 90, '16n', now);
    } else if (type === 'win') {
      const notes = param >= 5 ? ['C5', 'E5', 'G5', 'B5', 'C6'] : ['C5', 'E5', 'G5'];
      notes.forEach((n, i) => winSynth.triggerAttackRelease(n, '16n', now + i * 0.045));
    } else if (type === 'lose') {
      bassSynth.triggerAttackRelease('F2', '8n', now);
    } else if (type === 'peg') {
      metalSynth.triggerAttackRelease('32n', now);
    } else if (type === 'card') {
      clickSynth.triggerAttackRelease(280, '64n', now);
    }
  }).catch(() => {});
}

// ==========================================
// PARTICLE & SCREEN SHAKE FX
// ==========================================
const fxCanvas = document.getElementById('fx-canvas');
const fxCtx = fxCanvas.getContext('2d');
let particles = [];

function resizeFx() {
  fxCanvas.width = window.innerWidth;
  fxCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeFx);
resizeFx();

function spawnParticles(x, y, color = '#00e701', count = 24) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1,
      decay: 0.02 + Math.random() * 0.025,
      size: 2 + Math.random() * 3,
      color
    });
  }
}

function triggerShake() {
  const stage = document.getElementById('game-stage');
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
}

function loopFx() {
  fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18;
    p.life -= p.decay;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    fxCtx.globalAlpha = p.life;
    fxCtx.fillStyle = p.color;
    fxCtx.fillRect(p.x, p.y, p.size, p.size);
  }
  fxCtx.globalAlpha = 1;
  requestAnimationFrame(loopFx);
}
loopFx();

// ==========================================
// CORE BETTING & FEED LOGIC
// ==========================================
function getBet() {
  const val = parseFloat(document.getElementById('bet-input').value);
  return isNaN(val) || val <= 0 ? 1 : Math.floor(val * 100) / 100;
}

function setBet(val) {
  document.getElementById('bet-input').value = Math.min(val, Math.max(1, Math.floor(state.balance)));
  playSound('tick', 2);
}

function adjustBet(factor) {
  const current = getBet();
  const next = Math.max(1, Math.min(state.balance, Math.round(current * factor * 100) / 100));
  document.getElementById('bet-input').value = next;
  playSound('tick', 1);
}

function setBetMax() {
  document.getElementById('bet-input').value = Math.floor(state.balance * 100) / 100;
  playSound('tick', 4);
}

function placeWager(amount) {
  if (amount > state.balance || amount <= 0) {
    triggerShake();
    playSound('lose');
    return false;
  }
  state.balance = Math.round((state.balance - amount) * 100) / 100;
  state.nonce++;
  const rbRate = 0.035 + Math.min(state.streak * 0.005, 0.08);
  state.rakeback = Math.round((state.rakeback + amount * rbRate) * 100) / 100;
  saveState();
  return true;
}

function settleWager(gameName, bet, payout) {
  const mult = payout / bet;
  if (payout > 0) {
    state.balance = Math.round((state.balance + payout) * 100) / 100;
    state.streak++;
    state.xp += Math.round(bet * (1 + state.streak * 0.15));
    if (state.xp >= state.level * 500) {
      state.xp = 0;
      state.level++;
    }
    playSound('win', mult);
    if (mult >= 3) {
      triggerShake();
      spawnParticles(window.innerWidth * 0.5, window.innerHeight * 0.4, '#00e701', 36);
    }
  } else {
    state.streak = 0;
    playSound('lose');
  }

  state.history.push(state.balance);
  if (state.history.length > 40) state.history.shift();
  addFeedEntry('DU', gameName, bet, mult, payout);
  saveState();
}

function claimReload() {
  if (state.balance >= 10) return;
  state.balance = 1000.00;
  state.history.push(state.balance);
  playSound('win', 5);
  spawnParticles(window.innerWidth * 0.5, 60, '#00e701', 25);
  saveState();
}

function claimRakeback() {
  if (state.rakeback < 0.01) return;
  const amt = state.rakeback;
  state.balance = Math.round((state.balance + amt) * 100) / 100;
  state.rakeback = 0;
  state.history.push(state.balance);
  playSound('win', 3);
  spawnParticles(window.innerWidth * 0.65, 50, '#00e701', 18);
  saveState();
}

function rotateSeed() {
  state.seed = Math.random().toString(16).substring(2, 18);
  state.nonce = 0;
  playSound('tick', 5);
  saveState();
}

function resetSessionStats() {
  state.history = [state.balance];
  state.peak = state.balance;
  saveState();
}

function toggleTurbo() {
  state.turbo = !state.turbo;
  const btn = document.getElementById('turbo-btn');
  btn.textContent = state.turbo ? 'TURBO: ON' : 'TURBO: OFF';
  btn.classList.toggle('turbo-active', state.turbo);
  playSound('tick', 4);
  saveState();
}

function toggleMute() {
  state.muted = !state.muted;
  const btn = document.getElementById('mute-btn');
  btn.textContent = state.muted ? 'SFX: OFF' : 'SFX: ON';
  btn.classList.toggle('active-pill', !state.muted);
  saveState();
}

function drawProfitChart() {
  const canvas = document.getElementById('profit-chart');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const pts = state.history;
  if (pts.length < 2) return;

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;

  const baseY = h - ((1000 - min) / range) * (h - 10) - 5;
  if (baseY >= 0 && baseY <= h) {
    ctx.strokeStyle = '#232a35';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(w, baseY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const isUp = pts[pts.length - 1] >= pts[0];
  ctx.strokeStyle = isUp ? '#00e701' : '#ff3b5c';
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  pts.forEach((val, idx) => {
    const x = (idx / (pts.length - 1)) * w;
    const y = h - ((val - min) / range) * (h - 10) - 5;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// ==========================================
// NAVIGATION
// ==========================================
function switchGame(game) {
  currentGame = game;
  document.querySelectorAll('.game-view').forEach(el => el.classList.add('hidden'));
  document.getElementById('view-' + game).classList.remove('hidden');

  document.querySelectorAll('.game-controls').forEach(el => el.classList.add('hidden'));
  document.getElementById('controls-' + game).classList.remove('hidden');

  document.querySelectorAll('.nav-btn, .mnav-btn').forEach(btn => btn.classList.remove('active'));
  ['nav-' + game, 'mnav-' + game].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  });

  playSound('tick', 3);
  if (game === 'plinko') drawPlinkoBoard();
  if (game === 'crash') drawCrashFrame();
}

// ==========================================
// GAME 1: SLOTS
// ==========================================
const SYMBOLS = [
  { id: '777', label: '777', color: 'accent-gold', weight: 3, mult5: 100, mult4: 20, mult3: 5 },
  { id: 'DIA', label: '◆', color: 'accent-blue', weight: 6, mult5: 40, mult4: 10, mult3: 3 },
  { id: 'CRN', label: '♛', color: 'accent-green', weight: 10, mult5: 20, mult4: 5, mult3: 2 },
  { id: 'BAR', label: 'BAR', color: 'white', weight: 16, mult5: 10, mult4: 3, mult3: 1.5 },
  { id: 'CHY', label: '●', color: 'accent-red', weight: 24, mult5: 6, mult4: 2, mult3: 1.2 },
  { id: 'HEX', label: '⬡', color: 'muted', weight: 32, mult5: 4, mult4: 1.5, mult3: 0.8 }
];

let slotsSpinning = false;
let autoSpinActive = false;

function pickSymbol() {
  const total = SYMBOLS.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const s of SYMBOLS) {
    if (r < s.weight) return s;
    r -= s.weight;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function initSlotsGrid() {
  const grid = document.getElementById('slots-grid');
  grid.innerHTML = '';
  for (let col = 0; col < 5; col++) {
    const reel = document.createElement('div');
    reel.id = `reel-${col}`;
    reel.className = 'slot-reel';
    for (let row = 0; row < 3; row++) {
      const sym = pickSymbol();
      const cell = document.createElement('div');
      cell.id = `cell-${col}-${row}`;
      cell.className = `slot-cell ${sym.color}`;
      cell.textContent = sym.label;
      reel.appendChild(cell);
    }
    grid.appendChild(reel);
  }
}

function toggleAutoSpin() {
  autoSpinActive = !autoSpinActive;
  const btn = document.getElementById('autospin-btn');
  btn.textContent = autoSpinActive ? 'ON' : 'OFF';
  btn.classList.toggle('active', autoSpinActive);
  if (autoSpinActive && !slotsSpinning) spinSlots();
}

async function spinSlots() {
  if (slotsSpinning) return;
  const bet = getBet();
  if (!placeWager(bet)) {
    autoSpinActive = false;
    const btn = document.getElementById('autospin-btn');
    btn.textContent = 'OFF';
    btn.classList.remove('active');
    return;
  }

  slotsSpinning = true;
  const statusEl = document.getElementById('slots-status');
  statusEl.textContent = 'SPINNING...';
  statusEl.className = 'status-text muted';

  for (let c = 0; c < 5; c++) {
    document.getElementById(`reel-${c}`).classList.remove('tease-pulse');
    for (let r = 0; r < 3; r++) {
      document.getElementById(`cell-${c}-${r}`).classList.remove('win-cell');
    }
  }

  const outcome = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => pickSymbol()));
  const isTease = (outcome[0][1].id === '777' || outcome[0][1].id === 'DIA') &&
                  (outcome[1][1].id === outcome[0][1].id);

  const baseDelay = state.turbo ? 55 : 140;

  for (let col = 0; col < 5; col++) {
    const reelEl = document.getElementById(`reel-${col}`);
    if (isTease && col >= 2) {
      reelEl.classList.add('tease-pulse');
      playSound('tease', col);
    }

    const spinCycles = state.turbo ? 3 : (isTease && col >= 2 ? 12 : 6 + col * 2);
    for (let step = 0; step < spinCycles; step++) {
      for (let row = 0; row < 3; row++) {
        const rnd = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const cell = document.getElementById(`cell-${col}-${row}`);
        cell.textContent = rnd.label;
        cell.className = `slot-cell ${rnd.color}`;
        cell.style.opacity = '0.65';
      }
      await new Promise(res => setTimeout(res, baseDelay * 0.35));
    }

    for (let row = 0; row < 3; row++) {
      const sym = outcome[col][row];
      const cell = document.getElementById(`cell-${col}-${row}`);
      cell.textContent = sym.label;
      cell.style.opacity = '1';
      cell.className = `slot-cell pop-in ${sym.color}`;
    }
    reelEl.classList.remove('tease-pulse');
    playSound('reelStop', col);
  }

  const lines = [
    [[0,0],[1,0],[2,0],[3,0],[4,0]],
    [[0,1],[1,1],[2,1],[3,1],[4,1]],
    [[0,2],[1,2],[2,2],[3,2],[4,2]],
    [[0,0],[1,1],[2,2],[3,1],[4,0]],
    [[0,2],[1,1],[2,0],[3,1],[4,2]]
  ];

  let totalMult = 0;
  lines.forEach(line => {
    const first = outcome[line[0][0]][line[0][1]];
    let matchCount = 1;
    for (let i = 1; i < 5; i++) {
      if (outcome[line[i][0]][line[i][1]].id === first.id) matchCount++;
      else break;
    }
    if (matchCount >= 3) {
      const m = matchCount === 5 ? first.mult5 : matchCount === 4 ? first.mult4 : first.mult3;
      totalMult += m;
      for (let i = 0; i < matchCount; i++) {
        document.getElementById(`cell-${line[i][0]}-${line[i][1]}`).classList.add('win-cell');
      }
    }
  });

  const payout = Math.round(bet * totalMult * 100) / 100;
  const winEl = document.getElementById('slots-last-win');

  if (payout > 0) {
    winEl.textContent = `+${payout.toFixed(2)} CR (${totalMult.toFixed(2)}×)`;
    winEl.className = 'accent-green tabular-nums';
    statusEl.textContent = `WIN ${totalMult.toFixed(2)}×`;
    statusEl.className = 'status-text accent-green';
  } else {
    winEl.textContent = '0.00 CR';
    winEl.className = 'muted tabular-nums';
    statusEl.textContent = 'KEIN TREFFER';
    statusEl.className = 'status-text muted';
  }

  settleWager('SLOTS', bet, payout);
  slotsSpinning = false;

  if (autoSpinActive) {
    setTimeout(() => {
      if (autoSpinActive) spinSlots();
    }, state.turbo ? 140 : 420);
  }
}

// ==========================================
// GAME 2: CRASH
// ==========================================
let crashRunning = false;
let crashCashedOut = false;
let crashBet = 0;
let crashMult = 1.00;
let crashPoint = 1.00;
let crashStartTime = 0;
let lastTickMult = 1.0;

function generateCrashPoint() {
  if (Math.random() < 0.03) return 1.00;
  const r = Math.random();
  return Math.max(1.01, Math.floor((0.97 / (1 - r)) * 100) / 100);
}

function handleCrashAction() {
  if (!crashRunning) startCrashRound();
  else if (!crashCashedOut) cashOutCrash();
}

function startCrashRound() {
  const bet = getBet();
  if (!placeWager(bet)) return;

  crashBet = bet;
  crashRunning = true;
  crashCashedOut = false;
  crashMult = 1.00;
  lastTickMult = 1.00;
  crashPoint = generateCrashPoint();
  crashStartTime = performance.now();

  const btn = document.getElementById('crash-play-btn');
  btn.textContent = 'CASHOUT [SPACE]';
  btn.className = 'primary-btn cashout-mode';

  document.getElementById('crash-status').textContent = 'AKTIV';
  document.getElementById('crash-subtext').textContent = 'DRÜCKE CASHOUT VOR DEM CRASH';
  document.getElementById('crash-multiplier').className = 'crash-mult tabular-nums';

  updateCrashLoop();
}

function cashOutCrash() {
  if (!crashRunning || crashCashedOut) return;
  crashCashedOut = true;
  const payout = Math.round(crashBet * crashMult * 100) / 100;
  settleWager('CRASH', crashBet, payout);

  const btn = document.getElementById('crash-play-btn');
  btn.textContent = `AUSGEZAHLT (${crashMult.toFixed(2)}×)`;
  btn.className = 'primary-btn cashed-done';
  document.getElementById('crash-subtext').textContent = `+${payout.toFixed(2)} CR GESICHERT`;
}

function updateCrashLoop() {
  if (!crashRunning) return;
  const speedFactor = state.turbo ? 0.00014 : 0.000085;
  const elapsed = performance.now() - crashStartTime;
  crashMult = Math.pow(Math.E, speedFactor * elapsed);

  const autoTarget = parseFloat(document.getElementById('crash-autocashout').value) || 0;
  if (!crashCashedOut && autoTarget >= 1.05 && crashMult >= autoTarget) {
    crashMult = autoTarget;
    cashOutCrash();
  }

  if (crashMult - lastTickMult >= 0.15) {
    lastTickMult = crashMult;
    playSound('tick', Math.min(10, Math.floor(crashMult)));
  }

  if (crashMult >= crashPoint) {
    crashMult = crashPoint;
    crashRunning = false;
    drawCrashFrame(true);

    const multEl = document.getElementById('crash-multiplier');
    multEl.textContent = crashPoint.toFixed(2) + '×';
    multEl.className = 'crash-mult accent-red tabular-nums';

    if (!crashCashedOut) {
      settleWager('CRASH', crashBet, 0);
      document.getElementById('crash-subtext').textContent = `CRASHED @ ${crashPoint.toFixed(2)}×`;
      triggerShake();
    }

    addCrashBadge(crashPoint);

    const btn = document.getElementById('crash-play-btn');
    btn.textContent = 'BET [SPACE]';
    btn.className = 'primary-btn';
    document.getElementById('crash-status').textContent = 'BEENDET';
    return;
  }

  document.getElementById('crash-multiplier').textContent = crashMult.toFixed(2) + '×';
  drawCrashFrame(false);
  requestAnimationFrame(updateCrashLoop);
}

function drawCrashFrame(crashed = false) {
  const canvas = document.getElementById('crash-canvas');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = '#181e26';
  ctx.lineWidth = 1;
  for (let gx = 40; gx < w; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
  }
  for (let gy = 40; gy < h; gy += 40) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
  }

  const progress = Math.min(1, (crashMult - 1) / 5);
  const endX = 24 + progress * (w - 48);
  const endY = h - 24 - Math.pow(progress, 0.85) * (h - 56);

  ctx.strokeStyle = crashed ? '#ff3b5c' : (crashCashedOut ? '#00e701' : '#3b82f6');
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(24, h - 24);
  ctx.quadraticCurveTo(endX * 0.5, h - 24, endX, endY);
  ctx.stroke();

  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(endX, endY, 5, 0, Math.PI * 2);
  ctx.fill();
}

function addCrashBadge(val) {
  const bar = document.getElementById('crash-history');
  const badge = document.createElement('span');
  badge.className = 'crash-badge tabular-nums' + (val >= 2.0 ? ' good' : '');
  badge.textContent = val.toFixed(2) + '×';
  bar.prepend(badge);
  if (bar.children.length > 7) bar.lastChild.remove();
}

// ==========================================
// GAME 3: PLINKO
// ==========================================
const PLINKO_ROWS = 12;
const PLINKO_MULTS = {
  low:  [5.6, 2.1, 1.4, 1.1, 1.0, 0.7, 0.5, 0.7, 1.0, 1.1, 1.4, 2.1, 5.6],
  med:  [18,  4.0, 1.8, 1.2, 0.7, 0.4, 0.3, 0.4, 0.7, 1.2, 1.8, 4.0, 18],
  high: [110, 18,  4.5, 1.6, 0.5, 0.2, 0.2, 0.2, 0.5, 1.6, 4.5, 18,  110]
};
let plinkoRisk = 'high';
let plinkoBalls = [];
let plinkoLoopActive = false;

function setPlinkoRisk(risk) {
  plinkoRisk = risk;
  document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('risk-' + risk).classList.add('active');
  renderPlinkoBuckets();
  playSound('tick', 2);
}

function renderPlinkoBuckets() {
  const container = document.getElementById('plinko-buckets');
  container.innerHTML = '';
  const mults = PLINKO_MULTS[plinkoRisk];
  mults.forEach((m, idx) => {
    const dist = Math.abs(idx - 6) / 6;
    const cls = dist > 0.7 ? 'pbucket high' : dist > 0.35 ? 'pbucket mid' : 'pbucket';
    const div = document.createElement('div');
    div.id = `pbucket-${idx}`;
    div.className = cls + ' tabular-nums';
    div.textContent = m + '×';
    container.appendChild(div);
  });
}

function dropPlinkoBall() {
  const bet = getBet();
  if (!placeWager(bet)) return;

  const path = [];
  let rightCount = 0;
  for (let i = 0; i < PLINKO_ROWS; i++) {
    const dir = Math.random() < 0.5 ? 0 : 1;
    path.push(dir);
    rightCount += dir;
  }

  plinkoBalls.push({
    bet,
    path,
    bucket: rightCount,
    step: 0,
    progress: 0,
    x: 260 + (Math.random() - 0.5) * 4,
    y: 22
  });

  playSound('tick', 4);
  if (!plinkoLoopActive) {
    plinkoLoopActive = true;
    animatePlinko();
  }
}

function drawPlinkoBoard() {
  const canvas = document.getElementById('plinko-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const startY = 38;
  const rowGap = 27;
  const colGap = 34;

  ctx.fillStyle = '#475569';
  for (let r = 0; r < PLINKO_ROWS; r++) {
    const pins = r + 3;
    const rowWidth = (pins - 1) * colGap;
    const startX = (w - rowWidth) / 2;
    for (let p = 0; p < pins; p++) {
      ctx.beginPath();
      ctx.arc(startX + p * colGap, startY + r * rowGap, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  plinkoBalls.forEach(b => {
    ctx.fillStyle = '#00e701';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function animatePlinko() {
  if (plinkoBalls.length === 0) {
    plinkoLoopActive = false;
    drawPlinkoBoard();
    return;
  }

  const w = 520;
  const startY = 38;
  const rowGap = 27;
  const colGap = 34;
  const speed = state.turbo ? 0.16 : 0.085;

  for (let i = plinkoBalls.length - 1; i >= 0; i--) {
    const b = plinkoBalls[i];
    b.progress += speed;

    if (b.progress >= 1) {
      b.progress = 0;
      b.step++;
      playSound('peg');
    }

    if (b.step >= PLINKO_ROWS) {
      const mult = PLINKO_MULTS[plinkoRisk][b.bucket];
      const payout = Math.round(b.bet * mult * 100) / 100;
      settleWager('PLINKO', b.bet, payout);

      const hitEl = document.getElementById('plinko-last-hit');
      hitEl.textContent = `${mult}× (+${payout.toFixed(2)})`;
      hitEl.className = mult >= 1 ? 'status-text accent-green' : 'status-text muted';

      const bucketEl = document.getElementById(`pbucket-${b.bucket}`);
      if (bucketEl) {
        bucketEl.style.transform = 'translateY(3px)';
        setTimeout(() => (bucketEl.style.transform = ''), 120);
      }

      plinkoBalls.splice(i, 1);
      continue;
    }

    let rightsSoFar = 0;
    for (let s = 0; s < b.step; s++) rightsSoFar += b.path[s];

    const curX = w / 2 + (rightsSoFar - b.step / 2) * colGap;
    const curY = startY + b.step * rowGap;

    const nextDir = b.path[b.step] === 1 ? 0.5 : -0.5;
    const nextX = curX + nextDir * colGap;
    const nextY = curY + rowGap;

    const t = b.progress;
    b.x = curX + (nextX - curX) * t;
    b.y = curY + (nextY - curY) * t - Math.sin(t * Math.PI) * 7;
  }

  drawPlinkoBoard();
  requestAnimationFrame(animatePlinko);
}

// ==========================================
// GAME 4: BLACKJACK
// ==========================================
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
let bjDeck = [];
let bjPlayer = [];
let bjDealer = [];
let bjBet = 0;
let bjActive = false;

function createDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ suit: s, rank: r });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handScore(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === 'A') { total += 11; aces++; }
    else if (['K', 'Q', 'J'].includes(c.rank)) total += 10;
    else total += parseInt(c.rank, 10);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function renderCard(card, hidden = false) {
  const div = document.createElement('div');
  if (hidden) {
    div.className = 'playing-card hidden-card pop-in';
    div.textContent = '■';
    return div;
  }
  const isRed = card.suit === '♥' || card.suit === '♦';
  div.className = `playing-card pop-in ${isRed ? 'red' : ''}`;
  div.innerHTML = `<span class="card-corner">${card.rank}</span><span class="card-suit">${card.suit}</span><span class="card-corner bottom">${card.rank}</span>`;
  return div;
}

function renderBlackjack(revealDealer = false) {
  const pBox = document.getElementById('bj-player-cards');
  const dBox = document.getElementById('bj-dealer-cards');
  pBox.innerHTML = '';
  dBox.innerHTML = '';

  bjPlayer.forEach(c => pBox.appendChild(renderCard(c, false)));
  bjDealer.forEach((c, idx) => dBox.appendChild(renderCard(c, !revealDealer && idx === 1)));

  document.getElementById('bj-player-score').textContent = `(${handScore(bjPlayer)})`;
  document.getElementById('bj-dealer-score').textContent = revealDealer
    ? `(${handScore(bjDealer)})`
    : `(${handScore([bjDealer[0]])})`;
}

function startBlackjack() {
  if (bjActive) return;
  const bet = getBet();
  if (!placeWager(bet)) return;

  bjBet = bet;
  bjActive = true;
  bjDeck = createDeck();
  bjPlayer = [bjDeck.pop(), bjDeck.pop()];
  bjDealer = [bjDeck.pop(), bjDeck.pop()];

  document.getElementById('bj-active-bet').textContent = bjBet.toFixed(2) + ' CR';
  const statusEl = document.getElementById('bj-status');
  statusEl.textContent = 'DEIN ZUG';
  statusEl.className = 'status-text white';

  document.getElementById('bj-deal-btn').classList.add('hidden');
  document.getElementById('bj-actions').classList.remove('hidden');
  document.getElementById('bj-double-btn').disabled = state.balance < bjBet;

  playSound('card');
  renderBlackjack(false);

  if (handScore(bjPlayer) === 21) {
    finishBlackjack('BLACKJACK! 3:2', bjBet * 2.5);
  }
}

function bjHit() {
  if (!bjActive) return;
  bjPlayer.push(bjDeck.pop());
  playSound('card');
  renderBlackjack(false);
  document.getElementById('bj-double-btn').disabled = true;

  const score = handScore(bjPlayer);
  if (score > 21) finishBlackjack('BUST (>21)', 0);
  else if (score === 21) bjStand();
}

function bjDouble() {
  if (!bjActive || bjPlayer.length !== 2) return;
  if (!placeWager(bjBet)) return;
  bjBet *= 2;
  document.getElementById('bj-active-bet').textContent = bjBet.toFixed(2) + ' CR';
  bjPlayer.push(bjDeck.pop());
  playSound('card');
  if (handScore(bjPlayer) > 21) finishBlackjack('BUST (>21)', 0);
  else bjStand();
}

function bjStand() {
  if (!bjActive) return;
  while (handScore(bjDealer) < 17) {
    bjDealer.push(bjDeck.pop());
  }
  const pScore = handScore(bjPlayer);
  const dScore = handScore(bjDealer);

  if (dScore > 21 || pScore > dScore) finishBlackjack(`GEWONNEN (${pScore} VS ${dScore})`, bjBet * 2);
  else if (pScore === dScore) finishBlackjack(`PUSH (${pScore})`, bjBet);
  else finishBlackjack(`DEALER GEWINNT (${dScore} VS ${pScore})`, 0);
}

function finishBlackjack(msg, payout) {
  bjActive = false;
  renderBlackjack(true);
  const statusEl = document.getElementById('bj-status');
  statusEl.textContent = msg;
  statusEl.className =
    payout > bjBet ? 'status-text accent-green' :
    payout === bjBet ? 'status-text accent-gold' :
    'status-text accent-red';

  settleWager('BLACKJACK', bjBet, payout);
  document.getElementById('bj-deal-btn').classList.remove('hidden');
  document.getElementById('bj-actions').classList.add('hidden');
}

// ==========================================
// LIVE FEED & KEYBOARD SHORTCUTS
// ==========================================
const FEED_USERS = ['k4izer', 'nxva', 'vortex99', 'm4rc', 'zenith', 'lukas_at', 'r0nin', 'drift'];
const FEED_GAMES = ['SLOTS', 'CRASH', 'PLINKO', 'BLACKJACK'];

function addFeedEntry(user, game, bet, mult, payout) {
  const feed = document.getElementById('live-feed');
  const row = document.createElement('div');
  const isWin = payout > bet;
  row.className = 'feed-row pop-in';
  row.innerHTML = `
    <div>
      <span class="white">${user}</span>
      <span class="muted">${game}</span>
    </div>
    <div class="tabular-nums ${isWin ? 'accent-green' : 'muted'}">
      ${isWin ? '+' + payout.toFixed(2) : '-' + bet.toFixed(2)}
    </div>
  `;
  feed.prepend(row);
  if (feed.children.length > 18) feed.lastChild.remove();
}

setInterval(() => {
  const u = FEED_USERS[Math.floor(Math.random() * FEED_USERS.length)];
  const g = FEED_GAMES[Math.floor(Math.random() * FEED_GAMES.length)];
  const b = [10, 25, 50, 100, 250][Math.floor(Math.random() * 5)];
  const win = Math.random() < 0.44;
  const m = win ? 1.4 + Math.random() * 6 : 0;
  addFeedEntry(u, g, b, m, win ? b * m : 0);
}, 2400);

function triggerCurrentGameAction() {
  if (currentGame === 'slots') spinSlots();
  else if (currentGame === 'crash') handleCrashAction();
  else if (currentGame === 'plinko') dropPlinkoBall();
  else if (currentGame === 'blackjack' && !bjActive) startBlackjack();
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    if (!spaceHeld) {
      spaceHeld = true;
      triggerCurrentGameAction();
      if (state.turbo) {
        spaceInterval = setInterval(triggerCurrentGameAction, 140);
      }
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    spaceHeld = false;
    clearInterval(spaceInterval);
  }
});

// ==========================================
// BOOTSTRAP
// ==========================================
initSlotsGrid();
renderPlinkoBuckets();
if (state.turbo) {
  state.turbo = false;
  toggleTurbo();
}
if (state.muted) {
  state.muted = false;
  toggleMute();
}
updateHUD();
for (let i = 0; i < 6; i++) {
  addFeedEntry(FEED_USERS[i], FEED_GAMES[i % 4], 50, 2.4, i % 2 === 0 ? 120 : 0);
}
