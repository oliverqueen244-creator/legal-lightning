-- Update the function to use allowed matched_role values
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
BEGIN
  -- Update petitioner lawyer matches (role = 'petitioner' per constraint)
  WITH updated AS (
    UPDATE daily_court_docket 
    SET matched_profile_id = p_profile_id,
        matched_role = 'petitioner',
        match_method = 'auto_match',
        match_confidence = 0.95,
        fingerprint_matched_at = NOW()
    WHERE petitioner_lawyer ILIKE '%' || p_alias_pattern || '%'
    AND date >= p_from_date
    AND matched_profile_id IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_pet_count FROM updated;
  
  -- Update respondent lawyer matches (role = 'respondent' per constraint)
  WITH updated AS (
    UPDATE daily_court_docket 
    SET matched_profile_id = p_profile_id,
        matched_role = 'respondent',
        match_method = 'auto_match',
        match_confidence = 0.95,
        fingerprint_matched_at = NOW()
    WHERE respondent_lawyer ILIKE '%' || p_alias_pattern || '%'
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
    'alias_pattern', p_alias_pattern
  );
END;
$$;