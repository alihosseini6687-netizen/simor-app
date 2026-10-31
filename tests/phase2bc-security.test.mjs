import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {readSource} from './support/source.mjs';
import {partyAPI} from '../supabase/functions/simab-central-quests/party-api.ts';
import {pokerRoomAPI} from '../supabase/functions/simab-central-quests/poker-room-api.ts';
const source=readSource(new URL('../supabase/functions/simab-central-quests/index.ts',import.meta.url));
function limiter(){const code=source.slice(source.indexOf('const requestWindows'),source.indexOf('async function hmac'));return vm.runInNewContext(stripTypeScriptTypes(code)+';({requestLimit,requestWindows})');}
test('signed-identity rate buckets cap rapid writes and cannot be bypassed with forged room/actor IDs',()=>{
  const {requestLimit:limit}=limiter();for(let i=0;i<120;i++)assert.equal(limit('123',{action:'game',actorId:String(i),code:String(i)},0),0);
  assert.equal(limit('123',{action:'wallet',walletAction:'slot',actorId:'999'},1),60);
  assert.equal(limit('456',{action:'game'},1),0);assert.equal(limit('123',{action:'game'},60000),0);
  assert.equal(limit('123',{action:'room',op:'state'},1),0);assert.equal(limit('123',{action:'room',op:'signal'},1),0);
  assert.ok(source.indexOf('const retryAfterSeconds=requestLimit(subject,payload)')>source.indexOf('subject = verified.telegramUserId'));
});
test('read, invitation and signalling limits preserve polling but remain bounded',()=>{
 const {requestLimit:limit}=limiter();for(let i=0;i<240;i++)assert.equal(limit('1',{action:'room',op:i%2?'preview':'state'},0),0);
 assert.equal(limit('1',{action:'game_state'},0),60);
 for(let i=0;i<1200;i++)assert.equal(limit('1',{action:'game_room',op:'signal'},0),0);
 assert.equal(limit('1',{action:'room',op:'signal'},0),60);
});
test('rate counter memory is bounded without evicting live quotas; expired counters recover',()=>{
 const {requestLimit:limit,requestWindows:windows}=limiter();for(let i=0;i<10000;i++)limit(String(i),{action:'game'},0);
 assert.equal(limit('overflow',{action:'game'},1),60);assert.equal(windows.size,10000);
 assert.equal(limit('overflow',{action:'game'},60001),0);assert.equal(windows.size,1);
});
test('malformed room UUIDs are rejected before receipt lookup or room commit',async()=>{
 const db={rpc:async()=>({data:{serverWallet:true,coins:0,chips:0}}),from(){throw Error('must not query');}};
 for(const api of [partyAPI,pokerRoomAPI])for(const requestId of ['-'.repeat(36),'a'.repeat(36),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']){
  const r=await api(db,'123',{op:'create',code:'ABCDEFGH23',requestId});assert.equal(r.status,409);assert.equal(r.data.error,'invalid_request_id');
 }
});
