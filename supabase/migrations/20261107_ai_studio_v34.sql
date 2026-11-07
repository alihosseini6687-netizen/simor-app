-- Mango Game AI Studio v34. The public Perchance generator is third-party.
-- These tables authorize *access to our launcher*, never claim image inference is ours.
BEGIN;
CREATE TABLE public.simab_ai_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 enabled boolean NOT NULL DEFAULT true,
 free_mode boolean NOT NULL DEFAULT true,
 plans jsonb NOT NULL DEFAULT '[{"id":"mini","coins":10,"minutes":10},{"id":"plus","coins":20,"minutes":20},{"id":"max","coins":30,"minutes":30}]'::jsonb,
 archive_channel_id text,
 archive_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ai_plans_are_array CHECK (jsonb_typeof(plans)='array'),
 CONSTRAINT ai_archive_target CHECK (archive_channel_id IS NULL OR archive_channel_id ~ '^-100[0-9]{5,16}$')
);
INSERT INTO public.simab_ai_settings(singleton) VALUES(true);
CREATE TABLE public.simab_ai_access_passes (
 telegram_subject text NOT NULL REFERENCES public.simab_secure_wallets(telegram_subject),
 request_id uuid NOT NULL,
 plan_id text NOT NULL,
 paid_coins bigint NOT NULL CHECK(paid_coins BETWEEN 0 AND 10000),
 started_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(telegram_subject,request_id)
);
CREATE INDEX simab_ai_active_by_user ON public.simab_ai_access_passes(telegram_subject,expires_at DESC);
CREATE TABLE public.simab_ai_archive_requests (
 telegram_subject text NOT NULL REFERENCES public.simab_secure_wallets(telegram_subject),
 request_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','sent','unknown')),
 message_id bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(telegram_subject,request_id)
);
CREATE INDEX simab_ai_archive_by_user ON public.simab_ai_archive_requests(telegram_subject,created_at DESC);
ALTER TABLE public.simab_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simab_ai_access_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simab_ai_archive_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.simab_ai_settings,public.simab_ai_access_passes,public.simab_ai_archive_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.simab_ai_settings TO service_role;
GRANT SELECT,INSERT ON public.simab_ai_access_passes TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.simab_ai_archive_requests TO service_role;

