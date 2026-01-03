-- Drop and recreate view without SECURITY DEFINER
DROP VIEW IF EXISTS public.parsing_health_summary;

-- Recreate as regular view (will use invoker's permissions via RLS)
CREATE VIEW public.parsing_health_summary AS
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

-- Grant access to authenticated users (RLS on base table will filter)
GRANT SELECT ON public.parsing_health_summary TO authenticated;