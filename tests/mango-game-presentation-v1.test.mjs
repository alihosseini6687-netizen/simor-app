import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const theme=readFileSync(new URL('../assets/css/mango-game-theme-v1.css',import.meta.url),'utf8');
const homeTheme=readFileSync(new URL('../assets/css/mango-game-home-v1.css',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../simab.webmanifest',import.meta.url),'utf8'));
test('Mango Game home has exactly Hokm, Poker and Backgammon featured cards',()=>{
  const featured=home.match(/<div class="mango-games-grid">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(featured,'missing home featured row');
  assert.equal((featured.match(/mango-game-tile /g)||[]).length,3);
  assert.match(featured,/game=hokm/);
  assert.match(featured,/games\/poker\/index\.html/);
  assert.match(featured,/game=backgammon/);
  assert.doesNotMatch(featured,/slot|roulette|friends\.html/);
  assert.match(home,/mango-wheel-banner/);
  assert.match(home,/games\/wheel\/index\.html/);
  assert.match(home,/class="bottom-nav"/);
});
test('legacy account and admin affordances and authoritative wallet hooks remain',()=>{
  for(const id of ['user-balance-txt','user-game-id','user-name-txt','tasks-balance-num','games-container','tab-btn-games','tab-btn-tasks','v8-hero-recent'])
    assert.match(home,new RegExp('id="'+id+'"'));
  assert.match(home,/id="mango-account-details"/);
  assert.match(home,/id="btn-admin-bar"/);
  assert.match(home,/assets\/js\/simab-wallet-client\.js/);
  assert.match(home,/assets\/js\/simab-launch-routing-v22\.js/);
  assert.match(home,/assets\/css\/mango-game-home-v1\.css/);
  assert.match(home,/assets\/css\/mango-game-theme-v1\.css/);
});
test('Mango styles apply to home and game surfaces without changing game rules',()=>{
  for(const token of ['#121417','#1b1f24','#ff9e1b','#ffc247','#a6d94e'])
    assert.ok(theme.toLowerCase().includes(token));
  assert.match(theme,/#poker-room/);
  assert.match(theme,/#arena/);
  assert.match(homeTheme,/.mango-hero/);
  assert.match(homeTheme,/.mango-wheel-banner/);
  assert.equal(manifest.short_name,'Mango Game');
  assert.equal(manifest.icons[0].src,'assets/mango/mango-game-original-logo.png');
  assert.equal(manifest.start_url,'./index.html?home=1');
  assert.equal(manifest.id,'./index.html');
});
