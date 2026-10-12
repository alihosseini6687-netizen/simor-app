-- SIMAB secure beta wallet, one auditable source of truth.
-- Apply AFTER 20261012_verified_quest_rewards.sql.
-- IMPORTANT: Existing localStorage and Telegram CloudStorage coins are UNTRUSTED
-- and are NOT imported. Already verified channel rewards ARE imported once.
BEGIN;
CREATE TABLE IF NOT EXISTS public.simab_secure_wallets (
  telegram_subject text PRIMARY KEY CHECK (telegram_subject ~ '^[0-9]{1,20}$'),
  coins bigint NOT NULL DEFAULT 0 CHECK (coins BETWEEN 0 AND 1000000000000),
  chips bigint NOT NULL DEFAULT 0 CHECK (chips BETWEEN 0 AND 1000000000000),
  streak_day smallint NOT NULL DEFAULT 0 CHECK (streak_day BETWEEN 0 AND 7),
  daily_date date,
  wheel_date date,
  miner_ready_at timestamptz,
  last_slot_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.simab_secure_wallet_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_subject text NOT NULL REFERENCES public.simab_secure_wallets(telegram_subject) ON DELETE RESTRICT,
  event_key text NOT NULL CHECK (char_length(event_key) BETWEEN 3 AND 120),
  action text NOT NULL CHECK (char_length(action) BETWEEN 2 AND 40),
  request_id uuid,
  coin_delta bigint NOT NULL DEFAULT 0,
  chip_delta bigint NOT NULL DEFAULT 0,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (telegram_subject,event_key),
  UNIQUE (telegram_subject,request_id)
);
CREATE INDEX IF NOT EXISTS simab_secure_wallet_events_latest_idx
  ON public.simab_secure_wallet_events(telegram_subject,created_at DESC);
ALTER TABLE public.simab_secure_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simab_secure_wallet_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.simab_secure_wallets, public.simab_secure_wallet_events FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.simab_secure_wallets TO service_role;
GRANT SELECT,INSERT ON public.simab_secure_wallet_events TO service_role;

