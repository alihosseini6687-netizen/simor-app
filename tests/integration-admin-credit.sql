BEGIN;
DO $test$
DECLARE r jsonb; old_coins bigint; rid uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
BEGIN
  r := public.simab_admin_credit('702007470','801000001',250,rid);
  IF (r->>'coins')::bigint <> 250 OR (r->>'duplicate')::boolean THEN RAISE EXCEPTION 'initial credit failed'; END IF;
  r := public.simab_admin_credit('702007470','801000001',250,rid);
  IF (r->>'coins')::bigint <> 250 OR NOT (r->>'duplicate')::boolean THEN RAISE EXCEPTION 'retry doubled credit'; END IF;
  BEGIN
    PERFORM public.simab_admin_credit('702007470','801000002',250,rid);
    RAISE EXCEPTION 'changed target accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN IF SQLERRM <> 'request_conflict' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.simab_admin_credit('702007470','801000001',251,rid);
    RAISE EXCEPTION 'changed amount accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN IF SQLERRM <> 'request_conflict' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.simab_admin_credit('123','801000001',250,gen_random_uuid());
    RAISE EXCEPTION 'non-admin accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.simab_admin_credit('702007470','801000001',-1,gen_random_uuid());
    RAISE EXCEPTION 'negative amount accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN IF SQLERRM <> 'invalid_credit_amount' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.simab_admin_credit('702007470','801000001',1000000000000,gen_random_uuid());
    RAISE EXCEPTION 'overflow accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN IF SQLERRM <> 'wallet_limit' THEN RAISE; END IF; END;
  IF (SELECT coins FROM public.simab_secure_wallets WHERE telegram_subject='801000001') <> 250 THEN
    RAISE EXCEPTION 'rejected credit changed balance'; END IF;
  IF (SELECT count(*) FROM public.simab_secure_wallet_events WHERE telegram_subject='801000001' AND action='admin_credit') <> 1 THEN
    RAISE EXCEPTION 'incorrect audit count'; END IF;
  IF (SELECT result->>'adminUserId' FROM public.simab_secure_wallet_events WHERE telegram_subject='801000001' AND action='admin_credit') <> '702007470' THEN
    RAISE EXCEPTION 'actor not recorded'; END IF;
  IF has_function_privilege('anon','public.simab_admin_credit(text,text,bigint,uuid)','EXECUTE') OR
     has_function_privilege('authenticated','public.simab_admin_credit(text,text,bigint,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'public privilege leak'; END IF;
END;
$test$;
-- Exercise the actual restricted server role, including wallet initialization.
SET LOCAL ROLE service_role;
SELECT public.simab_admin_credit('702007470','801000003',100,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
RESET ROLE;
ROLLBACK;
