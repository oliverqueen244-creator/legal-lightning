-- ============================================
-- VAKALAT OS - STEP 2: Clean duplicates and add constraints
-- ============================================

-- Clean duplicates by keeping the one with valid court_room_no
DO $$
DECLARE
    dup_record RECORD;
    best_id UUID;
    to_delete UUID[];
BEGIN
    FOR dup_record IN
        SELECT date, court_location, case_number, COUNT(*) as cnt
        FROM daily_court_docket
        WHERE case_number IS NOT NULL
        GROUP BY date, court_location, case_number
        HAVING COUNT(*) > 1
    LOOP
        SELECT id INTO best_id
        FROM daily_court_docket
        WHERE date = dup_record.date
        AND court_location IS NOT DISTINCT FROM dup_record.court_location
        AND case_number = dup_record.case_number
        ORDER BY 
            CASE 
                WHEN court_room_no ~ '^[0-9]{1,2}$' THEN 0
                WHEN court_room_no ~ '^[A-Za-z]' THEN 1
                ELSE 2
            END,
            created_at ASC
        LIMIT 1;
        
        SELECT array_agg(id) INTO to_delete
        FROM daily_court_docket
        WHERE date = dup_record.date
        AND court_location IS NOT DISTINCT FROM dup_record.court_location
        AND case_number = dup_record.case_number
        AND id != best_id;
        
        IF to_delete IS NOT NULL THEN
            INSERT INTO docket_cleanup_log (deleted_docket_id, date, court_location, court_room_no, case_number, reason)
            SELECT id, dup_record.date, dup_record.court_location, court_room_no, dup_record.case_number, 
                   'Duplicate case - kept record with valid court_room_no'
            FROM daily_court_docket
            WHERE id = ANY(to_delete);
            
            DELETE FROM daily_court_docket WHERE id = ANY(to_delete);
        END IF;
    END LOOP;
END $$;

-- FIX 1: Create unique constraint on case identity
CREATE UNIQUE INDEX IF NOT EXISTS idx_docket_unique_case 
ON daily_court_docket (date, court_location, case_number) 
WHERE case_number IS NOT NULL;

-- FIX 8: Fix category codes in court_room_no (set to NULL if 3+ digits)
UPDATE daily_court_docket 
SET court_room_no = NULL 
WHERE court_room_no ~ '^[0-9]{3,}$';

-- Add check constraint to prevent category codes
ALTER TABLE daily_court_docket 
DROP CONSTRAINT IF EXISTS chk_court_room_no_not_category_code;

ALTER TABLE daily_court_docket 
ADD CONSTRAINT chk_court_room_no_not_category_code
CHECK (
    court_room_no IS NULL 
    OR court_room_no = 'UNKNOWN'
    OR court_room_no ~ '^[0-9]{1,2}[A-Za-z]?$'
    OR court_room_no ~ '^[A-Za-z]'
);