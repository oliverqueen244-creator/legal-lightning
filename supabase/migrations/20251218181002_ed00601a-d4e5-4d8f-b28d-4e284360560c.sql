-- Create judge_judgment_references table for Indian Kanoon links
CREATE TABLE public.judge_judgment_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  judge_name TEXT NOT NULL,
  court TEXT NOT NULL,
  case_type TEXT NOT NULL,
  judgment_date DATE NOT NULL,
  indian_kanoon_url TEXT NOT NULL,
  lawyer_names TEXT[] DEFAULT '{}',
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  added_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.judge_judgment_references ENABLE ROW LEVEL SECURITY;

-- Anyone can view judgment references (read-only for lawyers)
CREATE POLICY "Anyone can view judgment references"
  ON public.judge_judgment_references
  FOR SELECT
  USING (true);

-- Only admins can insert judgment references
CREATE POLICY "Admins can insert judgment references"
  ON public.judge_judgment_references
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'ADMIN'
    )
  );

-- Only admins can update judgment references
CREATE POLICY "Admins can update judgment references"
  ON public.judge_judgment_references
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'ADMIN'
    )
  );

-- Only admins can delete judgment references
CREATE POLICY "Admins can delete judgment references"
  ON public.judge_judgment_references
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'ADMIN'
    )
  );

-- Create index for efficient querying
CREATE INDEX idx_judgment_refs_judge ON public.judge_judgment_references(judge_name);
CREATE INDEX idx_judgment_refs_court ON public.judge_judgment_references(court);
CREATE INDEX idx_judgment_refs_case_type ON public.judge_judgment_references(case_type);