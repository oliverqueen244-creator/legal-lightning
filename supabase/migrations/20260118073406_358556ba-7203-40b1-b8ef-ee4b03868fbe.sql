
-- Drop the existing unique constraint that prevents multi-lawyer matching
DROP INDEX IF EXISTS idx_daily_court_docket_unique_case;

-- Create a new unique constraint that includes matched_profile_id
-- This allows the same case to appear for multiple matched lawyers
CREATE UNIQUE INDEX idx_daily_court_docket_unique_case_per_lawyer 
ON daily_court_docket (court_location, court_room_no, case_number, date, matched_profile_id)
WHERE matched_profile_id IS NOT NULL;

-- Keep a separate index for unmatched cases to prevent true duplicates
CREATE UNIQUE INDEX idx_daily_court_docket_unique_case_unmatched 
ON daily_court_docket (court_location, court_room_no, case_number, date)
WHERE matched_profile_id IS NULL;
