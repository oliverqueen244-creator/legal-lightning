-- Fix function search_path for generate_case_fingerprint
CREATE OR REPLACE FUNCTION public.generate_case_fingerprint(p_court_location text, p_case_number text, p_petitioner text, p_respondent text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = public
AS $function$
DECLARE
  normalized_case text;
  normalized_petitioner text;
  normalized_respondent text;
BEGIN
  -- Normalize case number (remove spaces, convert to uppercase)
  normalized_case := UPPER(TRIM(REGEXP_REPLACE(COALESCE(p_case_number, ''), '\s+', '', 'g')));
  
  -- Normalize party names (lowercase, trim, remove extra spaces)
  normalized_petitioner := LOWER(TRIM(REGEXP_REPLACE(COALESCE(p_petitioner, ''), '\s+', ' ', 'g')));
  normalized_respondent := LOWER(TRIM(REGEXP_REPLACE(COALESCE(p_respondent, ''), '\s+', ' ', 'g')));
  
  -- Generate fingerprint using MD5 hash of concatenated normalized values
  RETURN MD5(
    COALESCE(UPPER(p_court_location), '') || '|' ||
    normalized_case || '|' ||
    normalized_petitioner || '|' ||
    normalized_respondent
  );
END;
$function$;