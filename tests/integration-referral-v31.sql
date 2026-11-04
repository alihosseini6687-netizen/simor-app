BEGIN;
DO $test$
DECLARE a jsonb; b jsonb; c text; x bigint; y bigint; self_denied boolean:=false;
BEGIN
 a:=public.simab_referral_link('900000000011');
 c:=a->>'code';
 IF c !~ '^[a-f0-9]{32}$' THEN RAISE EXCEPTION 'referral link not generated'; END IF;
 IF (public.simab_referral_link('900000000011')->>'code')<>c THEN RAISE EXCEPTION 'referral code changed'; END IF;
 b:=public.simab_referral_claim('900000000012',c);
 IF b->>'granted'<>'true' THEN RAISE EXCEPTION 'valid referral not granted'; END IF;
 SELECT coins INTO x FROM public.simab_secure_wallets WHERE telegram_subject='900000000011';
 SELECT coins INTO y FROM public.simab_secure_wallets WHERE telegram_subject='900000000012';
 IF x<>50 OR y<>50 THEN RAISE EXCEPTION 'referral coin settlement wrong'; END IF;
 b:=public.simab_referral_claim('900000000012',c);
 IF b->>'granted'<>'false' THEN RAISE EXCEPTION 'duplicate referral payout'; END IF;
 SELECT coins INTO x FROM public.simab_secure_wallets WHERE telegram_subject='900000000011';
 IF x<>50 THEN RAISE EXCEPTION 'inviter duplicate credit'; END IF;
 BEGIN
  PERFORM public.simab_referral_claim('900000000011',c);
 EXCEPTION WHEN raise_exception THEN
  self_denied:=SQLERRM='self_referral';
 END;
 IF NOT self_denied THEN RAISE EXCEPTION 'self-referral accepted'; END IF;
END;$test$;
ROLLBACK;
