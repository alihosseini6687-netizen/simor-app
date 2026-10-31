import test from 'node:test';
import assert from 'node:assert/strict';
import {uiHarness} from './support/ui-harness.mjs';
const receipt=(version=1,code='ABCDEFGH23')=>({version,sessionId:code,room:{code,viewer:0,members:[{subject:'1',name:'A',emoji:'A'}],status:'waiting',host:true,buyIn:20,maxPlayers:2},state:null});
// Use the harness DOM, supplying just its missing document-level query method.
function setup(){return uiHarness('assets/js/simab-private-poker-v14.js','paint,load,mutate,createJoin,get latest(){return latest;}',{globals:{sessionStorage:{setItem(){}}},setupDOM:({$})=>{$('test-call').className='room-call';}});}
test('private poker ignores older versions but accepts equal-version signalling and two-device advances',()=>{
  const h=setup();h.api.paint(receipt(5));h.api.paint(receipt(3));assert.equal(h.api.latest.version,5);
  const same=receipt(5);same.room.messages=[];h.api.paint(same);assert.equal(h.api.latest,same);
  h.api.paint(receipt(9));assert.equal(h.api.latest.version,9);
});
test('private poker does not resurrect retired rooms from late receipts',()=>{
  const h=setup();h.api.paint(receipt(5));h.api.paint({room:null,state:null});h.api.paint(receipt(6));assert.equal(h.api.latest,null);
  h.api.paint(receipt(1,'BCDEFGHJ24'));h.api.paint(receipt(99));assert.equal(h.api.latest.room.code,'BCDEFGHJ24');
});
test('private poker rejects poll started before a leave and reconnect retains newest version',async()=>{
  const h=setup();h.api.paint(receipt(3));let resolve;h.wallet.read=()=>new Promise(r=>resolve=r);
  const poll=h.api.load();h.wallet.mutate=async()=>({room:null,state:null});await h.api.mutate('leave');resolve(receipt(3));await poll;assert.equal(h.api.latest,null);
  h.wallet.read=async()=>receipt(7,'BCDEFGHJ24');await h.api.load();h.wallet.read=async()=>receipt(6,'BCDEFGHJ24');await h.api.load();assert.equal(h.api.latest.version,7);
});
test('private poker full/closed invite never submits a wager or asks for consent',async()=>{
  const h=setup();h.$('join-code').value='ABCDEFGH23';let calls=0;h.wallet.mutate=async()=>{calls++;};
  for(const status of ['playing','finished','cancelled','waiting']){h.wallet.read=async()=>({preview:{status,count:2,maxPlayers:2,buyIn:20}});await h.api.createJoin('join');}
  assert.equal(calls,0);assert.match(h.$('lobby-status').textContent,/میز پر/);
});
test('private poker initial empty poll cannot clear a newer recovered room',async()=>{
 const h=setup();let resolve;h.wallet.read=()=>new Promise(r=>resolve=r);const poll=h.api.load();h.api.paint(receipt(8));resolve({room:null,state:null});await poll;assert.equal(h.api.latest.version,8);
});