CREATE OR REPLACE FUNCTION public.simab_secure_wallet_action(
  p_subject text, p_action text, p_amount integer DEFAULT 0, p_request_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE
  w public.simab_secure_wallets%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_now timestamptz := now();
  v_prev jsonb;
  v_seeded boolean := false;
  v_bytes bytea;
  v_key text := '';
  v_coin bigint := 0;
  v_chips bigint := 0;
  v_outcome jsonb := '{}'::jsonb;
  v_reward integer := 0;
  v_rand bigint;
  v_a integer;
  v_b integer;
  v_c integer;
  v_done boolean := false;
  v_result jsonb;
BEGIN
  IF p_subject IS NULL OR p_subject !~ '^[0-9]{1,20}$' THEN
    RAISE EXCEPTION 'invalid_subject' USING ERRCODE='22023';
  END IF;
  IF p_action NOT IN ('state','daily','wheel','miner_start','miner_claim',
                      'exchange_to_chips','exchange_to_coins','slot') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023';
  END IF;
  IF p_action <> 'state' AND p_request_id IS NULL THEN
    RAISE EXCEPTION 'missing_request_id' USING ERRCODE='22023';
  END IF;
  -- Existing signed, verified quest credits are the ONLY opening credit.
  -- Never import browser/local Telegram CloudStorage values.
  INSERT INTO public.simab_secure_wallets(telegram_subject,coins)
  SELECT p_subject,COALESCE((SELECT b.coins FROM public.simab_verified_quest_balances b
                            WHERE b.telegram_subject=p_subject),0)
  ON CONFLICT (telegram_subject) DO NOTHING
  RETURNING TRUE INTO v_seeded;
  SELECT * INTO STRICT w FROM public.simab_secure_wallets
    WHERE telegram_subject=p_subject FOR UPDATE;
  -- Preserve an immutable opening record for credits already verified by Telegram.
  IF COALESCE(v_seeded,FALSE) AND w.coins>0 THEN
    INSERT INTO public.simab_secure_wallet_events(
      telegram_subject,event_key,action,coin_delta,result)
    VALUES(p_subject,'opening_verified_quests','opening_verified_quests',w.coins,
           pg_catalog.jsonb_build_object('coins',w.coins,'chips',0));
  END IF;

  IF p_request_id IS NOT NULL THEN
    SELECT e.result INTO v_prev FROM public.simab_secure_wallet_events e
    WHERE e.telegram_subject=p_subject AND e.request_id=p_request_id;
    IF FOUND THEN
      RETURN v_prev || jsonb_build_object('duplicate',true,
        'coins',w.coins,'chips',w.chips,'streakDay',w.streak_day,
        'dailyAvailable',w.daily_date IS DISTINCT FROM v_today,
        'wheelAvailable',w.wheel_date IS DISTINCT FROM v_today,
        'minerReadyAt',w.miner_ready_at,'serverUtcDate',v_today);
    END IF;
  END IF;

  IF p_action='daily' THEN
    IF w.daily_date=v_today THEN v_outcome:=jsonb_build_object('alreadyClaimed',true);
    ELSE
      w.streak_day:=CASE WHEN w.daily_date=v_today-1 THEN LEAST(w.streak_day+1,7) ELSE 1 END;
      v_reward:=CASE w.streak_day WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3
          WHEN 4 THEN 4 WHEN 5 THEN 5 WHEN 6 THEN 7 ELSE 10 END;
      w.daily_date:=v_today; v_coin:=v_reward;
      v_key:='daily:'||v_today::text; v_done:=true;
    END IF;
  ELSIF p_action='wheel' THEN
    IF w.wheel_date=v_today THEN v_outcome:=jsonb_build_object('alreadySpun',true);
    ELSE
      -- gen_random_uuid() is a cryptographically secure server RNG. No client result accepted.
      v_bytes:=pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
      v_rand:=pg_catalog.get_byte(v_bytes,0)*16777216::bigint
        +pg_catalog.get_byte(v_bytes,1)*65536::bigint
        +pg_catalog.get_byte(v_bytes,2)*256::bigint
        +pg_catalog.get_byte(v_bytes,3);
      v_rand:=v_rand % 100;
      v_reward:=CASE WHEN v_rand<30 THEN 0 WHEN v_rand<65 THEN 1
        WHEN v_rand<85 THEN 2 WHEN v_rand<97 THEN 5 ELSE 10 END;
      w.wheel_date:=v_today; v_coin:=v_reward;
      v_outcome:=jsonb_build_object('wheelReward',v_reward);
      v_key:='wheel:'||v_today::text;v_done:=true;
    END IF;
  ELSIF p_action='miner_start' THEN
    IF w.miner_ready_at IS NOT NULL THEN
      v_outcome:=jsonb_build_object('minerAlreadyStarted',true);
    ELSE
      w.miner_ready_at:=v_now+interval '8 hours';
      v_key:='miner_start:'||p_request_id::text;v_done:=true;
    END IF;
  ELSIF p_action='miner_claim' THEN
    IF w.miner_ready_at IS NULL OR w.miner_ready_at>v_now THEN
      v_outcome:=jsonb_build_object('minerNotReady',true);
    ELSE
      v_coin:=4;
      v_key:='miner_claim:'||p_request_id::text;
      w.miner_ready_at:=v_now+interval '8 hours';v_done:=true;
    END IF;
  ELSIF p_action IN ('exchange_to_chips','exchange_to_coins') THEN
    IF p_amount IS NULL OR p_amount<1 OR p_amount>1000 THEN
      RAISE EXCEPTION 'invalid_amount' USING ERRCODE='22023';
    END IF;
    IF p_action='exchange_to_chips' THEN
      IF w.coins<p_amount THEN RAISE EXCEPTION 'insufficient_coins' USING ERRCODE='22023'; END IF;
      v_coin:=-p_amount; v_chips:=p_amount;
    ELSE
      IF w.chips<p_amount THEN RAISE EXCEPTION 'insufficient_chips' USING ERRCODE='22023'; END IF;
      v_chips:=-p_amount;v_coin:=p_amount;
    END IF;
    v_key:=p_action||':'||p_request_id::text;v_done:=true;
  ELSIF p_action='slot' THEN
    IF p_amount IS NULL OR p_amount<1 OR p_amount>50 THEN
      RAISE EXCEPTION 'invalid_bet' USING ERRCODE='22023';
    END IF;
    IF w.chips<p_amount THEN RAISE EXCEPTION 'insufficient_chips' USING ERRCODE='22023'; END IF;
    IF w.last_slot_at IS NOT NULL AND w.last_slot_at>v_now-interval '2 seconds' THEN
      RAISE EXCEPTION 'slot_cooldown' USING ERRCODE='22023';
    END IF;
    w.last_slot_at:=v_now;
    -- Three independent server-side cryptographic random reels.
    v_a:=pg_catalog.get_byte(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()),0)%6;
    v_b:=pg_catalog.get_byte(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()),0)%6;
    v_c:=pg_catalog.get_byte(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()),0)%6;
    v_reward:=CASE WHEN v_a=v_b AND v_b=v_c THEN p_amount*5
                   WHEN v_a=v_b OR v_a=v_c OR v_b=v_c THEN p_amount*2
                   ELSE 0 END;
    v_chips:=v_reward-p_amount;v_key:='slot:'||p_request_id::text;v_done:=true;
    v_outcome:=jsonb_build_object('reels',jsonb_build_array(v_a,v_b,v_c),
       'bet',p_amount,'payout',v_reward);
  END IF;

  IF v_done THEN
    IF w.coins+v_coin<0 OR w.chips+v_chips<0 OR
       w.coins+v_coin>1000000000000 OR w.chips+v_chips>1000000000000 THEN
      RAISE EXCEPTION 'wallet_limit' USING ERRCODE='22023';
    END IF;
    w.coins:=w.coins+v_coin;
    w.chips:=w.chips+v_chips;
    UPDATE public.simab_secure_wallets
      SET coins=w.coins,chips=w.chips,streak_day=w.streak_day,
          daily_date=w.daily_date,wheel_date=w.wheel_date,
          miner_ready_at=w.miner_ready_at,last_slot_at=w.last_slot_at,updated_at=v_now
      WHERE telegram_subject=p_subject;
  END IF;
  v_result:=jsonb_build_object('coins',w.coins,'chips',w.chips,
    'streakDay',w.streak_day,'dailyAvailable',w.daily_date IS DISTINCT FROM v_today,
    'wheelAvailable',w.wheel_date IS DISTINCT FROM v_today,
    'minerReadyAt',w.miner_ready_at,'rewardCoins',v_coin,
    'chipDelta',v_chips,'result',v_outcome,'serverUtcDate',v_today,
    'applied',v_done,'serverWallet',true);
  IF v_done THEN
    INSERT INTO public.simab_secure_wallet_events(
      telegram_subject,event_key,action,request_id,coin_delta,chip_delta,result)
    VALUES(p_subject,v_key,p_action,p_request_id,v_coin,v_chips,v_result);
  END IF;
  RETURN v_result;
