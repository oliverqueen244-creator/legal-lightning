-- Trigger function to call backfill when a new alias is inserted
CREATE OR REPLACE FUNCTION public.trigger_backfill_on_alias_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Use pg_net for async HTTP call (same pattern as trigger_auto_match_aliases)
    PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/backfill-alias-matches',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true),
            'x-trigger-secret', COALESCE(current_setting('app.settings.trigger_secret', true), '')
        ),
        body := jsonb_build_object(
            'profile_id', NEW.profile_id,
            'alias_name', NEW.alias_name,
            'alias_id', NEW.id
        )
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log warning but don't block alias inserts
    RAISE WARNING 'Backfill trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- Create the trigger on lawyer_aliases table
CREATE TRIGGER trigger_backfill_on_alias
AFTER INSERT ON public.lawyer_aliases
FOR EACH ROW
EXECUTE FUNCTION public.trigger_backfill_on_alias_insert();