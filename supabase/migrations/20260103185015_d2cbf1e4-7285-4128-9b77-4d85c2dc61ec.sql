-- Create confidence level enum
CREATE TYPE public.confidence_level AS ENUM ('excellent', 'good', 'degraded', 'risky', 'unsafe');

-- Create parser confidence runs table
CREATE TABLE public.parser_confidence_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  batch_id UUID,
  bench_code TEXT NOT NULL,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Detection and parsing metrics
  total_cases_detected INTEGER NOT NULL DEFAULT 0,
  total_cases_parsed INTEGER NOT NULL DEFAULT 0,
  total_cases_matched INTEGER NOT NULL DEFAULT 0,
  
  -- Error counts by domain
  parsing_error_count INTEGER NOT NULL DEFAULT 0,
  matching_error_count INTEGER NOT NULL DEFAULT 0,
  ingestion_error_count INTEGER NOT NULL DEFAULT 0,
  
  -- Confidence scoring
  confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_level confidence_level NOT NULL DEFAULT 'good',
  confidence_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Warning state
  warning_issued BOOLEAN NOT NULL DEFAULT false,
  
  -- Component scores for transparency
  ingestion_integrity_score INTEGER DEFAULT 0,
  parsing_stability_score INTEGER DEFAULT 0,
  matching_reliability_score INTEGER DEFAULT 0,
  historical_consistency_score INTEGER DEFAULT 0,
  
  UNIQUE(batch_id, bench_code)
);

-- Create index for efficient queries
CREATE INDEX idx_confidence_runs_bench_date ON public.parser_confidence_runs(bench_code, run_date DESC);
CREATE INDEX idx_confidence_runs_warning ON public.parser_confidence_runs(warning_issued, run_date DESC);
CREATE INDEX idx_confidence_runs_level ON public.parser_confidence_runs(confidence_level, run_date DESC);

-- Enable RLS
ALTER TABLE public.parser_confidence_runs ENABLE ROW LEVEL SECURITY;

-- Admin read-only policy
CREATE POLICY "Admins can view confidence runs"
ON public.parser_confidence_runs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'ADMIN'
  )
);

-- Service role can insert (for system jobs)
CREATE POLICY "Service role can insert confidence runs"
ON public.parser_confidence_runs
FOR INSERT
WITH CHECK (true);

-- Service role can update (for system jobs)
CREATE POLICY "Service role can update confidence runs"
ON public.parser_confidence_runs
FOR UPDATE
USING (true);

-- Create function to check if any bench has warnings for today
CREATE OR REPLACE FUNCTION public.get_active_confidence_warnings()
RETURNS TABLE (
  bench_code TEXT,
  confidence_level confidence_level,
  run_date DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bench_code, confidence_level, run_date
  FROM parser_confidence_runs
  WHERE run_date = CURRENT_DATE
  AND warning_issued = true
$$;