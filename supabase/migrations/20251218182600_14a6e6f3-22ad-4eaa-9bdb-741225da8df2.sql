-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create post_court_notes table for capturing hearing outcomes
-- This is institutional memory, not documentation work
CREATE TABLE public.post_court_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_fingerprint TEXT NOT NULL,
  docket_id UUID REFERENCES public.daily_court_docket(id),
  hearing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  what_happened TEXT,
  next_direction TEXT,
  note_for_next TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: one note per case per day per author
  CONSTRAINT unique_note_per_case_date_author UNIQUE (case_fingerprint, hearing_date, author_id)
);

-- Enable RLS
ALTER TABLE public.post_court_notes ENABLE ROW LEVEL SECURITY;

-- Users can view notes for cases they have access to (via their aliases)
CREATE POLICY "Users can view own notes"
  ON public.post_court_notes
  FOR SELECT
  USING (auth.uid() = author_id);

-- Users can insert their own notes
CREATE POLICY "Users can insert own notes"
  ON public.post_court_notes
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Users can update their own notes (same day only - enforced in app)
CREATE POLICY "Users can update own notes"
  ON public.post_court_notes
  FOR UPDATE
  USING (auth.uid() = author_id);

-- Seniors/Admins can view all notes for supervision
CREATE POLICY "Seniors can view all notes"
  ON public.post_court_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('SENIOR', 'ADMIN')
    )
  );

-- Create indexes for efficient querying
CREATE INDEX idx_post_court_notes_fingerprint ON public.post_court_notes(case_fingerprint);
CREATE INDEX idx_post_court_notes_date ON public.post_court_notes(hearing_date);
CREATE INDEX idx_post_court_notes_author ON public.post_court_notes(author_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_post_court_notes_updated_at
  BEFORE UPDATE ON public.post_court_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comment for future modules
COMMENT ON TABLE public.post_court_notes IS 
'Post-Court Capture: Human-verified hearing notes. 
IMPORTANT: This is a human-verified signal and must always be preferred over AI inference in future modules.
These notes feed Case History, Morning Brief indicators, and Client Update generation.';