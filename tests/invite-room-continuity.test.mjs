import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const party=readFileSync(new URL('../assets/js/simab-party-v16.js',import.meta.url),'utf8');
const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');

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
function route(search,telegramStart=''){
 const m=home.match(/<script>try\{const start=.*?<\/script>/s);
 assert.ok(m,'Telegram invitation router is present');
 let destination=null;
 const context={window:{Telegram:{WebApp:{initDataUnsafe:{start_param:telegramStart}}}},
   location:{search,replace:path=>{destination=path;}},URLSearchParams};
 vm.runInNewContext(m[0].replace(/^<script>/,'').replace(/<\/script>$/,''),context);
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
