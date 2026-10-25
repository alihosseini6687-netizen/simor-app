import test from 'node:test';
import assert from 'node:assert/strict';
import {startPoker,movePoker,publicPoker,evaluate,compare,settlePoker,startBG,moveBG,legalBG,passBG,spinSlot} from '../supabase/functions/simab-central-quests/games.ts';
const c=(rank,suit=0)=>(rank-2)+suit*13;
test('holdem evaluator handles wheel straight, flush, full house and kicker tie',()=>{
 assert.equal(evaluate([c(14),c(2,1),c(3,2),c(4),c(5,1),c(9,2),c(10)])[0],4);
 assert.deepEqual(evaluate([c(14),c(13),c(12),c(11),c(10),c(2,1),c(3,1)]),[8,14]);
 assert.deepEqual(evaluate([c(14),c(14,1),c(14,2),c(13),c(13,1),c(2),c(3)]),[6,14,13]);
 assert.ok(compare([1,14,13,12,9],[1,14,13,11,10])>0);
});
test('poker private deck and opponent hole cards never leave server during play',()=>{
 for(let i=0;i<20;i++){const s=startPoker(100,6),p=publicPoker(s);assert.equal(p.deck,undefined);assert.equal(p.players[0].cards.length,2);for(const bot of p.players.slice(1))assert.equal(bot.cards.length,0);const cards=[...s.deck,...s.board,...s.players.flatMap(p=>p.cards)];assert.equal(new Set(cards).size,cards.length);}
});
test('random complete poker hands conserve table chips; no negative stacks or stuck turns',()=>{
 for(const seats of [2,4,6])for(let n=0;n<45;n++){
  const s=startPoker(20+n%8*10,seats);let guard=0;
  while(!s.finished){assert.equal(s.current,0);const hero=s.players[0],call=Math.max(0,s.highest-hero.round);const p=publicPoker(s);
   const action=n%4===0?'fold':n%4===1&&p.canRaise&&p.maxRaiseTo>p.highest?'allin':call?'call':'check';
   movePoker(s,action,0);assert.ok(s.players.every(p=>p.stack>=0));if(++guard>70)assert.fail('hand never ends');
  }
  assert.equal(s.players.reduce((sum,p)=>sum+p.stack,0),s.buyIn*seats);
 }
});
test('poker side pots pay eligible players only and split ties deterministically',()=>{
 const players=[{id:0,name:'a',cards:[c(14),c(14,1)],stack:0,bet:10,folded:false},{id:1,name:'b',cards:[c(13),c(13,1)],stack:0,bet:20,folded:false},{id:2,name:'c',cards:[c(12),c(12,1)],stack:0,bet:20,folded:false}];
 const s={players,board:[c(2),c(5,1),c(8,2),c(9,3),c(11)],button:0,buyIn:10};settlePoker(s);assert.deepEqual(players.map(p=>p.stack),[30,20,0]);
 const t={players:structuredClone(players).map(p=>({...p,stack:0,bet:3})),board:[c(10,3),c(11,3),c(12,3),c(13,3),c(14,3)],button:0,buyIn:3};settlePoker(t);assert.deepEqual(t.players.map(p=>p.stack),[3,3,3]);
});
test('backgammon forces bar re-entry and higher die when only one die is playable',()=>{
 const s={kind:'backgammon',points:Array(24).fill(0),bar:[1,0],off:[14,0],turn:0,dice:[1,2],finished:false,winner:-1,stake:10,log:[]};
 s.points[21]=-2;s.points[20]=-2; // both re-entry choices lead to blocked second moves
 const moves=legalBG(s);assert.deepEqual(moves,[{from:-1,to:22,die:2}]);
});
test('backgammon bearing off cannot skip farther checkers or play opponent pieces',()=>{
 const s={kind:'backgammon',points:Array(24).fill(0),bar:[0,0],off:[13,0],turn:0,dice:[6],finished:false,winner:-1,stake:10,log:[]};s.points[1]=1;s.points[4]=1;
 const moves=legalBG(s);assert.deepEqual(moves,[{from:4,to:-1,die:6}]);assert.throws(()=>moveBG(s,1,6),/invalid_move/);
});
test('backgammon full games keep 15 checkers per side through hits and bear-off',()=>{
 for(let n=0;n<4;n++){const s=startBG(10);let moves=0;
  while(!s.finished){const available=legalBG(s);if(available.length){const m=available[Math.floor(Math.random()*available.length)];moveBG(s,m.from,m.die);}else passBG(s);
   for(const side of [0,1])assert.equal(s.points.reduce((sum,p)=>sum+(side===0?Math.max(0,p):Math.max(0,-p)),0)+s.bar[side]+s.off[side],15);
   if(++moves>1200)assert.fail('backgammon never finishes');
  }
 }
});
test('slot validates stake and multiplier; no additional penalty beyond stake',()=>{
 assert.throws(()=>spinSlot(-1,1),/invalid_bet/);assert.throws(()=>spinSlot(3,1),/invalid_bet/);assert.throws(()=>spinSlot(100,99),/invalid_bet/);
 for(let i=0;i<1000;i++){const r=spinSlot(100,1);assert.ok(r.reels.every(n=>n>=0&&n<9));assert.ok(r.payout>=0&&r.payout<=5000);}
});
