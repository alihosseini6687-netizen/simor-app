BEGIN;
ALTER TABLE public.simab_secure_wallets ADD COLUMN miner_tier smallint NOT NULL DEFAULT 0 CHECK(miner_tier BETWEEN 0 AND 4),
 ADD COLUMN miner_tank bigint NOT NULL DEFAULT 0 CHECK(miner_tank BETWEEN 0 AND 8000),
 ADD COLUMN miner_cycle_started timestamptz;
CREATE TABLE public.simab_financial_requests (
 telegram_subject text NOT NULL REFERENCES public.simab_secure_wallets(telegram_subject),
 request_id uuid NOT NULL, operation_key text NOT NULL CHECK(length(operation_key)<=1000),
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(telegram_subject,request_id)
);
CREATE TABLE public.simab_game_sessions (
 id uuid PRIMARY KEY, telegram_subject text NOT NULL REFERENCES public.simab_secure_wallets(telegram_subject),
 game text NOT NULL CHECK(game IN ('poker','backgammon','slot')),
 version integer NOT NULL DEFAULT 1, state jsonb NOT NULL,
 finished boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX simab_one_active_game_idx ON public.simab_game_sessions(telegram_subject,game) WHERE NOT finished;
CREATE INDEX simab_game_subject_idx ON public.simab_game_sessions(telegram_subject,updated_at DESC);
ALTER TABLE public.simab_financial_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simab_game_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.simab_financial_requests,public.simab_game_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.simab_financial_requests TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.simab_game_sessions TO service_role;

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
    IF p_amount IS NULL OR p_amount<1 OR p_amount>1000000 THEN
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
    'applied',v_done,'serverWallet',true,'minerTier',w.miner_tier,'minerTank',w.miner_tank,'minerCycleStarted',w.miner_cycle_started);
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


CREATE FUNCTION public.simab_wallet_action_v2(p_subject text,p_action text,p_amount integer,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE previous public.simab_financial_requests%ROWTYPE; output jsonb; op text; w public.simab_secure_wallets%ROWTYPE; cost bigint; delta bigint; capacity bigint; rate bigint;
BEGIN
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'invalid_request_id'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('daily','wheel','miner_start','miner_claim','exchange_to_chips','exchange_to_coins','slot','miner_upgrade','miner_recharge','miner_collect') THEN RAISE EXCEPTION 'invalid_action'; END IF;
 IF p_amount IS NULL OR p_amount<0 OR p_amount>1000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
 PERFORM public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 PERFORM 1 FROM public.simab_secure_wallets WHERE telegram_subject=p_subject FOR UPDATE;
 op:=p_action||':'||p_amount::text;
 SELECT * INTO previous FROM public.simab_financial_requests WHERE telegram_subject=p_subject AND request_id=p_request_id;
 IF FOUND THEN
  IF previous.operation_key<>op THEN RAISE EXCEPTION 'request_conflict'; END IF;
  RETURN previous.result || (public.simab_secure_wallet_action(p_subject,'state',0,NULL) - 'result' - 'rewardCoins' - 'chipDelta' - 'applied') || jsonb_build_object('duplicate',true);
 END IF;
 IF p_action IN ('miner_upgrade','miner_recharge','miner_collect') THEN
  SELECT * INTO STRICT w FROM public.simab_secure_wallets WHERE telegram_subject=p_subject;
  IF p_action='miner_upgrade' THEN
   IF p_amount<1 OR p_amount>4 OR p_amount<=w.miner_tier THEN RAISE EXCEPTION 'invalid_miner_tier'; END IF;
   cost:=(ARRAY[50,150,500,2000])[p_amount]; capacity:=(ARRAY[120,240,1850,8000])[p_amount];
   IF w.coins<cost THEN RAISE EXCEPTION 'insufficient_coins'; END IF;
   UPDATE public.simab_secure_wallets SET coins=coins-cost,miner_tier=p_amount,miner_tank=capacity,miner_cycle_started=now(),updated_at=now() WHERE telegram_subject=p_subject;
   delta:=-cost;
  ELSE
   IF w.miner_tier=0 THEN RAISE EXCEPTION 'miner_not_owned'; END IF;
   capacity:=(ARRAY[120,240,1850,8000])[w.miner_tier];
   IF p_action='miner_recharge' THEN
    IF w.miner_tank>=capacity THEN RAISE EXCEPTION 'miner_tank_full'; END IF;
    cost:=(ARRAY[40,120,400,1800])[w.miner_tier];
    IF w.coins<cost THEN RAISE EXCEPTION 'insufficient_coins'; END IF;
    UPDATE public.simab_secure_wallets SET coins=coins-cost,miner_tank=capacity,miner_cycle_started=now(),updated_at=now() WHERE telegram_subject=p_subject;
    delta:=-cost;
   ELSE
    rate:=(ARRAY[30,75,250,500])[w.miner_tier];
    delta:=floor(least(w.miner_tank,rate,greatest(0,extract(epoch from (now()-w.miner_cycle_started)))*rate/86400));
    IF delta<1 THEN RAISE EXCEPTION 'miner_not_ready'; END IF;
    IF w.coins+delta>1000000000000 THEN RAISE EXCEPTION 'wallet_limit'; END IF;
    UPDATE public.simab_secure_wallets SET coins=coins+delta,miner_tank=miner_tank-delta,miner_cycle_started=now(),updated_at=now() WHERE telegram_subject=p_subject;
   END IF;
  END IF;
  output:=public.simab_secure_wallet_action(p_subject,'state',0,NULL)||jsonb_build_object('rewardCoins',delta,'applied',true);
  INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,request_id,coin_delta,result) VALUES(p_subject,p_action||':'||p_request_id::text,p_action,p_request_id,delta,output);
 ELSE
  output:=public.simab_secure_wallet_action(p_subject,p_action,p_amount,p_request_id);
 END IF;
 INSERT INTO public.simab_financial_requests VALUES(p_subject,p_request_id,op,output,now());
 RETURN output;
