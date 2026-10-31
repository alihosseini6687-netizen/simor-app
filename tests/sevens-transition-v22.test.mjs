import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {startParty,stepParty,publicParty} from '../supabase/functions/simab-central-quests/party-games.ts';
import {partyAPI} from '../supabase/functions/simab-central-quests/party-api.ts';
import {harness} from './support/server-harness.mjs';

function fixture(version,hand=[0,1,2,3]){
 const s={kind:'sevens',n:2,current:0,finished:false,winners:[],result:'',event:1,lastEvent:'card',deadline:Date.now()+60000,log:[],hands:[[...hand],[13,14]],deck:[40,41],discard:[4],suit:0,direction:1,penalty:0,twoTarget:true,twoGift:true};
 if(version!==undefined)s.sevensRulesVersion=version;return s;
}
test('unversioned existing rooms and explicit v1 retain the single gift contract',()=>{
 for(const version of [undefined,1]){const s=fixture(version),stock=[...s.deck];stepParty(s,0,{type:'play',card:0,target:1,gift:1});assert.deepEqual(s.hands,[[2,3],[13,14,1]]);assert.deepEqual(s.deck,stock);assert.equal(s.sevensRulesVersion,version);assert.equal(s.event,2);assert.equal(s.current,1);}
});
test('legacy target-draw and no-target room variants are not silently converted',()=>{
 const draw=fixture();draw.twoGift=false;stepParty(draw,0,{type:'play',card:0,target:1});assert.deepEqual(draw.hands,[[1,2,3],[13,14,41]]);assert.deepEqual(draw.deck,[40]);
 const plain=fixture();plain.twoTarget=false;const stock=[...plain.deck];stepParty(plain,0,{type:'play',card:0,target:999});assert.deepEqual(plain.hands,[[1,2,3],[13,14]]);assert.deepEqual(plain.deck,stock);
});
test('v2 transfers exactly two selected cards; no stock substitutions or version changes',()=>{
 const s=fixture(2);s.twoGift=false;s.twoTarget=false;const stock=[...s.deck];stepParty(s,0,{type:'play',card:0,target:1,gifts:[1,2],sevensRulesVersion:1});assert.deepEqual(s.hands,[[3],[13,14,1,2]]);assert.deepEqual(s.deck,stock);assert.equal(s.sevensRulesVersion,2);
});
test('both contracts handle zero/one remaining card and final settlement state',()=>{
 for(const version of [undefined,1,2])for(const hand of [[0],[0,1]]){const s=fixture(version,hand);const move={type:'play',card:0,target:1,...(version===2?{gifts:hand.slice(1)}:{gift:hand[1]??null})};stepParty(s,0,move);assert.equal(s.finished,true);assert.deepEqual(s.winners,[0]);assert.deepEqual(s.hands,[[],[13,14,...hand.slice(1)]]);assert.deepEqual(s.deck,[40,41]);}
});
test('invalid and ambiguous cards/targets/contracts reject atomically before event or hand mutation',()=>{
 for(const version of [undefined,1,2])for(const extra of [
  {card:99},{card:1.5},{target:0},{target:2},{target:'1'},
  ...(version===2?[{gifts:[1]},{gifts:[1,1]},{gifts:[0,1]},{gifts:[1,99]},{gifts:[1,'2']},{gift:1,gifts:[1,2]}]:[{gift:0},{gift:99},{gift:'1'},{gift:1,gifts:[1]}])
 ]){const s=fixture(version),before=structuredClone(s);assert.throws(()=>stepParty(s,0,{type:'play',card:0,target:1,...(version===2?{gifts:[1,2]}:{gift:1}),...extra}));assert.deepEqual(s,before);}
 const unknown=fixture(3),before=structuredClone(unknown);assert.throws(()=>stepParty(unknown,0,{type:'draw'}),/sevens_upgrade_required/);assert.deepEqual(unknown,before);
});
test('private views identify contract without rewriting stored rooms or exposing other hands',()=>{
 for(const version of [undefined,1,2]){const s=fixture(version),before=structuredClone(s),p=publicParty(s,0);assert.equal(p.sevensRulesVersion,version??1);assert.equal(p.hands,undefined);assert.equal(p.deck,undefined);assert.deepEqual(p.hand,s.hands[0]);assert.deepEqual(s,before);}
});
test('new-game factory opts into v2; explicit legacy options keep all v14 variants',()=>{
 assert.equal(startParty('sevens',2,0).sevensRulesVersion,2);
 for(const options of [{twoGift:true,twoTarget:true},{twoGift:false,twoTarget:true},{twoGift:true,twoTarget:false}]){
  const s=startParty('sevens',2,0,{...options,sevensRulesVersion:1});assert.equal(s.sevensRulesVersion,1);assert.equal(s.twoGift,options.twoGift);assert.equal(s.twoTarget,options.twoTarget);
 }
});
test('capability discovery is side-effect free and does not call any wallet/database method',async()=>{
 const r=await partyAPI({},'801000011',{op:'capabilities'});assert.equal(r.status,200);assert.deepEqual(r.data.capabilities.sevensRulesVersions,[1,2]);
});
test('the Edge entrypoint still authenticates capabilities and discovery writes no wallet events',async()=>{
 const h=await harness();try{
  const events=async()=>(await h.db.query('select count(*)::int as n from simab_secure_wallet_events')).rows[0].n;
  const before=await events();assert.equal((await h.post({action:'game_room',op:'capabilities',initData:''})).status,401);
  const r=await h.post({action:'game_room',op:'capabilities'});assert.equal(r.status,200);assert.deepEqual(r.body.capabilities.sevensRulesVersions,[1,2]);assert.equal(await events(),before);
 }finally{await h.db.close();}
});

