-- Requires SIMAB Phase 2.1 foundation tables. No legacy balance import.
BEGIN;
CREATE OR REPLACE FUNCTION public.simab_claim_verified_telegram(p_telegram_subject text,p_name text)
RETURNS TABLE(player_id uuid,was_created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid; v_new boolean := false; v_status text;
BEGIN
 IF p_telegram_subject IS NULL OR p_telegram_subject !~ '^[0-9]{1,20}$' THEN
   RAISE EXCEPTION 'Invalid telegram subject';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('SIMAB_TG:'||p_telegram_subject,0));
 SELECT l.player_id INTO v_id FROM public.simab_identity_links l WHERE l.provider='telegram' AND l.provider_subject=p_telegram_subject;
 IF v_id IS NULL THEN
   INSERT INTO public.simab_players(display_name) VALUES (left(coalesce(nullif(btrim(p_name),''),'بازیکن'),80)) RETURNING id INTO v_id;
   INSERT INTO public.simab_identity_links(player_id,provider,provider_subject) VALUES(v_id,'telegram',p_telegram_subject);
   v_new := true;
 END IF;
 SELECT p.status INTO v_status FROM public.simab_players p WHERE p.id=v_id;
 IF v_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 INSERT INTO public.simab_wallets(player_id,asset,balance)
 VALUES(v_id,'COIN',0),(v_id,'CHIP',0) ON CONFLICT(player_id,asset) DO NOTHING;
 RETURN QUERY SELECT v_id,v_new;
END; $$;
REVOKE ALL ON FUNCTION public.simab_claim_verified_telegram(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_claim_verified_telegram(text,text) TO service_role;
COMMIT;
