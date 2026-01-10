-- Update the enforcement trigger to allow system-level operations
CREATE OR REPLACE FUNCTION public.enforce_lawyer_ownership_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip enforcement if called from a SECURITY DEFINER context with no auth (system operation)
  -- This allows admin functions and edge functions to update ownership fields
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if ownership fields are being modified
  IF (
    OLD.matched_profile_id IS DISTINCT FROM NEW.matched_profile_id
    OR OLD.force_active IS DISTINCT FROM NEW.force_active
    OR OLD.matched_role IS DISTINCT FROM NEW.matched_role
    OR OLD.match_method IS DISTINCT FROM NEW.match_method
    OR OLD.match_confidence IS DISTINCT FROM NEW.match_confidence
  ) THEN
    -- Must be a lawyer role to modify these fields
    IF NOT public.is_lawyer_role(auth.uid()) THEN
      RAISE EXCEPTION 'CLERK role cannot modify ownership fields (matched_profile_id, force_active, etc.). Only SENIOR, JUNIOR, or ADMIN roles may update these fields.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;