END;
$fn$;
REVOKE ALL ON FUNCTION public.simab_wallet_action_v2(text,text,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_wallet_action_v2(text,text,integer,uuid) TO service_role;

CREATE FUNCTION public.simab_game_commit(p_subject text,p_game text,p_request_id uuid,p_operation_key text,
 p_id uuid,p_expected_version integer,p_state jsonb,p_public jsonb,p_debit bigint,p_credit bigint,p_finished boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE prev public.simab_financial_requests%ROWTYPE; session public.simab_game_sessions%ROWTYPE;
 wallet public.simab_secure_wallets%ROWTYPE; output jsonb; ver integer;
BEGIN
 IF p_request_id IS NULL OR p_id IS NULL OR p_operation_key IS NULL OR length(p_operation_key)>1000 OR
  p_game IS NULL OR p_game NOT IN ('poker','backgammon','slot') OR p_finished IS NULL OR p_state IS NULL OR p_public IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
 IF p_debit IS NULL OR p_credit IS NULL OR p_debit<0 OR p_credit<0 OR p_debit>25000 OR p_credit>1250000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
 PERFORM public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 SELECT * INTO STRICT wallet FROM public.simab_secure_wallets WHERE telegram_subject=p_subject FOR UPDATE;
 SELECT * INTO prev FROM public.simab_financial_requests WHERE telegram_subject=p_subject AND request_id=p_request_id;
 IF FOUND THEN
  IF prev.operation_key<>p_operation_key THEN RAISE EXCEPTION 'request_conflict'; END IF;
  RETURN prev.result || jsonb_build_object('wallet',public.simab_secure_wallet_action(p_subject,'state',0,NULL),'duplicate',true);
 END IF;
 IF p_expected_version=-1 THEN
  IF EXISTS(SELECT 1 FROM public.simab_game_sessions WHERE telegram_subject=p_subject AND game=p_game AND NOT finished) THEN RAISE EXCEPTION 'active_game_exists'; END IF;
  IF p_game='slot' AND wallet.last_slot_at>now()-interval '2 seconds' THEN RAISE EXCEPTION 'slot_cooldown'; END IF;
  ver:=1;
  INSERT INTO public.simab_game_sessions(id,telegram_subject,game,state,finished) VALUES(p_id,p_subject,p_game,p_state,p_finished);
 ELSE
  SELECT * INTO session FROM public.simab_game_sessions WHERE id=p_id AND telegram_subject=p_subject AND game=p_game FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'game_not_found'; END IF;
  IF session.version<>p_expected_version THEN RAISE EXCEPTION 'stale_game'; END IF;
  IF session.finished THEN RAISE EXCEPTION 'game_finished'; END IF;
  IF p_debit<>0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  ver:=session.version+1;
  UPDATE public.simab_game_sessions SET state=p_state,version=ver,finished=p_finished,updated_at=now() WHERE id=p_id;
 END IF;
 IF wallet.chips<p_debit THEN RAISE EXCEPTION 'insufficient_chips'; END IF;
 IF wallet.chips-p_debit+p_credit>1000000000000 THEN RAISE EXCEPTION 'wallet_limit'; END IF;
 UPDATE public.simab_secure_wallets SET chips=chips-p_debit+p_credit,updated_at=now(),last_slot_at=CASE WHEN p_game='slot' THEN now() ELSE last_slot_at END WHERE telegram_subject=p_subject;
 output:=jsonb_build_object('sessionId',p_id,'version',ver,'state',p_public,'wallet',public.simab_secure_wallet_action(p_subject,'state',0,NULL),'duplicate',false);
 IF p_debit>0 OR p_credit>0 THEN
  INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,chip_delta,result)
  VALUES(p_subject,'game:'||p_request_id::text,p_game||CASE WHEN p_expected_version=-1 THEN '_buyin' ELSE '_settle' END,0,p_credit-p_debit,
    jsonb_build_object('sessionId',p_id,'debit',p_debit,'credit',p_credit,'requestId',p_request_id));
 END IF;
 INSERT INTO public.simab_financial_requests VALUES(p_subject,p_request_id,p_operation_key,output,now());
 RETURN output;
END;
$fn$;
REVOKE ALL ON FUNCTION public.simab_game_commit(text,text,uuid,text,uuid,integer,jsonb,jsonb,bigint,bigint,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_game_commit(text,text,uuid,text,uuid,integer,jsonb,jsonb,bigint,bigint,boolean) TO service_role;
COMMIT;
