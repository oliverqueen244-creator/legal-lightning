-- Morning Brief Scalability Optimization
-- Creates server-side counting function and composite indexes

-- Function for efficient history counting (NOT SECURITY DEFINER - uses RLS)
CREATE OR REPLACE FUNCTION get_previous_appearance_counts(
  fingerprints text[],
  before_date date
)
RETURNS TABLE(case_fingerprint text, appearance_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT dcd.case_fingerprint, COUNT(*)::bigint as appearance_count
  FROM daily_court_docket dcd
  WHERE dcd.case_fingerprint = ANY(fingerprints)
    AND dcd.date < before_date
  GROUP BY dcd.case_fingerprint
$$;

-- Index 1: History lookups by fingerprint+date
CREATE INDEX IF NOT EXISTS idx_docket_fingerprint_date 
  ON daily_court_docket (case_fingerprint, date);

-- Index 2: User+date lookups for docket queries
CREATE INDEX IF NOT EXISTS idx_docket_profile_date 
  ON daily_court_docket (matched_profile_id, date) 
  WHERE matched_profile_id IS NOT NULL;

-- Index 3: Document lookup by docket_id
CREATE INDEX IF NOT EXISTS idx_case_documents_docket 
  ON case_documents (docket_id);

-- Index 4: Arguments lookup by docket_id
CREATE INDEX IF NOT EXISTS idx_case_arguments_docket 
  ON case_arguments (docket_id);