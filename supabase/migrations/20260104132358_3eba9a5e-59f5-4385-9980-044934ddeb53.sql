
-- Drop old constraint and add new one with all note types
ALTER TABLE cause_list_notes DROP CONSTRAINT cause_list_notes_note_type_check;

ALTER TABLE cause_list_notes ADD CONSTRAINT cause_list_notes_note_type_check 
CHECK (note_type = ANY (ARRAY['NOTE', 'IMPORTANT', 'DIRECTION', 'OTHER', 'SUPPLEMENTARY_NOTE', 'TIME_CONDITION']));