END;
$func$;
REVOKE ALL ON FUNCTION public.simab_secure_wallet_action(text,text,integer,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_secure_wallet_action(text,text,integer,uuid) TO service_role;

-- Keep already-verified quest credits and the new shared wallet in sync
-- in ONE database transaction, without awarding duplicate quest rewards.
CREATE OR REPLACE FUNCTION public.simab_credit_verified_quest(
 p_telegram_subject text,p_quest_id uuid)
RETURNS TABLE(granted boolean,verified_coins bigint,reward_coins integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $quest$
DECLARE
  v_reward integer;
  v_created boolean := FALSE;
  v_seeded boolean := FALSE;
  v_balance bigint := 0;
  v_new_balance bigint := 0;
BEGIN
  IF p_telegram_subject IS NULL OR p_telegram_subject !~ '^[0-9]{1,20}$' THEN
    RAISE EXCEPTION 'invalid_subject' USING ERRCODE='22023';
  END IF;
  SELECT q.reward_coins INTO v_reward FROM public.simab_central_quests q
   WHERE q.id=p_quest_id AND q.is_published AND
         q.verification_mode='telegram_membership' AND
         q.reward_coins BETWEEN 1 AND 10000 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_rewardable' USING ERRCODE='22023'; END IF;
  -- Seed from previously verified quest credits BEFORE inserting this reward.
  INSERT INTO public.simab_secure_wallets(telegram_subject,coins)
    SELECT p_telegram_subject,
      COALESCE((SELECT b.coins FROM public.simab_verified_quest_balances b
                WHERE b.telegram_subject=p_telegram_subject),0)
    ON CONFLICT (telegram_subject) DO NOTHING
    RETURNING TRUE INTO v_seeded;
  IF COALESCE(v_seeded,FALSE) THEN
    INSERT INTO public.simab_secure_wallet_events(
      telegram_subject,event_key,action,coin_delta,result)
    SELECT p_telegram_subject,'opening_verified_quests','opening_verified_quests',
      coins,pg_catalog.jsonb_build_object('coins',coins,'chips',0)
    FROM public.simab_secure_wallets
    WHERE telegram_subject=p_telegram_subject AND coins>0;
  END IF;
  INSERT INTO public.simab_verified_quest_claims(telegram_subject,quest_id,reward_coins)
    VALUES(p_telegram_subject,p_quest_id,v_reward)
    ON CONFLICT (telegram_subject,quest_id) DO NOTHING
    RETURNING TRUE INTO v_created;
  IF COALESCE(v_created,FALSE) THEN
    INSERT INTO public.simab_verified_quest_balances AS b(telegram_subject,coins,updated_at)
      VALUES(p_telegram_subject,v_reward,now())
      ON CONFLICT(telegram_subject) DO UPDATE
        SET coins=b.coins+EXCLUDED.coins,updated_at=now()
      RETURNING coins INTO v_balance;
    UPDATE public.simab_secure_wallets SET coins=coins+v_reward,updated_at=now()
      WHERE telegram_subject=p_telegram_subject RETURNING coins INTO v_new_balance;
    INSERT INTO public.simab_secure_wallet_events(
      telegram_subject,event_key,action,coin_delta,result)
      VALUES(p_telegram_subject,'quest:'||p_quest_id::text,'verified_quest',v_reward,
             pg_catalog.jsonb_build_object('questId',p_quest_id,'coins',v_new_balance));
  ELSE
    SELECT coins INTO v_new_balance FROM public.simab_secure_wallets
      WHERE telegram_subject=p_telegram_subject;
  END IF;
  RETURN QUERY SELECT COALESCE(v_created,FALSE),COALESCE(v_new_balance,0),v_reward;
END;
$quest$;
REVOKE ALL ON FUNCTION public.simab_credit_verified_quest(text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_credit_verified_quest(text,uuid) TO service_role;

COMMENT ON TABLE public.simab_secure_wallets IS
  'Authenticated server-only beta wallet. No unverified browser/Telegram CloudStorage amounts.';
COMMENT ON TABLE public.simab_secure_wallet_events IS
  'Append-only audit of server wallet mutations and idempotency request IDs.';
COMMIT;
