import test from 'node:test';import assert from 'node:assert/strict';
import {startBJ,moveBJ,bjValue,startHokm,moveHokm,legalHokm,hokmTrickWinner,startLudo,moveLudo,legalLudo,publicTable,tableFrames} from '../supabase/functions/simab-central-quests/table-games.ts';
const c=(v,s=0)=>v-2+s*13;
test('blackjack ace values, natural, soft 17, push and surrender',()=>{
 assert.deepEqual(bjValue([c(14),c(14),c(9)]),{total:21,soft:true});assert.equal(bjValue([c(14),c(14),c(13)]).total,12);
 const fixture=(cards,dealer,deck=[])=>({kind:'blackjack',deck,dealer,hands:[{cards,bet:20,done:false,split:false,splitAce:false,result:'',payout:0}],active:0,stake:20,committed:20,payout:0,finished:false,result:'',log:[]});
 let s=fixture([c(13),c(7)],[c(14),c(6)],[c(2)]);moveBJ(s,'stand');assert.equal(s.dealer.length,2);assert.equal(s.payout,20);
 s=fixture([c(14),c(13)],[c(13,1),c(9)]);moveBJ(s,'stand');assert.equal(s.payout,50);
 s=fixture([c(13),c(5)],[c(13,1),c(8)]);moveBJ(s,'surrender');assert.equal(s.payout,10);
 s=fixture([c(8),c(8,1)],[c(13),c(7)],[c(3),c(2)]);assert.equal(moveBJ(s,'split'),20);assert.equal(s.hands.length,2);assert.equal(s.committed,40);assert.equal(publicTable(s).dealer.length,1);
});
test('blackjack complete random rounds: hidden deck, bounded exact integer payouts, legal double and split',()=>{
 for(let n=0;n<500;n++){const s=startBJ(20);let guard=0;while(!s.finished){const view=publicTable(s);assert.equal(view.deck,undefined);assert.equal(view.dealer.length,1);let action=n%7===0&&view.actions.includes('split')?'split':n%5===0&&view.actions.includes('double')?'double':bjValue(s.hands[s.active].cards).total<17?'hit':'stand';moveBJ(s,action);if(++guard>60)assert.fail('blackjack stuck');}assert.ok(Number.isSafeInteger(s.payout));assert.ok(s.payout>=0&&s.payout<=s.committed*2.5);assert.equal(publicTable(s).actions.length,0);}
 assert.throws(()=>startBJ(3),/invalid_buyin/);
});
test('hokm enforces follow suit and trump beats lead suit',()=>{
 const s={kind:'hokm',hands:[[c(2),c(14,1)],[],[],[]],turn:0,phase:'play',finished:false,trick:[{player:3,card:c(5)}]};assert.deepEqual(legalHokm(s),[c(2)]);
 assert.equal(hokmTrickWinner([{player:0,card:c(14)},{player:1,card:c(2,1)},{player:2,card:c(13)},{player:3,card:c(3,2)}],1),1);
});
test('hokm full matches: first 5 only for human hakem, hidden partners, unique cards, match to seven',()=>{
 for(let n=0;n<12;n++){const s=startHokm(20);let guard=0;while(!s.finished){const v=publicTable(s);assert.equal(v.deck,undefined);assert.equal(v.hands,undefined);if(s.phase==='trump'){assert.equal(s.hakem,0);assert.equal(s.hands[0].length,5);assert.equal(s.hands.slice(1).flat().length,0);moveHokm(s,{type:'trump',suit:n%4});}else if(s.phase==='round_end'){moveHokm(s,{type:'next'});}else{assert.equal(s.turn,0);const legal=legalHokm(s);assert.ok(legal.length);moveHokm(s,{type:'card',card:legal[n%legal.length]});}const cards=[...s.deck,...s.hands.flat(),...s.trick.map(x=>x.card)];assert.equal(new Set(cards).size,cards.length);if(++guard>400)assert.fail('hokm stuck');}assert.ok(Math.max(...s.scores)>=7);assert.ok(s.winner===0||s.winner===1);for(const frame of tableFrames(s))assert.equal(frame.hands,undefined);}
});
test('ludo requires six, exact finish, blocks passing and captures single opponent',()=>{
 const s={kind:'ludo',tokens:[[-1,54,0,0],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]],turn:0,die:3,stake:10,finished:false,winner:-1,result:'',log:[],opening:[]};assert.ok(!legalLudo(s).includes(0));assert.ok(!legalLudo(s).includes(1));s.die=2;assert.ok(legalLudo(s).includes(1));
 s.tokens[0]=[0,-1,-1,-1];s.tokens[1]=[40,40,-1,-1];s.die=3;assert.deepEqual(legalLudo(s),[]);s.tokens[1]=[40,-1,-1,-1];s.die=1;moveLudo(s,{type:'token',token:0});assert.equal(s.tokens[1][0],-1);
});
test('ludo complete games with four conserved tokens, fair legal turns and exact finishing',()=>{
 for(let n=0;n<8;n++){const s=startLudo(10);let guard=0;while(!s.finished){assert.equal(s.turn,0);if(!s.die)moveLudo(s,{type:'roll'});else{const legal=legalLudo(s);assert.ok(legal.length);moveLudo(s,{type:'token',token:legal[n%legal.length]});}assert.ok(s.tokens.every(a=>a.length===4&&a.every(x=>Number.isInteger(x)&&x>=-1&&x<=56)));if(++guard>2500)assert.fail('ludo stuck');}assert.ok(s.tokens[s.winner].every(x=>x===56));}
});
