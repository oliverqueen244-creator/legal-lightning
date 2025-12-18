-- Phase 1: Schema Changes for Document Management & Case Fingerprinting

-- Create document type enum
CREATE TYPE public.document_type AS ENUM (
  'CAUSELIST_PDF',
  'PETITION',
  'REPLY',
  'REJOINDER',
  'ORDER',
  'ANNEXURES',
  'NOTES'
);

-- Create document language enum
CREATE TYPE public.document_language AS ENUM ('EN', 'HI', 'MIXED', 'UNKNOWN');

-- Create document format enum
CREATE TYPE public.document_format AS ENUM ('TYPED', 'SCANNED', 'HANDWRITTEN');

-- Create document legibility enum
CREATE TYPE public.document_legibility AS ENUM ('CLEAR', 'AVERAGE', 'POOR');

-- Add new columns to case_documents
ALTER TABLE public.case_documents 
ADD COLUMN IF NOT EXISTS document_type document_type,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pending_review boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS language document_language DEFAULT 'UNKNOWN',
ADD COLUMN IF NOT EXISTS format document_format DEFAULT 'TYPED',
ADD COLUMN IF NOT EXISTS legibility document_legibility DEFAULT 'CLEAR',
ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;

-- Add case fingerprint to daily_court_docket for case identity tracking
ALTER TABLE public.daily_court_docket
ADD COLUMN IF NOT EXISTS case_fingerprint text,
ADD COLUMN IF NOT EXISTS fingerprint_matched_at timestamp with time zone;

-- Create index on fingerprint for fast lookups
CREATE INDEX IF NOT EXISTS idx_docket_fingerprint ON public.daily_court_docket(case_fingerprint);

-- Add RLS policy for document updates (seniors can update review status)
CREATE POLICY "Seniors can update document review status"
ON public.case_documents
FOR UPDATE
USING (
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('SENIOR', 'ADMIN')
  )
);

-- Add RLS policy for document deletion (admins only)
CREATE POLICY "Admins can delete documents"
ON public.case_documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'ADMIN'
  )
);

-- Function to generate case fingerprint
CREATE OR REPLACE FUNCTION public.generate_case_fingerprint(
  p_court_location text,
  p_case_number text,
  p_petitioner text,
  p_respondent text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_case text;
  normalized_petitioner text;
  normalized_respondent text;
BEGIN
  -- Normalize case number (remove spaces, convert to uppercase)
  normalized_case := UPPER(TRIM(REGEXP_REPLACE(COALESCE(p_case_number, ''), '\s+', '', 'g')));
  
  -- Normalize party names (lowercase, trim, remove extra spaces)
  normalized_petitioner := LOWER(TRIM(REGEXP_REPLACE(COALESCE(p_petitioner, ''), '\s+', ' ', 'g')));
  normalized_respondent := LOWER(TRIM(REGEXP_REPLACE(COALESCE(p_respondent, ''), '\s+', ' ', 'g')));
  
  -- Generate fingerprint using MD5 hash of concatenated normalized values
  RETURN MD5(
    COALESCE(UPPER(p_court_location), '') || '|' ||
    normalized_case || '|' ||
    normalized_petitioner || '|' ||
    normalized_respondent
  );
END;
$$;

-- Trigger to auto-generate fingerprint on insert/update
CREATE OR REPLACE FUNCTION public.auto_set_case_fingerprint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.case_fingerprint := generate_case_fingerprint(
    NEW.court_location,
    NEW.case_number,
    NEW.petitioner,
    NEW.respondent
  );
  
  -- Check if this fingerprint exists in older records
  IF EXISTS (
    SELECT 1 FROM daily_court_docket 
    WHERE case_fingerprint = NEW.case_fingerprint 
    AND id != NEW.id
    AND date < NEW.date
  ) THEN
    NEW.fingerprint_matched_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for fingerprint generation
DROP TRIGGER IF EXISTS set_case_fingerprint ON public.daily_court_docket;
CREATE TRIGGER set_case_fingerprint
  BEFORE INSERT OR UPDATE ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_case_fingerprint();