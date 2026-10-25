-- Admin-issued coins share the authoritative wallet; never import local balances.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS simab_admin_credit_request_idx
  ON public.simab_secure_wallet_events(event_key) WHERE action = 'admin_credit';

CREATE OR REPLACE FUNCTION public.simab_admin_credit(
  p_admin text, p_target text, p_amount bigint, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE
  v_key text;
  v_previous jsonb;
  v_balance bigint;
  v_result jsonb;
BEGIN
  -- Defense in depth: recheck the verified actor inside the same transaction.
  PERFORM 1 FROM public.simab_admins WHERE telegram_subject = p_admin FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'admin_only' USING ERRCODE='42501'; END IF;
  IF p_target IS NULL OR p_target !~ '^[1-9][0-9]{0,15}$' OR p_target::numeric > 9007199254740991 THEN
    RAISE EXCEPTION 'invalid_target' USING ERRCODE='22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 1000000000000 THEN
    RAISE EXCEPTION 'invalid_credit_amount' USING ERRCODE='22023';
  END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'invalid_request_id' USING ERRCODE='22023'; END IF;
  v_key := 'admin_credit:' || p_admin || ':' || p_request_id::text;
  -- Serialize retries even when a changed request targets a different wallet.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key, 0));
  SELECT result INTO v_previous FROM public.simab_secure_wallet_events
    WHERE action = 'admin_credit' AND event_key = v_key;
  IF FOUND THEN
    IF v_previous->>'targetUserId' <> p_target OR (v_previous->>'amount')::bigint <> p_amount THEN
      RAISE EXCEPTION 'request_conflict' USING ERRCODE='22023';
    END IF;
    RETURN v_previous || pg_catalog.jsonb_build_object('duplicate', true);
  END IF;
  -- Existing initialization preserves previously verified quest credits.
  -- A wallet can also be created for a recipient before their first app launch.
  PERFORM public.simab_secure_wallet_action(p_target, 'state', 0, NULL);
  SELECT coins INTO STRICT v_balance FROM public.simab_secure_wallets
    WHERE telegram_subject = p_target FOR UPDATE;
  IF v_balance + p_amount > 1000000000000 THEN
    RAISE EXCEPTION 'wallet_limit' USING ERRCODE='22023';
  END IF;
  UPDATE public.simab_secure_wallets SET coins = coins + p_amount, updated_at = now()
    WHERE telegram_subject = p_target RETURNING coins INTO v_balance;
  v_result := pg_catalog.jsonb_build_object(
    'serverWallet', true, 'targetUserId', p_target, 'adminUserId', p_admin,
    'amount', p_amount, 'coins', v_balance, 'requestId', p_request_id, 'duplicate', false);
  INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,result)
    VALUES(p_target,v_key,'admin_credit',p_amount,v_result);
  RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.simab_admin_credit(text,text,bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_admin_credit(text,text,bigint,uuid) TO service_role;
COMMIT;
