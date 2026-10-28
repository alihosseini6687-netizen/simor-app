-- CI/disposable PostgreSQL ONLY. Not executed during this local batch.
BEGIN;
DO $test$
DECLARE definition text; value integer; i integer;
BEGIN
 SELECT pg_get_functiondef('public.simab_secure_wallet_action(text,text,integer,uuid)'::regprocedure) INTO definition;
 IF definition LIKE '%v_rand:=v_rand % 100;%' OR definition LIKE '%0)%6;%' THEN RAISE EXCEPTION 'biased_rng_remains'; END IF;
 IF definition NOT LIKE '%public.simab_random_below(100)%' OR definition NOT LIKE '%public.simab_random_below(6)%' THEN RAISE EXCEPTION 'rng_repair_missing'; END IF;
 FOR i IN 1..1000 LOOP
  value:=public.simab_random_below(6);IF value<0 OR value>=6 THEN RAISE EXCEPTION 'reel_out_of_range'; END IF;
  value:=public.simab_random_below(100);IF value<0 OR value>=100 THEN RAISE EXCEPTION 'wheel_out_of_range'; END IF;
 END LOOP;
 IF has_function_privilege('anon','public.simab_random_below(integer)','EXECUTE') OR has_function_privilege('authenticated','public.simab_random_below(integer)','EXECUTE') THEN RAISE EXCEPTION 'rng_public_grant'; END IF;
END;
$test$;
ROLLBACK;
