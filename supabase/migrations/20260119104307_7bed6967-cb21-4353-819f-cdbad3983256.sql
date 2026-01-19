-- Table to track individual case item durations
CREATE TABLE public.case_item_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_location TEXT NOT NULL,
  court_no TEXT NOT NULL,
  item_no INTEGER NOT NULL,
  is_supplementary BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient queries by court and date
CREATE INDEX idx_case_durations_court_date 
  ON public.case_item_durations(court_location, court_no, session_date);

-- Index for calculating averages (only completed items)
CREATE INDEX idx_case_durations_completed 
  ON public.case_item_durations(court_location, court_no) 
  WHERE duration_seconds IS NOT NULL;

-- Unique constraint to prevent duplicate entries for same item in same session
CREATE UNIQUE INDEX idx_case_durations_unique_item 
  ON public.case_item_durations(court_location, court_no, item_no, is_supplementary, session_date)
  WHERE ended_at IS NULL;

-- Table to store pre-computed court averages for fast lookups
CREATE TABLE public.court_avg_duration (
  court_location TEXT NOT NULL,
  court_no TEXT NOT NULL,
  avg_seconds_per_case NUMERIC(8,2),
  sample_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (court_location, court_no)
);

-- Enable RLS on both tables
ALTER TABLE public.case_item_durations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_avg_duration ENABLE ROW LEVEL SECURITY;

-- Read-only policy for authenticated users (they just need to view averages)
CREATE POLICY "Anyone can view case durations"
  ON public.case_item_durations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view court averages"
  ON public.court_avg_duration FOR SELECT
  USING (true);

-- Service role can insert/update (edge functions)
CREATE POLICY "Service role can manage case durations"
  ON public.case_item_durations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage court averages"
  ON public.court_avg_duration FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to calculate court averages (called by aggregation job)
CREATE OR REPLACE FUNCTION public.calculate_court_averages()
RETURNS TABLE (
  court_location TEXT,
  court_no TEXT,
  avg_seconds NUMERIC,
  sample_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    cid.court_location,
    cid.court_no,
    AVG(cid.duration_seconds)::NUMERIC(8,2) as avg_seconds,
    COUNT(*)::INTEGER as sample_count
  FROM public.case_item_durations cid
  WHERE cid.duration_seconds IS NOT NULL
    AND cid.duration_seconds BETWEEN 30 AND 3600  -- Filter outliers (30s to 1hr)
    AND cid.session_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY cid.court_location, cid.court_no
$$;

-- Function to refresh all court averages
CREATE OR REPLACE FUNCTION public.refresh_court_averages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  INSERT INTO public.court_avg_duration (court_location, court_no, avg_seconds_per_case, sample_count, last_updated)
  SELECT 
    court_location,
    court_no,
    avg_seconds,
    sample_count,
    now()
  FROM public.calculate_court_averages()
  ON CONFLICT (court_location, court_no) 
  DO UPDATE SET 
    avg_seconds_per_case = EXCLUDED.avg_seconds_per_case,
    sample_count = EXCLUDED.sample_count,
    last_updated = now();
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;