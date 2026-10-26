BEGIN;
CREATE TABLE public.simab_poker_rooms(code text PRIMARY KEY CHECK(code~'^[A-Z2-9]{10}$'),version integer NOT NULL DEFAULT 1,status text NOT NULL CHECK(status IN ('waiting','playing','finished','cancelled')),state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.simab_poker_members(telegram_subject text PRIMARY KEY REFERENCES public.simab_secure_wallets(telegram_subject),room_code text NOT NULL REFERENCES public.simab_poker_rooms(code));
CREATE INDEX simab_poker_members_room ON public.simab_poker_members(room_code);
CREATE TABLE public.simab_poker_signals(id bigserial PRIMARY KEY,room_code text NOT NULL REFERENCES public.simab_poker_rooms(code),sender text NOT NULL,recipient text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX simab_poker_signal_inbox ON public.simab_poker_signals(room_code,recipient,id);
ALTER TABLE public.simab_poker_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simab_poker_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simab_poker_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.simab_poker_rooms,public.simab_poker_members,public.simab_poker_signals FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.simab_poker_rooms TO service_role;
GRANT SELECT,INSERT,DELETE ON public.simab_poker_members,public.simab_poker_signals TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.simab_poker_signals_id_seq TO service_role;
CREATE FUNCTION public.simab_poker_room_commit(p_subject text,p_code text,p_expected integer,p_state jsonb,p_status text,p_changes jsonb,p_request uuid,p_signature text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE old public.simab_poker_rooms%ROWTYPE; prev public.simab_financial_requests%ROWTYPE; x jsonb; old_escrow bigint:=0;new_escrow bigint:=0;delta bigint:=0;wallet public.simab_secure_wallets%ROWTYPE;ver integer;output jsonb;
BEGIN
 IF p_code!~'^[A-Z2-9]{10}$' OR p_request IS NULL OR p_signature IS NULL OR length(p_signature)>1000 OR p_status NOT IN ('waiting','playing','finished','cancelled') THEN RAISE EXCEPTION 'invalid_request'; END IF;
 PERFORM public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 SELECT * INTO old FROM public.simab_poker_rooms WHERE code=p_code FOR UPDATE;
 IF FOUND THEN
  old_escrow:=CASE WHEN old.status IN ('waiting','playing') THEN (old.state->>'buyIn')::bigint*jsonb_array_length(old.state->'members') ELSE 0 END;
  ver:=old.version+1;
 ELSE
  IF p_expected<>-1 THEN RAISE EXCEPTION 'room_not_found'; END IF;
  ver:=1;
 END IF;
 SELECT * INTO prev FROM public.simab_financial_requests WHERE telegram_subject=p_subject AND request_id=p_request;
 IF FOUND THEN IF prev.operation_key<>p_signature THEN RAISE EXCEPTION 'request_conflict'; END IF;RETURN prev.result; END IF;
 IF old.code IS NOT NULL AND old.version<>p_expected THEN RAISE EXCEPTION 'stale_game'; END IF;
 IF p_status IN ('waiting','playing') THEN new_escrow:=(p_state->>'buyIn')::bigint*jsonb_array_length(p_state->'members'); END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_changes) ORDER BY value->>'subject' LOOP
  IF (x->>'delta')::bigint<0 AND x->>'subject'<>p_subject THEN RAISE EXCEPTION 'invalid_request'; END IF;
  IF abs((x->>'delta')::bigint)>60000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  delta:=delta+(x->>'delta')::bigint;
  SELECT * INTO STRICT wallet FROM public.simab_secure_wallets WHERE telegram_subject=x->>'subject' FOR UPDATE;
  IF wallet.chips+(x->>'delta')::bigint<0 THEN RAISE EXCEPTION 'insufficient_chips'; END IF;
 END LOOP;
 IF delta+new_escrow-old_escrow<>0 THEN RAISE EXCEPTION 'escrow_mismatch'; END IF;
 IF p_expected=-1 THEN INSERT INTO public.simab_poker_rooms VALUES(p_code,ver,p_status,p_state,now(),now());
 ELSE UPDATE public.simab_poker_rooms SET version=ver,status=p_status,state=p_state,updated_at=now() WHERE code=p_code; END IF;
 DELETE FROM public.simab_poker_members m WHERE room_code=p_code AND (p_status NOT IN ('waiting','playing') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_state->'members') n WHERE n->>'subject'=m.telegram_subject));
 IF p_status IN ('waiting','playing') THEN
  FOR x IN SELECT value FROM jsonb_array_elements(p_state->'members') LOOP
   INSERT INTO public.simab_poker_members VALUES(x->>'subject',p_code) ON CONFLICT DO NOTHING;
   IF EXISTS(SELECT 1 FROM public.simab_poker_members WHERE telegram_subject=x->>'subject' AND room_code<>p_code) THEN RAISE EXCEPTION 'active_room_exists'; END IF;
  END LOOP;
 END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
  UPDATE public.simab_secure_wallets SET chips=chips+(x->>'delta')::bigint,updated_at=now() WHERE telegram_subject=x->>'subject';
  INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,chip_delta,result) VALUES(x->>'subject','room:'||p_code||':'||p_subject||':'||p_request,'poker_friends',0,(x->>'delta')::bigint,jsonb_build_object('roomCode',p_code,'version',ver));
 END LOOP;
 output:=jsonb_build_object('roomCode',p_code,'version',ver);
 INSERT INTO public.simab_financial_requests VALUES(p_subject,p_request,p_signature,output,now());RETURN output;
END;$fn$;
REVOKE ALL ON FUNCTION public.simab_poker_room_commit(text,text,integer,jsonb,text,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_poker_room_commit(text,text,integer,jsonb,text,jsonb,uuid,text) TO service_role;
CREATE FUNCTION public.simab_poker_signal(p_subject text,p_code text,p_recipient text,p_payload jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE n bigint;
BEGIN
 IF octet_length(p_payload::text)>24000 OR p_subject=p_recipient OR NOT EXISTS(SELECT 1 FROM public.simab_poker_members a JOIN public.simab_poker_members b ON a.room_code=b.room_code WHERE a.telegram_subject=p_subject AND b.telegram_subject=p_recipient AND a.room_code=p_code) THEN RAISE EXCEPTION 'invalid_request'; END IF;
 DELETE FROM public.simab_poker_signals WHERE room_code=p_code AND created_at<now()-interval '1 hour';
 IF (SELECT count(*) FROM public.simab_poker_signals WHERE room_code=p_code)>5000 THEN RAISE EXCEPTION 'signal_limit'; END IF;
 INSERT INTO public.simab_poker_signals(room_code,sender,recipient,payload) VALUES(p_code,p_subject,p_recipient,p_payload) RETURNING id INTO n;RETURN n;
END;$fn$;
REVOKE ALL ON FUNCTION public.simab_poker_signal(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_poker_signal(text,text,text,jsonb) TO service_role;
COMMIT;
