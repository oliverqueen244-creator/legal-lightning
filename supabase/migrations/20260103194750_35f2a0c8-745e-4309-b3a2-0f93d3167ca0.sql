-- =============================================
-- SELF-HEALING PARSER FALLBACK SYSTEM
-- =============================================

-- Create enum for fallback levels
CREATE TYPE public.fallback_level AS ENUM (
  'primary',
  'fallback_1_lenient',
  'fallback_2_section',
  'fallback_3_historical'
);

-- Create parser_fallback_log table for audit trail
CREATE TABLE public.parser_fallback_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  bench_code text NOT NULL,
  fallback_level fallback_level NOT NULL,
  triggered_reason text NOT NULL,
  cases_before integer NOT NULL DEFAULT 0,
  cases_after integer NOT NULL DEFAULT 0,
  confidence_before integer NOT NULL DEFAULT 0,
  confidence_after integer NOT NULL DEFAULT 0,
  applied_at timestamp with time zone NOT NULL DEFAULT now(),
  parse_duration_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add index for efficient queries
CREATE INDEX idx_fallback_log_batch_id ON public.parser_fallback_log(batch_id);
CREATE INDEX idx_fallback_log_bench_code ON public.parser_fallback_log(bench_code);
CREATE INDEX idx_fallback_log_applied_at ON public.parser_fallback_log(applied_at DESC);

-- Enable RLS
ALTER TABLE public.parser_fallback_log ENABLE ROW LEVEL SECURITY;

-- Admin-only read access
CREATE POLICY "Admins can view fallback logs"
ON public.parser_fallback_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'ADMIN'::app_role
  )
);

-- Service role can insert (for backend jobs)
CREATE POLICY "Service role can insert fallback logs"
ON public.parser_fallback_log
FOR INSERT
WITH CHECK (true);

-- Create fallback_disabled_benches table for per-bench disable toggle
CREATE TABLE public.fallback_disabled_benches (
  bench_code text PRIMARY KEY,
  disabled_at timestamp with time zone NOT NULL DEFAULT now(),
  disabled_by uuid REFERENCES auth.users(id),
  reason text
);

-- Enable RLS
ALTER TABLE public.fallback_disabled_benches ENABLE ROW LEVEL SECURITY;

-- Admin-only access for disabled benches table
CREATE POLICY "Admins can view disabled benches"
ON public.fallback_disabled_benches
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'ADMIN'::app_role
  )
);

CREATE POLICY "Admins can insert disabled benches"
ON public.fallback_disabled_benches
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'ADMIN'::app_role
  )
);

CREATE POLICY "Admins can delete disabled benches"
ON public.fallback_disabled_benches
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'ADMIN'::app_role
  )
);

-- Add parse_mode column to parser_confidence_runs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'parser_confidence_runs' 
    AND column_name = 'parse_mode'
  ) THEN
    ALTER TABLE public.parser_confidence_runs 
    ADD COLUMN parse_mode text DEFAULT 'primary';
  END IF;
END$$;

-- Create view for fallback summary stats (admin only)
CREATE OR REPLACE VIEW public.fallback_summary_view AS
SELECT 
  DATE(applied_at) as fallback_date,
  bench_code,
  fallback_level,
  COUNT(*) as attempt_count,
  AVG(confidence_after - confidence_before) as avg_confidence_delta,
  SUM(CASE WHEN confidence_after > confidence_before THEN 1 ELSE 0 END) as improvement_count,
  SUM(cases_after - cases_before) as total_cases_recovered,
  MAX(applied_at) as last_attempt
FROM public.parser_fallback_log
GROUP BY DATE(applied_at), bench_code, fallback_level;

-- Function to check if fallback is disabled for a bench
CREATE OR REPLACE FUNCTION public.is_fallback_disabled(p_bench_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM fallback_disabled_benches
    WHERE bench_code = p_bench_code
  )
$$;

-- Function to log fallback attempt (called from backend)
CREATE OR REPLACE FUNCTION public.log_fallback_attempt(
  p_batch_id uuid,
  p_bench_code text,
  p_fallback_level text,
  p_triggered_reason text,
  p_cases_before integer,
  p_cases_after integer,
  p_confidence_before integer,
  p_confidence_after integer,
  p_parse_duration_ms integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO parser_fallback_log (
    batch_id,
    bench_code,
    fallback_level,
    triggered_reason,
    cases_before,
    cases_after,
    confidence_before,
    confidence_after,
    parse_duration_ms
  ) VALUES (
    p_batch_id,
    p_bench_code,
    p_fallback_level::fallback_level,
    p_triggered_reason,
    p_cases_before,
    p_cases_after,
    p_confidence_before,
    p_confidence_after,
    p_parse_duration_ms
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
EXCEPTION WHEN OTHERS THEN
  -- Never block processing
  RETURN NULL;
END;
$$;