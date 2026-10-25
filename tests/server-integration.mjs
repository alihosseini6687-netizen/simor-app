import {harness} from './support/server-harness.mjs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const h=await harness();
try{
 const bad=await h.post({action:'game',game:'poker',op:'start',amount:100,seats:6,requestId:randomUUID(),initData:'invalid'});assert.equal(bad.status,401);
 let r=await h.post({action:'wallet',walletAction:'exchange_to_chips',amount:1000,requestId:randomUUID()});assert.equal(r.body.coins,999000);assert.equal(r.body.chips,1000);
 const request={action:'game',game:'poker',op:'start',amount:100,seats:6,requestId:randomUUID()};let p=await h.post(request);assert.equal(p.status,200);assert.equal(p.body.wallet.chips,900);assert.equal(p.body.state.deck,undefined);
 assert.ok(p.body.state.timeline.length>0);for(const f of p.body.state.timeline){assert.equal(f.deck,undefined);if(!f.finished)for(const bot of f.players.slice(1))assert.equal(bot.cards.length,0);}
 let repeat=await h.post(request);assert.equal(repeat.body.duplicate,true);assert.equal(repeat.body.wallet.chips,900);assert.deepEqual(repeat.body.state.timeline,p.body.state.timeline);const saved=await h.db.query('select state from simab_game_sessions where id=$1',[p.body.sessionId]);assert.equal(saved.rows[0].state.timeline,undefined);
 let last=p.body;let turns=0;while(!last.state.finished){const move={type:last.state.toCall?'call':'check'};const rr=await h.post({action:'game',game:'poker',op:'move',sessionId:last.sessionId,version:last.version,move,requestId:randomUUID()});assert.equal(rr.status,200,JSON.stringify(rr));last=rr.body;if(++turns>100)throw Error('stuck');}
 assert.equal(last.wallet.chips,900+last.state.players[0].stack);console.log('Poker HTTP and transactional wallet passed',turns,'turns');
 r=await h.post({action:'game',game:'backgammon',op:'start',amount:20,requestId:randomUUID()});assert.equal(r.status,200);const bg=r.body;
 r=await h.post({action:'game',game:'backgammon',op:'move',sessionId:bg.sessionId,version:bg.version,move:{from:99,die:99},requestId:randomUUID()});assert.equal(r.status,409);
 r=await h.post({action:'game',game:'backgammon',op:'leave',sessionId:bg.sessionId,version:bg.version,requestId:randomUUID()});assert.equal(r.status,200);assert.equal(r.body.wallet.chips,last.wallet.chips-20);
 console.log('Backgammon rejects impossible move and settles leave exactly once');
 const spin={action:'game',game:'slot',op:'start',amount:5,multiplier:1,requestId:randomUUID()};r=await h.post(spin);assert.equal(r.status,200);repeat=await h.post(spin);assert.equal(repeat.body.duplicate,true);assert.equal(repeat.body.wallet.chips,r.body.wallet.chips);assert.deepEqual(repeat.body.state.reels,r.body.state.reels);
 console.log('Slot request retry preserves reels and balance');

 // New games use the exact same signed API and atomic session/wallet transaction.
 for(const game of ['hokm','ludo']){
  const initial=await h.post({action:'wallet',walletAction:'state'});const amount=20;
  const req={action:'game',game,op:'start',amount,requestId:randomUUID()};let r=await h.post(req);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.wallet.chips,initial.body.chips-amount);const id=r.body.sessionId;
  const dup=await h.post(req);assert.equal(dup.body.duplicate,true);assert.equal(dup.body.wallet.chips,r.body.wallet.chips);
  const foreign=await h.post({action:'game_state',game,sessionId:id},801000012);assert.equal(foreign.body.state,null);
  let last=r.body,guard=0;while(!last.state.finished){const s=last.state;let move;
   if(game==='hokm'){assert.equal(s.hands,undefined);assert.equal(s.deck,undefined);move=s.phase==='trump'?{type:'trump',suit:0}:s.phase==='round_end'?{type:'next'}:{type:'card',card:s.legal[0]};}
   else move=s.die?{type:'token',token:s.legal[0]}:{type:'roll'};
   const request={action:'game',game,op:'move',sessionId:id,version:last.version,move,requestId:randomUUID()};r=await h.post(request);assert.equal(r.status,200,JSON.stringify(r));last=r.body;
   if(++guard>3000)throw Error(game+' stuck');
  }
  assert.equal(last.wallet.chips,initial.body.chips-amount+(last.state.winner===0?amount*(game==='hokm'?2:4):0));
  console.log(game,'full match and shared wallet settlement passed',guard,'moves');
 }
 let opening;do{opening=await h.post({action:'game',game:'blackjack',op:'start',amount:20,requestId:randomUUID()});assert.equal(opening.status,200);}while(opening.body.state.finished);
 const id=opening.body.sessionId;
 // Local test fixture only: deterministic pair to exercise an additional atomic split wager.
 await h.db.query("UPDATE simab_game_sessions SET state=jsonb_set(jsonb_set(state,'{hands,0,cards}','[6,19]'::jsonb),'{dealer}','[7,20]'::jsonb) WHERE id=$1",[id]);
 const split={action:'game',game:'blackjack',op:'move',sessionId:id,version:opening.body.version,move:{type:'split'},requestId:randomUUID()};await h.db.query("UPDATE simab_secure_wallets SET chips=0 WHERE telegram_subject='801000011'");
 const denied=await h.post({...split,requestId:randomUUID()});assert.equal(denied.status,409);assert.equal(denied.body.error,'insufficient_chips');
 const preserved=await h.db.query('SELECT version,state FROM simab_game_sessions WHERE id=$1',[id]);assert.equal(preserved.rows[0].version,opening.body.version);assert.equal(preserved.rows[0].state.hands.length,1);
 await h.db.query("UPDATE simab_secure_wallets SET chips=$1 WHERE telegram_subject='801000011'",[opening.body.wallet.chips]);
 r=await h.post(split);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.wallet.chips,opening.body.wallet.chips-20);let bj=r.body;
 repeat=await h.post(split);assert.equal(repeat.body.wallet.chips,bj.wallet.chips);assert.equal(repeat.body.duplicate,true);
 let guard=0;while(!bj.state.finished){r=await h.post({action:'game',game:'blackjack',op:'move',sessionId:id,version:bj.version,move:{type:'stand'},requestId:randomUUID()});assert.equal(r.status,200);bj=r.body;if(++guard>4)throw Error('split stuck');}
 assert.equal(bj.wallet.chips,opening.body.wallet.chips-20+bj.state.payout);
 console.log('Blackjack split takes additional stake exactly once; final hands settle once');
 console.log('All HTTP/database integration checks passed');
}finally{await h.db.close();}
