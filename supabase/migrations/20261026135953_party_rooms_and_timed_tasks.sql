BEGIN;
CREATE TABLE public.simab_room_messages(id bigserial PRIMARY KEY,room_code text NOT NULL REFERENCES public.simab_poker_rooms(code),subject text NOT NULL,display_name text NOT NULL,kind text NOT NULL CHECK(kind IN('chat','question','answer')),body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 500),message_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(subject,message_id));
CREATE INDEX simab_room_messages_room ON public.simab_room_messages(room_code,id);
ALTER TABLE public.simab_room_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.simab_room_messages FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.simab_room_messages TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.simab_room_messages_id_seq TO service_role;
CREATE FUNCTION public.simab_room_message(p_subject text,p_code text,p_name text,p_kind text,p_body text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE room public.simab_poker_rooms%ROWTYPE;
BEGIN
 SELECT * INTO room FROM public.simab_poker_rooms WHERE code=p_code FOR UPDATE;
 IF room.status NOT IN('waiting','playing') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(room.state->'members') m WHERE m->>'subject'=p_subject AND (m->>'archiveConsent')::boolean) THEN RAISE EXCEPTION 'room_forbidden';END IF;
 IF p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 500 OR p_kind NOT IN('chat','question','answer') OR p_id IS NULL THEN RAISE EXCEPTION 'invalid_message';END IF;
 IF EXISTS(SELECT 1 FROM public.simab_room_messages WHERE subject=p_subject AND message_id=p_id) THEN RETURN '{"ok":true}'::jsonb;END IF;
 IF (SELECT count(*) FROM public.simab_room_messages WHERE subject=p_subject AND created_at>now()-interval '10 seconds')>=8 THEN RAISE EXCEPTION 'message_limit';END IF;
 DELETE FROM public.simab_room_messages WHERE created_at<now()-interval '30 days';
 INSERT INTO public.simab_room_messages(room_code,subject,display_name,kind,body,message_id) VALUES(p_code,p_subject,left(p_name,60),p_kind,btrim(p_body),p_id);
 RETURN '{"ok":true}'::jsonb;
END;$$;
REVOKE ALL ON FUNCTION public.simab_room_message(text,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_room_message(text,text,text,text,text,uuid) TO service_role;
ALTER TABLE public.simab_central_quests DROP CONSTRAINT simab_central_quests_timer_seconds_check;
ALTER TABLE public.simab_central_quests ADD CHECK(timer_seconds BETWEEN 5 AND 120);
CREATE TABLE public.simab_task_visits(subject text NOT NULL,quest_id uuid NOT NULL REFERENCES public.simab_central_quests(id),started_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(subject,quest_id));
ALTER TABLE public.simab_task_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.simab_task_visits FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.simab_task_visits TO service_role;
CREATE FUNCTION public.simab_task_start(p_subject text,p_quest uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE q public.simab_central_quests%ROWTYPE;t timestamptz;
BEGIN
 SELECT * INTO q FROM public.simab_central_quests WHERE id=p_quest AND is_published;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_rewardable';END IF;
 INSERT INTO public.simab_task_visits(subject,quest_id) VALUES(p_subject,p_quest) ON CONFLICT DO NOTHING;
 SELECT started_at INTO t FROM public.simab_task_visits WHERE subject=p_subject AND quest_id=p_quest;
 RETURN jsonb_build_object('readyAt',t+make_interval(secs=>CASE WHEN q.verification_mode='telegram_membership' THEN 5 ELSE 10 END),'serverNow',now());
END;$$;
CREATE FUNCTION public.simab_task_claim_v16(p_subject text,p_quest uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE q public.simab_central_quests%ROWTYPE;t timestamptz;fresh boolean:=false;w jsonb;
BEGIN
 PERFORM public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 SELECT * INTO q FROM public.simab_central_quests WHERE id=p_quest AND is_published AND reward_coins>0 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_rewardable';END IF;
 SELECT started_at INTO t FROM public.simab_task_visits WHERE subject=p_subject AND quest_id=p_quest;
 IF t IS NULL OR now()<t+make_interval(secs=>CASE WHEN q.verification_mode='telegram_membership' THEN 5 ELSE 10 END) THEN RAISE EXCEPTION 'task_not_ready';END IF;
 INSERT INTO public.simab_verified_quest_claims(telegram_subject,quest_id,reward_coins) VALUES(p_subject,p_quest,q.reward_coins) ON CONFLICT DO NOTHING RETURNING true INTO fresh;
 IF coalesce(fresh,false) THEN
  UPDATE public.simab_secure_wallets SET coins=coins+q.reward_coins,updated_at=now() WHERE telegram_subject=p_subject;
  INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,result) VALUES(p_subject,'quest:'||p_quest,'verified_quest',q.reward_coins,jsonb_build_object('questId',p_quest));
 END IF;
 w:=public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 RETURN jsonb_build_object('granted',coalesce(fresh,false),'alreadyClaimed',not coalesce(fresh,false),'rewardCoins',q.reward_coins,'wallet',w,'verifiedCoins',w->'coins');
END;$$;
REVOKE ALL ON FUNCTION public.simab_task_start(text,uuid),public.simab_task_claim_v16(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_task_start(text,uuid),public.simab_task_claim_v16(text,uuid) TO service_role;
-- Archive definitions, preserve historical claims and balances.
UPDATE public.simab_central_quests SET is_published=false,updated_at=now() WHERE is_published;
CREATE FUNCTION public.simab_economy_status(p_admin text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_admin<>'702007470' THEN RAISE EXCEPTION 'admin_only';END IF;
 RETURN jsonb_build_object('players',(SELECT count(*) FROM public.simab_secure_wallets),'totalCoins',(SELECT coalesce(sum(coins),0) FROM public.simab_secure_wallets),'totalChips',(SELECT coalesce(sum(chips),0) FROM public.simab_secure_wallets),'activeRooms',(SELECT count(*) FROM public.simab_poker_rooms WHERE status IN('waiting','playing')),'rewards24h',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT action,count(*) AS payments,coalesce(sum(coin_delta),0) AS coins FROM public.simab_secure_wallet_events WHERE created_at>now()-interval '24 hours' AND action IN('daily','wheel','miner_claim','miner_collect','verified_quest') GROUP BY action) x));
END;$$;
REVOKE ALL ON FUNCTION public.simab_economy_status(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_economy_status(text) TO service_role;
COMMIT;
