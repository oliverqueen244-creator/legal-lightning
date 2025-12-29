-- ============================================
-- VAKALAT OS - STEP 3: Trigger & RLS fixes
-- ============================================

-- FIX 6: Recreate trigger with idempotency check
DROP TRIGGER IF EXISTS trigger_auto_match_on_insert ON daily_court_docket;

CREATE OR REPLACE FUNCTION public.trigger_auto_match_aliases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- IDEMPOTENCY: Skip if already matched with high confidence
    IF NEW.matched_profile_id IS NOT NULL AND COALESCE(NEW.match_confidence, 0) >= 0.95 THEN
        RETURN NEW;
    END IF;
    
    -- Skip if no lawyer info to match
    IF NEW.petitioner_lawyer IS NULL AND NEW.respondent_lawyer IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Use pg_net for async HTTP call with environment-based secret
    PERFORM net.http_post(
        url := 'https://pwpnnixoscppfzjogcgj.supabase.co/functions/v1/auto-match-aliases',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cG5uaXhvc2NwcGZ6am9nY2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTY5NzAsImV4cCI6MjA4MDMzMjk3MH0.DzT7tDz74hGo3WMHO2EACM2GkqrdXns1I3OXwHsTrRc',
            'x-trigger-secret', COALESCE(current_setting('app.settings.trigger_secret', true), '')
        ),
        body := jsonb_build_object(
            'docket_id', NEW.id,
            'petitioner_lawyer', NEW.petitioner_lawyer,
            'respondent_lawyer', NEW.respondent_lawyer
        )
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log warning but don't block inserts
    RAISE WARNING 'Auto-match trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_auto_match_on_insert
AFTER INSERT ON daily_court_docket
FOR EACH ROW
EXECUTE FUNCTION trigger_auto_match_aliases();

-- FIX 7: Fix RLS on profile_scan_log - remove overly permissive policy
DROP POLICY IF EXISTS "Service role can manage scan logs" ON profile_scan_log;

CREATE POLICY "Service role can manage scan logs" 
ON public.profile_scan_log 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');