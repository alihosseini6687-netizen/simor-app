import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {harness} from './support/server-harness.mjs';
const ids=[801000011,801000012,801000013];
test('friends poker isolates cards, protects seats, shares real turns and settles virtual chips exactly once',async()=>{
 const h=await harness();const post=(id,p)=>h.post({action:'room',requestId:randomUUID(),...p},id);
 try{
 for(const id of ids){if(id!==ids[0])await h.client.rpc('simab_admin_credit',{p_admin:'702007470',p_target:String(id),p_amount:10000,p_request_id:randomUUID()});await h.post({action:'wallet',walletAction:'exchange_to_chips',amount:1000,requestId:randomUUID()},id);}
 let a=await post(ids[0],{op:'create',amount:100,maxPlayers:6,name:'علی',emoji:'🦁'});assert.equal(a.status,200,JSON.stringify(a));const code=a.body.room.code;assert.equal(a.body.wallet.chips,900);
 assert.equal((await post(ids[2],{op:'state',code})).body.error,'room_forbidden');
 let b=await post(ids[1],{op:'join',code,name:'دوست',emoji:'😎'});assert.equal(b.status,200,JSON.stringify(b));assert.equal(b.body.wallet.chips,900);
 const second=await post(ids[1],{op:'create',amount:100,maxPlayers:2});assert.equal(second.body.error,'active_room_exists');assert.equal((await h.post({action:'wallet',walletAction:'state'},ids[1])).body.chips,900);
 a=await post(ids[0],{op:'state',code});let r=await post(ids[1],{op:'start',code,version:a.body.version});assert.equal(r.status,409);
 r=await post(ids[0],{op:'start',code,version:a.body.version});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.state.deck,undefined);assert.equal(r.body.state.players[0].cards.length,2);assert.equal(r.body.state.players[1].cards.length,0);
 b=await post(ids[1],{op:'state',code});assert.deepEqual(b.body.state.players[0].cards.length,2);assert.equal(b.body.state.players[1].cards.length,0);assert.notDeepEqual(b.body.state.players[0].cards,r.body.state.players[0].cards);
 const illegal=await post(ids[2],{op:'move',code,version:r.body.version,move:{type:'allin'}});assert.equal(illegal.body.error,'room_forbidden');
 const current=r.body.state.current;const actor=ids[current];const req={op:'move',code,version:r.body.version,move:{type:'fold'},requestId:randomUUID()};const finish=await post(actor,req);assert.equal(finish.status,200,JSON.stringify(finish));assert.ok(finish.body.state.finished);
 const again=await post(actor,req);assert.equal(again.status,200);assert.equal(again.body.wallet.chips,finish.body.wallet.chips);assert.equal(again.body.duplicate,true);
 const wallets=await Promise.all(ids.slice(0,2).map(id=>h.post({action:'wallet',walletAction:'state'},id)));assert.equal(wallets.reduce((sum,x)=>sum+x.body.chips,0),2000);
 const sig=await post(ids[2],{op:'signal',code,to:String(ids[0]),signal:{type:'offer',description:{sdp:'x'}}});assert.equal(sig.status,409);
 // Waiting-room cancellation refunds all entrants, including a lost-response retry.
 a=await post(ids[0],{op:'create',amount:50,maxPlayers:4,name:'علی'});const next=a.body.room.code;b=await post(ids[1],{op:'join',code:next});a=await post(ids[0],{op:'state',code:next});const cancel={op:'leave',code:next,version:a.body.version,requestId:randomUUID()};const cancelled=await post(ids[0],cancel);assert.equal(cancelled.status,200,JSON.stringify(cancelled));assert.equal(cancelled.body.room.status,'cancelled');assert.equal((await post(ids[0],cancel)).body.wallet.chips,cancelled.body.wallet.chips);
 // A guest's waiting-room leave can be retried without leaking room state or charging twice.
 a=await post(ids[0],{op:'create',amount:50,maxPlayers:4});b=await post(ids[1],{op:'join',code:a.body.room.code});const leave={op:'leave',code:a.body.room.code,version:b.body.version,requestId:randomUUID()};const left=await post(ids[1],leave);assert.equal(left.status,200);assert.equal((await post(ids[1],leave)).body.wallet.chips,left.body.wallet.chips);
 // Signaling is private to participants and supports a cursor.
 b=await post(ids[1],{op:'join',code:a.body.room.code});const sent=await post(ids[0],{op:'signal',code:a.body.room.code,to:String(ids[1]),signal:{type:'ready'}});assert.equal(sent.status,200);const received=await post(ids[1],{op:'state',code:a.body.room.code,after:0});assert.equal(received.body.room.signals.length,1);assert.equal((await post(ids[0],{op:'state',code:a.body.room.code})).body.room.signals.length,0);
 // Expiry is enforced by the server and settles abandoned heads-up tables.
 a=await post(ids[0],{op:'state',code:a.body.room.code});r=await post(ids[0],{op:'start',code:a.body.room.code,version:a.body.version});await h.db.query("update simab_poker_rooms set state=jsonb_set(state,'{poker,turnDeadline}',$1) where code=$2",[JSON.stringify(Date.now()-100000),a.body.room.code]);const timed=await post(ids[1],{op:'state',code:a.body.room.code});assert.equal(timed.status,200,JSON.stringify(timed));assert.ok(timed.body.state.finished);
 }finally{await h.db.close();}
});
