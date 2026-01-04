-- Add source_type to differentiate PDF vs HTML sources
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'causelist_source_type') THEN
    CREATE TYPE causelist_source_type AS ENUM ('PDF', 'HTML_COMPLETE', 'HTML_SEARCH');
  END IF;
END$$;

-- Add new columns to raw_causelists
ALTER TABLE public.raw_causelists 
ADD COLUMN IF NOT EXISTS source_type causelist_source_type DEFAULT 'PDF',
ADD COLUMN IF NOT EXISTS query_lawyer_name text DEFAULT NULL;

-- Add index for efficient querying by source type
CREATE INDEX IF NOT EXISTS idx_raw_causelists_source_type ON public.raw_causelists(source_type);

-- Add comment for documentation
COMMENT ON COLUMN public.raw_causelists.source_type IS 'Type of causelist source: PDF (court PDFs), HTML_COMPLETE (full HTML causelists), HTML_SEARCH (lawyer-filtered search results)';
COMMENT ON COLUMN public.raw_causelists.query_lawyer_name IS 'For HTML_SEARCH: the lawyer name used to filter the search results';