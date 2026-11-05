import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261105_room_idle_refund_v32.sql');
const party=read('supabase/functions/simab-central-quests/party-api.ts');
const poker=read('supabase/functions/simab-central-quests/poker-room-api.ts');
const ui=read('assets/js/simab-room-idle-timer-v32.js');
test('server-owned one minute heartbeat and unconditional waiting room escrow refund',()=>{
 assert.match(sql,/interval '60 seconds'/);
 assert.match(sql,/status='waiting'/);
 assert.match(sql,/FOR UPDATE SKIP LOCKED/);
 assert.match(sql,/room:auto-timeout:/);
 assert.match(sql,/ON CONFLICT \(telegram_subject,event_key\) DO NOTHING/);
 assert.match(sql,/WHERE code=r\.code/);
 assert.match(sql,/DELETE FROM public\.simab_poker_members/);
 assert.match(sql,/simab_room_presence ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON FUNCTION .* FROM PUBLIC,anon,authenticated/);
 assert.ok(!/IF r\.status='playing' THEN[\s\S]*chips=chips/.test(sql),'playing tables are not refunded by idle cron');
});
test('room and poker apply the same heartbeat and cancellation, no credit from client timer',()=>{
 for(const file of [party,poker]){
 assert.match(file,/simab_room_heartbeat/);
 assert.match(file,/simab_expire_waiting_rooms/);
 assert.match(file,/idleExpiresAt/);
 }
 assert.doesNotMatch(ui,/SimabWallet\.mutate|coins\s*\+\+|chips\s*\+\+/);
 for(const p of ['games/room/index.html','games/poker/friends.html']){
  const s=read(p);assert.match(s,/id="room-idle-timer"/);assert.match(s,/simab-room-idle-timer-v32\.js/);
 }
 assert.match(read('assets/js/simab-party-v16.js'),/SimabIdleTimer\?\.update/);
 assert.match(read('assets/js/simab-private-poker-v14.js'),/SimabIdleTimer\?\.update/);
});
