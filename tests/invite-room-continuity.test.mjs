import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const party=readFileSync(new URL('../assets/js/simab-party-v16.js',import.meta.url),'utf8');
const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const launchScript=readFileSync(new URL('../assets/js/simab-launch-routing-v22.js',import.meta.url),'utf8');

// Exercise the real start-button guard rather than duplicating its logic.
function startDisabled(room,required){
 const match=party.match(/function syncButtons\(\)\{[^\n]*\}/);
 assert.ok(match,'room button guard must exist');
 const nodes=Object.fromEntries(['start','leave','join','create','practice-enter'].map(id=>[id,{disabled:false}]));
 const context={latest:room?{room}:null,busy:false,SimabWallet:{pending:null},
   document:{querySelectorAll:()=>[],getElementById:id=>nodes[id]},
   requiredPlayers:()=>required};
 vm.createContext(context);
 vm.runInContext('const $=id=>document.getElementById(id);'+match[0]+';syncButtons();',context);
 return nodes.start.disabled;
}
test('host must wait for the chosen table size; guests and finished tables cannot start',()=>{
 const room={host:true,status:'waiting',members:[{subject:'host'},{subject:'friend'}],maxPlayers:4};
 assert.equal(startDisabled(room,4),true,'two of four players must not enable start');
 room.members.push({subject:'friend3'},{subject:'friend4'});
 assert.equal(startDisabled(room,4),false,'host can start with all four');
 assert.equal(startDisabled({...room,host:false},4),true,'guest cannot start');
 assert.equal(startDisabled({...room,status:'playing'},4),true,'playing table cannot start again');
 assert.equal(startDisabled(null,4),true);
});
test('newly created multiplayer room preserves the exact code for reload',()=>{
 assert.match(party,/code=r\.room\.code;if\(!practice&&new URLSearchParams\(location\.search\)\.get\('code'\)!==code\)history\.replaceState\(null,''/);
 assert.match(party,/encodeURIComponent\(kind\)\+'\&code='\+encodeURIComponent\(code\)/);
});
function route(search,telegramStart='',store=new Map(),authDate='123'){
 assert.match(home,/src="assets\/js\/simab-launch-routing-v22\.js\?v=20261102"/);
 let destination=null;
 const context={window:{Telegram:{WebApp:{initData:'auth_date='+authDate,initDataUnsafe:{start_param:telegramStart}}}},
   location:{search,replace:path=>{destination=path;}},URLSearchParams,
   sessionStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)}};
 vm.runInNewContext(launchScript,context);
 return destination;
}
test('Telegram invitation routes directly to the selected room from signed or URL start params',()=>{
 const code='ABCDEFGHJK',dest='games/room/index.html?game=hokm&code='+code;
 assert.equal(route('?startapp=g_hokm_'+code),dest);
 assert.equal(route('?start=g_hokm_'+code),dest);
 assert.equal(route('?tgWebAppStartParam=g_hokm_'+code),dest);
 assert.equal(route('', 'g_hokm_'+code),dest);
 assert.equal(route('?home=1&startapp=g_hokm_'+code),null,'explicit Home must never replay old invite');
 assert.equal(route('?startapp=g_hokm_BAD'),null,'malformed room code must not redirect');
});

test('same Telegram launch is not replayed after returning from a game, unless a new explicit invitation arrives',()=>{
 const session=new Map(),first='g_hokm_ABCDEFGHJK',other='g_ludo_ABCDEFGHJK';
 assert.equal(route('',first,session),'games/room/index.html?game=hokm&code=ABCDEFGHJK');
 assert.equal(route('',first,session),null,'back navigation must not reopen stale room');
 assert.equal(route('?home=1',first,session),null,'explicit home must override Telegram init data');
 assert.equal(route('',first,session),null,'home must remain stable');
 assert.equal(route('?startapp='+other,first,session),'games/room/index.html?game=ludo&code=ABCDEFGHJK','fresh explicit invite must work');
 assert.equal(route('',first,session,'124'),'games/room/index.html?game=hokm&code=ABCDEFGHJK','new Telegram launch may route');
});
test('Telegram poker and offer deep links cannot leave the allowlisted destinations',()=>{
 assert.equal(route('?startapp=p_ABCDEFGHJK'),'games/poker/friends.html?code=ABCDEFGHJK');
 assert.equal(route('?start=o_0123456789abcdef0123456789abcdef'),'offers/index.html?code=0123456789abcdef0123456789abcdef');
 assert.equal(route('?startapp=javascript%3Aalert(1)'),null);
 assert.equal(route('?startapp=g_fake_ABCDEFGHJK'),null);
});