async function rooms(){
 const h=await harness(),ids=['801000011','801000012'];
 for(const id of ids){await h.client.rpc('simab_admin_credit',{p_admin:'702007470',p_target:id,p_amount:1000,p_request_id:randomUUID()});await h.client.rpc('simab_secure_wallet_action',{p_subject:id,p_action:'exchange_to_chips',p_amount:100,p_request_id:randomUUID()});}
 const api=(i,p)=>h.post({action:'game_room',...p},Number(ids[i]));
 const balances=async()=> (await h.db.query('select telegram_subject,chips from simab_secure_wallets order by telegram_subject')).rows;
 const row=async code=>(await h.db.query('select version,status,state from simab_poker_rooms where code=$1',[code])).rows[0];
 return{...h,ids,api,balances,row};
}
test('old waiting room resumes unchanged with mixed old/new clients, old receipts and one-card play',async()=>{
 const h=await rooms();try{
  const create={op:'create',game:'sevens',amount:20,maxPlayers:2,consent:true,options:{twoGift:true,twoTarget:true},requestId:randomUUID()};
  let r=await h.api(0,create);assert.equal(r.status,200);const code=r.body.room.code;
  assert.equal(r.body.room.sevensRules.sevensRulesVersion,1);assert.equal((await h.api(0,create)).body.wallet.chips,80);
  // Simulate the existing v14 waiting state: no marker in persisted options.
  await h.db.query("update simab_poker_rooms set state=state #- '{options,sevensRulesVersion}' where code=$1",[code]);
  r=await h.api(1,{op:'join',code,amount:20,consent:true,sevensProtocol:2,requestId:randomUUID()});assert.equal(r.status,200);
  r=await h.api(0,{op:'start',code,version:r.body.version,requestId:randomUUID()});assert.equal(r.status,200);assert.equal(r.body.state.sevensRulesVersion,1);
  const saved=await h.row(code);saved.state.game=fixture();await h.db.query('update simab_poker_rooms set state=$1 where code=$2',[JSON.stringify(saved.state),code]);
  const move={op:'move',code,version:saved.version,move:{type:'play',card:0,target:1,gift:1},requestId:randomUUID()};
  r=await h.api(0,move);assert.equal(r.status,200);assert.deepEqual(r.body.state.hand,[2,3]);assert.equal(r.body.state.sevensRulesVersion,1);
  const replay=await h.api(0,move);assert.equal(replay.status,200);assert.equal(replay.body.version,r.body.version);
  assert.deepEqual((await h.row(code)).state.game.hands,[[2,3],[13,14,1]]);assert.equal((await h.balances()).reduce((n,w)=>n+Number(w.chips),0),160);
 }finally{await h.db.close();}
});
test('v2 admission, ownership, optimistic locking, immutable rules, recovery and settlement stay authoritative',async()=>{
 const h=await rooms();try{
  const before=await h.balances(),create={op:'create',game:'sevens',amount:20,maxPlayers:2,consent:true,options:{sevensRulesVersion:2,twoGift:false,twoTarget:false},requestId:randomUUID()};
  assert.equal((await h.api(0,create)).body.error,'sevens_upgrade_required');assert.deepEqual(await h.balances(),before);
  let r=await h.api(0,{...create,sevensProtocol:2});assert.equal(r.status,200);const code=r.body.room.code;assert.equal(r.body.room.sevensRules.sevensRulesVersion,2);
  const waiting=await h.row(code),join={op:'join',code,amount:20,consent:true,requestId:randomUUID()};
  assert.equal((await h.api(1,join)).body.error,'sevens_upgrade_required');assert.deepEqual(await h.row(code),waiting);
  assert.equal((await h.api(1,{op:'preview',code})).body.preview.sevensRules.sevensRulesVersion,2);
  r=await h.api(1,{...join,sevensProtocol:2});assert.equal(r.status,200);
  assert.equal((await h.api(0,{op:'start',code,version:r.body.version,requestId:randomUUID()})).body.error,'sevens_upgrade_required');
  r=await h.api(0,{op:'start',code,version:r.body.version,sevensProtocol:2,requestId:randomUUID()});assert.equal(r.status,200);
  const saved=await h.row(code);saved.state.game=fixture(2);await h.db.query('update simab_poker_rooms set state=$1 where code=$2',[JSON.stringify(saved.state),code]);
  const stable=await h.row(code),balance=await h.balances();
  const play={op:'move',code,version:stable.version,sevensProtocol:2,move:{type:'play',card:0,target:1,gifts:[1,2]},requestId:randomUUID()};
  assert.equal((await h.api(1,play)).body.error,'invalid_turn');assert.deepEqual(await h.row(code),stable);
  assert.equal((await h.api(0,{...play,move:{type:'play',card:0,target:1,gift:1}})).body.error,'invalid_gift');assert.deepEqual(await h.row(code),stable);assert.deepEqual(await h.balances(),balance);
  assert.equal((await h.api(0,{...play,options:{sevensRulesVersion:1},move:{type:'play',card:0,target:1,gift:1}})).body.error,'invalid_gift');assert.deepEqual(await h.row(code),stable);assert.deepEqual(await h.balances(),balance);
  r=await h.api(0,play);assert.equal(r.status,200);assert.deepEqual(r.body.state.hand,[3]);assert.equal(r.body.state.hands,undefined);
  assert.equal((await h.api(0,play)).body.version,r.body.version);
  assert.equal((await h.api(0,{...play,move:{...play.move,gifts:[2,1]}})).body.error,'request_conflict');
  assert.equal((await h.api(0,{...play,requestId:randomUUID()})).body.error,'stale_game');
  const state=await h.row(code);assert.equal(state.state.game.sevensRulesVersion,2);assert.deepEqual(state.state.game.hands,[[3],[13,14,1,2]]);
  // Leave is always available, even from an old client; authoritative payout once.
  const leave={op:'leave',code,version:r.body.version,requestId:randomUUID()};r=await h.api(0,leave);assert.equal(r.status,200);assert.equal(r.body.room.status,'finished');assert.equal((await h.api(0,leave)).status,200);assert.equal((await h.balances()).reduce((n,w)=>n+Number(w.chips),0),200);
 }finally{await h.db.close();}
});
