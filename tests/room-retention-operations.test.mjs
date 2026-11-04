import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const operation=readFileSync(new URL('../supabase/operations/20261104_room_messages_retention.sql', import.meta.url),'utf8');
test('SIMAB room-message expiry is scoped, recurring, and not in auto-run migrations',()=>{
 assert.match(operation,/CREATE EXTENSION IF NOT EXISTS pg_cron/);
 assert.match(operation,/simab-expire-room-messages-30-days/);
 assert.match(operation,/'5 \* \* \* \*'/);
 assert.match(operation,/DELETE FROM public\.simab_room_messages WHERE created_at < NOW\(\) - INTERVAL '30 days'/);
 assert.doesNotMatch(operation,/(?:DELETE|UPDATE|TRUNCATE) FROM public\.simab_secure_wallets/i);
 assert.match(operation,/cron\.unschedule/);
});
