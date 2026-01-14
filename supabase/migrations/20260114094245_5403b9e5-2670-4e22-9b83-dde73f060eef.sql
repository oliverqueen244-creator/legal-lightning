-- Create table for lawyer case notes (in-system notes)
CREATE TABLE public.lawyer_case_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lawyer_id UUID NOT NULL,
  case_fingerprint TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: one note per lawyer + case
  UNIQUE(lawyer_id, case_fingerprint)
);

-- Enable RLS
ALTER TABLE public.lawyer_case_notes ENABLE ROW LEVEL SECURITY;

-- Lawyers can only see and manage their own notes
CREATE POLICY "Lawyers can view own notes"
ON public.lawyer_case_notes
FOR SELECT
USING (auth.uid() = lawyer_id);

CREATE POLICY "Lawyers can insert own notes"
ON public.lawyer_case_notes
FOR INSERT
WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Lawyers can update own notes"
ON public.lawyer_case_notes
FOR UPDATE
USING (auth.uid() = lawyer_id);

CREATE POLICY "Lawyers can delete own notes"
ON public.lawyer_case_notes
FOR DELETE
USING (auth.uid() = lawyer_id);

-- Trigger for updated_at
CREATE TRIGGER update_lawyer_case_notes_updated_at
BEFORE UPDATE ON public.lawyer_case_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_lawyer_case_notes_lawyer_id ON public.lawyer_case_notes(lawyer_id);
CREATE INDEX idx_lawyer_case_notes_fingerprint ON public.lawyer_case_notes(case_fingerprint);