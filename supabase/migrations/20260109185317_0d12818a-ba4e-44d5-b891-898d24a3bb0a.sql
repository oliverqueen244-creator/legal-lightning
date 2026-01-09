-- Add case_title_raw column to store verbatim case title for auditability
ALTER TABLE public.daily_court_docket 
ADD COLUMN IF NOT EXISTS case_title_raw TEXT;