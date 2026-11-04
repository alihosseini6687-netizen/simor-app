-- Mango Game idle room guard v32.
-- Signed Edge traffic is the only caller of heartbeat; cron only expires WAITING rooms.
-- Playing rooms must be settled by their game engine, never refunded blindly.
BEGIN;
CREATE TABLE public.simab_room_presence(
 room_code text NOT NULL REFERENCES public.simab_poker_rooms(code) ON DELETE CASCADE,
 telegram_subject text NOT NULL REFERENCES public.simab_secure_wallets(telegram_subject),
 last_seen timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(room_code,telegram_subject)
);
CREATE INDEX simab_room_presence_recent ON public.simab_room_presence(room_code,last_seen DESC);
ALTER TABLE public.simab_room_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.simab_room_presence FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.simab_room_presence TO service_role;

CREATE FUNCTION public.simab_room_heartbeat(p_subject text,p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE r public.simab_poker_rooms%ROWTYPE; is_member boolean; stale boolean;
BEGIN
 SELECT * INTO r FROM public.simab_poker_rooms WHERE code=p_code FOR UPDATE;
 IF r.code IS NULL OR r.status NOT IN ('waiting','playing') THEN RETURN jsonb_build_object('ok',false,'closed',true); END IF;
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(r.state->'members') m WHERE m->>'subject'=p_subject) INTO is_member;
 IF NOT is_member THEN RAISE EXCEPTION 'room_forbidden'; END IF;
 IF r.status='waiting' THEN
  SELECT EXISTS(
   SELECT 1 FROM jsonb_array_elements(r.state->'members') m
   LEFT JOIN public.simab_room_presence p ON p.room_code=r.code AND p.telegram_subject=m->>'subject'
   WHERE COALESCE(p.last_seen,r.created_at)<now()-interval '60 seconds'
  ) INTO stale;
  IF stale THEN RETURN jsonb_build_object('ok',false,'expired',true);END IF;
 END IF;
 INSERT INTO public.simab_room_presence(room_code,telegram_subject,last_seen)
 VALUES(p_code,p_subject,now())
 ON CONFLICT (room_code,telegram_subject) DO UPDATE SET last_seen=greatest(public.simab_room_presence.last_seen,excluded.last_seen);
 RETURN jsonb_build_object('ok',true);
END;$fn$;

CREATE FUNCTION public.simab_expire_waiting_rooms(p_limit integer DEFAULT 50) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE r public.simab_poker_rooms%ROWTYPE; m jsonb; subject text; amount bigint; inserted uuid; processed integer:=0;
BEGIN
 IF p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'invalid_limit'; END IF;
 FOR r IN
  SELECT x.* FROM public.simab_poker_rooms x
  WHERE x.status='waiting' AND x.created_at<now()-interval '60 seconds'
  AND EXISTS (
   SELECT 1 FROM jsonb_array_elements(x.state->'members') m
   LEFT JOIN public.simab_room_presence p ON p.room_code=x.code AND p.telegram_subject=m->>'subject'
   WHERE COALESCE(p.last_seen,x.created_at)<now()-interval '60 seconds'
  )
  ORDER BY x.created_at,x.code FOR UPDATE SKIP LOCKED LIMIT p_limit
 LOOP
  amount:=(r.state->>'buyIn')::bigint;
  IF amount<0 OR amount>10000 OR jsonb_typeof(r.state->'members')<>'array' OR jsonb_array_length(r.state->'members') NOT BETWEEN 1 AND 6 THEN
   RAISE EXCEPTION 'invalid_room_escrow';
  END IF;
  -- Lock wallets in the same stable order as normal escrow commits.
  PERFORM 1 FROM public.simab_secure_wallets w
   WHERE w.telegram_subject IN (SELECT x->>'subject' FROM jsonb_array_elements(r.state->'members') x)
   ORDER BY w.telegram_subject FOR UPDATE;
  FOR m IN SELECT value FROM jsonb_array_elements(r.state->'members') ORDER BY value->>'subject' LOOP
   subject:=m->>'subject';
   inserted:=NULL;
   INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,chip_delta,result)
   VALUES(subject,'room:auto-timeout:'||r.code,'room_timeout_refund',0,amount,
     jsonb_build_object('roomCode',r.code,'reason','waiting_member_offline_60s'))
   ON CONFLICT (telegram_subject,event_key) DO NOTHING RETURNING id INTO inserted;
   IF inserted IS NOT NULL THEN
    UPDATE public.simab_secure_wallets SET chips=chips+amount,updated_at=now() WHERE telegram_subject=subject;
    IF NOT FOUND THEN RAISE EXCEPTION 'missing_wallet';END IF;
   END IF;
  END LOOP;
  UPDATE public.simab_poker_rooms SET status='cancelled',version=version+1,updated_at=now() WHERE code=r.code;
  DELETE FROM public.simab_poker_members WHERE room_code=r.code;
  DELETE FROM public.simab_room_presence WHERE room_code=r.code;
  processed:=processed+1;
 END LOOP;
 RETURN processed;
END;$fn$;

REVOKE ALL ON FUNCTION public.simab_room_heartbeat(text,text),public.simab_expire_waiting_rooms(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_room_heartbeat(text,text),public.simab_expire_waiting_rooms(integer) TO service_role;
COMMIT;
