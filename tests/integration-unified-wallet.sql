BEGIN;
DO $test$
DECLARE r jsonb; again jsonb; game_id uuid:=gen_random_uuid(); request_id uuid:=gen_random_uuid(); request2 uuid:=gen_random_uuid();
BEGIN
 PERFORM public.simab_admin_credit('702007470','801000010',1000,gen_random_uuid());
 r:=public.simab_wallet_action_v2('801000010','exchange_to_chips',100,request_id);
 IF (r->>'coins')::bigint<>900 OR (r->>'chips')::bigint<>100 THEN RAISE EXCEPTION 'exchange did not debit coins';END IF;
 again:=public.simab_wallet_action_v2('801000010','exchange_to_chips',100,request_id);
 IF (again->>'coins')::bigint<>900 OR NOT (again->>'duplicate')::boolean THEN RAISE EXCEPTION 'duplicate charged again';END IF;
 BEGIN
  PERFORM public.simab_wallet_action_v2('801000010','exchange_to_coins',100,request_id);
  RAISE EXCEPTION 'changed request accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'request_conflict' THEN RAISE; END IF;END;
 r:=public.simab_game_commit('801000010','poker',request2,'poker:start:test',game_id,-1,'{}','{"kind":"poker"}',50,0,false);
 IF (r->'wallet'->>'chips')::bigint<>50 THEN RAISE EXCEPTION 'buy-in not debited';END IF;
 again:=public.simab_game_commit('801000010','poker',request2,'poker:start:test',game_id,-1,'{}','{"kind":"poker"}',50,0,false);
 IF (again->'wallet'->>'chips')::bigint<>50 OR NOT (again->>'duplicate')::boolean THEN RAISE EXCEPTION 'buy-in retry charged again';END IF;
 BEGIN
  PERFORM public.simab_game_commit('801000010','poker',gen_random_uuid(),'poker:another',gen_random_uuid(),-1,'{}','{}',50,0,false);
  RAISE EXCEPTION 'multiple active sessions accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'active_game_exists' THEN RAISE;END IF;END;
 BEGIN
  PERFORM public.simab_game_commit('801000010','poker',gen_random_uuid(),'poker:stale',game_id,0,'{}','{}',0,50,true);
  RAISE EXCEPTION 'stale session accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'stale_game' THEN RAISE;END IF;END;
 request2:=gen_random_uuid();
 r:=public.simab_game_commit('801000010','poker',request2,'poker:finish',game_id,1,'{}','{"kind":"poker","finished":true}',0,45,true);
 IF (r->'wallet'->>'chips')::bigint<>95 THEN RAISE EXCEPTION 'remaining chips not returned';END IF;
 again:=public.simab_game_commit('801000010','poker',request2,'poker:finish',game_id,1,'{}','{}',0,45,true);
 IF (again->'wallet'->>'chips')::bigint<>95 THEN RAISE EXCEPTION 'duplicate settlement';END IF;
 IF (SELECT sum(chip_delta) FROM public.simab_secure_wallet_events WHERE telegram_subject='801000010')<>95 THEN RAISE EXCEPTION 'ledger does not reconcile';END IF;
 r:=public.simab_wallet_action_v2('801000010','miner_upgrade',1,gen_random_uuid());
 IF (r->>'coins')::bigint<>850 OR (r->>'minerTier')::int<>1 THEN RAISE EXCEPTION 'miner purchase failed';END IF;
 UPDATE public.simab_secure_wallets SET miner_cycle_started=now()-interval '24 hours' WHERE telegram_subject='801000010';
 request_id:=gen_random_uuid();r:=public.simab_wallet_action_v2('801000010','miner_collect',0,request_id);
 IF (r->>'rewardCoins')::int<>30 OR (r->>'coins')::bigint<>880 THEN RAISE EXCEPTION 'miner claim failed';END IF;
 r:=public.simab_wallet_action_v2('801000010','miner_collect',0,request_id);
 IF (r->>'coins')::bigint<>880 OR (r->>'minerTank')::int<>90 THEN RAISE EXCEPTION 'miner double credited';END IF;
 IF has_table_privilege('anon','public.simab_game_sessions','select') OR has_table_privilege('authenticated','public.simab_financial_requests','select') OR
 has_function_privilege('anon','public.simab_game_commit(text,text,uuid,text,uuid,integer,jsonb,jsonb,bigint,bigint,boolean)','execute') THEN RAISE EXCEPTION 'public access to hidden game state';END IF;
END;
$test$;
SET LOCAL ROLE service_role;
SELECT public.simab_wallet_action_v2('801000010','daily',0,gen_random_uuid());
RESET ROLE;
ROLLBACK;
