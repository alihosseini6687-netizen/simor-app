import test from 'node:test';
import assert from 'node:assert/strict';
import {uiHarness} from './support/ui-harness.mjs';

const invite='ABCDEFGHJK';
function setup(){
 const replace=[];
 const h=uiHarness('assets/js/simab-party-v16.js','load,createJoin',{
  game:'hokm',globals:{
   location:{search:'?game=hokm&code='+invite},
   history:{replaceState:(_,__,url)=>replace.push(url)}
  }
 });
 let mutations=0;
 h.wallet.mutate=async()=>{mutations++;throw Error('unexpected mutation');};
 return {...h,replace,get mutations(){return mutations;}};
}
function problem(code){const error=Error(code);error.code=code;return error;}

test('wrong-game invite offers the correct explicit link but never leaves/closes a different room',async()=>{
 const h=setup();
 h.wallet.read=async(_,payload)=>{
  if(payload.op==='state')throw problem('wrong_room_type');
  return {preview:{game:'ludo',status:'waiting',count:1,maxPlayers:4,buyIn:20}};
 };
 await h.api.load();
 const panel=h.$('existing-room');
 assert.equal(panel.hidden,false);
 const links=panel.children.filter(x=>x.tagName==='A');
 assert.equal(links.length,1);
 assert.equal(links[0].href,'?game=ludo&code='+invite);
 assert.equal(panel.children.some(x=>x.tagName==='BUTTON'),false,'no destructive old-room action on mismatch');
 assert.equal(h.mutations,0);
});
test('full and already started rooms cannot invoke a wallet transaction from invite',async()=>{
 for(const preview of [
  {game:'hokm',status:'waiting',count:4,maxPlayers:4,buyIn:20},
  {game:'hokm',status:'playing',count:2,maxPlayers:4,buyIn:20},
  {game:'hokm',status:'finished',count:4,maxPlayers:4,buyIn:20}
 ]){
  const h=setup();
  h.wallet.read=async(_,payload)=>{
   if(payload.op==='state')throw problem('room_forbidden');
   return {preview};
  };
  await h.api.load();
  assert.match(h.$('status').textContent,/میز پر است|دعوت دیگر/);
  h.$('join-code').value=invite;
  await h.api.createJoin('join');
  assert.equal(h.mutations,0,'full/closed invites never submit');
 }
});
test('expired room code is cleared so user can create another room',async()=>{
 const h=setup();
 h.wallet.read=async()=>{throw problem('room_not_found');};
 await h.api.load();
 assert.equal(h.mutations,0);
 assert.match(h.$('status').textContent,/دعوت پیدا نشد/);
 assert.ok(h.replace.includes('?game=hokm'));
 assert.equal(h.$('create').disabled,false);
});
test('invalid cross-game preview does not generate an unallowlisted navigation target',async()=>{
 const h=setup();
 h.wallet.read=async(_,payload)=>{
  if(payload.op==='state')throw problem('wrong_room_type');
  return {preview:{game:'<script>',status:'waiting',count:1,maxPlayers:2,buyIn:20}};
 };
 await h.api.load();
 assert.equal(h.$('existing-room').children.filter(x=>x.tagName==='A').length,0);
 assert.equal(h.mutations,0);
});
