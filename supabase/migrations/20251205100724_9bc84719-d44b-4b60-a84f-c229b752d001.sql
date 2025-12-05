-- Add unique constraint on court_metadata for upsert to work correctly
ALTER TABLE court_metadata 
ADD CONSTRAINT court_metadata_bench_court_no_unique UNIQUE (bench, court_no);