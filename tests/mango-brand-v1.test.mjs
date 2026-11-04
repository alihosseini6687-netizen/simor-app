import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Mango Game home matches approved three featured games and daily wheel',()=>{
 const html=read('index.html'),home=html.slice(html.indexOf('<div id="tab-home-content">'),html.indexOf('<!-- سربرگ ۲: بازی‌ها -->'));
 assert.match(html,/<title>Mango Game \| Gaming Club<\/title>/);
 assert.equal((home.match(/class="mango-feature"/g)||[]).length,3);
 for(const slug of ['game=hokm','games/poker/index.html','game=backgammon'])assert.ok(home.includes(slug),slug);
 assert.doesNotMatch(home,/games\/slot\//);
 assert.doesNotMatch(home,/game=roulette/);
 assert.doesNotMatch(home,/بازی با دوستان/);
 assert.match(home,/games\/wheel\/index\.html/);
 assert.match(home,/mango-game-icon\.jpg/);
 for(const nav of ['home','games','news','tasks'])assert.match(html,new RegExp('id="tab-btn-'+nav+'"'));
 for(const id of ['user-balance-txt','tasks-balance-num','user-name-txt','avatar-container','user-game-id','btn-admin-bar'])assert.equal(html.split('id="'+id+'"').length-1,1,id);
});
test('site-wide colors apply on independent game pages without editing financial / engine functions',()=>{
 const paths=['index.html','games/room/index.html','games/poker/friends.html','games/poker/index.html','games/blackjack/index.html','games/slot/index.html','games/wheel/index.html','wallet/index.html','swap/index.html','quests/index.html','streak/index.html','friends/index.html','admin/index.html','ai/index.html'];
 for(const path of paths){
  const html=read(path);
  assert.match(html,/mango-game-theme\.css\?v=20261104/,path);
  assert.match(html,/mango-game-labels\.js\?v=20261104/,path);
 }
 const css=read('assets/css/mango-game-theme.css');
 for(const hex of ['#121417','#1b1f24','#ff9e1b','#ffc247','#a6d94e'])assert.ok(css.includes(hex),hex);
 assert.match(read('assets/js/mango-game-labels.js'),/closest\('script,style,textarea,code,pre/);
});
test('PWA branding changed without rotating Telegram bot or wallet identity',()=>{
 const manifest=JSON.parse(read('simab.webmanifest'));
 assert.equal(manifest.name,'Mango Game — Gaming Club');
 assert.equal(manifest.start_url,'./index.html?home=1');
 assert.equal(manifest.id,'./index.html');
 assert.match(read('index.html'),/simab_signed_launch_init_data_v1/);
 assert.match(read('games/room/index.html'),/simab-party-v16\.js/);
});
