import test from 'node:test';
import assert from 'node:assert/strict';
import {uiHarness} from './support/ui-harness.mjs';

const harness=()=>uiHarness(
 'assets/js/simab-room-media-v16.js',
 'resumeNetwork,reconnectPeer,stopMedia,get attempts(){return restartAttempts;},get peers(){return peers;},setUp(r,joined=true){latest=r;media=joined;}',
 {setupDOM:({document})=>{document.body.dataset.mode='friends';}}
);
test('online return reopens exhausted ICE restart budget without additional microphone capture',async()=>{
 const h=harness();
 h.api.setUp({room:{code:'ABCDEFGH23',status:'waiting',viewer:0,members:[{subject:'1'},{subject:'2'}],iceServers:[]}});
 let offers=0;
 const pc={
  connectionState:'failed',signalingState:'stable',
  setConfiguration(){},async createOffer(o){assert.equal(o.iceRestart,true);offers++;return{};},
  async setLocalDescription(){this.localDescription={toJSON:()=>({})};},close(){}
 };
 h.api.peers.set('2',pc);
 for(let k=0;k<2;k++){h.api.reconnectPeer('2',pc);h.flush();await new Promise(setImmediate);}
 assert.equal(offers,2);
 h.api.reconnectPeer('2',pc);assert.equal(h.timers.size,0,'automatic budget stops at two retries');
 h.api.resumeNetwork();assert.equal(h.timers.size,1,'network return retries again');
 h.flush();await new Promise(setImmediate);
 assert.equal(offers,3);
 h.api.stopMedia();h.api.resumeNetwork();
 assert.equal(h.timers.size,0,'leaving cancels any late network events');
});
test('offline higher seat does not create glare even after an online event',async()=>{
 const h=harness();
 h.api.setUp({room:{code:'ABCDEFGH23',status:'waiting',viewer:1,members:[{subject:'1'},{subject:'2'}],iceServers:[]}});
 h.api.peers.set('1',{connectionState:'failed'});
 h.api.resumeNetwork();
 assert.equal(h.timers.size,0,'only lower seat initiates offers');
});
