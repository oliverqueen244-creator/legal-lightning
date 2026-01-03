-- Fix SECURITY DEFINER functions with proper input validation

-- 1. Update handle_new_user to validate role before casting
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role app_role;
  raw_role text;
BEGIN
  -- Insert profile (without role)
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  
  -- Validate role before casting to prevent cast errors
  raw_role := new.raw_user_meta_data ->> 'role';
  
  -- Only accept valid roles, default to JUNIOR for invalid/missing values
  IF raw_role IS NOT NULL AND raw_role IN ('SENIOR', 'JUNIOR', 'CLERK', 'ADMIN') THEN
    user_role := raw_role::app_role;
  ELSE
    user_role := 'JUNIOR'::app_role;
  END IF;
  
  -- Insert role into secure user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, user_role);
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't expose internal details
  RAISE WARNING 'handle_new_user failed for user %: %', new.id, SQLERRM;
  -- Re-raise a generic error to fail signup if profile creation fails
  RAISE EXCEPTION 'Failed to create user profile';
END;
$function$;

-- 2. Update trigger_auto_match_aliases to use app settings for anon key
-- This removes the hardcoded JWT token from the function
CREATE OR REPLACE FUNCTION public.trigger_auto_match_aliases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  anon_key TEXT;
  supabase_url TEXT;
  trigger_secret TEXT;
BEGIN
    -- IDEMPOTENCY: Skip if already matched with high confidence
    IF NEW.matched_profile_id IS NOT NULL AND COALESCE(NEW.match_confidence, 0) >= 0.95 THEN
        RETURN NEW;
    END IF;
    
    -- Skip if no lawyer info to match
    IF NEW.petitioner_lawyer IS NULL AND NEW.respondent_lawyer IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get configuration from app settings
    supabase_url := current_setting('app.settings.supabase_url', true);
    anon_key := current_setting('app.settings.supabase_anon_key', true);
    trigger_secret := current_setting('app.settings.trigger_secret', true);
    
    -- Validate required settings
    IF supabase_url IS NULL OR anon_key IS NULL THEN
        RAISE WARNING 'Auto-match trigger skipped: app.settings.supabase_url or app.settings.supabase_anon_key not configured';
        RETURN NEW;
    END IF;
    
    -- Use pg_net for async HTTP call
    PERFORM net.http_post(
        url := supabase_url || '/functions/v1/auto-match-aliases',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || anon_key,
            'x-trigger-secret', COALESCE(trigger_secret, '')
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

-- 3. Configure app settings for the trigger function (using vault for security)
-- Note: These settings need to be configured by the database administrator
-- The values below are placeholders that should be set in the Supabase dashboard
DO $$
BEGIN
  -- Set the Supabase URL (this is public information)
  PERFORM set_config('app.settings.supabase_url', 'https://pwpnnixoscppfzjogcgj.supabase.co', false);
  
  -- The anon key should be set via ALTER DATABASE or Supabase dashboard
  -- ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key';
  -- ALTER DATABASE postgres SET app.settings.trigger_secret = 'your-trigger-secret';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'App settings configuration note: %', SQLERRM;
END;
$$;