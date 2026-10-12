-- SIMAB verified quest ledger. Run AFTER central_quests_admins migration.
-- Does NOT import, overwrite or spend browser/CloudStorage coins.
BEGIN;
CREATE TABLE IF NOT EXISTS public.simab_verified_quest_balances (
 telegram_subject text PRIMARY KEY CHECK (telegram_subject ~ '^[0-9]{1,20}$'),
 coins bigint NOT NULL DEFAULT 0 CHECK (coins >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.simab_verified_quest_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 telegram_subject text NOT NULL CHECK (telegram_subject ~ '^[0-9]{1,20}$'),
 quest_id uuid NOT NULL REFERENCES public.simab_central_quests(id) ON DELETE RESTRICT,
 reward_coins integer NOT NULL CHECK (reward_coins BETWEEN 1 AND 10000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(telegram_subject,quest_id)
);
CREATE INDEX IF NOT EXISTS simab_verified_quest_claims_subject_idx
 ON public.simab_verified_quest_claims(telegram_subject,created_at DESC);
ALTER TABLE public.simab_verified_quest_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simab_verified_quest_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.simab_verified_quest_balances, public.simab_verified_quest_claims
 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simab_verified_quest_balances,
 public.simab_verified_quest_claims TO service_role;

-- Single DB transaction prevents concurrent double-credit.
-- Caller MUST verify signed Telegram identity and channel membership.
CREATE OR REPLACE FUNCTION public.simab_credit_verified_quest(
 p_telegram_subject text,p_quest_id uuid)
RETURNS TABLE(granted boolean,verified_coins bigint,reward_coins integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
 v_reward integer;
 v_created boolean := false;
 v_balance bigint := 0;
BEGIN
 IF p_telegram_subject IS NULL OR p_telegram_subject !~ '^[0-9]{1,20}$' THEN
   RAISE EXCEPTION 'invalid_subject' USING ERRCODE='22023';
 END IF;
 SELECT q.reward_coins INTO v_reward FROM public.simab_central_quests q
 WHERE q.id=p_quest_id AND q.is_published
 AND q.verification_mode='telegram_membership'
 AND q.reward_coins BETWEEN 1 AND 10000 FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'not_rewardable' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.simab_verified_quest_claims(telegram_subject,quest_id,reward_coins)
 VALUES(p_telegram_subject,p_quest_id,v_reward)
 ON CONFLICT(telegram_subject,quest_id) DO NOTHING
 RETURNING TRUE INTO v_created;
 IF COALESCE(v_created,FALSE) THEN
   INSERT INTO public.simab_verified_quest_balances AS b(telegram_subject,coins,updated_at)
   VALUES(p_telegram_subject,v_reward,now())
   ON CONFLICT(telegram_subject) DO UPDATE SET coins=b.coins+EXCLUDED.coins,
   updated_at=now() RETURNING coins INTO v_balance;
 ELSE
   SELECT b.coins INTO v_balance FROM public.simab_verified_quest_balances b
   WHERE b.telegram_subject=p_telegram_subject;
 END IF;
 RETURN QUERY SELECT COALESCE(v_created,FALSE),COALESCE(v_balance,0),v_reward;
END;
$fn$;
REVOKE ALL ON FUNCTION public.simab_credit_verified_quest(text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simab_credit_verified_quest(text,uuid) TO service_role;
COMMENT ON FUNCTION public.simab_credit_verified_quest(text,uuid) IS
 'Atomic one-time reward ledger. Run only after server Telegram getChatMember.';
COMMIT;
