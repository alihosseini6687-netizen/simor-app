// ==========================================================
// منطق اصلی مینی‌اپلیکیشن تلگرام (Core App & Touch Logic)
// ==========================================================

// متغیرهای حالت برنامه (State)
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

// فرمول سطح‌ها (سطح ۱ تا ۵۰)
function getLevelRequirement(lvl) {
  let base = 150;
  for (let i = 1; i < lvl; i++) {
    if (i <= 10) base *= 1.15;
    else if (i <= 30) base *= 1.10;
    else base *= 1.05;
  }
  return Math.round(base);
}

// مقداردهی اولیه
document.addEventListener('DOMContentLoaded', () => {
  initUserData();
  setupTouchAndTilt();
  updateUI();
});

// شناسایی یا صدور شناسه رندوم کاربر
function initUserData() {
  let saved = localStorage.getItem('simor_user_state');
  if (saved) {
    userState = JSON.parse(saved);
  } else {
    // تولید شناسه ۸ رقمی با پیشوند s
    let randomNum = Math.floor(10000000 + Math.random() * 90000000);
    userState.uid = 's' + randomNum;

    // دریافت نام کاربر از تلگرام در صورت وجود
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      let u = tg.initDataUnsafe.user;
      userState.name = u.first_name || u.username || 'Player';
      if (u.photo_url) {
        document.getElementById('user-avatar').src = u.photo_url;
      }
    }
    saveState();
  }
}

function saveState() {
  localStorage.setItem('simor_user_state', JSON.stringify(userState));
}

// به‌روزرسانی المنت‌های صفحه
function updateUI() {
  document.getElementById('user-name').innerText = userState.name;
  document.getElementById('user-uid').innerText = userState.uid;
  document.getElementById('coin-balance').innerText = userState.coins.toFixed(3);
  document.getElementById('current-level').innerText = `Level ${userState.level}`;
  
  let req = getLevelRequirement(userState.level);
  document.getElementById('level-req').innerText = `${Math.floor(userState.coins)} / ${req}`;
  
  let progressPercent = Math.min(100, (userState.coins / req) * 100);
  document.getElementById('progress-fill').style.width = `${progressPercent}%`;

  document.getElementById('energy-val').innerText = userState.energy;
  document.getElementById('energy-fill').style.width = `${(userState.energy / userState.maxEnergy) * 100}%`;

  document.getElementById('tap-lvl').innerText = userState.tapPowerLvl;
  document.getElementById('refill-left').innerText = userState.refillsLeft;
}

// سیستم تعاملی لمس، انیمیشن ۳بعدی و تپ سکه
function setupTouchAndTilt() {
  const coinWrapper = document.getElementById('coin-tap-target');
  const coinImg = coinWrapper ? coinWrapper.querySelector('.coin-3d') : null;

  if (!coinWrapper || !coinImg) return;

  coinWrapper.addEventListener('pointerdown', (e) => {
    if (userState.energy < 1) return;

    // ویبره هپتیک تلگرام
    if (tg && tg.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }

    // زاویه ۳بعدی متناسب با محل لمس انگشت روی سکه
    const rect = coinWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const rotX = -(y / 4).toFixed(1);
    const rotY = (x / 4).toFixed(1);

    coinImg.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(0.96)`;

    // افزایش موجودی و کسر انرژی
    userState.coins += userState.tapPower;
    userState.energy -= 1;

    // بررسی ارتقای خودکار لول
    checkLevelUp();

    updateUI();
    saveState();
  });

  const resetTilt = () => {
    coinImg.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)';
  };

  coinWrapper.addEventListener('pointerup', resetTilt);
  coinWrapper.addEventListener('pointerleave', resetTilt);
}

// بررسی صعود به لول بعدی و پاداش ۳ درصدی
function checkLevelUp() {
  let req = getLevelRequirement(userState.level);
  if (userState.coins >= req && userState.level < 50) {
    userState.level += 1;
    // ۳ درصد پاداش
    let bonus = req * 0.03;
    userState.coins += bonus;
    
    // جایزه ویژه لول ۵۰
    if (userState.level === 50) {
      userState.coins += 20000;
    }

    if (tg && tg.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred('success');
    }
  }
}

// باز و بسته کردن بازی‌ها از هاب ۳×۴
function openGame(gameType) {
  if (gameType === 'tap') {
    document.getElementById('modal-tap-game').classList.remove('hidden');
  } else {
    alert('این مینی‌گیم در حال اتصال به سرور است.');
  }
}

function closeGame(gameType) {
  if (gameType === 'tap') {
    document.getElementById('modal-tap-game').classList.add('hidden');
  }
}

// باز و بسته‌کردن پنل شفاف بوسترها
function toggleBoostSheet() {
  const sheet = document.getElementById('boost-sheet');
  sheet.classList.toggle('hidden');
}

// خرید ارتقای قدرت تپ (تا ۱۰ سطح)
function buyTapUpgrade() {
  let cost = userState.tapPowerLvl * 50;
  if (userState.coins >= cost && userState.tapPowerLvl < 10) {
    userState.coins -= cost;
    userState.tapPowerLvl += 1;
    userState.tapPower = +(0.001 * userState.tapPowerLvl).toFixed(3);
    document.getElementById('tap-cost').innerText = (userState.tapPowerLvl * 50);
    updateUI();
    saveState();
  } else {
    alert('سکه کافی نیست یا به حداکثر سطح رسیده‌اید.');
  }
}

// خرید شارژ دستی مخزن (حداکثر ۳ بار در روز)
function buyRefill() {
  let cost = 100;
  if (userState.refillsLeft > 0 && userState.coins >= cost) {
    userState.coins -= cost;
    userState.energy = userState.maxEnergy;
    userState.refillsLeft -= 1;
    updateUI();
    saveState();
    toggleBoostSheet();
  } else {
    alert('سکه ناکافی است یا سهمیه شارژ امروز تمام شده است.');
  }
}

// جابجایی تب‌های پایین
function switchTab(tabName) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  event.currentTarget.classList.add('active');
  
  if (tabName !== 'games') {
    alert(`صفحه ${tabName} آماده بارگذاری بخش‌های بعدی است.`);
  }
}
