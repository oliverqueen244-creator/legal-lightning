-- Create court_overrides table for storing judge substitutions from supplementary lists
CREATE TABLE public.court_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  court_location TEXT NOT NULL,
  court_no TEXT NOT NULL,
  override_date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_serial INTEGER,
  to_serial INTEGER,
  new_judge TEXT,
  override_type TEXT NOT NULL DEFAULT 'judge_substitution',
  source_causelist_id UUID REFERENCES raw_causelists(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_DATE + INTERVAL '1 day')
);

-- Create index for quick lookups
CREATE INDEX idx_court_overrides_lookup ON public.court_overrides(court_location, court_no, override_date, is_active);

-- Enable RLS
ALTER TABLE public.court_overrides ENABLE ROW LEVEL SECURITY;

-- Anyone can view overrides
CREATE POLICY "Anyone can view court overrides"
  ON public.court_overrides
  FOR SELECT
  USING (true);

-- Service role can insert overrides
CREATE POLICY "Service role can insert court overrides"
  ON public.court_overrides
  FOR INSERT
  WITH CHECK (true);

-- Service role can update overrides  
CREATE POLICY "Service role can update court overrides"
  ON public.court_overrides
  FOR UPDATE
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.court_overrides;