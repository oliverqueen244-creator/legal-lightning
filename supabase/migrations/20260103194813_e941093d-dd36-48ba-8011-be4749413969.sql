-- Fix security definer view by dropping and recreating with proper RLS
DROP VIEW IF EXISTS public.fallback_summary_view;

-- Create the view without security definer (it will inherit caller's permissions)
CREATE VIEW public.fallback_summary_view AS
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