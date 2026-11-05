-- Transactional coverage: two escrow refunds exactly once and a live host not expired.
BEGIN;
DO $test$
DECLARE r jsonb; a bigint; b bigint; n int;
BEGIN
 PERFORM public.simab_secure_wallet_action('900000000201','state',0,NULL);
 PERFORM public.simab_secure_wallet_action('900000000202','state',0,NULL);
 PERFORM public.simab_secure_wallet_action('900000000203','state',0,NULL);
 UPDATE public.simab_secure_wallets SET chips=100 WHERE telegram_subject IN ('900000000201','900000000202','900000000203');
 PERFORM public.simab_poker_room_commit(
 '900000000201','MANGOIDL32',-1,
 '{"host":"900000000201","buyIn":25,"maxPlayers":2,"members":[{"subject":"900000000201"}],"poker":null}'::jsonb,
 'waiting','[{"subject":"900000000201","delta":-25}]'::jsonb,'10b915bf-0000-4000-8000-000000000201','idle-test-create');
 PERFORM public.simab_poker_room_commit(
 '900000000202','MANGOIDL32',1,
 '{"host":"900000000201","buyIn":25,"maxPlayers":2,"members":[{"subject":"900000000201"},{"subject":"900000000202"}],"poker":null}'::jsonb,
 'waiting','[{"subject":"900000000202","delta":-25}]'::jsonb,'10b915bf-0000-4000-8000-000000000202','idle-test-join');
 UPDATE public.simab_poker_rooms SET created_at=now()-interval '2 minutes' WHERE code='MANGOIDL32';
 SELECT public.simab_expire_waiting_rooms() INTO n;
 IF n<>1 THEN RAISE EXCEPTION 'abandoned waiting room not cancelled: %',n;END IF;
 SELECT chips INTO a FROM public.simab_secure_wallets WHERE telegram_subject='900000000201';
 SELECT chips INTO b FROM public.simab_secure_wallets WHERE telegram_subject='900000000202';
 IF a<>100 OR b<>100 THEN RAISE EXCEPTION 'escrow not fully refunded: %, %',a,b;END IF;
 SELECT public.simab_expire_waiting_rooms() INTO n;
 IF n<>0 THEN RAISE EXCEPTION 'duplicate cancellation: %',n;END IF;
 SELECT count(*) INTO n FROM public.simab_secure_wallet_events WHERE action='room_timeout_refund' AND result->>'roomCode'='MANGOIDL32';
 IF n<>2 THEN RAISE EXCEPTION 'duplicate/missing refund ledger: %',n;END IF;
 IF (SELECT status FROM public.simab_poker_rooms WHERE code='MANGOIDL32')<>'cancelled' THEN RAISE EXCEPTION 'room remains open';END IF;
 IF EXISTS(SELECT 1 FROM public.simab_poker_members WHERE room_code='MANGOIDL32') THEN RAISE EXCEPTION 'member leaked';END IF;

 PERFORM public.simab_poker_room_commit('900000000203','MANGOIDL33',-1,
 '{"host":"900000000203","buyIn":25,"maxPlayers":2,"members":[{"subject":"900000000203"}],"poker":null}'::jsonb,
 'waiting','[{"subject":"900000000203","delta":-25}]'::jsonb,'10b915bf-0000-4000-8000-000000000203','live-test-create');
 SELECT public.simab_room_heartbeat('900000000203','MANGOIDL33') INTO r;
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'heartbeat failed';END IF;
 UPDATE public.simab_poker_rooms SET created_at=now()-interval '2 minutes' WHERE code='MANGOIDL33';
 SELECT public.simab_expire_waiting_rooms() INTO n;
 IF n<>0 OR (SELECT status FROM public.simab_poker_rooms WHERE code='MANGOIDL33')<>'waiting'
 THEN RAISE EXCEPTION 'active host incorrectly refunded';END IF;
 IF (SELECT chips FROM public.simab_secure_wallets WHERE telegram_subject='900000000203')<>75 THEN RAISE EXCEPTION 'active escrow changed';END IF;
 -- This user did not generate a signed heartbeat in the prior minute.
 UPDATE public.simab_room_presence SET last_seen=now()-interval '2 minutes' WHERE room_code='MANGOIDL33';
 SELECT public.simab_room_heartbeat('900000000203','MANGOIDL33') INTO r;
 IF r->>'expired'<>'true' THEN RAISE EXCEPTION 'offline timeout could be evaded by late heartbeat';END IF;
 SELECT public.simab_expire_waiting_rooms() INTO n;
 IF n<>1 OR (SELECT chips FROM public.simab_secure_wallets WHERE telegram_subject='900000000203')<>100
 THEN RAISE EXCEPTION 'second escrow not refunded after timeout';END IF;
END;$test$;
ROLLBACK;
