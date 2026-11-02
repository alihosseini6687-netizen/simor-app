import test from 'node:test';
import assert from 'node:assert/strict';
import {uiHarness} from './support/ui-harness.mjs';
function media(navigator={}){return uiHarness('assets/js/simab-room-media-v16.js','reconnectPeer,dropPeer,stopMedia,get peers(){return peers;},get attempts(){return restartAttempts;},setUp(r,joined=true){latest=r;media=joined;},enableRTC(){window.RTCPeerConnection=function(){};}',{globals:{navigator},setupDOM:({document})=>{document.body.dataset.mode='friends';}});}
test('only lower-numbered seat restarts failed ICE; leaving cancels pending reconnect and closes peer',async()=>{
 const h=media(),room={code:'ABCDEFGH23',viewer:0,members:[{subject:'1'},{subject:'2'}],iceServers:[]};
 h.api.setUp({room});let offers=0,closed=0;
 const pc={connectionState:'failed',signalingState:'stable',setConfiguration(){},async createOffer(options){assert.equal(options.iceRestart,true);offers++;return{};},async setLocalDescription(){this.localDescription={toJSON:()=>({})};},close(){closed++;}};
 h.api.peers.set('2',pc);h.api.reconnectPeer('2',pc);assert.equal(h.timers.size,1);
 h.flush();await new Promise(setImmediate);assert.equal(offers,1);
 h.api.reconnectPeer('2',pc);const queued=[...h.timers.values()][0];
 h.api.stopMedia();assert.equal(h.timers.size,0);queued();await new Promise(setImmediate);
 assert.equal(offers,1,'stale timer cannot create a new offer');assert.equal(closed,1);
 room.viewer=1;h.api.setUp({room});h.api.peers.set('1',pc);
 h.api.reconnectPeer('1',pc);assert.equal(h.timers.size,0,'higher seat must never create competing offers');
});
test('reconnect backoff is limited, and dropping a peer prevents stale retry',async()=>{
 const h=media(),room={code:'ABCDEFGH23',viewer:0,members:[{subject:'1'},{subject:'2'}],iceServers:[]};
 h.api.setUp({room});let count=0;
 const pc={connectionState:'failed',signalingState:'stable',setConfiguration(){},async createOffer(options){count++;return{};},async setLocalDescription(){this.localDescription={toJSON:()=>({})};},close(){}};
 h.api.peers.set('2',pc);
 for(let i=0;i<2;i++){h.api.reconnectPeer('2',pc);assert.equal(h.timers.size,1);h.flush();await new Promise(setImmediate);}
 h.api.reconnectPeer('2',pc);assert.equal(h.timers.size,0,'attempt cap must not queue a third reconnect');
 assert.equal(count,2);
 h.api.dropPeer('2');assert.equal(h.api.peers.size,0);
 assert.equal(h.api.attempts.size,0,'retry counter must be cleaned up');
});
test('microphone denial remains recoverable; late capture after leaving is stopped',async()=>{
 let capture;const h=media({mediaDevices:{getUserMedia:()=>new Promise(resolve=>capture=resolve)}});h.api.enableRTC();
 const room={code:'ABCDEFGH23',viewer:0,status:'waiting',members:[{subject:'1'}]};
 h.api.setUp({room},false);const promise=h.$('voice-join').onclick();let stopped=0;h.api.stopMedia();
 capture({getTracks:()=>[{stop(){stopped++;}}]});await promise;
 assert.equal(stopped,1);assert.equal(h.$('mic-toggle').disabled,true);assert.equal(h.$('voice-join').disabled,false);
 const denied=media({mediaDevices:{getUserMedia:async()=>{const e=Error('denied');e.name='NotAllowedError';throw e;}}});
 denied.api.enableRTC();denied.api.setUp({room},false);await denied.$('voice-join').onclick();
 assert.match(denied.$('media-message').textContent,/اجازهٔ میکروفن/);assert.equal(denied.$('voice-join').disabled,false);
});
