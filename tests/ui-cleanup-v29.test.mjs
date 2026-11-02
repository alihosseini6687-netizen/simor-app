import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const home=read('index.html');
const runtime=read('assets/js/i18n/runtime.js');
const css=read('assets/css/simab-safe-area-v16.css');
const shop=read('assets/js/simab-shop-v15.js');

test('home has one welcome title, one Games entry and recent-game row, but no game shortcut strip or virtual-credit duplicates',()=>{
 assert.match(home,/<h1 data-i18n="home.shortWelcome">خوش آمدید<\/h1>/);
 assert.match(home,/onclick="switchNavTab\('games'\)"/);
 assert.match(home,/id="v8-hero-recent"/);
 assert.doesNotMatch(home,/class="v8-hero-focus"/);
 assert.doesNotMatch(home,/class="simab-secure-entry"/);
 assert.doesNotMatch(home,/🎮 GAME ZONE/);
 assert.doesNotMatch(home,/<h1>همه <em>بازی‌ها<\/em><\/h1>/);
 assert.match(home,/بازی مورد علاقه‌ات را انتخاب کن/);
});
test('Tasks keeps requested reward explanation but drops repetitive server-account metadata',()=>{
 const tasks=home.slice(home.indexOf('id="tab-tasks-content"'),home.indexOf('id="tab-news-content"'));
 assert.match(tasks,/پاداش‌ها فعلاً مجازی‌اند/);
 assert.match(tasks,/id="tasks-balance-num"/);
 assert.doesNotMatch(tasks,/موجودی سروری این حساب/);
 assert.doesNotMatch(tasks,/data-wallet-account/);
});
test('noncash notice is not repeated at the bottom of daily, wheel, miner, slot and game pages',()=>{
 for(const path of ['streak/index.html','games/tap/index.html','games/wheel/index.html','games/horoscope/index.html','games/slot/index.html','games/poker/index.html','games/poker/friends.html','games/backgammon/index.html','swap/index.html','games/hokm/index.html','games/ludo/index.html','games/blackjack/index.html','games/room/index.html']){
  const s=read(path);
  assert.doesNotMatch(s,/برداشت نقدی وجود ندارد|برداشت نقدی ندارند|برداشت پول ندارد/,path);
 }
 assert.match(read('wallet/terms.html'),/برداشت/,'purchase terms still disclose the real credit restrictions');
});
test('Wallet keeps Stars server-confirmation but not duplicated messages or unnecessary TON explanation',()=>{
 const wallet=read('wallet/index.html');
 assert.match(wallet,/بسته را انتخاب کن؛ پرداخت در پنجرهٔ رسمی تلگرام/);
 assert.match(wallet,/سکه فقط پس از تأیید سروری پرداخت/);
 assert.doesNotMatch(wallet,/برای کالای دیجیتال در تلگرام از Stars استفاده می‌شود/);
 assert.doesNotMatch(wallet,/v8-virtual-label/);
 assert.doesNotMatch(wallet,/همه سکه‌ها و ژتون‌ها اعتبار مجازی داخل بازی هستند/);
 assert.doesNotMatch(shop,/موجودی عمومی ولت روی شبکهٔ اصلی؛ با سکهٔ بازی متفاوت است/);
 assert.doesNotMatch(shop,/r\.enabled\?'بسته را انتخاب کن/);
});
test('No translated-text diagnostic banner is injected in the seven-language runtime',()=>{
 assert.doesNotMatch(runtime,/document\.createElement\('p'\);notice\.id='simab-i18n-notice'/);
 assert.match(runtime,/function coverage\(\)/,'developer audit remains callable');
 assert.match(runtime,/function audit\(/,'translation audit remains available');
});
test('Welcome is translated to seven languages, including English and Persian',()=>{
 const langs=['fa','en','ru','ar','hi','fr','de'],catalogs=Object.fromEntries(langs.map(x=>[x,{}]));
 const context={window:{SimabLocales:{catalogs}}};
 vm.runInNewContext(read('assets/js/i18n/other-tools.js'),context);
 for(const lang of langs)assert.ok(catalogs[lang]['home.shortWelcome']?.trim(),lang);
 assert.equal(catalogs.fa['home.shortWelcome'],'خوش آمدید');
 assert.equal(catalogs.en['home.shortWelcome'],'Welcome');
});
test('Back/Home anchors are buttons on mobile and desktop, and every main UI uses a fresh shared style',()=>{
 assert.match(css,/min-height:40px/);
 assert.match(css,/border-radius:11px/);
 assert.match(css,/@media \(max-width:370px\)/);
 assert.match(css,/@media \(min-width:900px\)/);
 for(const p of ['index.html','wallet/index.html','wallet/privacy.html','wallet/terms.html','quests/index.html','games/wheel/index.html','games/room/index.html','games/poker/friends.html','games/ludo/index.html','streak/index.html']){
  assert.match(read(p),/simab-safe-area-v16\.css\?v=20261102/,p);
 }
});
test('Web and Mini App share the same home and all game pages, without inventing browser wallet identities',()=>{
 assert.match(home,/id="tab-games-content"/);
 assert.match(home,/assets\/v3\/hero\.webp/);
 assert.match(home,/assets\/js\/simab-wallet-client\.js/);
 assert.doesNotMatch(home,/window\.location\s*=\s*['"]https:\/\/t\.me/);
 assert.match(read('assets/js/simab-wallet-client.js'),/ورود از تلگرام لازم است/);
});

test('same web home installs as a standalone shell without caching wallet data offline',()=>{
 const meta=JSON.parse(read('simab.webmanifest'));
 assert.equal(meta.start_url,'./index.html?home=1');
 assert.equal(meta.display,'standalone');
 assert.match(home,/rel="manifest" href="simab.webmanifest"/);
 assert.ok(meta.icons.some(x=>x.src==='assets/v16/simab-logo.png'));
 assert.doesNotMatch(home,/navigator\.serviceWorker\.register/);
});
