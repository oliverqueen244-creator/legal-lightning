-- Add is_active column to live_board_cache to track which courts are currently sitting
ALTER TABLE live_board_cache ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Update existing rows to be inactive (they'll be marked active on next scrape during court hours)
UPDATE live_board_cache SET is_active = false WHERE is_active IS NULL;