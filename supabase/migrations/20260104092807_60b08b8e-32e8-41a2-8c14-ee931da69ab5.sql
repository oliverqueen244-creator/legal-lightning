-- Add source and uploaded_by columns to raw_causelists
ALTER TABLE raw_causelists 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'telegram',
ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id);

-- Create index for filtering by source
CREATE INDEX IF NOT EXISTS idx_raw_causelists_source ON raw_causelists(source);

-- Comment for documentation
COMMENT ON COLUMN raw_causelists.source IS 'Origin of causelist: telegram, admin_upload, or web_scrape';
COMMENT ON COLUMN raw_causelists.uploaded_by IS 'Admin user who uploaded this causelist (null for telegram/scraper)';