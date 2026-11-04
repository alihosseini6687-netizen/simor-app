-- Mango Game: signed Telegram referral rewards; intentionally no browser-controlled credits.
-- First claim per invited account, one code per inviter, at most five rewarded invites
-- per inviter per UTC day. Rewards are virtual coins, not cash or withdrawable assets.
BEGIN;
CREATE TABLE public.simab_referral_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 enabled boolean NOT NULL DEFAULT true,
 inviter_reward integer NOT NULL DEFAULT 50 CHECK (inviter_reward BETWEEN 0 AND 1000),
 invitee_reward integer NOT NULL DEFAULT 50 CHECK (invitee_reward BETWEEN 0 AND 1000),
 daily_limit integer NOT NULL DEFAULT 5 CHECK (daily_limit BETWEEN 1 AND 50)
);
INSERT INTO public.simab_referral_settings(singleton) VALUES (true);

CREATE TABLE public.simab_referral_links (
 telegram_subject text PRIMARY KEY REFERENCES public.simab_secure_wallets(telegram_subject),
 code text NOT NULL UNIQUE CHECK (code ~ '^[a-f0-9]{32}$'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.simab_referral_claims (
 invitee_subject text PRIMARY KEY REFERENCES public.simab_secure_wallets(telegram_subject),
 inviter_subject text NOT NULL REFERENCES public.simab_secure_wallets(telegram_subject),
 code text NOT NULL REFERENCES public.simab_referral_links(code),
 invitee_reward integer NOT NULL,
 inviter_reward integer NOT NULL,
 claimed_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT simab_referral_no_self CHECK (invitee_subject <> inviter_subject)
);
CREATE INDEX simab_referral_inviter_day ON public.simab_referral_claims(inviter_subject,claimed_at DESC);

ALTER TABLE public.simab_referral_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simab_referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simab_referral_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.simab_referral_settings,public.simab_referral_links,public.simab_referral_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.simab_referral_settings TO service_role;
GRANT SELECT,INSERT ON public.simab_referral_links,public.simab_referral_claims TO service_role;
GRANT SELECT ON public.simab_referral_links,public.simab_referral_claims TO service_role;

CREATE FUNCTION public.simab_referral_link(p_subject text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
DECLARE cfg public.simab_referral_settings%ROWTYPE; ref text; used integer;
BEGIN
 IF p_subject !~ '^[1-9][0-9]{0,15}$' THEN RAISE EXCEPTION 'invalid_subject'; END IF;
 PERFORM public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 INSERT INTO public.simab_referral_links(telegram_subject,code)
 VALUES(p_subject,replace(gen_random_uuid()::text,'-',''))
 ON CONFLICT (telegram_subject) DO NOTHING;
 SELECT code INTO STRICT ref FROM public.simab_referral_links WHERE telegram_subject=p_subject;
 SELECT * INTO STRICT cfg FROM public.simab_referral_settings WHERE singleton=true;
 SELECT count(*) INTO used FROM public.simab_referral_claims WHERE inviter_subject=p_subject;
 RETURN jsonb_build_object('code',ref,'enabled',cfg.enabled,'inviterReward',cfg.inviter_reward,'inviteeReward',cfg.invitee_reward,'successfulInvites',used,'dailyLimit',cfg.daily_limit);
END;$f$;

CREATE FUNCTION public.simab_referral_claim(p_subject text,p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
DECLARE cfg public.simab_referral_settings%ROWTYPE; inviter text; used_today integer; already boolean; w_inviter public.simab_secure_wallets%ROWTYPE; w_invitee public.simab_secure_wallets%ROWTYPE;
BEGIN
 IF p_subject !~ '^[1-9][0-9]{0,15}$' OR p_code !~ '^[a-f0-9]{32}$' THEN RAISE EXCEPTION 'invalid_referral';END IF;
 SELECT telegram_subject INTO inviter FROM public.simab_referral_links WHERE code=p_code;
 IF inviter IS NULL THEN RAISE EXCEPTION 'invalid_referral';END IF;
 IF inviter=p_subject THEN RAISE EXCEPTION 'self_referral';END IF;
 PERFORM public.simab_secure_wallet_action(p_subject,'state',0,NULL);
 -- Lock both wallets in stable identity order. This serializes daily caps and duplicate claims.
 PERFORM 1 FROM public.simab_secure_wallets
  WHERE telegram_subject IN (inviter,p_subject) ORDER BY telegram_subject FOR UPDATE;
 SELECT * INTO STRICT w_inviter FROM public.simab_secure_wallets WHERE telegram_subject=inviter;
 SELECT * INTO STRICT w_invitee FROM public.simab_secure_wallets WHERE telegram_subject=p_subject;
 SELECT EXISTS(SELECT 1 FROM public.simab_referral_claims WHERE invitee_subject=p_subject) INTO already;
 IF already THEN RETURN jsonb_build_object('granted',false,'alreadyClaimed',true,'wallet',public.simab_secure_wallet_action(p_subject,'state',0,NULL));END IF;
 SELECT * INTO STRICT cfg FROM public.simab_referral_settings WHERE singleton=true;
 IF NOT cfg.enabled THEN RAISE EXCEPTION 'referrals_disabled';END IF;
 -- A prior financial event makes this an existing account, not a new referral.
 IF EXISTS(SELECT 1 FROM public.simab_secure_wallet_events WHERE telegram_subject=p_subject)
    OR w_invitee.coins<>0 OR w_invitee.chips<>0 THEN RAISE EXCEPTION 'existing_account';END IF;
 SELECT count(*) INTO used_today FROM public.simab_referral_claims
 WHERE inviter_subject=inviter AND claimed_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF used_today>=cfg.daily_limit THEN RAISE EXCEPTION 'referral_daily_limit';END IF;
 IF w_inviter.coins+cfg.inviter_reward>1000000000000 OR w_invitee.coins+cfg.invitee_reward>1000000000000 THEN RAISE EXCEPTION 'wallet_limit'; END IF;
 INSERT INTO public.simab_referral_claims(invitee_subject,inviter_subject,code,invitee_reward,inviter_reward)
 VALUES(p_subject,inviter,p_code,cfg.invitee_reward,cfg.inviter_reward);
 UPDATE public.simab_secure_wallets SET coins=coins+cfg.inviter_reward,updated_at=now() WHERE telegram_subject=inviter;
 UPDATE public.simab_secure_wallets SET coins=coins+cfg.invitee_reward,updated_at=now() WHERE telegram_subject=p_subject;
 INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,chip_delta,result)
 VALUES(inviter,'referral-inviter:'||p_subject,'referral_reward',cfg.inviter_reward,0,jsonb_build_object('invitee',p_subject));
 INSERT INTO public.simab_secure_wallet_events(telegram_subject,event_key,action,coin_delta,chip_delta,result)
 VALUES(p_subject,'referral-invitee:'||p_subject,'referral_welcome',cfg.invitee_reward,0,jsonb_build_object('inviter',inviter));
 RETURN jsonb_build_object('granted',true,'rewardCoins',cfg.invitee_reward,'inviterRewardCoins',cfg.inviter_reward,'wallet',public.simab_secure_wallet_action(p_subject,'state',0,NULL));
END;$f$;

REVOKE ALL ON FUNCTION public.simab_referral_link(text),public.simab_referral_claim(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_referral_link(text),public.simab_referral_claim(text,text) TO service_role;
COMMIT;
