import test from 'node:test';
import assert from 'node:assert/strict';
import {startParty,stepParty,publicParty} from '../supabase/functions/simab-central-quests/party-games.ts';
import {partyAPI} from '../supabase/functions/simab-central-quests/party-api.ts';

function fixture(version,hand=[0,1,2,3]){
 const s={kind:'sevens',n:2,current:0,finished:false,winners:[],result:'',event:1,lastEvent:'card',deadline:Date.now()+60000,log:[],hands:[[...hand],[13,14]],deck:[40,41],discard:[4],suit:0,direction:1,penalty:0,twoTarget:true,twoGift:true};
 if(version!==undefined)s.sevensRulesVersion=version;return s;
}
test('unversioned existing rooms and explicit v1 retain the single gift contract',()=>{
 for(const version of [undefined,1]){const s=fixture(version),stock=[...s.deck];stepParty(s,0,{type:'play',card:0,target:1,gift:1});assert.deepEqual(s.hands,[[2,3],[13,14,1]]);assert.deepEqual(s.deck,stock);assert.equal(s.sevensRulesVersion,version);assert.equal(s.event,2);assert.equal(s.current,1);}
});
test('legacy target-draw and no-target room variants are not silently converted',()=>{
 const draw=fixture();draw.twoGift=false;stepParty(draw,0,{type:'play',card:0,target:1});assert.deepEqual(draw.hands,[[1,2,3],[13,14,41]]);assert.deepEqual(draw.deck,[40]);
 const plain=fixture();plain.twoTarget=false;const stock=[...plain.deck];stepParty(plain,0,{type:'play',card:0,target:999});assert.deepEqual(plain.hands,[[1,2,3],[13,14]]);assert.deepEqual(plain.deck,stock);
});
test('v2 transfers exactly two selected cards; no stock substitutions or version changes',()=>{
 const s=fixture(2);s.twoGift=false;s.twoTarget=false;const stock=[...s.deck];stepParty(s,0,{type:'play',card:0,target:1,gifts:[1,2],sevensRulesVersion:1});assert.deepEqual(s.hands,[[3],[13,14,1,2]]);assert.deepEqual(s.deck,stock);assert.equal(s.sevensRulesVersion,2);
});
test('both contracts handle zero/one remaining card and final settlement state',()=>{
 for(const version of [undefined,1,2])for(const hand of [[0],[0,1]]){const s=fixture(version,hand);const move={type:'play',card:0,target:1,...(version===2?{gifts:hand.slice(1)}:{gift:hand[1]??null})};stepParty(s,0,move);assert.equal(s.finished,true);assert.deepEqual(s.winners,[0]);assert.deepEqual(s.hands,[[],[13,14,...hand.slice(1)]]);assert.deepEqual(s.deck,[40,41]);}
});
test('invalid and ambiguous cards/targets/contracts reject atomically before event or hand mutation',()=>{
 for(const version of [undefined,1,2])for(const extra of [
  {card:99},{card:1.5},{target:0},{target:2},{target:'1'},
  ...(version===2?[{gifts:[1]},{gifts:[1,1]},{gifts:[0,1]},{gifts:[1,99]},{gifts:[1,'2']},{gift:1,gifts:[1,2]}]:[{gift:0},{gift:99},{gift:'1'},{gift:1,gifts:[1]}])
 ]){const s=fixture(version),before=structuredClone(s);assert.throws(()=>stepParty(s,0,{type:'play',card:0,target:1,...(version===2?{gifts:[1,2]}:{gift:1}),...extra}));assert.deepEqual(s,before);}
 const unknown=fixture(3),before=structuredClone(unknown);assert.throws(()=>stepParty(unknown,0,{type:'draw'}),/sevens_upgrade_required/);assert.deepEqual(unknown,before);
});
test('private views identify contract without rewriting stored rooms or exposing other hands',()=>{
 for(const version of [undefined,1,2]){const s=fixture(version),before=structuredClone(s),p=publicParty(s,0);assert.equal(p.sevensRulesVersion,version??1);assert.equal(p.hands,undefined);assert.equal(p.deck,undefined);assert.deepEqual(p.hand,s.hands[0]);assert.deepEqual(s,before);}
});
test('new-game factory opts into v2; explicit legacy options keep all v14 variants',()=>{
 assert.equal(startParty('sevens',2,0).sevensRulesVersion,2);
 for(const options of [{twoGift:true,twoTarget:true},{twoGift:false,twoTarget:true},{twoGift:true,twoTarget:false}]){
  const s=startParty('sevens',2,0,{...options,sevensRulesVersion:1});assert.equal(s.sevensRulesVersion,1);assert.equal(s.twoGift,options.twoGift);assert.equal(s.twoTarget,options.twoTarget);
 }
});
test('capability discovery is side-effect free and does not call any wallet/database method',async()=>{
 const r=await partyAPI({},'801000011',{op:'capabilities'});assert.equal(r.status,200);assert.deepEqual(r.data.capabilities.sevensRulesVersions,[1,2]);
});
