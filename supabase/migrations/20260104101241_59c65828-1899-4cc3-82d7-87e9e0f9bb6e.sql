-- Add input_format to differentiate PDF vs HTML input
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'causelist_input_format') THEN
    CREATE TYPE causelist_input_format AS ENUM ('PDF', 'HTML');
  END IF;
END$$;

-- Add source_granularity to indicate document scope
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_granularity') THEN
    CREATE TYPE source_granularity AS ENUM ('FULL_CAUSELIST', 'COURT_SECTION', 'LAWYER_FILTERED');
  END IF;
END$$;

-- Add new columns to raw_causelists
ALTER TABLE public.raw_causelists 
ADD COLUMN IF NOT EXISTS input_format causelist_input_format DEFAULT 'PDF',
ADD COLUMN IF NOT EXISTS source_granularity source_granularity DEFAULT 'FULL_CAUSELIST',
ADD COLUMN IF NOT EXISTS structure_confidence numeric(3,2) DEFAULT NULL;

-- Add origin column to daily_court_docket for tracking source
ALTER TABLE public.daily_court_docket
ADD COLUMN IF NOT EXISTS origin text DEFAULT 'PDF',
ADD COLUMN IF NOT EXISTS confidence_source text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS structure_confidence numeric(3,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS raw_causelist_id uuid DEFAULT NULL;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_raw_causelists_input_format ON public.raw_causelists(input_format);
CREATE INDEX IF NOT EXISTS idx_daily_court_docket_origin ON public.daily_court_docket(origin);

-- Add comments for documentation
COMMENT ON COLUMN public.raw_causelists.input_format IS 'File format: PDF or HTML';
COMMENT ON COLUMN public.raw_causelists.source_granularity IS 'Scope of the document: FULL_CAUSELIST (entire day), COURT_SECTION (single court), LAWYER_FILTERED (search results)';
COMMENT ON COLUMN public.raw_causelists.structure_confidence IS 'Confidence in structural parsing: 0.9 for HTML, 0.6-0.75 for PDF';
COMMENT ON COLUMN public.daily_court_docket.origin IS 'Source type: PDF, HTML_FULL_CAUSELIST, HTML_SEARCH';
COMMENT ON COLUMN public.daily_court_docket.confidence_source IS 'What determined the confidence: court_structure, ai_parse, alias_match';
COMMENT ON COLUMN public.daily_court_docket.structure_confidence IS 'Confidence in the case data structure (0-1)';
COMMENT ON COLUMN public.daily_court_docket.raw_causelist_id IS 'Reference to the source causelist';