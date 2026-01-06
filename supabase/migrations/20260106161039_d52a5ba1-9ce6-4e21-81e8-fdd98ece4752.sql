-- Fix Security Definer View issue for parsing_health_summary
-- Recreate view with security_invoker = true to enforce RLS of querying user
DROP VIEW IF EXISTS public.parsing_health_summary;

CREATE VIEW public.parsing_health_summary
WITH (security_invoker = true)
AS 
SELECT 
    date(created_at) AS report_date,
    domain,
    error_code,
    severity,
    count(*) AS error_count,
    count(DISTINCT batch_id) AS affected_batches,
    count(DISTINCT bench_code) AS affected_benches,
    max(created_at) AS last_seen,
    sum(
        CASE
            WHEN resolved THEN 1
            ELSE 0
        END) AS resolved_count
FROM admin_error_events
WHERE created_at >= (now() - '7 days'::interval)
GROUP BY (date(created_at)), domain, error_code, severity
ORDER BY (date(created_at)) DESC, (count(*)) DESC;

-- Fix Security Definer View issue for fallback_summary_view
-- Recreate view with security_invoker = true to enforce RLS of querying user
DROP VIEW IF EXISTS public.fallback_summary_view;

CREATE VIEW public.fallback_summary_view
WITH (security_invoker = true)
AS 
SELECT 
    date(applied_at) AS fallback_date,
    bench_code,
    fallback_level,
    count(*) AS attempt_count,
    avg(confidence_after - confidence_before) AS avg_confidence_delta,
    sum(
        CASE
            WHEN confidence_after > confidence_before THEN 1
            ELSE 0
        END) AS improvement_count,
    sum(cases_after - cases_before) AS total_cases_recovered,
    max(applied_at) AS last_attempt
FROM parser_fallback_log
GROUP BY (date(applied_at)), bench_code, fallback_level;