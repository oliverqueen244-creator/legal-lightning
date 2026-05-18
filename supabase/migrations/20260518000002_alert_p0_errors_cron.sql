-- ============================================================
-- C-3: Schedule alert-p0-errors every 15 minutes
-- Requires pg_cron + pg_net (already enabled).
-- Requires app.settings.supabase_url and
-- app.settings.supabase_service_key to be set in DB config.
-- ============================================================

BEGIN;

-- Drop existing schedule if reapplying
SELECT cron.unschedule('alert-p0-errors')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'alert-p0-errors');

SELECT cron.schedule(
  'alert-p0-errors',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/alert-p0-errors',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);

COMMIT;