CREATE FUNCTION public.simab_ai_activate(p_subject text,p_plan_id text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
DECLARE cfg public.simab_ai_settings%ROWTYPE; w public.simab_secure_wallets%ROWTYPE;
 current_pass public.simab_ai_access_passes%ROWTYPE;
 plan jsonb; charge bigint; minutes integer;
BEGIN
 IF p_subject !~ '^[1-9][0-9]{0,15}$' OR p_request_id IS NULL OR length(p_plan_id)>32 THEN RAISE EXCEPTION 'invalid_request';END IF;
 SELECT * INTO STRICT cfg FROM public.simab_ai_settings WHERE singleton FOR SHARE;
 IF NOT cfg.enabled THEN RAISE EXCEPTION 'ai_disabled';END IF;
 PERFORM public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 SELECT * INTO STRICT w FROM public.simab_secure_wallets WHERE telegram_subject=p_subject FOR UPDATE;
 IF cfg.free_mode THEN
  RETURN jsonb_build_object('active',true,'free',true,'wallet',public.simab_secure_wallet_action(p_subject,'state',0,NULL));
 END IF;
 SELECT * INTO current_pass FROM public.simab_ai_access_passes WHERE telegram_subject=p_subject AND request_id=p_request_id;
 IF FOUND THEN
  IF current_pass.plan_id<>p_plan_id THEN RAISE EXCEPTION 'request_conflict';END IF;
  RETURN jsonb_build_object('active',current_pass.expires_at>now(),'expiresAt',current_pass.expires_at,
   'free',false,'duplicate',true,'wallet',public.simab_secure_wallet_action(p_subject,'state',0,NULL));
 END IF;
 SELECT * INTO current_pass FROM public.simab_ai_access_passes
 WHERE telegram_subject=p_subject AND expires_at>now() ORDER BY expires_at DESC LIMIT 1;
 IF FOUND THEN
  RETURN jsonb_build_object('active',true,'expiresAt',current_pass.expires_at,'free',false,'alreadyActive',true,
   'wallet',public.simab_secure_wallet_action(p_subject,'state',0,NULL));
 END IF;
 SELECT e.value INTO plan FROM jsonb_array_elements(cfg.plans) AS e(value)
 WHERE e.value->>'id'=p_plan_id LIMIT 1;
 IF plan IS NULL OR (plan->>'coins') !~ '^[0-9]{1,5}$' OR (plan->>'minutes') !~ '^[0-9]{1,3}$'
 THEN RAISE EXCEPTION 'invalid_ai_plan';END IF;
 charge=(plan->>'coins')::bigint;minutes=(plan->>'minutes')::integer;
 IF charge<1 OR charge>10000 OR minutes<1 OR minutes>180 THEN RAISE EXCEPTION 'invalid_ai_plan';END IF;
 IF w.coins<charge THEN RAISE EXCEPTION 'insufficient_coins';END IF;
 UPDATE public.simab_secure_wallets SET coins=coins-charge,updated_at=now() WHERE telegram_subject=p_subject;
 INSERT INTO public.simab_ai_access_passes(telegram_subject,request_id,plan_id,paid_coins,expires_at)
 VALUES(p_subject,p_request_id,p_plan_id,charge,now()+make_interval(mins=>minutes));
 INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,chip_delta,result)
 VALUES(p_subject,'ai-access:'||p_request_id::text,'ai_studio_access',-charge,0,jsonb_build_object('plan',p_plan_id,'minutes',minutes));
 RETURN jsonb_build_object('active',true,'free',false,'paidCoins',charge,'expiresAt',now()+make_interval(mins=>minutes),
  'wallet',public.simab_secure_wallet_action(p_subject,'state',0,NULL));
END;$f$;

CREATE FUNCTION public.simab_ai_archive_claim(p_subject text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
DECLARE cfg public.simab_ai_settings%ROWTYPE; existing public.simab_ai_archive_requests%ROWTYPE;
BEGIN
 IF p_subject !~ '^[1-9][0-9]{0,15}$' OR p_request_id IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 SELECT * INTO STRICT cfg FROM public.simab_ai_settings WHERE singleton FOR SHARE;
 IF NOT cfg.enabled OR NOT cfg.archive_enabled OR cfg.archive_channel_id IS NULL THEN RAISE EXCEPTION 'archive_not_ready';END IF;
 PERFORM public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 PERFORM 1 FROM public.simab_secure_wallets WHERE telegram_subject=p_subject FOR UPDATE;
 SELECT * INTO existing FROM public.simab_ai_archive_requests WHERE telegram_subject=p_subject AND request_id=p_request_id;
 IF FOUND THEN RETURN jsonb_build_object('reserved',false,'status',existing.status,'messageId',existing.message_id);END IF;
 IF NOT cfg.free_mode AND NOT EXISTS(SELECT 1 FROM public.simab_ai_access_passes WHERE telegram_subject=p_subject AND expires_at>now())
 THEN RAISE EXCEPTION 'ai_pass_required';END IF;
 IF EXISTS(SELECT 1 FROM public.simab_ai_archive_requests
  WHERE telegram_subject=p_subject AND created_at>now()-interval '15 seconds')
 THEN RAISE EXCEPTION 'archive_rate_limited';END IF;
 IF (SELECT count(*) FROM public.simab_ai_archive_requests
    WHERE telegram_subject=p_subject AND created_at>now()-interval '1 day')>=100
 THEN RAISE EXCEPTION 'archive_daily_limit';END IF;
 INSERT INTO public.simab_ai_archive_requests(telegram_subject,request_id) VALUES(p_subject,p_request_id);
 RETURN jsonb_build_object('reserved',true);
END;$f$;

REVOKE ALL ON FUNCTION public.simab_ai_activate(text,text,uuid),public.simab_ai_archive_claim(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_ai_activate(text,text,uuid),public.simab_ai_archive_claim(text,uuid) TO service_role;
COMMIT;
