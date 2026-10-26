BEGIN;
CREATE TABLE public.simab_shop_settings(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),stars_per_unit integer CHECK(stars_per_unit BETWEEN 1 AND 10000),enabled boolean NOT NULL DEFAULT false,webhook_bound boolean NOT NULL DEFAULT false,webhook_secret text NOT NULL DEFAULT(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')),treasury text NOT NULL DEFAULT 'UQAvbDktnDNwR8MeKDI1ax-j2zFM4gGW3B6CMfHh-tAsILvE');
INSERT INTO public.simab_shop_settings(singleton) VALUES(true);
CREATE TABLE public.simab_star_orders(id uuid PRIMARY KEY,telegram_subject text NOT NULL REFERENCES public.simab_secure_wallets(telegram_subject),coins bigint NOT NULL,stars integer NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','refunded')),invoice_url text,charge_id text UNIQUE,unrecovered_coins bigint NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes');
CREATE INDEX simab_star_order_subject ON public.simab_star_orders(telegram_subject,created_at DESC);
CREATE TABLE public.simab_star_receipts(charge_id text PRIMARY KEY,order_id uuid NOT NULL REFERENCES public.simab_star_orders(id),status text NOT NULL CHECK(status IN ('credited','refund_needed','refunded')));
CREATE TABLE public.simab_bot_channels(chat_id text PRIMARY KEY,title text NOT NULL,username text,enabled boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.simab_bot_channels(chat_id,title,username) VALUES('@SimorApp','کانال رسمی سیماب','SimorApp');
CREATE TABLE public.simab_offers(code text PRIMARY KEY CHECK(code~'^[a-f0-9]{32}$'),title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),message text NOT NULL CHECK(length(message) BETWEEN 1 AND 1500),reward integer NOT NULL CHECK(reward BETWEEN 0 AND 1000000),max_claims integer NOT NULL CHECK(max_claims BETWEEN 1 AND 100000),claims integer NOT NULL DEFAULT 0,expires_at timestamptz NOT NULL,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.simab_offer_claims(code text REFERENCES public.simab_offers(code),telegram_subject text REFERENCES public.simab_secure_wallets(telegram_subject),claimed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(code,telegram_subject));
CREATE TABLE public.simab_offer_deliveries(code text REFERENCES public.simab_offers(code),chat_id text REFERENCES public.simab_bot_channels(chat_id),status text NOT NULL CHECK(status IN ('reserved','sent','failed','unknown')),message_id bigint,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(code,chat_id));
DO $roles$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['simab_shop_settings','simab_star_orders','simab_star_receipts','simab_bot_channels','simab_offers','simab_offer_claims','simab_offer_deliveries'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO service_role',t);END LOOP;END;$roles$;
CREATE FUNCTION public.simab_star_order_create(p_subject text,p_coins bigint,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
DECLARE s public.simab_shop_settings%ROWTYPE;o public.simab_star_orders%ROWTYPE;
BEGIN
 PERFORM public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 SELECT * INTO s FROM public.simab_shop_settings WHERE singleton;
 IF NOT s.enabled OR NOT s.webhook_bound OR s.stars_per_unit IS NULL THEN RAISE EXCEPTION 'shop_not_ready';END IF;
 IF p_coins NOT IN (10000,20000,50000,100000,500000) OR p_id IS NULL THEN RAISE EXCEPTION 'invalid_pack';END IF;
 IF EXISTS(SELECT 1 FROM public.simab_star_orders WHERE telegram_subject=p_subject AND unrecovered_coins>0) THEN RAISE EXCEPTION 'refund_review_required';END IF;
 INSERT INTO public.simab_star_orders(id,telegram_subject,coins,stars) VALUES(p_id,p_subject,p_coins,(p_coins/10000)*s.stars_per_unit) ON CONFLICT DO NOTHING;
 SELECT * INTO o FROM public.simab_star_orders WHERE id=p_id;
 IF o.telegram_subject<>p_subject OR o.coins<>p_coins THEN RAISE EXCEPTION 'request_conflict';END IF;
 RETURN to_jsonb(o);
END;$f$;
CREATE FUNCTION public.simab_star_invoice_set(p_id uuid,p_url text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$ UPDATE public.simab_star_orders SET invoice_url=p_url WHERE id=p_id AND invoice_url IS NULL;$f$;
CREATE FUNCTION public.simab_star_payment(p_subject text,p_id uuid,p_charge text,p_stars integer,p_refund boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
DECLARE o public.simab_star_orders%ROWTYPE;r public.simab_star_receipts%ROWTYPE;w public.simab_secure_wallets%ROWTYPE;revoke_coins bigint;
BEGIN
 PERFORM public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 SELECT * INTO o FROM public.simab_star_orders WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR o.telegram_subject<>p_subject OR o.stars<>p_stars OR length(p_charge) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'invalid_payment';END IF;
 SELECT * INTO r FROM public.simab_star_receipts WHERE charge_id=p_charge;
 IF FOUND AND r.order_id<>p_id THEN RAISE EXCEPTION 'payment_conflict';END IF;
 IF p_refund THEN
  IF r.status='refunded' THEN RETURN jsonb_build_object('duplicate',true);END IF;
  IF o.status='paid' AND o.charge_id=p_charge THEN
   SELECT * INTO STRICT w FROM public.simab_secure_wallets WHERE telegram_subject=p_subject FOR UPDATE;
   revoke_coins:=least(w.coins,o.coins);
   UPDATE public.simab_secure_wallets SET coins=coins-revoke_coins,updated_at=now() WHERE telegram_subject=p_subject;
   UPDATE public.simab_star_orders SET status='refunded',unrecovered_coins=o.coins-revoke_coins WHERE id=p_id;
   INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,chip_delta,result) VALUES(p_subject,'star-refund:'||p_charge,'purchase_refund',-revoke_coins,0,jsonb_build_object('orderId',p_id));
  ELSIF o.status='pending' THEN UPDATE public.simab_star_orders SET status='refunded',charge_id=p_charge WHERE id=p_id;END IF;
  INSERT INTO public.simab_star_receipts VALUES(p_charge,p_id,'refunded') ON CONFLICT(charge_id) DO UPDATE SET status='refunded';RETURN jsonb_build_object('refunded',true);
 END IF;
 IF r.status IN ('credited','refunded') THEN RETURN jsonb_build_object('duplicate',true);END IF;
 IF o.status<>'pending' THEN
  INSERT INTO public.simab_star_receipts VALUES(p_charge,p_id,'refund_needed') ON CONFLICT DO NOTHING;RETURN jsonb_build_object('needsRefund',true);
 END IF;
 SELECT * INTO STRICT w FROM public.simab_secure_wallets WHERE telegram_subject=p_subject FOR UPDATE;
 IF w.coins+o.coins>1000000000000 THEN RAISE EXCEPTION 'wallet_limit';END IF;
 UPDATE public.simab_secure_wallets SET coins=coins+o.coins,updated_at=now() WHERE telegram_subject=p_subject;
 UPDATE public.simab_star_orders SET status='paid',charge_id=p_charge WHERE id=p_id;
 INSERT INTO public.simab_star_receipts VALUES(p_charge,p_id,'credited');
 INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,chip_delta,result) VALUES(p_subject,'star-payment:'||p_charge,'purchase_coins',o.coins,0,jsonb_build_object('orderId',p_id,'stars',p_stars));
 RETURN jsonb_build_object('credited',o.coins);
END;$f$;
CREATE FUNCTION public.simab_shop_admin(p_admin text,p_op text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
DECLARE c text;affected integer:=0;o public.simab_star_orders%ROWTYPE;w public.simab_secure_wallets%ROWTYPE;take bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.simab_admins WHERE telegram_subject=p_admin) THEN RAISE EXCEPTION 'admin_only';END IF;
 IF p_op='reconcile_refund' THEN
  SELECT * INTO o FROM public.simab_star_orders WHERE id=(p_data->>'orderId')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_order';END IF;
  PERFORM public.simab_secure_wallet_action(o.telegram_subject,'state',0,NULL);
  SELECT * INTO o FROM public.simab_star_orders WHERE id=o.id FOR UPDATE;
  SELECT * INTO STRICT w FROM public.simab_secure_wallets WHERE telegram_subject=o.telegram_subject FOR UPDATE;
  take:=least(w.coins,o.unrecovered_coins);
  IF take>0 THEN
   UPDATE public.simab_secure_wallets SET coins=coins-take,updated_at=now() WHERE telegram_subject=o.telegram_subject;
   UPDATE public.simab_star_orders SET unrecovered_coins=unrecovered_coins-take WHERE id=o.id;
   INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,chip_delta,result) VALUES(o.telegram_subject,'refund-reconcile:'||gen_random_uuid(),'purchase_refund',-take,0,jsonb_build_object('orderId',o.id));
  END IF;
  RETURN jsonb_build_object('remaining',o.unrecovered_coins-take);
 ELSIF p_op='settings' THEN
  IF (p_data->>'starsPerUnit')::integer NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'invalid_price';END IF;
  UPDATE public.simab_shop_settings SET stars_per_unit=(p_data->>'starsPerUnit')::integer,enabled=(p_data->>'enabled')::boolean WHERE singleton;
 ELSIF p_op='webhook_bound' THEN UPDATE public.simab_shop_settings SET webhook_bound=(p_data->>'bound')::boolean WHERE singleton;
 ELSIF p_op='channel' THEN
  UPDATE public.simab_bot_channels SET enabled=false WHERE lower(username)=lower(p_data->>'username') AND chat_id<>p_data->>'id';
  INSERT INTO public.simab_bot_channels(chat_id,title,username,enabled) VALUES(p_data->>'id',left(p_data->>'title',150),p_data->>'username',(p_data->>'enabled')::boolean) ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title,username=excluded.username,enabled=excluded.enabled,updated_at=now();
 ELSIF p_op='offer' THEN
  c:=replace(gen_random_uuid()::text,'-','');
  IF (p_data->>'hours')::integer NOT BETWEEN 1 AND 720 THEN RAISE EXCEPTION 'invalid_expiry';END IF;
  INSERT INTO public.simab_offers(code,title,message,reward,max_claims,expires_at,created_by) VALUES(c,p_data->>'title',p_data->>'message',(p_data->>'reward')::integer,(p_data->>'maxClaims')::integer,now()+make_interval(hours=>(p_data->>'hours')::integer),p_admin);RETURN jsonb_build_object('code',c);
 ELSIF p_op='reserve_delivery' THEN
  INSERT INTO public.simab_offer_deliveries(code,chat_id,status) VALUES(p_data->>'code',p_data->>'channel','reserved') ON CONFLICT DO NOTHING;GET DIAGNOSTICS affected=ROW_COUNT;RETURN jsonb_build_object('reserved',affected>0);
 ELSIF p_op='delivery_result' THEN
  UPDATE public.simab_offer_deliveries SET status=p_data->>'status',message_id=(p_data->>'messageId')::bigint,updated_at=now() WHERE code=p_data->>'code' AND chat_id=p_data->>'channel';
 ELSE RAISE EXCEPTION 'invalid_action';END IF;
 RETURN jsonb_build_object('ok',true);
END;$f$;
CREATE FUNCTION public.simab_offer_claim(p_subject text,p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
DECLARE o public.simab_offers%ROWTYPE;w public.simab_secure_wallets%ROWTYPE;
BEGIN
 PERFORM public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 SELECT * INTO o FROM public.simab_offers WHERE code=p_code FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'offer_not_found';END IF;
 IF EXISTS(SELECT 1 FROM public.simab_offer_claims WHERE code=p_code AND telegram_subject=p_subject) THEN RETURN jsonb_build_object('granted',false,'alreadyClaimed',true,'wallet',public.simab_secure_wallet_action(p_subject,'state',0,NULL));END IF;
 IF o.reward=0 THEN RAISE EXCEPTION 'offer_no_reward';END IF;
 IF o.expires_at<=now() THEN RAISE EXCEPTION 'offer_expired';END IF;
 IF o.claims>=o.max_claims THEN RAISE EXCEPTION 'offer_exhausted';END IF;
 SELECT * INTO STRICT w FROM public.simab_secure_wallets WHERE telegram_subject=p_subject FOR UPDATE;
 IF w.coins+o.reward>1000000000000 THEN RAISE EXCEPTION 'wallet_limit';END IF;
 INSERT INTO public.simab_offer_claims(code,telegram_subject) VALUES(p_code,p_subject);
 UPDATE public.simab_offers SET claims=claims+1 WHERE code=p_code;
 UPDATE public.simab_secure_wallets SET coins=coins+o.reward,updated_at=now() WHERE telegram_subject=p_subject;
 INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,chip_delta,result) VALUES(p_subject,'offer:'||p_code,'offer_reward',o.reward,0,jsonb_build_object('offer',p_code));
 RETURN jsonb_build_object('granted',true,'rewardCoins',o.reward,'wallet',public.simab_secure_wallet_action(p_subject,'state',0,NULL));
END;$f$;
CREATE FUNCTION public.simab_channel_update(p_chat text,p_title text,p_username text,p_enabled boolean) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$ UPDATE public.simab_bot_channels SET enabled=false WHERE lower(username)=lower(p_username) AND chat_id<>p_chat; INSERT INTO public.simab_bot_channels(chat_id,title,username,enabled) VALUES(p_chat,left(p_title,150),p_username,p_enabled) ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title,username=excluded.username,enabled=excluded.enabled,updated_at=now();$f$;
DO $acl$ DECLARE f record;BEGIN FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('simab_star_order_create','simab_star_invoice_set','simab_star_payment','simab_shop_admin','simab_offer_claim','simab_channel_update') LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||f.signature||' FROM PUBLIC,anon,authenticated';EXECUTE 'GRANT EXECUTE ON FUNCTION '||f.signature||' TO service_role';END LOOP;END;$acl$;
COMMIT;
