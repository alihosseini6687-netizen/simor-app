-- Run with psql -v ON_ERROR_STOP=1 after all SIMAB migrations.
DO $test$
DECLARE
  q uuid;
  p jsonb;
  again jsonb;
  req uuid;
  credit record;
  c bigint;
  ch bigint;
  generated_reels jsonb;
BEGIN
  INSERT INTO public.simab_central_quests(title,url,reward_coins,verification_mode)
    VALUES('Secure channel','https://t.me/SimorApp',3,'telegram_membership')
    RETURNING id INTO q;
  SELECT * INTO credit FROM public.simab_credit_verified_quest('10000001',q);
  IF NOT credit.granted OR credit.verified_coins<>3 THEN
    RAISE EXCEPTION 'quest credit did not create secure wallet: %',credit; END IF;
  SELECT * INTO credit FROM public.simab_credit_verified_quest('10000001',q);
  IF credit.granted OR credit.verified_coins<>3 THEN
    RAISE EXCEPTION 'quest double credited: %',credit; END IF;

  req:=pg_catalog.gen_random_uuid();
  p:=public.simab_secure_wallet_action('10000001','daily',0,req);
  IF p->>'coins'<>'4' OR p->>'rewardCoins'<>'1' THEN RAISE EXCEPTION 'daily failed: %',p; END IF;
  again:=public.simab_secure_wallet_action('10000001','daily',0,req);
  IF again->>'duplicate'<>'true' OR again->>'coins'<>'4' THEN RAISE EXCEPTION 'retry double credit: %',again; END IF;
  p:=public.simab_secure_wallet_action('10000001','daily',0,pg_catalog.gen_random_uuid());
  IF p->'result'->>'alreadyClaimed'<>'true' OR p->>'applied'<>'false' THEN
    RAISE EXCEPTION 'daily limit failed: %',p; END IF;
  p:=public.simab_secure_wallet_action('10000001','wheel',0,pg_catalog.gen_random_uuid());
  IF (p->>'rewardCoins')::integer NOT BETWEEN 0 AND 10 THEN RAISE EXCEPTION 'wheel bounds: %',p; END IF;
  p:=public.simab_secure_wallet_action('10000001','wheel',0,pg_catalog.gen_random_uuid());
  IF p->'result'->>'alreadySpun'<>'true' THEN RAISE EXCEPTION 'wheel repeated: %',p; END IF;

  p:=public.simab_secure_wallet_action('10000001','miner_start',0,pg_catalog.gen_random_uuid());
  IF p->>'minerReadyAt' IS NULL THEN RAISE EXCEPTION 'miner did not start: %',p; END IF;
  p:=public.simab_secure_wallet_action('10000001','miner_claim',0,pg_catalog.gen_random_uuid());
  IF p->'result'->>'minerNotReady'<>'true' THEN RAISE EXCEPTION 'early mining payout: %',p; END IF;
  UPDATE public.simab_secure_wallets SET miner_ready_at=now()-interval '1 second'
    WHERE telegram_subject='10000001';
  req:=pg_catalog.gen_random_uuid();
  p:=public.simab_secure_wallet_action('10000001','miner_claim',0,req);
  IF p->>'rewardCoins'<>'4' THEN RAISE EXCEPTION 'mining payout failed: %',p; END IF;
  again:=public.simab_secure_wallet_action('10000001','miner_claim',0,req);
  IF again->>'duplicate'<>'true' THEN RAISE EXCEPTION 'mining repeated: %',again; END IF;

  p:=public.simab_secure_wallet_action('10000001','exchange_to_chips',2,pg_catalog.gen_random_uuid());
  IF p->>'chipDelta'<>'2' THEN RAISE EXCEPTION 'exchange failed: %',p; END IF;
  p:=public.simab_secure_wallet_action('10000001','slot',2,pg_catalog.gen_random_uuid());
  generated_reels:=p->'result'->'reels';
  IF jsonb_array_length(generated_reels)<>3 THEN RAISE EXCEPTION 'RNG missing: %',p; END IF;
  IF (p->'result'->>'payout')::integer NOT IN (0,4,16) THEN
    RAISE EXCEPTION 'invalid slot payout: %',p; END IF;
  -- Ensure a second separate spin cannot be spammed within the same 2-second window.
  PERFORM public.simab_secure_wallet_action('10000001','exchange_to_chips',1,pg_catalog.gen_random_uuid());
  BEGIN
    PERFORM public.simab_secure_wallet_action('10000001','slot',1,pg_catalog.gen_random_uuid());
    RAISE EXCEPTION 'slot_cooldown missing';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM<>'slot_cooldown' THEN RAISE; END IF;
  END;
  SELECT coins,chips INTO c,ch FROM public.simab_secure_wallets WHERE telegram_subject='10000001';
  IF c<0 OR ch<0 THEN RAISE EXCEPTION 'negative wallet after slot'; END IF;

  -- Never credit a forged local balance for a different subject.
  INSERT INTO public.simab_verified_quest_balances(telegram_subject,coins)
    VALUES('10000002',6) ON CONFLICT DO NOTHING;
  p:=public.simab_secure_wallet_action('10000002','state',0,NULL);
  IF p->>'coins'<>'6' OR p->>'chips'<>'0' THEN RAISE EXCEPTION 'verified migration failed: %',p; END IF;
  IF (SELECT count(*) FROM public.simab_secure_wallet_events e WHERE
      e.telegram_subject='10000002' AND e.action='opening_verified_quests')<>1 THEN
    RAISE EXCEPTION 'missing opening ledger credit'; END IF;
  p:=public.simab_secure_wallet_action('10000003','state',0,NULL);
  IF p->>'coins'<>'0' THEN RAISE EXCEPTION 'unverified user credited: %',p; END IF;

  IF has_function_privilege('anon','public.simab_secure_wallet_action(text,text,integer,uuid)','EXECUTE') OR
     has_function_privilege('authenticated','public.simab_secure_wallet_action(text,text,integer,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'unauthenticated roles can execute wallet RPC'; END IF;
  IF has_table_privilege('anon','public.simab_secure_wallets','SELECT') OR
     has_table_privilege('authenticated','public.simab_secure_wallet_events','INSERT') THEN
    RAISE EXCEPTION 'RLS table exposed to client'; END IF;
END
$test$;
