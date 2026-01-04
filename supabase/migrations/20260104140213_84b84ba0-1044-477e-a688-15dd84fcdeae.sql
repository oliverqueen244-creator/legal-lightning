-- Drop the existing constraint and add expanded one with new status values
ALTER TABLE public.raw_causelists DROP CONSTRAINT IF EXISTS raw_causelists_status_check;

ALTER TABLE public.raw_causelists ADD CONSTRAINT raw_causelists_status_check 
CHECK (status = ANY (ARRAY[
  'downloaded'::text, 
  'extracting'::text, 
  'text_extracted'::text, 
  'notes_extracted'::text, 
  'scanning'::text, 
  'scanned'::text, 
  'extract_error'::text,
  'parsed_complete'::text,
  'parsed_empty'::text
]));