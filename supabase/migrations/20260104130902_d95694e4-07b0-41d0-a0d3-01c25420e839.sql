-- Add unique constraint for efficient batch upserts
-- This enables ON CONFLICT to work properly for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_court_docket_unique_case 
ON public.daily_court_docket (court_location, court_room_no, case_number, date);

-- Add index on raw_causelist_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_court_docket_causelist 
ON public.daily_court_docket (raw_causelist_id);

-- Add index on hearing_likelihood for filtering
CREATE INDEX IF NOT EXISTS idx_daily_court_docket_likelihood 
ON public.daily_court_docket (hearing_likelihood) 
WHERE hearing_likelihood IS NOT NULL;