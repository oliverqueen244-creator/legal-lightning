-- Add new columns to daily_court_docket for judge tracking and source URL
ALTER TABLE public.daily_court_docket 
ADD COLUMN IF NOT EXISTS judge_names text,
ADD COLUMN IF NOT EXISTS source_url text;

-- Rename judge_names to sitting_judges in court_metadata for clarity
ALTER TABLE public.court_metadata 
RENAME COLUMN judge_names TO sitting_judges;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_court_metadata_bench_court ON public.court_metadata(bench, court_no);
CREATE INDEX IF NOT EXISTS idx_docket_date_court ON public.daily_court_docket(date, court_location, court_room_no);