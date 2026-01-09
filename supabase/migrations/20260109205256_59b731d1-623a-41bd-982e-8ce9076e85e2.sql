
-- Database constraint: Reject any update where matched_profile_id IS NOT NULL but match_method IS NULL
-- This ensures no UI or script can ever bypass auditability

CREATE OR REPLACE FUNCTION public.enforce_match_method_on_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- If matched_profile_id is being set (not null), match_method must also be set
  IF NEW.matched_profile_id IS NOT NULL AND NEW.match_method IS NULL THEN
    RAISE EXCEPTION 'Cannot set matched_profile_id without match_method. Every match must be auditable.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS enforce_match_auditability ON public.daily_court_docket;

-- Create trigger that fires before INSERT or UPDATE
CREATE TRIGGER enforce_match_auditability
  BEFORE INSERT OR UPDATE ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_match_method_on_profile();

-- Add comment for documentation
COMMENT ON FUNCTION public.enforce_match_method_on_profile() IS 
  'Ensures that every case match has an audit trail by requiring match_method when matched_profile_id is set.';
