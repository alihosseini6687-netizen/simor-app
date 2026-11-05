-- Double-claim, old account, self-referral and daily-cap must not mint extra coins.
BEGIN;
DO $test$
DECLARE inviter text:='900000000400'; c text; k integer; r jsonb; refused boolean; got bigint;
BEGIN
 c:=public.simab_referral_link(inviter)->>'code';
 FOR k IN 1..5 LOOP
  r:=public.simab_referral_claim('90000000040'||k::text,c);
  IF r->>'granted'<>'true' THEN RAISE EXCEPTION 'valid referral rejected';END IF;
 END LOOP;
 SELECT coins INTO got FROM public.simab_secure_wallets WHERE telegram_subject=inviter;
 IF got<>250 THEN RAISE EXCEPTION 'wrong inviter reward';END IF;
 r:=public.simab_referral_claim('900000000401',c);
 IF r->>'alreadyClaimed'<>'true' THEN RAISE EXCEPTION 'repeat claim paid';END IF;
 SELECT coins INTO got FROM public.simab_secure_wallets WHERE telegram_subject=inviter;
 IF got<>250 THEN RAISE EXCEPTION 'double credit';END IF;
 refused:=false;
 BEGIN PERFORM public.simab_referral_claim('900000000406',c);
 EXCEPTION WHEN raise_exception THEN refused:=SQLERRM='referral_daily_limit';END;
 IF NOT refused THEN RAISE EXCEPTION 'daily referral cap bypassed';END IF;
 -- Existing accounts cannot claim even if the inviter is otherwise eligible.
 UPDATE public.simab_referral_settings SET daily_limit=10 WHERE singleton=true;
 PERFORM public.simab_secure_wallet_action('900000000407','state',0,NULL);
 UPDATE public.simab_secure_wallets SET coins=1 WHERE telegram_subject='900000000407';
 refused:=false;
 BEGIN PERFORM public.simab_referral_claim('900000000407',c);
 EXCEPTION WHEN raise_exception THEN refused:=SQLERRM='existing_account';END;
 IF NOT refused THEN RAISE EXCEPTION 'pre-funded account claimed new-user reward';END IF;
 refused:=false;
 BEGIN PERFORM public.simab_referral_claim(inviter,c);
 EXCEPTION WHEN raise_exception THEN refused:=SQLERRM='self_referral';END;
 IF NOT refused THEN RAISE EXCEPTION 'self referral accepted';END IF;
END;$test$;
ROLLBACK;
