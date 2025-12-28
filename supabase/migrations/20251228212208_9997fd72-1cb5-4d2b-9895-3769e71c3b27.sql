-- Drop the old constraint and add a new one with all needed statuses
ALTER TABLE public.raw_causelists DROP CONSTRAINT IF EXISTS raw_causelists_status_check;

ALTER TABLE public.raw_causelists 
ADD CONSTRAINT raw_causelists_status_check 
CHECK (status = ANY (ARRAY['downloaded', 'extracting', 'text_extracted', 'notes_extracted', 'scanning', 'scanned', 'extract_error']));

-- Also fix live_board_cache status constraint
ALTER TABLE public.live_board_cache DROP CONSTRAINT IF EXISTS live_board_cache_status_check;

ALTER TABLE public.live_board_cache 
ADD CONSTRAINT live_board_cache_status_check 
CHECK (status = ANY (ARRAY['hearing', 'passover', 'lunch', 'adjourned', 'not_sitting']));