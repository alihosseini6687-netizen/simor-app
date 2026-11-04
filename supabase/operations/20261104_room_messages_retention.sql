-- SIMAB production operation, applied 2026-11-04 as migration
-- simab_room_messages_30d_cron_20261104.
-- This file is deliberately OUTSIDE supabase/migrations:
-- the disposable PGlite test harness and vanilla PostgreSQL CI lack pg_cron.
-- Only run against a managed Supabase database where pg_cron is supported.
-- Do NOT run this operational change blindly on unrelated/staging projects.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Named cron.schedule is idempotent/upserted by pg_cron.
-- Each hour at minute 05 UTC removes room messages older than 30 days.
-- No wallet balances, game state, member list or message younger than 30 days is touched.
SELECT cron.schedule(
  'simab-expire-room-messages-30-days',
  '5 * * * *',
  $$DELETE FROM public.simab_room_messages WHERE created_at < NOW() - INTERVAL '30 days';$$
);

-- Production verification:
-- SELECT jobid,jobname,schedule,active,command
-- FROM cron.job WHERE jobname='simab-expire-room-messages-30-days';
-- SELECT count(*) FROM public.simab_room_messages
-- WHERE created_at < NOW()-INTERVAL '30 days';
-- To stop future deletion explicitly:
-- SELECT cron.unschedule('simab-expire-room-messages-30-days');
