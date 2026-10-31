BEGIN;
-- Forward-only RNG repair. No balances, payout expressions, dates or receipts change.
CREATE FUNCTION public.simab_random_below(p_bound integer) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $rng$
DECLARE bytes bytea; value bigint; cutoff bigint;
BEGIN
  IF p_bound IS NULL OR p_bound < 1 THEN RAISE EXCEPTION 'invalid_random_bound'; END IF;
  cutoff := 4294967296::bigint - (4294967296::bigint % p_bound);
  LOOP
    -- UUID v4 bytes 0..3 have no version/variant bits; all 32 bits are random.
    bytes := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
    value := pg_catalog.get_byte(bytes,0)*16777216::bigint
      + pg_catalog.get_byte(bytes,1)*65536::bigint
      + pg_catalog.get_byte(bytes,2)*256::bigint + pg_catalog.get_byte(bytes,3);
    IF value < cutoff THEN RETURN (value % p_bound)::integer; END IF;
  END LOOP;
END;
$rng$;
REVOKE ALL ON FUNCTION public.simab_random_below(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_random_below(integer) TO service_role;

-- Modify only the four known RNG assignments in the installed function. Abort
-- atomically on unexpected schema drift rather than replacing unrelated fixes.
DO $repair$
DECLARE definition text; original text; needle text; reel text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef('public.simab_secure_wallet_action(text,text,integer,uuid)'::regprocedure) INTO definition;
  original := definition;
  needle := 'v_rand:=v_rand % 100;';
  IF (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 THEN
    RAISE EXCEPTION 'unexpected_wallet_wheel_definition';
  END IF;
  definition := replace(definition,needle,'v_rand:=public.simab_random_below(100);');
  FOREACH reel IN ARRAY ARRAY['v_a','v_b','v_c'] LOOP
    needle := reel||':=pg_catalog.get_byte(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()),0)%6;';
    IF (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 THEN
      RAISE EXCEPTION 'unexpected_wallet_slot_definition';
    END IF;
    definition := replace(definition,needle,reel||':=public.simab_random_below(6);');
  END LOOP;
  IF definition = original THEN RAISE EXCEPTION 'wallet_rng_not_repaired'; END IF;
  EXECUTE definition;
END;
$repair$;
COMMIT;
