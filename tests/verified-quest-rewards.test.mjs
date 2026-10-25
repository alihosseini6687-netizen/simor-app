import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { Script } from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const edge=read('supabase/functions/simab-central-quests/index.ts');
const sql=read('supabase/migrations/20261012_verified_quest_rewards.sql');
const client=read('assets/js/simab-central-quests.js');
test('TypeScript function and browser client parse',()=>{
  new Script(stripTypeScriptTypes(edge).replace(/^import .*?\n/gm,''));
  new Script(client);
  for(const p of ['quests/index.html','admin/index.html']){
    const html=read(p);
    for(const [,code] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
      new Script(code);
    assert.match(html,/simab-central-quests\.js\?v=(?:7|20261025|10)/);
  }
});
test('only verified Telegram channel can credit a reward',()=>{
  assert.match(edge,/verifyTelegramInitData/);
  assert.match(edge,/verifyTelegramEd25519/);
  assert.match(edge,/getChatMember/);
  assert.match(edge,/member\.status==="restricted"&&member\.is_member===true/);
  assert.match(edge,/OFFICIAL_CHANNEL/);
  assert.match(edge,/q\.verification_mode!=="telegram_membership"/);
  assert.match(edge,/simab_credit_verified_quest/);
  assert.match(edge,/membership_check_unavailable/);
  assert.match(edge,/channel_membership_required/);
});
test('ledger prevents duplicate grants and blocks anonymous DB access',()=>{
  assert.match(sql,/UNIQUE\(telegram_subject,quest_id\)/);
  assert.match(sql,/ON CONFLICT\(telegram_subject,quest_id\) DO NOTHING/);
  assert.match(sql,/IF COALESCE\(v_created,FALSE\) THEN/);
  assert.match(sql,/coins=b\.coins\+EXCLUDED\.coins/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/g);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.simab_credit_verified_quest/);
  assert.match(sql,/TO service_role/);
});
test('client never pretends local coins equal confirmed server rewards',()=>{
  assert.match(client,/verifiedCoins/);
  assert.match(client,/alreadyClaimed|claimedIds/);
  assert.match(client,/claim\.disabled=true/);
  assert.match(client,/برای استفاده به کیف پول سروری برو/);
  assert.doesNotMatch(client,/localStorage\.setItem\([^\n]*verifiedCoins/);
});
