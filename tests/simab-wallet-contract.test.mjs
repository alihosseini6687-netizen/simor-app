import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const edge=read('supabase/functions/simab-central-quests/index.ts');
const ui=read('assets/js/simab-wallet-client.js');
const sql=read('supabase/migrations/20261013_secure_wallet_games.sql');

test('all changed JS parses, Edge compiles after stripping Deno types',()=>{
  new Script(ui);
  new Script(stripTypeScriptTypes(edge).replace(/^import .*?\n/gm,''));
  const html=read('wallet/index.html');
  assert.match(html,/src="\.\.\/assets\/js\/simab-secure-wallet\.js\?v=13"/);
  for(const [,code] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Script(code);
});
test('Telegram auth and server-side wallet action never trust browser user or RNG',()=>{
  assert.match(edge,/verifyTelegramInitData\(payload\.initData/);
  assert.match(edge,/payload\.action === "wallet"/);
  assert.match(edge,/p_subject:subject,p_action:walletAction/);
  assert.match(edge,/p_request_id:mutating\?requestId:null/);
  assert.doesNotMatch(edge,/p_balance|p_balance_coins|p_client_outcome/);
  assert.match(edge,/Number\.isSafeInteger\(amount\)/);
  assert.match(edge,/payload\.action === "wallet_history"/);
  assert.match(edge,/\.eq\("telegram_subject",subject\)/);
});
test('PostgreSQL enforces server RNG, idempotency, positive-only and RLS',()=>{
  assert.match(sql,/FOR UPDATE/);
  assert.match(sql,/pg_catalog\.gen_random_uuid\(\)/);
  assert.match(sql,/UNIQUE \(telegram_subject,request_id\)/);
  assert.match(sql,/UNIQUE \(telegram_subject,event_key\)/);
  assert.match(sql,/coins BETWEEN 0 AND 1000000000000/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.simab_secure_wallet_action/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.simab_secure_wallet_action/);
  assert.match(sql,/IF w\.daily_date=v_today/);
  assert.match(sql,/IF w\.wheel_date=v_today/);
  assert.match(sql,/IF w\.miner_ready_at IS NULL OR w\.miner_ready_at>v_now/);
  assert.match(sql,/p_action='slot'/);
  assert.match(sql,/v_chips:=v_reward-p_amount/);
  assert.match(sql,/UPDATE public\.simab_secure_wallets SET coins=coins\+v_reward/);
});
test('new server wallet must not import, spend or mirror legacy CloudStorage balances',()=>{
  assert.doesNotMatch(ui,/localStorage\.getItem\(\s*['"]simor_coins_/);
  assert.doesNotMatch(ui,/CloudStorage\.(?:getItem|setItem)/);
  assert.doesNotMatch(ui,/Math\.random/);
  assert.match(ui,/simab_financial_pending_v2/);
  assert.match(ui,/requestId:requestId\(\)/);
  assert.match(sql,/simab_verified_quest_balances/);
  for(const path of ['index.html','games/poker/index.html','games/backgammon/index.html','games/slot/index.html','games/wheel/index.html','games/tap/index.html','streak/index.html','swap/index.html','quests/index.html']){
    assert.match(read(path),/simab-wallet-client\.js\?v=13/,path);
    assert.doesNotMatch(read(path),/simor_coins_|simab_chips_/);
  }
});
test('free miner claims after start; paid miner is separate and charged on server',()=>{
 const controller=read('assets/js/simab-secure-wallet.js');
 assert.match(controller,/running\?'miner_claim':'miner_start'/);
 assert.match(read('supabase/migrations/20261025081053_unified_wallet_game_sessions.sql'),/coins=coins-cost/);
});
test('wallet controller persists the full original request before sending and reuses it on recovery',()=>{
 assert.match(ui,/localStorage.setItem\(pendingKey,JSON.stringify\(request\)\)/);
 assert.match(ui,/api\(pending\)/);assert.match(ui,/if\(pending\)throw Error/);
});
