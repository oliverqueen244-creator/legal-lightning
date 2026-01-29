-- Add index to eliminate sequential scans on daily_court_docket
CREATE INDEX IF NOT EXISTS idx_docket_date_profile ON daily_court_docket(date, matched_profile_id);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_docket_date_location ON daily_court_docket(date, court_location);

-- Add index for match-docket-aliases function that queries unmatched cases
CREATE INDEX IF NOT EXISTS idx_docket_unmatched ON daily_court_docket(date) WHERE matched_profile_id IS NULL;