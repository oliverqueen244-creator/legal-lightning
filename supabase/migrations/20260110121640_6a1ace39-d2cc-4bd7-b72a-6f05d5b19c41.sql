-- Create a function to manually match cases for a profile (bypasses RLS)
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
  v_case_ids UUID[];
BEGIN
  -- Update petitioner lawyer matches
  WITH updated AS (
    UPDATE daily_court_docket 
    SET matched_profile_id = p_profile_id,
        matched_role = 'petitioner_lawyer',
        match_method = 'admin_manual',
        match_confidence = 0.95,
        fingerprint_matched_at = NOW()
    WHERE petitioner_lawyer ILIKE '%' || p_alias_pattern || '%'
    AND date >= p_from_date
    AND matched_profile_id IS NULL
    RETURNING id
  )
  SELECT array_agg(id) INTO v_case_ids FROM updated;
  
  v_matched_count := COALESCE(array_length(v_case_ids, 1), 0);
  
  -- Update respondent lawyer matches
  WITH updated AS (
    UPDATE daily_court_docket 
    SET matched_profile_id = p_profile_id,
        matched_role = 'respondent_lawyer',
        match_method = 'admin_manual',
        match_confidence = 0.95,
        fingerprint_matched_at = NOW()
    WHERE respondent_lawyer ILIKE '%' || p_alias_pattern || '%'
    AND date >= p_from_date
    AND matched_profile_id IS NULL
    RETURNING id
  )
  SELECT v_matched_count + COALESCE(array_length(array_agg(id), 1), 0) INTO v_matched_count FROM updated;
  
  RETURN jsonb_build_object(
    'success', true,
    'matched_count', v_matched_count,
    'profile_id', p_profile_id,
    'alias_pattern', p_alias_pattern
  );
END;
$$;

-- Grant execute to authenticated users (will be restricted by app logic)
GRANT EXECUTE ON FUNCTION admin_match_cases_for_profile TO authenticated;