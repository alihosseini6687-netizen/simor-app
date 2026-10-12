-- SIMAB Phase 2.3: central quest catalogue and verified administrative identity.
-- No legacy coins, chips, users or historical balances are touched.
BEGIN;

CREATE TABLE IF NOT EXISTS public.simab_admins (
  telegram_subject text PRIMARY KEY CHECK (telegram_subject ~ '^[0-9]{1,20}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- The current SIMAB owner's Telegram ID already appears in the existing admin UI.
-- This is an identifier, never a bot token; server still requires Telegram's signed initData.
INSERT INTO public.simab_admins(telegram_subject) VALUES ('702007470')
ON CONFLICT (telegram_subject) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.simab_central_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 100),
  url text NOT NULL CHECK (char_length(url) BETWEEN 12 AND 500 AND url ~ '^https://'),
  reward_coins integer NOT NULL CHECK (reward_coins BETWEEN 0 AND 10000),
  timer_seconds smallint NOT NULL DEFAULT 20 CHECK (timer_seconds BETWEEN 10 AND 120),
  verification_mode text NOT NULL DEFAULT 'external_visit'
    CHECK (verification_mode IN ('external_visit','telegram_membership')),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS simab_central_quests_active_idx
  ON public.simab_central_quests(is_published,created_at DESC);

ALTER TABLE public.simab_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simab_central_quests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.simab_admins, public.simab_central_quests
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simab_admins,
  public.simab_central_quests TO service_role;

COMMENT ON TABLE public.simab_central_quests IS
  'Central mission definitions only. Rewards are NOT payable until server-side verification and an idempotent wallet ledger are deployed.';
COMMIT;
