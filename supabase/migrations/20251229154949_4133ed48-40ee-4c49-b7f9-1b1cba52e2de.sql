-- Add match metadata columns to daily_court_docket
ALTER TABLE public.daily_court_docket
ADD COLUMN IF NOT EXISTS matched_role text,
ADD COLUMN IF NOT EXISTS match_method text,
ADD COLUMN IF NOT EXISTS match_confidence decimal(4,3),
ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

-- Add check constraint for matched_role
ALTER TABLE public.daily_court_docket
ADD CONSTRAINT check_matched_role CHECK (matched_role IS NULL OR matched_role IN ('petitioner', 'respondent'));

-- Add check constraint for match_method  
ALTER TABLE public.daily_court_docket
ADD CONSTRAINT check_match_method CHECK (match_method IS NULL OR match_method IN ('exact', 'fuzzy'));

-- Add index for cases needing review
CREATE INDEX IF NOT EXISTS idx_docket_needs_review ON public.daily_court_docket(needs_review) WHERE needs_review = true;