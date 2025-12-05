-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.trigger_auto_match_aliases()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM extensions.http_post(
    url := 'https://pwpnnixoscppfzjogcgj.supabase.co/functions/v1/auto-match-aliases',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cG5uaXhvc2NwcGZ6am9nY2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTY5NzAsImV4cCI6MjA4MDMzMjk3MH0.DzT7tDz74hGo3WMHO2EACM2GkqrdXns1I3OXwHsTrRc"}'::jsonb,
    body := json_build_object(
      'docket_id', NEW.id,
      'petitioner_lawyer', NEW.petitioner_lawyer,
      'respondent_lawyer', NEW.respondent_lawyer
    )::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;