-- Drop existing check constraints for court_location and list_type
ALTER TABLE daily_court_docket DROP CONSTRAINT IF EXISTS daily_court_docket_court_location_check;
ALTER TABLE daily_court_docket DROP CONSTRAINT IF EXISTS daily_court_docket_list_type_check;

-- No constraints - accept any values (the edge function will handle normalization)