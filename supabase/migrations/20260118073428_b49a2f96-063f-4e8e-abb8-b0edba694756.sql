
-- Drop the other unique constraint that prevents multi-lawyer matching
DROP INDEX IF EXISTS idx_docket_unique_case;
