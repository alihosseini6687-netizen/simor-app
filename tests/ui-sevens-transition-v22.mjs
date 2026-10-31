import assert from 'node:assert/strict';
import {phase4Browser} from './support/phase4-browser-v22.mjs';

const h=await phase4Browser(),p=h.page;let checks=0;
try{
 await h.open('sevens');
 const fixture=async(version,hand=[0,1,2,3],flags={twoTarget:true,twoGift:true})=>p.evaluate(({version,hand,flags})=>{
  const s=SimabPracticeRules.startParty('sevens',2,0);s.current=0;s.hands=[hand,[13,14]];s.discard=[4];s.suit=0;s.penalty=0;Object.assign(s,flags);if(version===null)delete s.sevensRulesVersion;else s.sevensRulesVersion=version;__phase4.fixture(s);
 },{version,hand,flags});
 for(const version of [null,1,2]){
  await fixture(version);
  const gifts=p.locator('#controls select[aria-label="Cards to transfer from your hand"]');
  assert.equal(await gifts.evaluate(el=>el.multiple),version===2);checks++;
  assert.match(await p.locator('.sevens-rule-contract').innerText(),version===2?/two hand cards/:/one hand card/);checks++;
  await gifts.selectOption(version===2?['1','2']:'1');await p.locator('#hand button').first().click();
  assert.deepEqual(await p.evaluate(()=>__phase4.state.hands[0]),version===2?[3]:[2,3]);checks++;
 }
 for(const [flags,label] of [[{twoTarget:true,twoGift:false},/draws one stock/],[{twoTarget:false,twoGift:true},/no special transfer/]]){
  await fixture(null,[0,1,2,3],flags);assert.equal(await p.locator('#controls select[aria-label="Cards to transfer from your hand"]').count(),0);assert.match(await p.locator('.sevens-rule-contract').innerText(),label);checks++;
  await p.locator('#hand button').first().click();assert.deepEqual(await p.evaluate(()=>__phase4.state.hands[0]),[1,2,3]);checks++;
 }
 for(const version of [1,2])for(const hand of [[0],[0,1]]){
  await fixture(version,hand);
  if(hand.length>1)await p.locator('#controls select[aria-label="Cards to transfer from your hand"]').selectOption('1');
  await p.locator('#hand button').first().click();assert.equal(await p.evaluate(()=>__phase4.state.finished),true);checks++;
 }
 // A backend-first readiness check prevents a new-rule debit on production v14.
 await p.evaluate(()=>{__phase4.resetRoom();SimabWallet.read=async()=>({room:null});SimabWallet.mutate=async(a,p)=>{__writes.push(p);return{room:null};};});
 await p.locator('#create').click();assert.match(await p.locator('#entry-status').innerText(),/updated server and app/);assert.deepEqual(await p.evaluate(()=>__writes),[]);checks++;
 await p.evaluate(()=>{SimabWallet.read=async()=>({capabilities:{sevensRulesVersions:[1,2]}});});
 await p.locator('#create').click();const writes=await p.evaluate(()=>__writes);assert.equal(writes.length,1);assert.equal(writes[0].sevensProtocol,2);assert.equal(writes[0].options.sevensRulesVersion,2);checks++;
 assert.deepEqual(h.errors,[]);console.log(JSON.stringify({checks,errors:h.errors,scope:'Real Chrome controls with local fixtures only; no production transport, auth or balances'},null,2));
}finally{await h.close();}
