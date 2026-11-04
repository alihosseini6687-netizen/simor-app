import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const get=p=>readFileSync(new URL(p,root),'utf8');
const home=get('index.html');
const css=get('assets/css/mango-game-theme-v1.css');
const manifest=JSON.parse(get('simab.webmanifest'));
const homePart=home.split('id="tab-home-content"')[1]?.split('<!-- سربرگ ۲: بازی‌ها -->')[0];
test('approved Mango Game home has wallet, hero, exactly three featured games, wheel and existing menu',()=>{
 assert.ok(homePart);
 assert.match(home,/class="top-header mango-header"/);
 assert.match(home,/id="user-balance-txt" data-coins/);
 assert.match(homePart,/mango-hero/);
 assert.equal((homePart.match(/class="mango-game-tile"/g)||[]).length,3);
 for(const route of ['game=hokm','games/poker/index.html','game=backgammon'])assert.ok(homePart.includes(route),route);
 assert.doesNotMatch(homePart,/games\/slot\/index.html|game=roulette|games\/roulette|class="friend-entry"|بازی با دوستان/);
 assert.match(homePart,/games\/wheel\/index.html/);
 for(const id of ['tab-btn-home','tab-btn-games','tab-btn-news','tab-btn-tasks'])assert.match(home,new RegExp('id="'+id+'"'));
 for(const id of ['user-name-txt','user-num-id','user-game-id','btn-admin-bar','tasks-balance-num','games-container'])assert.match(home,new RegExp('id="'+id+'"'));
});
test('other supported games remain available via existing Games tab; identity and payment source untouched',()=>{
 for(const url of ['games/slot/index.html','games/blackjack/index.html','games/room/index.html?game=ludo'])
  assert.ok(home.includes(url),'full catalog removed: '+url);
 assert.match(home,/const ADMIN_ID = "702007470"/);
 assert.match(home,/SimabWallet\.subscribe/);
 assert.match(home,/simab_signed_launch_init_data_v1/);
});
test('global theme is linked on all main gameplay pages without changing the protected i18n loader',()=>{
 assert.match(home,/mango-game-theme-v1\.css\?v=20261104/);
 for(const p of ['games/room/index.html','games/poker/friends.html','games/backgammon/index.html','games/slot/index.html','wallet/index.html']){
   assert.match(get(p),/mango-game-theme-v1\.css\?v=20261104/,'Mango stylesheet absent in '+p);
 }
 for(const value of ['#121417','#1b1f24','#ff9e1b','#ffc247','#a6d94e','#f5f2ea','#a7adb7'])
  assert.ok(css.includes(value),'missing brand color '+value);
 assert.match(css,/\.table-felt/);
 assert.match(css,/\.bg-board/);
 assert.match(css,/\.party-shell/);
 assert.match(css,/\.poker-controls/);
});
test('Mango Game identity has a local app icon but legacy bot endpoint remains unchanged',()=>{
 assert.match(home,/assets\/mango-game-original-icon\.webp/);
 assert.match(home,/assets\/mango-game-mark\.svg/);
 assert.match(get('assets/mango-game-mark.svg'),/<svg /);
 assert.equal(manifest.short_name,'Mango Game');
 assert.equal(manifest.theme_color,'#121417');
 assert.match(get('supabase/functions/simab-central-quests/index.ts'),/simorapp_bot/);
});
