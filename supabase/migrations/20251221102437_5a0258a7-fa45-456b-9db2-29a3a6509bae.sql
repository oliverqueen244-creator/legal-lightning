-- Add extraction_progress column to track chunked PDF text extraction
ALTER TABLE raw_causelists 
ADD COLUMN IF NOT EXISTS extraction_progress JSONB DEFAULT NULL;

COMMENT ON COLUMN raw_causelists.extraction_progress IS 
'Tracks chunked text extraction: {pages_done, total_pages, status, last_updated, error_count}';