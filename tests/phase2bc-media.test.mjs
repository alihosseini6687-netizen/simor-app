import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {roomIceServers} from '../supabase/functions/simab-central-quests/ice-config.ts';
import {uiHarness} from './support/ui-harness.mjs';
test('optional TURN defaults to STUN and fails closed for incomplete or malformed configuration',async()=>{
 for(const config of [{},{SIMAB_TURN_URLS:'turn:relay.example:3478'},{SIMAB_TURN_URLS:'https://relay.example',SIMAB_TURN_SECRET:'x'.repeat(32)},{SIMAB_TURN_URLS:'turn:user:password@relay.example:3478',SIMAB_TURN_SECRET:'x'.repeat(32)}])assert.equal((await roomIceServers(k=>config[k],0)).length,1);
});
test('TURN credentials are random, ten-minute HMAC credentials; response never contains shared secret',async()=>{
 const config={SIMAB_TURN_URLS:'turn:relay.example:3478?transport=udp,turns:relay.example:5349?transport=tcp',SIMAB_TURN_SECRET:'synthetic-unit-test-secret-32-characters'};
 const a=await roomIceServers(k=>config[k],1000000),b=await roomIceServers(k=>config[k],1000000);
 assert.equal(a.length,2);assert.equal(a[1].username.split(':')[0],'1600');assert.notEqual(a[1].username,b[1].username);
 assert.equal(a[1].credential,createHmac('sha1',config.SIMAB_TURN_SECRET).update(a[1].username).digest('base64'));assert.ok(!JSON.stringify(a).includes(config.SIMAB_TURN_SECRET));
});
function media(navigator={}){return uiHarness('assets/js/simab-room-media-v16.js','reconnectPeer,dropPeer,stopMedia,get peers(){return peers;},get attempts(){return restartAttempts;},setUp(r,joined=true){latest=r;media=joined;},enableRTC(){window.RTCPeerConnection=function(){};}',{globals:{navigator},setupDOM:({document})=>{document.body.dataset.mode='friends';}});}
test('only offer owner restarts failed ICE and page-exit cleanup cancels queued restart',async()=>{
 const h=media(),room={viewer:0,members:[{subject:'1'},{subject:'2'}],iceServers:[]};h.api.setUp({room});let offers=0,closed=0;
 const pc={connectionState:'failed',signalingState:'stable',setConfiguration(){},async createOffer(options){assert.equal(options.iceRestart,true);offers++;return{};},async setLocalDescription(){this.localDescription={toJSON:()=>({})};},close(){closed++;}};
 h.api.peers.set('2',pc);h.api.reconnectPeer('2',pc);assert.equal(h.timers.size,1);h.flush();await new Promise(setImmediate);assert.equal(offers,1);
 h.api.reconnectPeer('2',pc);const queued=[...h.timers.values()][0];h.api.stopMedia();assert.equal(h.timers.size,0);queued();await new Promise(setImmediate);assert.equal(offers,1);assert.equal(closed,1);
 room.viewer=1;h.api.setUp({room});h.api.peers.set('1',pc);h.api.reconnectPeer('1',pc);assert.equal(h.timers.size,0);
});
test('microphone denial remains recoverable and late permission capture is stopped after leaving',async()=>{
 let capture;const h=media({mediaDevices:{getUserMedia:()=>new Promise(r=>capture=r)}});h.api.enableRTC();const room={code:'ABCDEFGH23',viewer:0,status:'waiting',members:[{subject:'1'}]};h.api.setUp({room},false);
 const joining=h.$('voice-join').onclick();let stopped=0;h.api.stopMedia();capture({getTracks:()=>[{stop(){stopped++;}}]});await joining;assert.equal(stopped,1);assert.equal(h.$('mic-toggle').disabled,true);assert.equal(h.$('voice-join').disabled,false);
 const denied=media({mediaDevices:{getUserMedia:async()=>{const e=Error('denied');e.name='NotAllowedError';throw e;}}});denied.api.enableRTC();denied.api.setUp({room},false);await denied.$('voice-join').onclick();assert.match(denied.$('media-message').textContent,/اجازهٔ میکروفن/);assert.equal(denied.$('voice-join').disabled,false);
});
