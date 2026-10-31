import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {startParty,stepParty,publicParty} from '../supabase/functions/simab-central-quests/party-games.ts';
import {localeContext} from './support/i18n-inventory-v22.mjs';

const copy=x=>JSON.parse(JSON.stringify(x));
function seven(n=4,hands=[[0,1,2,3],[13,14],[26,27],[39,40]],direction=1){return {kind:'sevens',n,current:0,finished:false,winners:[],result:'',event:1,lastEvent:'card',deadline:0,log:[],hands:hands.slice(0,n).map(h=>[...h]),deck:Array.from({length:30},(_,i)=>51-i),discard:[4],suit:0,direction,penalty:0,twoTarget:true,twoGift:true};}
for(const n of [2,3,4]){
 test('phase4 Sevens '+n+': targeted two-card hand transfer and private views',()=>{
  const s=seven(n),deck=JSON.stringify(s.deck),before=s.hands[n-1].length;stepParty(s,0,{type:'play',card:0,target:n-1,gifts:[1,2]});
  assert.deepEqual(s.hands[0],[3]);assert.equal(s.hands[n-1].length,before+2);assert.equal(JSON.stringify(s.deck),deck);
  for(let i=0;i<n;i++){const p=publicParty(s,i);assert.equal(p.hands,undefined);assert.equal(p.deck,undefined);assert.deepEqual(p.hand,s.hands[i]);}
 });
 test('phase4 Sevens '+n+': short hand transfers all remaining cards, never draws substitutes',()=>{
  for(const remaining of [0,1]){const hands=seven(n).hands;hands[0]=remaining?[0,1]:[0];const s=seven(n,hands),deck=JSON.stringify(s.deck),before=s.hands[1].length;stepParty(s,0,{type:'play',card:0,target:1,gifts:remaining?[1]:[]});assert.equal(s.finished,true);assert.deepEqual(s.winners,[0]);assert.equal(s.hands[1].length,before+remaining);assert.equal(JSON.stringify(s.deck),deck);}
 });
 test('phase4 Sevens '+n+': reverse then Ace, both directions',()=>{
  for(const direction of [1,-1]){const s=seven(n);s.direction=direction;s.hands[0]=[8,1];stepParty(s,0,{type:'play',card:8});assert.equal(s.direction,-direction);const actor=(n-direction)%n;assert.equal(s.current,actor);s.hands[actor]=[12,2];stepParty(s,actor,{type:'play',card:12});assert.equal(s.current,(actor-2*direction+2*n)%n);}
 });
}
test('phase4 Sevens invalid transfers are atomic',()=>{
 for(const gifts of [[1],[1,1],[0,1],[1,99]]){const s=seven(),before=copy(s);assert.throws(()=>stepParty(s,0,{type:'play',card:0,target:1,gifts}));assert.deepEqual(s,before);}
});
test('phase4 Sevens three eights keep one valid bonus turn each; final card wins',()=>{
 const s=seven(2,[[6,19,32,1],[13,14]]);for(const card of [6,19,32]){const event=s.event;stepParty(s,0,{type:'play',card});assert.equal(s.current,0);assert.equal(s.event,event+1);assert.equal(s.finished,false);}const last=seven(2,[[6],[13,14]]);stepParty(last,0,{type:'play',card:6});assert.equal(last.finished,true);
});
test('phase4 Sevens Jack chooses any valid suit; no illegal suit or last Jack',()=>{
 const s=seven(2,[[9,1],[13,14]]);s.suit=3;const before=copy(s);assert.throws(()=>stepParty(s,0,{type:'play',card:9,suit:4}));assert.deepEqual(s,before);stepParty(s,0,{type:'play',card:9,suit:2});assert.equal(s.suit,2);assert.throws(()=>stepParty(seven(2,[[9],[13,14]]),0,{type:'play',card:9,suit:0}));
});
for(const n of [2,3,4])test('phase4 Sevens '+n+': seven penalties stack 2/4/6 and draw once',()=>{
 const s=seven(n,[[5,31,0],[18,13],[31,26],[44,39]]);for(const [index,card]of [5,18,n===2?31:31].entries()){stepParty(s,s.current,{type:'play',card});assert.equal(s.penalty,(index+1)*2);}const actor=s.current,count=s.hands[actor].length;stepParty(s,actor,{type:'draw'});assert.equal(s.hands[actor].length,count+6);assert.equal(s.penalty,0);assert.equal(s.current,(actor+1)%n);
});
test('phase4 Truth refusal and empty answer leave state unchanged',()=>{
 const s=startParty('truth',2,0);Object.assign(s,{phase:'answer',question:'Private question',current:0});for(const move of [{type:'skip'},{type:'answer',text:''}]){const before=copy(s);assert.throws(()=>stepParty(s,0,move));assert.deepEqual(s,before);}stepParty(s,0,{type:'answer',text:'Actual answer'});assert.equal(s.phase,'roll');
});
for(const n of [2,3,4])test('phase4 Hokm '+n+': repeated human/bot trick winners and explicit round continuation',()=>{
 for(const winner of [0,1]){
  const s=startParty('hokm',n,0),t=s.table;Object.assign(t,{phase:'play',trump:0,current:0,hakem:0,trick:[],lastTrick:[],tricks:Array(n===4?2:n).fill(0),scores:Array(n===4?2:n).fill(0)});s.current=0;
  const low=[[0,1,2],[3,4,5],[6,7,8]];t.hands=Array.from({length:n},(_,i)=>i===winner?[12,11,10]:low[(i+(i>winner?-1:0))%3].slice());
  for(let trick=0;trick<3;trick++){for(let j=0;j<n;j++){const actor=s.current;stepParty(s,actor,{type:'play',card:t.hands[actor][0]});}assert.equal(s.current,winner);assert.equal(t.trick.length,0);assert.equal(t.lastTrick.length,n);}
 }
 const s=startParty('hokm',n,0),t=s.table;Object.assign(t,{phase:'play',trump:0,current:0,hakem:0,trick:[],lastTrick:[],tricks:Array(n===4?2:n).fill(0),scores:Array(n===4?2:n).fill(0),hands:Array.from({length:n},(_,i)=>[i===0?12:i])});t.tricks[0]=6;s.current=0;for(let j=0;j<n;j++)stepParty(s,s.current,{type:'play',card:t.hands[s.current][0]});assert.equal(t.phase,'round_end');assert.equal(s.current,0);stepParty(s,0,{type:'next_round'});assert.equal(t.phase,'trump');assert.equal(t.hands[t.hakem].length,5);
});
test('phase4 browser rules generated from authoritative source and bots use approved actions',()=>{
 const x={window:{},crypto,structuredClone};vm.createContext(x);vm.runInContext(readFileSync(new URL('../assets/js/simab-practice-rules-v17.js',import.meta.url),'utf8'),x);vm.runInContext(readFileSync(new URL('../assets/js/simab-practice-ai-v20.js',import.meta.url),'utf8'),x);
 const s=seven(3);s.discard=[13];s.suit=1;const move=x.window.SimabPracticeAI.choose(s,x.window.SimabPracticeRules);assert.equal(move.card,0);assert.equal(move.gifts.length,2);const server=copy(s),practice=copy(s);stepParty(server,0,move,123);x.window.SimabPracticeRules.stepParty(practice,0,move,123);assert.deepEqual(copy(practice),server);
 const truth=startParty('truth',2,0);truth.phase='answer';assert.equal(x.window.SimabPracticeAI.choose(truth,x.window.SimabPracticeRules).type,'answer');
});
for(const lang of ['en','fa','ru','ar','hi','fr','de'])test('phase4 '+lang+': exact transfer and no-refusal guidance',()=>{const x=localeContext(lang);for(const key of ['truth.participants','privacy.localBottle','rules.sevensTwo','error.twoTransfer','rules.truth'])assert.ok(x.SimabI18n.key(key)&&!x.SimabI18n.key(key).startsWith('['));assert.deepEqual([...x.SimabI18n.missing],[]);});
