import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../assets/js/simab-central-quests.js',import.meta.url),'utf8');
const block=source.slice(source.indexOf('  function wireAdminCredit()'),source.indexOf('  if (isAdmin) {\n    wireAdminCredit();'));
function ui(api, saved=new Map()) {
 const nodes=Object.fromEntries(['target-user-id','target-coin-amount','admin-credit-submit','admin-credit-status'].map(id=>[id,{value:'',textContent:'',disabled:false}]));
 const window={confirm:()=>true};
 const context={document:{getElementById:id=>nodes[id]},window,crypto:webcrypto,
  URLSearchParams,localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
  signedInitDataCandidates:()=>[new URLSearchParams({user:JSON.stringify({id:702007470})}).toString()],doAdmin:api};
 runInNewContext(block+'\nwireAdminCredit();',context);
 return {nodes,send:()=>window.transferCoinsDirect(),saved};
}
test('Persian digits credit exact recipient and show audited success',async()=>{
 let calls=0;
 const u=ui(async(action,p)=>{calls++;assert.equal(action,'admin_credit');assert.equal(p.targetUserId,'123456');assert.equal(p.amount,1000);
  return {...p,serverWallet:true,coins:1050};});
 u.nodes['target-user-id'].value='۱۲۳۴۵۶';u.nodes['target-coin-amount'].value='۱۰۰۰';await u.send();
 assert.equal(calls,1);assert.equal(u.saved.size,0);assert.match(u.nodes['admin-credit-status'].textContent,/واریز ثبت شد/);
});
test('lost response survives reload and resends same immutable request',async()=>{
 let first;
 const u=ui(async(_,p)=>{first={...p};throw Error('offline');});
 u.nodes['target-user-id'].value='123456';u.nodes['target-coin-amount'].value='25';await u.send();
 assert.equal(u.saved.size,1);assert.equal(u.nodes['target-user-id'].disabled,true);
 const reloaded=ui(async(_,p)=>{assert.deepEqual({...p},first);return {...p,serverWallet:true,coins:25,duplicate:true};},u.saved);
 await reloaded.send();assert.equal(u.saved.size,0);assert.match(reloaded.nodes['admin-credit-status'].textContent,/دوباره اضافه نشد/);
});
test('invalid recipient, fractions and negative amounts do not contact server',async()=>{
 let calls=0;const u=ui(async()=>{calls++;});
 for(const [id,amount] of [['@user','10'],['-123','1'],['123','1.5'],['123','-5'],['123','0'],['123','1000000000001']]){
  u.nodes['target-user-id'].value=id;u.nodes['target-coin-amount'].value=amount;await u.send();
 }assert.equal(calls,0);
});
test('double click sends once while pending; definitive rejection unlocks form',async()=>{
 let reject,calls=0;const u=ui(()=>{calls++;return new Promise((_,r)=>{reject=r;});});
 u.nodes['target-user-id'].value='123';u.nodes['target-coin-amount'].value='5';
 const active=u.send();await u.send();assert.equal(calls,1);
 reject(Object.assign(Error('admin denied'),{definitive:true}));await active;
 assert.equal(u.saved.size,0);assert.equal(u.nodes['target-user-id'].disabled,false);
});
