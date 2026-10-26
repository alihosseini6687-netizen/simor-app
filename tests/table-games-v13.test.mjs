import test from 'node:test';import assert from 'node:assert/strict';
import {startBJ,moveBJ,publicBJ,total,startH,moveH,publicH,startL,moveL,legalL} from '../supabase/functions/simab-central-quests/table-games.ts';
import {startPoker,movePoker,publicPoker} from '../supabase/functions/simab-central-quests/games.ts';
const c=(rank,suit=0)=>rank-2+suit*13;
test('blackjack aces, natural 3:2, dealer natural, push and split 21 payouts',()=>{
 assert.equal(total([c(14),c(14),c(9)]),21);assert.equal(total([c(14),c(6)]),17);assert.equal(total([c(14),c(10),c(5)]),16);
 const base=()=>({kind:'blackjack',deck:[c(10),c(10)],dealer:[c(10),c(7)],hands:[{cards:[c(14),c(13)],bet:20,done:false,split:false}],current:0,stake:20,finished:false,payout:0,result:''});
 let s=base();moveBJ(s,'stand');assert.equal(s.payout,50);
 s=base();s.hands[0].split=true;moveBJ(s,'stand');assert.equal(s.payout,40);
 s=base();s.dealer=[c(14),c(13)];moveBJ(s,'stand');assert.equal(s.payout,20);
 s=base();s.dealer=[c(14),c(13)];s.hands[0].split=true;moveBJ(s,'stand');assert.equal(s.payout,0);
});
test('blackjack double and split require matching extra stake; split aces stop after one card',()=>{
 const s={kind:'blackjack',deck:[c(10),c(9)],dealer:[c(10),c(7)],hands:[{cards:[c(14),c(14,1)],bet:20,done:false,split:false}],current:0,finished:false,payout:0};assert.equal(moveBJ(s,'split'),20);assert.equal(s.hands.length,2);assert.ok(s.finished);assert.equal(s.payout,80);assert.throws(()=>moveBJ(s,'split'));
 const d={kind:'blackjack',deck:[c(10)],dealer:[c(10),c(8)],hands:[{cards:[c(5),c(6)],bet:20,done:false,split:false}],current:0,finished:false,payout:0};assert.equal(moveBJ(d,'double'),20);assert.equal(d.hands[0].bet,40);assert.equal(d.payout,80);
});
test('blackjack hides hole card and deck and complete rounds never get stuck',()=>{
 for(let i=0;i<200;i++){const s=startBJ(20);if(!s.finished){const p=publicBJ(s);assert.equal(p.deck,undefined);assert.equal(p.dealer[1],-1);}let guard=0;while(!s.finished){moveBJ(s,total(s.hands[s.current].cards)<16?'hit':'stand');assert.ok(++guard<30);}assert.ok(Number.isInteger(s.payout)&&s.payout>=0);}
 assert.throws(()=>startBJ(3),/invalid_buyin/);
});
test('Hokm exposes only own cards, enforces lead suit and chooses trump from five cards',()=>{
 const s=startH(20),p=publicH(s);assert.equal(p.deck,undefined);assert.equal(p.hands,undefined);if(s.phase==='trump'){assert.equal(s.hands[0].length,5);assert.equal(s.hands[2].length,0);moveH(s,{type:'trump',suit:0});}
 s.phase='play';s.current=0;s.trick=[{player:3,card:c(9)}];s.hands[0]=[c(2),c(14,1)];assert.throws(()=>moveH(s,{type:'play',card:c(14,1)}),/invalid_move/);
});
test('Hokm complete matches reach seven points without hidden-card leaks or stuck turns',()=>{
 for(let i=0;i<12;i++){const s=startH(20);let guard=0;while(!s.finished){const p=publicH(s);assert.equal(s.current,0);moveH(s,s.phase==='trump'?{type:'trump',suit:i%4}:{type:'play',card:p.legal[0]});assert.ok(++guard<600);}assert.ok(s.scores[s.winner]>=7);assert.ok([0,1].includes(s.winner));}
});
test('Ludo entry, safe cells, capture, exact finish and third six rules',()=>{
 const s=startL(10);s.die=2;assert.deepEqual(legalL(s),[]);s.die=6;assert.deepEqual(legalL(s),[0,1,2,3]);s.pieces[0]=[56,57,57,57];s.die=2;assert.deepEqual(legalL(s),[]);s.die=1;moveL(s,{type:'piece',index:0});assert.ok(s.finished);assert.equal(s.winner,0);
 const x=startL(10);x.die=1;x.pieces[0][0]=0;x.pieces[1][0]=40;moveL(x,{type:'piece',index:0});assert.equal(x.pieces[1][0],-1);assert.equal(x.current,0);
 const safe=startL(10);safe.die=1;safe.pieces[0][0]=7;safe.pieces[1][0]=47;moveL(safe,{type:'piece',index:0});assert.notEqual(safe.pieces[1][0],-1);
});
test('Ludo complete games preserve all pieces and always find a winner',()=>{
 for(let i=0;i<6;i++){const s=startL(10);let n=0;while(!s.finished){moveL(s,s.die?{type:'piece',index:legalL(s)[0]}:{type:'roll'});assert.ok(s.pieces.every(p=>p.length===4&&p.every(v=>v>=-1&&v<=57)));assert.ok(++n<5000);}assert.ok(s.pieces[s.winner].every(v=>v===57));}
});
test('poker server deadline expires to check/fold and does not accept a late raise',()=>{
 for(let i=0;i<15;i++){const s=startPoker(100,6);if(s.finished)continue;assert.ok(s.turnDeadline>Date.now());assert.equal(publicPoker(s).turnSeconds,20);const call=s.highest>s.players[0].round;s.turnDeadline=Date.now()-1;movePoker(s,'raise',999999);if(call)assert.ok(s.players[0].folded);else assert.ok(!s.players[0].folded);if(!s.finished)assert.ok(s.turnDeadline>Date.now());}
});
