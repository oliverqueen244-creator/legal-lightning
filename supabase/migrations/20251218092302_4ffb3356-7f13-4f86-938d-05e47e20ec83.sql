-- Drop the old trigger first
DROP TRIGGER IF EXISTS on_docket_insert_match_aliases ON public.daily_court_docket;

-- Recreate the function using pg_net extension (correct for Supabase)
CREATE OR REPLACE FUNCTION public.trigger_auto_match_aliases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Use pg_net for async HTTP calls (non-blocking)
  PERFORM net.http_post(
    url := 'https://pwpnnixoscppfzjogcgj.supabase.co/functions/v1/auto-match-aliases',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cG5uaXhvc2NwcGZ6am9nY2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTY5NzAsImV4cCI6MjA4MDMzMjk3MH0.DzT7tDz74hGo3WMHO2EACM2GkqrdXns1I3OXwHsTrRc',
      'x-trigger-secret', 'Xy9zA2bC4dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4xY5z='
    ),
    body := jsonb_build_object(
      'docket_id', NEW.id,
      'petitioner_lawyer', NEW.petitioner_lawyer,
      'respondent_lawyer', NEW.respondent_lawyer
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block inserts if HTTP call fails
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER on_docket_insert_match_aliases
AFTER INSERT ON public.daily_court_docket
FOR EACH ROW
EXECUTE FUNCTION public.trigger_auto_match_aliases();