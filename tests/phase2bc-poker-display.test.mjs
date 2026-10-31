import test from 'node:test';import assert from 'node:assert/strict';
import {uiHarness} from './support/ui-harness.mjs';
const receipt=(version=1,current=0)=>({sessionId:'poker-test',version,state:{kind:'poker',pot:10,street:0,board:[],current,button:0,winners:[],players:[0,1].map(id=>({id,name:id?'Bot A':'Me',cards:id?[]:[0,1],stack:100,round:0})),buyIn:100,toCall:0,highest:0,minRaiseTo:2,maxRaiseTo:100,canRaise:true}});
function setup(delay=async()=>{}){return uiHarness('assets/js/simab-poker-v10.js','accept,animate,action,get session(){return session;}',{globals:{SimabGameRoom:{open:async()=>{},fit(){},close(){},delay}},setupDOM:({$})=>{for(const cls of ['pot-label','poker-controls','bet-shortcuts'])$('test-'+cls).className=cls;}});}
test('bot frame names actual active bot, not viewer; out-of-turn buttons stay disabled',()=>{
 const h=setup();h.api.accept(receipt(1,1));assert.match(h.$('turn-status').textContent,/Bot A.*BOT/);assert.equal(h.$('fold').disabled,true);
 h.api.accept(receipt(2,0));assert.match(h.$('turn-status').textContent,/نوبت شما/);
});
test('failed poker action is silent; accepted result sounds only after server response',async()=>{
 const h=setup();h.api.accept(receipt());h.wallet.mutate=async()=>{throw Error('rejected');};await h.api.action('move',{type:'raise',amount:10});assert.deepEqual(h.sounds,[]);
 h.wallet.mutate=async()=>receipt(2);await h.api.action('move',{type:'raise',amount:10});assert.ok(h.sounds.includes('raise'));
});
test('newer poker state invalidates delayed old frames and terminal receipt replay is silent',async()=>{
 let release;const h=setup(()=>new Promise(r=>release=r));h.api.accept(receipt(3));
 // Public frame sequence is serialized, not compressed into the final state.
 const r=receipt(4,1);r.state.timeline=[receipt(4,1).state,receipt(4,0).state];
 const next=h.api.animate(r);assert.equal(h.api.session.state.current,1);h.api.accept(receipt(6));release();await next;assert.equal(h.api.session.version,6);
 await h.api.animate(receipt(5));assert.equal(h.api.session.version,6);
 const done=receipt(7);done.state.finished=true;done.state.result='Draw';await h.api.animate(done);const count=h.sounds.length;await h.api.animate(done);assert.equal(h.sounds.length,count);assert.equal(h.sounds.at(-1),'tap');
});
