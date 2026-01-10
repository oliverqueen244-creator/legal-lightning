-- Create a function to normalize lawyer names in SQL for matching
CREATE OR REPLACE FUNCTION normalize_lawyer_name(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
BEGIN
  IF name IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Convert to uppercase and trim
  normalized := UPPER(TRIM(name));
  
  -- Remove common prefixes (order matters - longer patterns first)
  normalized := regexp_replace(normalized, '^(SENIOR ADV\.?\s*|SR\.?\s*ADV\.?\s*)', '', 'i');
  normalized := regexp_replace(normalized, '^(JUNIOR ADV\.?\s*|JR\.?\s*ADV\.?\s*)', '', 'i');
  normalized := regexp_replace(normalized, '^(ADV\.?\s+|ADVOCATE\s+|ADVT\.?\s+|ADVC\.?\s+)', '', 'i');
  normalized := regexp_replace(normalized, '^(MR\.?\s+|MRS\.?\s+|MS\.?\s+|MISS\s+)', '', 'i');
  normalized := regexp_replace(normalized, '^(DR\.?\s+|PROF\.?\s+)', '', 'i');
  normalized := regexp_replace(normalized, '^(SHRI\s+|SMT\.?\s+|KUMARI\s+|KU\.?\s+)', '', 'i');
  normalized := regexp_replace(normalized, '^(LD\.?\s+|LEARNED\s+)', '', 'i');
  normalized := regexp_replace(normalized, '^(ADHIVAKTA\s+|VAKIL\s+)', '', 'i');
  
  -- Normalize whitespace
  normalized := regexp_replace(normalized, '\s+', ' ', 'g');
  
  -- Remove trailing punctuation
  normalized := regexp_replace(normalized, '[.,;:]+$', '');
  
  RETURN TRIM(normalized);
END;
$$;

-- Update the admin matching function to use normalized names
CREATE OR REPLACE FUNCTION admin_match_cases_for_profile(
  p_profile_id UUID,
  p_alias_pattern TEXT,
  p_from_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matched_count INTEGER := 0;
  v_pet_count INTEGER := 0;
  v_res_count INTEGER := 0;
  v_normalized_pattern TEXT;
BEGIN
  -- Normalize the search pattern
  v_normalized_pattern := normalize_lawyer_name(p_alias_pattern);
  
  -- Update petitioner lawyer matches (using normalized comparison)
  WITH updated AS (
    UPDATE daily_court_docket 
    SET matched_profile_id = p_profile_id,
        matched_role = 'petitioner',
        match_method = 'auto_match',
        match_confidence = 0.95,
        fingerprint_matched_at = NOW()
    WHERE normalize_lawyer_name(petitioner_lawyer) ILIKE '%' || v_normalized_pattern || '%'
    AND date >= p_from_date
    AND matched_profile_id IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_pet_count FROM updated;
  
  -- Update respondent lawyer matches (using normalized comparison)
  WITH updated AS (
    UPDATE daily_court_docket 
    SET matched_profile_id = p_profile_id,
        matched_role = 'respondent',
        match_method = 'auto_match',
        match_confidence = 0.95,
        fingerprint_matched_at = NOW()
    WHERE normalize_lawyer_name(respondent_lawyer) ILIKE '%' || v_normalized_pattern || '%'
    AND date >= p_from_date
    AND matched_profile_id IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_res_count FROM updated;
  
  v_matched_count := v_pet_count + v_res_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'matched_count', v_matched_count,
    'petitioner_matches', v_pet_count,
    'respondent_matches', v_res_count,
    'profile_id', p_profile_id,
    'alias_pattern', p_alias_pattern,
    'normalized_pattern', v_normalized_pattern
  );
END;
$$;