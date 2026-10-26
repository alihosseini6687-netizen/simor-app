import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {harness} from './support/server-harness.mjs';
const c=(r,s=0)=>r-2+s*13;
test('new games use isolated sessions, private cards, atomic debits, exactly-once wins and recovery',async()=>{
 const h=await harness();try{
 await h.post({action:'wallet',walletAction:'exchange_to_chips',amount:5000,requestId:randomUUID()});
 for(const game of ['hokm','blackjack','ludo']){
 const request={action:'game',game,op:'start',amount:20,requestId:randomUUID()};const a=await h.post(request);assert.equal(a.status,200,JSON.stringify(a));let r=a.body;assert.equal(r.state.deck,undefined);assert.equal(r.state.hands?.[1]?.cards?.length===2&&game==='hokm',false);
 const repeat=await h.post(request);assert.equal(repeat.body.duplicate,true);assert.equal(repeat.body.wallet.chips,r.wallet.chips);
 if(r.state.finished)continue;
 const other=await h.post({action:'game_state',game,sessionId:r.sessionId},999000033);assert.equal(other.body.state,null);
 const invalid=await h.post({action:'game',game,op:'move',move:{type:'cheat',winner:0,payout:99999},sessionId:r.sessionId,version:r.version,requestId:randomUUID()});assert.equal(invalid.status,409);
 const leave={action:'game',game,op:'leave',sessionId:r.sessionId,version:r.version,requestId:randomUUID()};const left=await h.post(leave);assert.equal(left.status,200);assert.equal(left.body.wallet.chips,r.wallet.chips);const again=await h.post(leave);assert.equal(again.body.wallet.chips,left.body.wallet.chips);
 }
 // Seed controlled cards only in the test database: a double win returns 80 after an extra 20 debit.
 let a=await h.post({action:'game',game:'blackjack',op:'start',amount:20,requestId:randomUUID()});while(a.body.state.finished)a=await h.post({action:'game',game:'blackjack',op:'start',amount:20,requestId:randomUUID()});
 const controlled={kind:'blackjack',deck:[c(10)],dealer:[c(10),c(8)],hands:[{cards:[c(5),c(6)],bet:20,done:false,split:false}],current:0,stake:20,finished:false,payout:0,result:''};await h.db.query('update simab_game_sessions set state=$1 where id=$2',[controlled,a.body.sessionId]);
 const double={action:'game',game:'blackjack',op:'move',move:{type:'double'},sessionId:a.body.sessionId,version:a.body.version,requestId:randomUUID()};const win=await h.post(double);assert.equal(win.status,200,JSON.stringify(win));assert.equal(win.body.state.payout,80);assert.equal(win.body.wallet.chips,a.body.wallet.chips+60);assert.equal((await h.post(double)).body.wallet.chips,win.body.wallet.chips);
 // Insufficient extra stake rolls back both split and session version.
 let b=await h.post({action:'game',game:'blackjack',op:'start',amount:20,requestId:randomUUID()});while(b.body.state.finished)b=await h.post({action:'game',game:'blackjack',op:'start',amount:20,requestId:randomUUID()});const pair={...controlled,deck:[c(10),c(9)],hands:[{cards:[c(8),c(8,1)],bet:20,done:false,split:false}]};await h.db.query('update simab_game_sessions set state=$1 where id=$2',[pair,b.body.sessionId]);await h.db.exec("update simab_secure_wallets set chips=0 where telegram_subject='801000011'");
 const rejected=await h.post({action:'game',game:'blackjack',op:'move',move:{type:'split'},sessionId:b.body.sessionId,version:b.body.version,requestId:randomUUID()});assert.equal(rejected.body.error,'insufficient_chips');const saved=await h.db.query('select version,state from simab_game_sessions where id=$1',[b.body.sessionId]);assert.equal(saved.rows[0].version,b.body.version);assert.equal(saved.rows[0].state.hands.length,1);
 }finally{await h.db.close();}
});
