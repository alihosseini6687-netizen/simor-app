import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const txt=path=>read(path).toString('utf8');

test('Mango Game home follows approved composition, but keeps the full original game catalog',()=>{
 const home=txt('index.html');
 const section=home.slice(home.indexOf('id="tab-home-content"'),home.indexOf('<!-- سربرگ ۲: بازی‌ها -->'));
 assert.match(home,/mango-wallet-row/);
 assert.equal((home.match(/id="user-balance-txt"/g)||[]).length,1,'one authoritative wallet balance');
 assert.equal((home.match(/id="v8-hero-recent"/g)||[]).length,1,'recent-game restore hook retained');
 assert.match(section,/به <strong>مانگو گیم<\/strong> خوش آمدید/);
 assert.equal((section.match(/class="mango-home-card /g)||[]).length,3);
 for(const url of ['games/room/index.html?game=hokm','games/poker/index.html','games/room/index.html?game=backgammon'])assert.ok(section.includes('href="'+url+'"'),url);
 assert.doesNotMatch(section,/games\/slot\/index\.html|games\/wheel\/index\.html\?slot|رولت|class="friends-banner"/);
 assert.match(section,/href="games\/wheel\/index\.html"/);
 for(const asset of ['mango-hokm-card.webp','mango-poker-card.webp','mango-backgammon-card.webp','mango-wheel-art.webp']){
  assert.match(section,new RegExp('assets/'+asset.replace('.',String.raw'\.')));
  const bytes=read('assets/'+asset);
  assert.equal(bytes.subarray(0,4).toString('ascii'),'RIFF',asset);
  assert.equal(bytes.subarray(8,12).toString('ascii'),'WEBP',asset);
 }
 assert.match(section,/id="mango-account-details"/);
 assert.match(section,/id="btn-admin-bar"/);
 assert.match(home,/id="tab-news-content"/);
 assert.match(home,/id="tab-games-content"/);
 assert.match(home,/id="tab-tasks-content"/);
 assert.match(home,/games\/slot\/index\.html/,'previously implemented non-featured games stay available');
 assert.match(home,/assets\/js\/simab-wallet-client\.js\?v=21/,'signed shared wallet remains');
});
test('real supplied Mango logo is a valid PNG; PWA and TON retain their original identity/origin',()=>{
 const png=read('assets/mango-game-icon.png');
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),128);
 assert.equal(png.readUInt32BE(20),128);
 const manifest=JSON.parse(txt('simab.webmanifest'));
 assert.equal(manifest.id,'./index.html');
 assert.equal(manifest.start_url,'./index.html?home=1');
 assert.ok(manifest.icons.some(x=>x.src==='assets/mango-game-icon.png'));
 const ton=JSON.parse(txt('tonconnect-manifest.json'));
 assert.equal(ton.url,'https://alihosseini6687-netizen.github.io/simor-app');
 assert.equal(ton.termsOfUseUrl,'https://alihosseini6687-netizen.github.io/simor-app/wallet/terms.html');
 assert.equal(ton.name,'Mango Game');
 assert.match(ton.iconUrl,/\/assets\/mango-game-icon\.png$/);
 assert.doesNotMatch(JSON.stringify(ton),/mnemonic|private_key|seed_phrase/i);
});
test('Mango look is shared across major screens without changing rules or stake endpoints',()=>{
 const theme=txt('assets/css/mango-game-theme-v1.css');
 for(const color of ['#121417','#1b1f24','#ff9e1b','#ffc247','#a6d94e'])assert.ok(theme.includes(color));
 for(const page of ['index.html','games/room/index.html','games/poker/index.html','games/poker/friends.html',
   'games/backgammon/index.html','games/blackjack/index.html','games/ludo/index.html','games/slot/index.html',
   'games/wheel/index.html','wallet/index.html','admin/index.html','quests/index.html','friends/index.html']){
  const contents=txt(page);assert.match(contents,/mango-game-theme-v1\.css\?v=20261104-mango1/,page);
  if(page!=='index.html')assert.match(contents,/mango-game-labels-v1\.js/,page);
 }
 const home=txt('index.html');
 assert.match(home,/mango-game-home-v1\.css/);
 assert.match(home,/id="user-game-id"/);
 assert.match(home,/simab_signed_launch_init_data_v1/,'signed launch retention unchanged');
});
