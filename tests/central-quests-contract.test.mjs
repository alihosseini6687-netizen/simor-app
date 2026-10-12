import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const client = read('assets/js/simab-central-quests.js');
const admin = read('admin/index.html');
const quests = read('quests/index.html');
const edge = read('supabase/functions/simab-central-quests/index.ts');
const sql = read('supabase/migrations/20261012_central_quests_admins.sql');

test('client and both affected pages have parseable JS', () => {
  new Script(client, { filename: 'simab-central-quests.js' });
  for (const [html, name] of [[admin,'admin'],[quests,'quests']]) {
    for (const [,source] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
      new Script(source, { filename: name + '.inline.js' });
    assert.match(html, /src="\.\.\/assets\/js\/simab-central-quests\.js\?v=\d+"/);
  }
});
test('site edits cannot claim server-confirmed rewards locally', () => {
  assert.doesNotMatch(quests, /claimedQuests\.push\(qKey\)/);
  assert.doesNotMatch(quests, /balance\s*=\s*parseFloat\(\(balance\s*\+\s*q\.reward/);
  assert.doesNotMatch(admin, /tasks1\.push\(newTask\)/);
  assert.match(client, /rewardAvailable:\s*false|rewardsEnabled: false|پاداش پیشنهادی/);
});
test('Telegram HMAC verification and database admin lookup precede writes', () => {
  const auth = edge.indexOf('verifyTelegramInitData(payload.initData');
  const permission = edge.indexOf('db.from("simab_admins")');
  const write = edge.indexOf('.insert({');
  assert.ok(auth >= 0 && permission > auth && write > permission);
  assert.match(edge, /constantTimeMatch/);
  assert.match(edge, /telegram_auth_failed/);
  assert.match(edge, /admin_only/);
  assert.match(edge, /channel_not_configured/);
});
test('central tables deny direct browser access and enable RLS', () => {
  assert.match(sql, /ALTER TABLE public\.simab_admins ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /ALTER TABLE public\.simab_central_quests ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.simab_admins, public\.simab_central_quests/);
  assert.match(sql, /TO service_role/);
});

test('admin status and drafts are present; no secret is exposed', () => {
  assert.match(client,/simabCheckMissionsConnection/);
  assert.match(client,/simabSaveQuestDraft/);
  assert.match(client,/botMatchesExpected/);
  assert.match(admin,/id="quest-server-status"/);
  assert.match(admin,/id="quest-drafts-list"/);
  assert.match(edge,/botPublicName/);
  assert.match(edge,/payload.action === "ping"/);
  assert.match(edge,/signature_mismatch/);
});
test('locally claimed mission flags are not used as auth evidence', () => {
  assert.doesNotMatch(quests,/simab_quests_claimed_/);
  assert.doesNotMatch(quests,/claimedQuests.includes/);
});
