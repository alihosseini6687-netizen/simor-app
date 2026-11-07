-- Exercised with real PostgreSQL in a rollback-only transaction: no real coins.
BEGIN;
DO $test$
DECLARE subject text:='900000000505';rid uuid:='a98c581b-7a4d-4b71-bf1d-940000000034';r jsonb;spent bigint;n integer;
BEGIN
 PERFORM public.simab_secure_wallet_action(subject,'state',0,NULL);
 UPDATE public.simab_secure_wallets SET coins=100,chips=100 WHERE telegram_subject=subject;
 r:=public.simab_ai_activate(subject,'mini',rid);
 IF r->>'free'<>'true' OR (SELECT coins FROM public.simab_secure_wallets WHERE telegram_subject=subject)<>100
 THEN RAISE EXCEPTION 'free AI mode charged coins';END IF;
 UPDATE public.simab_ai_settings SET free_mode=false WHERE singleton;
 r:=public.simab_ai_activate(subject,'mini',rid);
 IF r->>'active'<>'true' OR (r->>'paidCoins')::integer<>10 OR (SELECT coins FROM public.simab_secure_wallets WHERE telegram_subject=subject)<>90
 THEN RAISE EXCEPTION 'paid activation not atomic';END IF;
 r:=public.simab_ai_activate(subject,'mini',rid);
 IF r->>'duplicate'<>'true' OR (SELECT coins FROM public.simab_secure_wallets WHERE telegram_subject=subject)<>90
 THEN RAISE EXCEPTION 'paid retry charged twice';END IF;
 r:=public.simab_ai_activate(subject,'plus','cd9b452c-6cc5-4fd0-bf21-940000000034');
 IF r->>'alreadyActive'<>'true' OR (SELECT coins FROM public.simab_secure_wallets WHERE telegram_subject=subject)<>90
 THEN RAISE EXCEPTION 'active pass charged again';END IF;
 SELECT count(*) INTO n FROM public.simab_secure_wallet_events WHERE telegram_subject=subject AND action='ai_studio_access';
 IF n<>1 THEN RAISE EXCEPTION 'not exactly one AI ledger event';END IF;
 BEGIN
  PERFORM public.simab_ai_activate(subject,'plus',rid);
  RAISE EXCEPTION 'conflicting retry was accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'request_conflict' THEN RAISE;END IF;
 END;
 UPDATE public.simab_ai_access_passes SET expires_at=now()-interval '5 minutes' WHERE telegram_subject=subject;
 UPDATE public.simab_secure_wallets SET coins=0 WHERE telegram_subject=subject;
 BEGIN
  PERFORM public.simab_ai_activate(subject,'plus','d283cb37-e80e-4c41-bf81-940000000034');
  RAISE EXCEPTION 'unfunded activation accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'insufficient_coins' THEN RAISE;END IF;
 END;
 IF (SELECT count(*) FROM public.simab_ai_access_passes WHERE telegram_subject=subject)<>1
 THEN RAISE EXCEPTION 'failed charge created pass';END IF;
 IF has_table_privilege('anon','public.simab_ai_settings','select')
 OR has_table_privilege('authenticated','public.simab_ai_access_passes','select')
 OR has_function_privilege('anon','public.simab_ai_activate(text,text,uuid)','execute')
 THEN RAISE EXCEPTION 'AI settings/ledger publicly exposed';END IF;
 UPDATE public.simab_ai_settings SET free_mode=true,archive_enabled=true,archive_channel_id='-1001234567890' WHERE singleton;
 r:=public.simab_ai_archive_claim(subject,'e7358ffb-d4ea-4554-8777-940000000034');
 IF r->>'reserved'<>'true' THEN RAISE EXCEPTION 'archive first claim not reserved';END IF;
 r:=public.simab_ai_archive_claim(subject,'e7358ffb-d4ea-4554-8777-940000000034');
 IF r->>'reserved'<>'false' THEN RAISE EXCEPTION 'archive duplicate claimed again';END IF;
 BEGIN
  PERFORM public.simab_ai_archive_claim(subject,'f7358ffb-d4ea-4554-8777-940000000034');
  RAISE EXCEPTION 'archive rate throttle bypassed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'archive_rate_limited' THEN RAISE;END IF;
 END;
END;$test$;
ROLLBACK;
