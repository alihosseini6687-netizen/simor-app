// ==========================================================
// منطق تعاملی، جابجایی تب‌ها و سیستم تپ طلایی
// ==========================================================

let tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
  tg.expand();
  tg.ready();
}

let userState = {
  uid: '',
  name: 'Player',
  coins: 0.000,
  level: 1,
  energy: 2500,
  maxEnergy: 2500,
  tapPowerLvl: 1,
  tapPower: 0.001,
  refillsLeft: 3
};

function getLevelRequirement(lvl) {
  let base = 150;
  for (let i = 1; i < lvl; i++) {
    if (i <= 10) base *= 1.15;
    else if (i <= 30) base *= 1.10;
    else base *= 1.05;
  }
  return Math.round(base);
}

document.addEventListener('DOMContentLoaded', () => {
  initUserData();
  setupTouchAndTilt();
  updateUI();
});

function initUserData() {
  let saved = localStorage.getItem('simor_user_state');
  if (saved) {
    userState = JSON.parse(saved);
  } else {
    let randomNum = Math.floor(10000000 + Math.random() * 90000000);
    userState.uid = 's' + randomNum;
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      let u = tg.initDataUnsafe.user;
      userState.name = u.first_name || u.username || 'Player';
    }
    saveState();
  }
  document.getElementById('ref-link-text').innerText = `https://t.me/SimorApp_bot?startapp=${userState.uid}`;
}

function saveState() {
  localStorage.setItem('simor_user_state', JSON.stringify(userState));
}

function updateUI() {
  document.getElementById('user-name').innerText = userState.name;
  document.getElementById('user-uid').innerText = userState.uid;
  document.getElementById('coin-balance').innerText = userState.coins.toFixed(3);
  document.getElementById('current-level').innerText = `سطح ${userState.level} ★`;
  
  let req = getLevelRequirement(userState.level);
  document.getElementById('level-req').innerText = `${Math.floor(userState.coins)} / ${req}`;
  document.getElementById('progress-fill').style.width = `${Math.min(100, (userState.coins / req) * 100)}%`;

  document.getElementById('energy-val').innerText = `${userState.energy} / ${userState.maxEnergy}`;
  document.getElementById('energy-fill').style.width = `${(userState.energy / userState.maxEnergy) * 100}%`;

  document.getElementById('tap-lvl').innerText = userState.tapPowerLvl;
  document.getElementById('refill-left').innerText = userState.refillsLeft;
}

// سیستم تپ و انیمیشن سه‌بعدی
function setupTouchAndTilt() {
  const target = document.getElementById('coin-tap-target');
  const coin = target ? target.querySelector('.coin-3d-gold') : null;
  if (!target || !coin) return;

  target.addEventListener('pointerdown', (e) => {
    if (userState.energy < 1) return;

    if (tg && tg.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }

    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    coin.style.transform = `perspective(600px) rotateX(${-(y/4).toFixed(1)}deg) rotateY(${(x/4).toFixed(1)}deg) scale(0.96)`;

    userState.coins += userState.tapPower;
    userState.energy -= 1;

    checkLevelUp();
    updateUI();
    saveState();
  });

  const reset = () => { coin.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)'; };
  target.addEventListener('pointerup', reset);
  target.addEventListener('pointerleave', reset);
}

function checkLevelUp() {
  let req = getLevelRequirement(userState.level);
  if (userState.coins >= req && userState.level < 50) {
    userState.level += 1;
    userState.coins += req * 0.03;
    if (userState.level === 50) userState.coins += 20000;
    if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
  }
}

// جابجایی تب‌های ناوبری پایین بدون هشدار و با انیمیشن روان
function switchNav(tabName, el) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');

  document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.add('active');
}

function openGame(type) {
  if (type === 'tap') document.getElementById('modal-tap-game').classList.remove('hidden');
  else alert('این بازی در پچ بعدی آنلاین خواهد شد.');
}

function closeGame(type) {
  if (type === 'tap') document.getElementById('modal-tap-game').classList.add('hidden');
}

function toggleBoostSheet() {
  document.getElementById('boost-sheet').classList.toggle('hidden');
}

function buyTapUpgrade() {
  let cost = userState.tapPowerLvl * 50;
  if (userState.coins >= cost && userState.tapPowerLvl < 10) {
    userState.coins -= cost;
    userState.tapPowerLvl += 1;
    userState.tapPower = +(0.001 * userState.tapPowerLvl).toFixed(3);
    document.getElementById('tap-cost').innerText = userState.tapPowerLvl * 50;
    updateUI();
    saveState();
  }
}

function buyRefill() {
  let cost = 100;
  if (userState.refillsLeft > 0 && userState.coins >= cost) {
    userState.coins -= cost;
    userState.energy = userState.maxEnergy;
    userState.refillsLeft -= 1;
    updateUI();
    saveState();
    toggleBoostSheet();
  }
}

// عملکرد چرخاندن گردونه
let isSpinning = false;
function spinWheel() {
  if (isSpinning) return;
  isSpinning = true;
  const disc = document.getElementById('wheel-disc');
  const deg = 1800 + Math.floor(Math.random() * 360);
  disc.style.transform = `rotate(${deg}deg)`;
  setTimeout(() => {
    isSpinning = false;
    userState.coins += 2;
    updateUI();
    saveState();
  }, 3200);
}

// بررسی تسک‌ها با تایمر ۳۰ ثانیه‌ای
function verifyTask(btn, reward) {
  btn.disabled = true;
  btn.innerText = 'در حال بررسی...';
  setTimeout(() => {
    userState.coins += reward;
    btn.innerText = 'انجام شد ✓';
    btn.style.borderColor = '#10b981';
    btn.style.color = '#10b981';
    updateUI();
    saveState();
  }, 1500);
}

function copyRefLink() {
  navigator.clipboard.writeText(document.getElementById('ref-link-text').innerText);
  alert('لینک کپی شد!');
}
