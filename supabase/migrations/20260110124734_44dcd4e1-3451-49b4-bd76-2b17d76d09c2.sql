-- Create a simpler trigger that matches directly in the database
-- This avoids the complexity of HTTP calls from triggers

CREATE OR REPLACE FUNCTION public.auto_match_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_match_profile_id UUID;
  v_match_role TEXT;
  v_match_confidence NUMERIC;
  v_matched_alias TEXT;
  v_pet_normalized TEXT;
  v_res_normalized TEXT;
BEGIN
  -- Skip if already matched
  IF NEW.matched_profile_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Normalize lawyer names
  v_pet_normalized := normalize_lawyer_name(NEW.petitioner_lawyer);
  v_res_normalized := normalize_lawyer_name(NEW.respondent_lawyer);
  
  -- Skip if no lawyer info
  IF v_pet_normalized IS NULL AND v_res_normalized IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Try to match petitioner lawyer first
  IF v_pet_normalized IS NOT NULL THEN
    SELECT la.profile_id, la.alias_name
    INTO v_match_profile_id, v_matched_alias
    FROM lawyer_aliases la
    WHERE normalize_lawyer_name(la.alias_name) IS NOT NULL
    AND v_pet_normalized ILIKE '%' || normalize_lawyer_name(la.alias_name) || '%'
    ORDER BY LENGTH(la.alias_name) DESC  -- Prefer longer aliases (more specific)
    LIMIT 1;
    
    IF v_match_profile_id IS NOT NULL THEN
      v_match_role := 'petitioner';
      v_match_confidence := 0.95;
    END IF;
  END IF;
  
  -- If no petitioner match, try respondent
  IF v_match_profile_id IS NULL AND v_res_normalized IS NOT NULL THEN
    SELECT la.profile_id, la.alias_name
    INTO v_match_profile_id, v_matched_alias
    FROM lawyer_aliases la
    WHERE normalize_lawyer_name(la.alias_name) IS NOT NULL
    AND v_res_normalized ILIKE '%' || normalize_lawyer_name(la.alias_name) || '%'
    ORDER BY LENGTH(la.alias_name) DESC
    LIMIT 1;
    
    IF v_match_profile_id IS NOT NULL THEN
      v_match_role := 'respondent';
      v_match_confidence := 0.95;
    END IF;
  END IF;
  
  -- Update the record if we found a match
  IF v_match_profile_id IS NOT NULL THEN
    NEW.matched_profile_id := v_match_profile_id;
    NEW.matched_role := v_match_role;
    NEW.match_method := 'auto_match';
    NEW.match_confidence := v_match_confidence;
    NEW.fingerprint_matched_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create BEFORE INSERT trigger (modifies NEW directly)
DROP TRIGGER IF EXISTS auto_match_on_insert ON public.daily_court_docket;
DROP TRIGGER IF EXISTS auto_match_on_update ON public.daily_court_docket;

CREATE TRIGGER auto_match_before_insert
  BEFORE INSERT ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_match_on_insert();