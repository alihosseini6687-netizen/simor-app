import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {roomIceServers} from '../supabase/functions/simab-central-quests/ice-config.ts';

test('TURN is opt-in; invalid or missing secrets retain STUN-only',async()=>{
 for(const data of [{},{SIMAB_TURN_URLS:'turn:relay.example:3478'},{SIMAB_TURN_URLS:'http://relay.example:3478',SIMAB_TURN_SECRET:'x'.repeat(32)},{SIMAB_TURN_URLS:'turn:user@relay.example:3478',SIMAB_TURN_SECRET:'x'.repeat(32)}]){
  const servers=await roomIceServers(key=>data[key],0);
  assert.deepEqual(servers,[{urls:'stun:stun.l.google.com:19302'}]);
 }
});
test('TURN credentials use ten-minute HMAC with per-request nonce, without exposing secret',async()=>{
 const config={SIMAB_TURN_URLS:'turn:relay.example:3478?transport=udp,turns:relay.example:5349?transport=tcp',SIMAB_TURN_SECRET:'synthetic-unit-test-secret-32-characters'};
 const read=k=>config[k];
 const a=await roomIceServers(read,1000000),b=await roomIceServers(read,1000000);
 assert.equal(a.length,2);
 assert.equal(a[1].urls.length,2);
 assert.ok(a[1].username.startsWith('1600:simab:'));
 assert.notEqual(a[1].username,b[1].username);
 assert.equal(a[1].credential,createHmac('sha1',config.SIMAB_TURN_SECRET).update(a[1].username).digest('base64'));
 assert.ok(!JSON.stringify(a).includes(config.SIMAB_TURN_SECRET));
});
