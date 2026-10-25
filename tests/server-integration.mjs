import {harness} from './support/server-harness.mjs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const h=await harness();
try{
 const bad=await h.post({action:'game',game:'poker',op:'start',amount:100,seats:6,requestId:randomUUID(),initData:'invalid'});assert.equal(bad.status,401);
 let r=await h.post({action:'wallet',walletAction:'exchange_to_chips',amount:1000,requestId:randomUUID()});assert.equal(r.body.coins,999000);assert.equal(r.body.chips,1000);
 const request={action:'game',game:'poker',op:'start',amount:100,seats:6,requestId:randomUUID()};let p=await h.post(request);assert.equal(p.status,200);assert.equal(p.body.wallet.chips,900);assert.equal(p.body.state.deck,undefined);
 let repeat=await h.post(request);assert.equal(repeat.body.duplicate,true);assert.equal(repeat.body.wallet.chips,900);
 let last=p.body;let turns=0;while(!last.state.finished){const move={type:last.state.toCall?'call':'check'};const rr=await h.post({action:'game',game:'poker',op:'move',sessionId:last.sessionId,version:last.version,move,requestId:randomUUID()});assert.equal(rr.status,200,JSON.stringify(rr));last=rr.body;if(++turns>100)throw Error('stuck');}
 assert.equal(last.wallet.chips,900+last.state.players[0].stack);console.log('Poker HTTP and transactional wallet passed',turns,'turns');
 r=await h.post({action:'game',game:'backgammon',op:'start',amount:20,requestId:randomUUID()});assert.equal(r.status,200);const bg=r.body;
 r=await h.post({action:'game',game:'backgammon',op:'move',sessionId:bg.sessionId,version:bg.version,move:{from:99,die:99},requestId:randomUUID()});assert.equal(r.status,409);
 r=await h.post({action:'game',game:'backgammon',op:'leave',sessionId:bg.sessionId,version:bg.version,requestId:randomUUID()});assert.equal(r.status,200);assert.equal(r.body.wallet.chips,last.wallet.chips-20);
 console.log('Backgammon rejects impossible move and settles leave exactly once');
 const spin={action:'game',game:'slot',op:'start',amount:5,multiplier:1,requestId:randomUUID()};r=await h.post(spin);assert.equal(r.status,200);repeat=await h.post(spin);assert.equal(repeat.body.duplicate,true);assert.equal(repeat.body.wallet.chips,r.body.wallet.chips);assert.deepEqual(repeat.body.state.reels,r.body.state.reels);
 console.log('Slot request retry preserves reels and balance');
 console.log('All HTTP/database integration checks passed');
}finally{await h.db.close();}
