import test from 'node:test';
import assert from 'node:assert/strict';
import {readSource} from './support/source.mjs';
const migration=readSource(new URL('../supabase/migrations/20261028090000_wallet_unbiased_random.sql',import.meta.url));
const old=readSource(new URL('../supabase/migrations/20261025081053_unified_wallet_game_sessions.sql',import.meta.url));
test('forward RNG repair changes exactly four guarded assignments, not payout or daily policy',()=>{
  const wheel='v_rand:=v_rand % 100;';
  assert.equal(old.split(wheel).length-1,1);
  for(const reel of ['v_a','v_b','v_c'])assert.equal(old.split(reel+':=pg_catalog.get_byte(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()),0)%6;').length-1,1);
  assert.match(migration,/unexpected_wallet_wheel_definition/);assert.match(migration,/unexpected_wallet_slot_definition/);
  assert.match(migration,/public.simab_random_below\(100\)/);assert.match(migration,/public.simab_random_below\(6\)/);
  assert.doesNotMatch(migration,/UPDATE public.simab_secure_wallets|v_reward:=|wheel_date:=|daily_date:=/);
  assert.match(migration,/REVOKE ALL[\s\S]*FROM PUBLIC,anon,authenticated/);
});
test('32-bit rejection boundaries for six symbols and 100 weighted tickets have equal accepted residue counts',()=>{
  assert.match(migration,/4294967296::bigint - \(4294967296::bigint % p_bound\)/);
  assert.match(migration,/IF value < cutoff THEN RETURN \(value % p_bound\)::integer/);
  for(const n of [6,100]){
    const cutoff=2**32-(2**32%n);let reads=0;
    const samples=[2**32-1,cutoff,cutoff-1];
    const sample=()=>{for(;;){const x=samples[reads++];if(x<cutoff)return x%n;}};
    assert.equal(sample(),n-1);assert.equal(reads,3);
    for(let residue=0;residue<n;residue++)assert.equal(Math.floor((cutoff-1-residue)/n)+1,cutoff/n);
  }
});
test('daily wheel UI describes authoritative unequal weights rather than equal visual sectors',()=>{
  const ui=readSource(new URL('../games/tap/index.html',import.meta.url));
  for(const s of ['0 coins 30%','1 coin 35%','2 coins 20%','5 coins 12%','10 coins 3%','not equal odds','not Roulette'])assert.ok(ui.includes(s));
  const rewards=Array.from({length:100},(_,r)=>r<30?0:r<65?1:r<85?2:r<97?5:10);
  assert.deepEqual([0,1,2,5,10].map(p=>rewards.filter(x=>x===p).length),[30,35,20,12,3]);
  assert.match(old,/v_rand<30[\s\S]*v_rand<65[\s\S]*v_rand<85[\s\S]*v_rand<97/);
});
