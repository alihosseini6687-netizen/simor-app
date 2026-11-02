import test from 'node:test';
import assert from 'node:assert/strict';
import {startParty,stepParty,timeoutParty,publicParty,partyPayout,legalSevens,gameSizes} from '../supabase/functions/simab-central-quests/party-games.ts';
import {legalBG} from '../supabase/functions/simab-central-quests/games.ts';

const modes=[
 ['hokm',2],['hokm',3],['hokm',4],
 ['ludo',2],['ludo',3],['ludo',4],
 ['backgammon',2],['snakes',2],['snakes',3],['snakes',4],
 ['sevens',2],['sevens',3],['sevens',5],['sevens',6],['sevens',8],
 ['mill',2],['bingo',2],['bingo',4],['blackjack',2],['blackjack',3],['blackjack',8],
 ['slot',2],['slot',8],['truth',2],['truth',4]
];
test('every published competitive game accepts its supported player counts with zero-entry and no payouts',()=>{
 for(const [kind,n] of modes){
  assert.ok(n>=gameSizes[kind][0]&&n<=gameSizes[kind][1],kind+'/'+n);
  const state=startParty(kind,n,0,{twoGift:true,twoTarget:true,mode:'dice'});
  assert.equal(state.n,n,kind+'/'+n);
  assert.equal(state.current>=0&&state.current<n,true);
  for(let viewer=0;viewer<n;viewer++){
   const view=publicParty(state,viewer);
   assert.equal(view.deck,undefined,kind+' deck leaked');
   assert.equal(view.bag,undefined,kind+' bag leaked');
   if(kind==='sevens'){
    assert.equal(view.hands,undefined,'other-player Sevens hands leaked');
    assert.equal(view.hand.length,7);
    assert.equal(view.counts.length,n);
   }
   if(kind==='blackjack'&&!state.finished){
    for(let i=0;i<n;i++)if(i!==viewer)assert.ok(view.hands[i].every(card=>card===-1),'opponent Blackjack hand leaked');
    assert.equal(view.dealer[1],-1,'Blackjack hole card leaked');
   }
   if(kind==='hokm')assert.equal(view.table.hands,undefined,'Hokm hands leaked');
   if(kind==='bingo')assert.equal(view.tickets,undefined,'other player Bingo tickets leaked');
  }
  assert.deepEqual(partyPayout({...state,finished:true,winners:[0]},0),Array(n).fill(0),kind+'/'+n+' imaginary payment');
 }
});
test('each competitive player-count variant reaches a terminal state under legal server turns',()=>{
 const endToEnd=modes.filter(([kind])=>kind!=='truth');
 for(const [kind,n] of endToEnd){
  let state=startParty(kind,n,0,{twoGift:true,twoTarget:true});
  let turns=0;
  while(!state.finished&&turns++<25000){
   if(kind==='sevens'){
    const hand=state.hands[state.current],available=legalSevens(state,state.current);
    const card=available.find(card=>!(card%13+2===11&&hand.length===1));
    if(card===undefined){stepParty(state,state.current,{type:'draw'},state.deadline);continue;}
    const m={type:'play',card,suit:0};
    if(card%13+2===2&&state.twoTarget){
     m.target=(state.current+state.direction+state.n)%state.n;
     if(state.twoGift&&hand.length>1)m.gift=hand.find(x=>x!==card);
    }
    stepParty(state,state.current,m,state.deadline);
   }else timeoutParty(state);
  }
  assert.equal(state.finished,true,kind+'/'+n+' did not finish after '+turns+' turns');
  assert.equal(state.winners.every(i=>Number.isInteger(i)&&i>=0&&i<n),true,kind+'/'+n+' invalid winner');
  assert.deepEqual(partyPayout(state,0),Array(n).fill(0),kind+'/'+n+' unexpected virtual chips');
 }
});
test('invalid-turn moves never advance or mutate another player’s cards or dice',()=>{
 for(const [kind,n] of [['hokm',2],['hokm',3],['hokm',4],['ludo',2],['ludo',3],['backgammon',2],['sevens',2],['sevens',8],['blackjack',2],['mill',2]]){
  const s=startParty(kind,n,0,{twoGift:true});
  const before=structuredClone(s),impostor=(s.current+1)%n;
  assert.throws(()=>stepParty(s,impostor,{type:'roll',card:0,from:0,to:0}),/invalid_turn/,kind+'/'+n);
  assert.deepEqual(s,before,kind+'/'+n+' state changed after out-of-turn move');
 }
});
test('two-person Backgammon opening dice remain private to each turn, without allowing repeat rolls',()=>{
 const s=startParty('backgammon',2,0);
 stepParty(s,0,{type:'roll'});
 assert.equal(s.current,1);
 assert.equal(s.table.opening[0]>=1&&s.table.opening[0]<=6,true);
 assert.equal(s.table.opening[1],0);
 assert.throws(()=>stepParty(s,0,{type:'roll'}),/invalid_turn/);
 let attempts=0;
 while(s.table.opening&&attempts++<45)stepParty(s,s.current,{type:'roll'});
 assert.equal(s.table.opening,undefined,'opening tie should retry and eventually break');
 assert.ok(legalBG(s.table).length>0,'winner receives playable opening dice');
});
