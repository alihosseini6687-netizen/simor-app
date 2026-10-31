import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readSource} from './support/source.mjs';
import {uiHarness} from './support/ui-harness.mjs';
const source=readSource(new URL('../assets/js/simab-launch-routing-v22.js',import.meta.url));
function launch(search='',start='',store=new Map()){
 const paths=[],context={window:{Telegram:{WebApp:{initDataUnsafe:{start_param:start},initData:'auth_date=123'}}},location:{search,replace:p=>paths.push(p)},URLSearchParams,sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}};
 vm.runInNewContext(source,context);return{paths,context,store};
}
test('all three explicit launch aliases route only to allowlisted game screens',()=>{
 for(const alias of ['start','startapp','tgWebAppStartParam'])assert.deepEqual(launch('?'+alias+'=p_ABCDEFGH23').paths,['games/poker/friends.html?code=ABCDEFGH23']);
 assert.deepEqual(launch('?startapp=g_hokm_ABCDEFGH23').paths,['games/room/index.html?game=hokm&code=ABCDEFGH23']);
 for(const value of ['g_fake_ABCDEFGH23','p_../../admin','javascript:alert(1)','ref_123'])assert.equal(launch('?startapp='+encodeURIComponent(value)).paths.length,0);
});
test('home opt-out, revisits and duplicate script execution do not unexpectedly redirect',()=>{
 const start='p_ABCDEFGH23',store=new Map();const first=launch('',start,store);assert.equal(first.paths.length,1);
 vm.runInNewContext(source,first.context);assert.equal(first.paths.length,1);assert.equal(launch('',start,store).paths.length,0);
 const fresh=new Map();assert.equal(launch('?home=1',start,fresh).paths.length,0);assert.equal(launch('',start,fresh).paths.length,0);
 assert.equal(launch('?startapp='+start,start,fresh).paths.length,1);
});
test('wrong-game invitations offer the correct explicit link without changing selected game',async()=>{
 for(const target of ['ludo',null]){
  const h=uiHarness('assets/js/simab-party-v16.js','load,createJoin',{game:'hokm',globals:{location:{search:'?game=hokm&code=ABCDEFGH23'}}});
  h.wallet.read=async(action,p)=>{if(p.op==='state'||action==='game_room'&&!target){const e=Error('wrong');e.code='wrong_room_type';throw e;}return{preview:{code:'ABCDEFGH23',game:target,status:'waiting',count:1,maxPlayers:2,buyIn:20}};};
  await h.api.load();const link=h.$('existing-room').children.find(n=>n.tagName==='A');assert.equal(link.href,target?'?game=ludo&code=ABCDEFGH23':'../poker/friends.html?code=ABCDEFGH23');
 }
});
test('shared full invites do not submit; missing invites leave settings usable',async()=>{
 const h=uiHarness('assets/js/simab-party-v16.js','load,createJoin',{game:'hokm',globals:{location:{search:'?game=hokm&code=ABCDEFGH23'}}});let writes=0;h.wallet.mutate=async()=>{writes++;};h.wallet.read=async()=>({preview:{game:'hokm',status:'waiting',count:4,maxPlayers:4,buyIn:20}});h.$('join-code').value='ABCDEFGH23';await h.api.createJoin('join');assert.equal(writes,0);assert.match(h.$('status').textContent,/میز پر/);
 h.wallet.read=async()=>{const e=Error('missing');e.code='room_not_found';throw e;};await h.api.load();assert.match(h.$('status').textContent,/دعوت پیدا نشد/);assert.equal(h.$('create').disabled,false);
});
