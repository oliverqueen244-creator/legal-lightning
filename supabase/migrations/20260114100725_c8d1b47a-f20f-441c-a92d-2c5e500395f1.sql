-- Create case_hearings table for lawyer-confirmed hearing events
-- This is ADDITIVE - does not modify existing daily_court_docket or post_court_notes tables

-- Hearing source enum
CREATE TYPE public.hearing_source AS ENUM ('post_court', 'manual');

-- Case hearings table - stores confirmed hearing events
CREATE TABLE public.case_hearings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_fingerprint TEXT NOT NULL,
  hearing_date DATE NOT NULL,
  court_room_no TEXT,
  judge_names TEXT,
  was_heard BOOLEAN NOT NULL DEFAULT true,
  outcome TEXT,
  source public.hearing_source NOT NULL DEFAULT 'post_court',
  source_post_court_note_id UUID REFERENCES public.post_court_notes(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- One hearing per case per date per lawyer (avoid duplicates)
  CONSTRAINT unique_hearing_per_case_date_user UNIQUE (case_fingerprint, hearing_date, created_by)
);

-- Enable RLS
ALTER TABLE public.case_hearings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own hearings
CREATE POLICY "Users can view their own hearings" 
ON public.case_hearings 
FOR SELECT 
USING (auth.uid() = created_by);

-- Users can create their own hearings
CREATE POLICY "Users can create their own hearings" 
ON public.case_hearings 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- Users can update their own hearings
CREATE POLICY "Users can update their own hearings" 
ON public.case_hearings 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Users can delete their own hearings
CREATE POLICY "Users can delete their own hearings" 
ON public.case_hearings 
FOR DELETE 
USING (auth.uid() = created_by);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_case_hearings_updated_at
BEFORE UPDATE ON public.case_hearings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_case_hearings_fingerprint ON public.case_hearings(case_fingerprint);
CREATE INDEX idx_case_hearings_date ON public.case_hearings(hearing_date);
CREATE INDEX idx_case_hearings_created_by ON public.case_hearings(created_by);

-- Function to auto-create hearing when post_court_note is created
-- This derives hearings from post_court_notes (lawyer-confirmed events)
CREATE OR REPLACE FUNCTION public.derive_hearing_from_post_court_note()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update hearing based on post_court_note
  INSERT INTO public.case_hearings (
    case_fingerprint,
    hearing_date,
    court_room_no,
    judge_names,
    was_heard,
    outcome,
    source,
    source_post_court_note_id,
    created_by
  )
  SELECT 
    NEW.case_fingerprint,
    NEW.hearing_date,
    docket.court_room_no,
    docket.judge_names,
    true,
    NEW.what_happened,
    'post_court'::public.hearing_source,
    NEW.id,
    NEW.author_id
  FROM public.daily_court_docket docket
  WHERE docket.case_fingerprint = NEW.case_fingerprint
    AND docket.date = NEW.hearing_date
  LIMIT 1
  ON CONFLICT (case_fingerprint, hearing_date, created_by) 
  DO UPDATE SET
    was_heard = true,
    outcome = EXCLUDED.outcome,
    source_post_court_note_id = EXCLUDED.source_post_court_note_id,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on post_court_notes to auto-create hearings
CREATE TRIGGER auto_derive_hearing_on_post_court_note
AFTER INSERT OR UPDATE ON public.post_court_notes
FOR EACH ROW
EXECUTE FUNCTION public.derive_hearing_from_post_court_note();

-- Backfill existing post_court_notes into case_hearings
-- This ensures existing lawyer-confirmed notes become hearings
INSERT INTO public.case_hearings (
  case_fingerprint,
  hearing_date,
  court_room_no,
  judge_names,
  was_heard,
  outcome,
  source,
  source_post_court_note_id,
  created_by
)
SELECT DISTINCT ON (pcn.case_fingerprint, pcn.hearing_date, pcn.author_id)
  pcn.case_fingerprint,
  pcn.hearing_date,
  docket.court_room_no,
  docket.judge_names,
  true,
  pcn.what_happened,
  'post_court'::public.hearing_source,
  pcn.id,
  pcn.author_id
FROM public.post_court_notes pcn
LEFT JOIN public.daily_court_docket docket 
  ON docket.case_fingerprint = pcn.case_fingerprint
  AND docket.date = pcn.hearing_date
ON CONFLICT (case_fingerprint, hearing_date, created_by) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE public.case_hearings IS 'Lawyer-confirmed hearing events derived from post_court_notes or manually added. One hearing per case per date per lawyer.';