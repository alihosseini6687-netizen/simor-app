import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=file('index.html'),friends=file('friends/index.html');
const sql=file('supabase/migrations/20261104_mango_referrals_v31.sql');
const edge=file('supabase/functions/simab-central-quests/index.ts');
const api=file('supabase/functions/simab-central-quests/referral-api.ts');
const shop=file('supabase/functions/simab-central-quests/shop.ts');
const admin=file('assets/js/simab-shop-admin-v15.js');
test('gift links redirect to the existing server offer flow, not mutable local balances',()=>{
 assert.match(home,/\^gift_\(\[a-f0-9\]\{32\}\)\$/);
 assert.match(home,/offers\/index\.html\?code=/);
 assert.match(admin,/startapp=gift_/);
 assert.match(shop,/gift_\[a-f0-9\]\{32\}/);
 assert.doesNotMatch(home,/let currentInvites|simab_ref_count_/);
});
test('referral invites use signed Telegram identity and wallet RPC, never URL-minted coins',()=>{
 assert.match(edge,/import \{referralAPI\}/);
 assert.match(edge,/payload\.action === 'referral_claim'/);
 assert.match(api,/simab_referral_claim/);
 assert.match(home,/SimabWallet\.mutate\('referral_claim'/);
 assert.match(friends,/SimabWallet\.read\('referral_info'/);
 assert.match(friends,/startapp=r_/);
 assert.match(shop,/r_\[a-f0-9\]\{32\}/);
});
test('referral SQL enforces one invitee, never self, same-transaction wallet and ledger',()=>{
 for(const snippet of ['PRIMARY KEY REFERENCES public.simab_secure_wallets','PRIMARY KEY REFERENCES public.simab_secure_wallets','simab_referral_no_self','FOR UPDATE','existing_account','referral_daily_limit','simab_secure_wallet_events','SECURITY INVOKER','REVOKE ALL ON FUNCTION','GRANT EXECUTE ON FUNCTION'])assert.ok(sql.includes(snippet),snippet);
 assert.match(sql,/simab_referral_claims/);
 assert.match(sql,/daily_limit integer NOT NULL DEFAULT 5/);
 assert.match(sql,/inviter_reward integer NOT NULL DEFAULT 50/);
 assert.match(sql,/invitee_reward integer NOT NULL DEFAULT 50/);
 assert.doesNotMatch(sql,/GRANT EXECUTE.* TO anon/);
});
