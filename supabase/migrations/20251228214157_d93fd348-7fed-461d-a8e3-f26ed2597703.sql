-- Add batch_start column to case_parse_queue for multi-batch processing
ALTER TABLE public.case_parse_queue 
ADD COLUMN IF NOT EXISTS batch_start integer DEFAULT 0;