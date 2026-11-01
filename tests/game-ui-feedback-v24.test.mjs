import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const party=read('assets/js/simab-party-v16.js');
const table=read('assets/js/simab-table-games-v13.js');
const first=party.indexOf('function decorateDice(value){'),last=party.indexOf('\nfunction questionCard(',first);
assert.ok(first>=0&&last>first,'extract original multiplayer die renderer');
const diceCode=party.slice(first,last);
new Script(diceCode);
new Script(party);new Script(table);
function visualizeDie(value){
 const box={dataset:{},children:[],attributes:{},
  replaceChildren(){this.children=[];},
  setAttribute(k,v){this.attributes[k]=v;},
  append(n){this.children.push(n);}
 };
 const node=(tag,cls,text)=>({tag,className:cls||'',textContent:text||'',style:{},children:[],append(...children){this.children.push(...children);}});
 const context={document:{querySelectorAll:sel=>sel==='.dice3d'?[box]:[]},node,fmt:n=>String(n)};
 runInNewContext(diceCode+';decorateDice(value)',{...context,value});
 return box;
}
test('unrolled multiplayer dice have a question mark, not a fabricated face 1',()=>{
 for(const value of [undefined,null,0,7,-1]){
  const die=visualizeDie(value);
  assert.equal(die.dataset.unrolled,'true');
  assert.equal(die.children.length,1);
  assert.equal(die.children[0].className,'dice-unrolled');
  assert.equal(die.children[0].textContent,'?');
  assert.match(die.attributes['aria-label'],/هنوز تاس/);
 }
});
test('real server dice 1, 3, 6 display correct pip counts and spoken result',()=>{
 for(const value of [1,3,6]){
  const die=visualizeDie(value);
  assert.equal(die.dataset.unrolled,'false');
  assert.equal(die.children[0].className,'dice-cube');
  assert.equal(die.children[0].children.length,6);
  const counts=die.children[0].children.map(face=>face.children.filter(x=>x.tag==='i').length);
  assert.deepEqual(counts,[1,2,6,5,3,4]);
  assert.match(die.attributes['aria-label'],new RegExp(String(value)));
 }
});
test('multiplayer dice UI never defaults to one when result is missing',()=>{
 assert.match(party,/decorateDice\(s\.kind==='ludo'\?s\.table\.die:s\.kind==='truth'&&s\.mode==='bottle'\?null:s\.die\)/);
 assert.doesNotMatch(party,/decorateDice\(s\.kind==='ludo'\?s\.table\.die:s\.die\|\|1\)/);
});
test('standalone Ludo die uses current authoritative turn and leaves history separate',()=>{
 assert.match(table,/function ludoDice\(s\)\{const value=s\.die,valid=/);
 assert.match(table,/ludo-roll-history/);
 assert.doesNotMatch(table,/const value=s\.die\|\|s\.lastRoll\?\.value/);
 assert.match(table,/game==='hokm'\?'نوبت '\+names\[session\.state\.current\]/);
});
test('miner receipt messages do not claim a successful collection on server not-ready or malformed reply',()=>{
 const html=read('games/horoscope/index.html');
 const parts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
 parts.forEach(js=>new Script(js));
 assert.match(html,/minerNotReady\?/);
 assert.match(html,/minerAlreadyStarted\?/);
 assert.match(html,/Number\.isSafeInteger\(r\.rewardCoins\)/);
 assert.match(html,/برآورد تقریبی/);
});
test('each newly introduced game/miner label is localized in seven languages',()=>{
 const langs=['en','fa','ru','ar','hi','fr','de'];
 const catalogs=Object.fromEntries(langs.map(x=>[x,{}]));
 const context={window:{SimabLocales:{catalogs}}};
 runInNewContext(read('assets/js/i18n/other-tools.js'),context);
 for(const lang of langs)for(const key of ['miner.coinsEstimated','miner.estimateExplanation','miner.notReady','miner.alreadyStarted','miner.invalidReceipt','miner.balanceDelta','game.ludoServerActions','game.hokmServerActions']){
  const text=catalogs[lang][key];
  assert.ok(typeof text==='string'&&text.trim().length>10,lang+' '+key);
 }
});
