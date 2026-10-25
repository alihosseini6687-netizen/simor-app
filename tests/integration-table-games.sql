BEGIN;
DO $test$
DECLARE r jsonb; again jsonb; rid uuid:=gen_random_uuid(); gid uuid:=gen_random_uuid(); g text;
BEGIN
 PERFORM public.simab_admin_credit('702007470','801000013',1000,gen_random_uuid());
 PERFORM public.simab_wallet_action_v2('801000013','exchange_to_chips',1000,gen_random_uuid());
 FOREACH g IN ARRAY ARRAY['hokm','ludo'] LOOP
  gid:=gen_random_uuid();rid:=gen_random_uuid();
  r:=public.simab_game_commit('801000013',g,rid,g||':start',gid,-1,'{}','{}',20,0,false);
  again:=public.simab_game_commit('801000013',g,rid,g||':start',gid,-1,'{}','{}',20,0,false);
  IF r->'wallet'->>'chips'<>again->'wallet'->>'chips' THEN RAISE EXCEPTION 'new game duplicate debit';END IF;
  BEGIN
   PERFORM public.simab_game_commit('801000013',g,gen_random_uuid(),g||':bad-extra',gid,1,'{}','{}',10,0,false);
   RAISE EXCEPTION 'non-blackjack additional stake accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_amount' THEN RAISE; END IF;END;
  r:=public.simab_game_commit('801000013',g,gen_random_uuid(),g||':finish',gid,1,'{}','{}',0,40,true);
 END LOOP;
 gid:=gen_random_uuid();
 r:=public.simab_game_commit('801000013','blackjack',gen_random_uuid(),'bj:start',gid,-1,'{"committed":20}','{}',20,0,false);
 rid:=gen_random_uuid();
 r:=public.simab_game_commit('801000013','blackjack',rid,'bj:split',gid,1,'{"committed":40}','{}',20,0,false);
 again:=public.simab_game_commit('801000013','blackjack',rid,'bj:split',gid,1,'{"committed":40}','{}',20,0,false);
 IF r->'wallet'->>'chips'<>again->'wallet'->>'chips' THEN RAISE EXCEPTION 'split debited twice';END IF;
 BEGIN
  PERFORM public.simab_game_commit('801000013','blackjack',gen_random_uuid(),'bj:wrong',gid,2,'{"committed":80}','{}',20,0,false);
  RAISE EXCEPTION 'unmatched additional wager accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_amount' THEN RAISE;END IF;END;
 r:=public.simab_game_commit('801000013','blackjack',gen_random_uuid(),'bj:finish',gid,2,'{"committed":40}','{}',0,80,true);
 IF (r->'wallet'->>'chips')::bigint<>1080 THEN RAISE EXCEPTION 'new-game ledger balance wrong';END IF;
 IF (SELECT sum(chip_delta) FROM public.simab_secure_wallet_events WHERE telegram_subject='801000013')<>1080 THEN RAISE EXCEPTION 'new-game ledger mismatch';END IF;
 IF has_function_privilege('anon','public.simab_game_commit(text,text,uuid,text,uuid,integer,jsonb,jsonb,bigint,bigint,boolean)','EXECUTE') OR
 has_function_privilege('authenticated','public.simab_game_commit(text,text,uuid,text,uuid,integer,jsonb,jsonb,bigint,bigint,boolean)','EXECUTE') THEN RAISE EXCEPTION 'public financial access granted';END IF;
END $test$;
ROLLBACK;
