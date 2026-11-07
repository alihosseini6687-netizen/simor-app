import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {harness} from './support/server-harness.mjs';

test('old Hokm and Ludo sessions receive one fresh server turn, no debit, no duplicate settlement',async()=>{
 const h=await harness();
 try{
  const exchange=await h.post({action:'wallet',walletAction:'exchange_to_chips',amount:200,requestId:randomUUID()});
  assert.equal(exchange.status,200,JSON.stringify(exchange));
  for(const game of ['hokm','ludo']){
   const first=await h.post({action:'game',game,op:'start',amount:10,requestId:randomUUID()});
   assert.equal(first.status,200,JSON.stringify(first));
   const {sessionId}=first.body;
   await h.db.query("UPDATE simab_game_sessions SET state=state-'turnDeadline' WHERE id=$1",[sessionId]);
   const before=await h.db.query("SELECT count(*)::int AS n FROM simab_secure_wallet_events WHERE telegram_subject='801000011'");
   const resumed=await h.post({action:'game_state',game,sessionId});
   assert.equal(resumed.status,200,JSON.stringify(resumed));
   assert.equal(resumed.body.legacyDeadlineRestored,true);
   assert.equal(resumed.body.version,first.body.version+1);
   const deadline=resumed.body.state.turnDeadline;
   assert.ok(deadline>=Date.now()+15000 && deadline<=Date.now()+22000,'deadline restored only after signed owner resumed');
   assert.equal(resumed.body.wallet.chips,first.body.wallet.chips,'a restored timer never changes chips');
   const after=await h.db.query("SELECT count(*)::int AS n FROM simab_secure_wallet_events WHERE telegram_subject='801000011'");
   assert.equal(after.rows[0].n,before.rows[0].n,'no fake award or double debit recorded');
   const again=await h.post({action:'game_state',game,sessionId});
   assert.equal(again.status,200,JSON.stringify(again));
   assert.equal(again.body.version,resumed.body.version);
   assert.equal(again.body.state.turnDeadline,deadline);
   const outsider=await h.post({action:'game_state',game,sessionId},801000099);
   assert.equal(outsider.body.state,null);
  }
 }finally{await h.db.close();}
});
