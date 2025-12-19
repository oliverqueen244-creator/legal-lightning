-- Add columns to live_board_cache for enhanced tracking
ALTER TABLE public.live_board_cache
ADD COLUMN IF NOT EXISTS list_type TEXT DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS cross_court_from TEXT DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.live_board_cache.list_type IS 'Current list type: daily or supplementary';
COMMENT ON COLUMN public.live_board_cache.cross_court_from IS 'Source court number if case reassigned from another court';