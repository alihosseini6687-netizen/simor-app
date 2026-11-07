-- SIMAB AI Studio v36: owner-managed, user-visible terms. No paid access or archive enabled by this migration.
ALTER TABLE public.simab_ai_settings
  ADD COLUMN IF NOT EXISTS terms_text text NOT NULL DEFAULT '';
ALTER TABLE public.simab_ai_settings
  ADD CONSTRAINT simab_ai_terms_length_v36 CHECK (char_length(terms_text) <= 5000);
COMMENT ON COLUMN public.simab_ai_settings.terms_text IS 'Owner-authored user-facing terms. Image channel publishing remains off unless archive consent terms are clearly populated.';
