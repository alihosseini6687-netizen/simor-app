BEGIN;
-- Add only game identifiers. Existing sessions, balances, RLS and replay keys remain.
ALTER TABLE public.simab_game_sessions DROP CONSTRAINT simab_game_sessions_game_check;
ALTER TABLE public.simab_game_sessions ADD CONSTRAINT simab_game_sessions_game_check CHECK(game IN ('poker','backgammon','slot','hokm','blackjack','ludo'));
CREATE OR REPLACE FUNCTION public.simab_game_commit(p_subject text,p_game text,p_request_id uuid,p_operation_key text,
 p_id uuid,p_expected_version integer,p_state jsonb,p_public jsonb,p_debit bigint,p_credit bigint,p_finished boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE prev public.simab_financial_requests%ROWTYPE; session public.simab_game_sessions%ROWTYPE;
 wallet public.simab_secure_wallets%ROWTYPE; output jsonb; ver integer;
BEGIN
 IF p_request_id IS NULL OR p_id IS NULL OR p_operation_key IS NULL OR length(p_operation_key)>1000 OR
  p_game IS NULL OR p_game NOT IN ('poker','backgammon','slot','hokm','blackjack','ludo') OR p_finished IS NULL OR p_state IS NULL OR p_public IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
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
  IF p_debit<>0 AND (p_game<>'blackjack' OR p_debit>10000) THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_game='blackjack' AND (coalesce((p_state->>'committed')::bigint - (session.state->>'committed')::bigint,-1) <> p_debit
    OR coalesce((p_state->>'committed')::bigint,80001)>80000 OR (NOT p_finished AND p_credit<>0)) THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  ver:=session.version+1;
  UPDATE public.simab_game_sessions SET state=p_state,version=ver,finished=p_finished,updated_at=now() WHERE id=p_id;
 END IF;
 IF wallet.chips<p_debit THEN RAISE EXCEPTION 'insufficient_chips'; END IF;
 IF wallet.chips-p_debit+p_credit>1000000000000 THEN RAISE EXCEPTION 'wallet_limit'; END IF;
 UPDATE public.simab_secure_wallets SET chips=chips-p_debit+p_credit,updated_at=now(),last_slot_at=CASE WHEN p_game='slot' THEN now() ELSE last_slot_at END WHERE telegram_subject=p_subject;
 output:=jsonb_build_object('sessionId',p_id,'version',ver,'state',p_public,'wallet',public.simab_secure_wallet_action(p_subject,'state',0,NULL),'duplicate',false);
 IF p_debit>0 OR p_credit>0 THEN
  INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,chip_delta,result)
  VALUES(p_subject,'game:'||p_request_id::text,p_game||CASE WHEN p_expected_version=-1 THEN '_buyin' WHEN p_debit>0 AND NOT p_finished THEN '_bet' ELSE '_settle' END,0,p_credit-p_debit,
    jsonb_build_object('sessionId',p_id,'debit',p_debit,'credit',p_credit,'requestId',p_request_id));
 END IF;
 INSERT INTO public.simab_financial_requests VALUES(p_subject,p_request_id,p_operation_key,output,now());
 RETURN output;
END;
$fn$;
REVOKE ALL ON FUNCTION public.simab_game_commit(text,text,uuid,text,uuid,integer,jsonb,jsonb,bigint,bigint,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_game_commit(text,text,uuid,text,uuid,integer,jsonb,jsonb,bigint,bigint,boolean) TO service_role;
COMMIT;
