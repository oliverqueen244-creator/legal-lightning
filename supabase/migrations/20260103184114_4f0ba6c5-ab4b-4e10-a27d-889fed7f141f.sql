-- Create severity enum for error events
CREATE TYPE public.error_severity AS ENUM ('P0', 'P1', 'P2');

-- Create domain enum for error categorization
CREATE TYPE public.error_domain AS ENUM (
  'AUTH',
  'NETWORK',
  'OFFLINE_BLOCK',
  'SYNC',
  'UPLOAD',
  'PWA',
  'REALTIME',
  'CAUSELIST_PARSING',
  'CASE_MATCHING',
  'INGESTION',
  'UNKNOWN'
);

-- Create environment enum
CREATE TYPE public.error_environment AS ENUM ('web', 'pwa', 'ios', 'backend');

-- Create admin_error_events table
CREATE TABLE public.admin_error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT,
  route TEXT,
  severity public.error_severity NOT NULL DEFAULT 'P2',
  domain public.error_domain NOT NULL DEFAULT 'UNKNOWN',
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  environment public.error_environment NOT NULL DEFAULT 'web',
  is_online BOOLEAN,
  app_version TEXT,
  browser TEXT,
  os TEXT,
  device TEXT,
  batch_id UUID,
  bench_code TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  admin_note TEXT
);

-- Create index for common queries
CREATE INDEX idx_error_events_created_at ON public.admin_error_events(created_at DESC);
CREATE INDEX idx_error_events_domain ON public.admin_error_events(domain);
CREATE INDEX idx_error_events_severity ON public.admin_error_events(severity);
CREATE INDEX idx_error_events_error_code ON public.admin_error_events(error_code);
CREATE INDEX idx_error_events_resolved ON public.admin_error_events(resolved);
CREATE INDEX idx_error_events_batch_id ON public.admin_error_events(batch_id);

-- Enable RLS
ALTER TABLE public.admin_error_events ENABLE ROW LEVEL SECURITY;

-- Security definer function to insert error events (bypasses RLS)
CREATE OR REPLACE FUNCTION public.log_error_event(
  p_severity public.error_severity,
  p_domain public.error_domain,
  p_error_code TEXT,
  p_message TEXT,
  p_environment public.error_environment DEFAULT 'web',
  p_user_id UUID DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_route TEXT DEFAULT NULL,
  p_is_online BOOLEAN DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_batch_id UUID DEFAULT NULL,
  p_bench_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.admin_error_events (
    severity, domain, error_code, message, environment,
    user_id, role, route, is_online, app_version,
    browser, os, device, batch_id, bench_code
  ) VALUES (
    p_severity, p_domain, p_error_code, 
    LEFT(p_message, 500), -- Truncate message for safety
    p_environment, p_user_id, p_role, p_route, p_is_online,
    p_app_version, p_browser, p_os, p_device, p_batch_id, p_bench_code
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
EXCEPTION WHEN OTHERS THEN
  -- Fail silently - never block user actions
  RETURN NULL;
END;
$$;

-- RLS Policy: Only admins can SELECT
CREATE POLICY "Admins can view error events"
ON public.admin_error_events
FOR SELECT
USING (public.has_role(auth.uid(), 'ADMIN'));

-- RLS Policy: Only admins can UPDATE (for resolved + admin_note only)
CREATE POLICY "Admins can update error events"
ON public.admin_error_events
FOR UPDATE
USING (public.has_role(auth.uid(), 'ADMIN'));

-- No direct INSERT policy - must use log_error_event function
-- No DELETE policy - errors are permanent record

-- Create parsing health summary view for dashboard
CREATE OR REPLACE VIEW public.parsing_health_summary AS
SELECT
  DATE(created_at) as report_date,
  domain,
  error_code,
  severity,
  COUNT(*) as error_count,
  COUNT(DISTINCT batch_id) as affected_batches,
  COUNT(DISTINCT bench_code) as affected_benches,
  MAX(created_at) as last_seen,
  SUM(CASE WHEN resolved THEN 1 ELSE 0 END) as resolved_count
FROM public.admin_error_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), domain, error_code, severity
ORDER BY report_date DESC, error_count DESC;