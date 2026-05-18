-- ============================================================
-- Daily scheduled jobs (pg_cron)
-- Requires pg_cron + pg_net + app.settings.supabase_url + service key.
-- ============================================================

BEGIN;

-- Causelist scrape — both benches, today's date.
-- 01:30 UTC = 07:00 IST, before court opens at 09:00 IST.

SELECT cron.unschedule('scrape-causelist-jaipur')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scrape-causelist-jaipur');

SELECT cron.unschedule('scrape-causelist-jodhpur')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scrape-causelist-jodhpur');

SELECT cron.schedule(
  'scrape-causelist-jaipur',
  '30 1 * * 1-6',  -- 07:00 IST Mon-Sat (court is closed Sunday)
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/scrape-causelist',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key', true)
    ),
    body := jsonb_build_object('bench', 'JAIPUR')
  )
  $$
);

SELECT cron.schedule(
  'scrape-causelist-jodhpur',
  '32 1 * * 1-6',  -- 07:02 IST, staggered to avoid hitting HC simultaneously
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/scrape-causelist',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key', true)
    ),
    body := jsonb_build_object('bench', 'JODHPUR')
  )
  $$
);

-- Revoke expired intern accounts daily at 00:30 UTC (06:00 IST)
SELECT cron.unschedule('revoke-expired-interns')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'revoke-expired-interns');

SELECT cron.schedule(
  'revoke-expired-interns',
  '30 0 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/revoke-expired-interns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);

COMMIT;
