-- ============================================================
-- Atomic claim of next ai_jobs row to prevent two workers from
-- processing the same job (race-free with FOR UPDATE SKIP LOCKED).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_next_ai_job()
RETURNS SETOF public.ai_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.ai_jobs
  SET status = 'processing',
      started_at = NOW()
  WHERE id = (
    SELECT id FROM public.ai_jobs
    WHERE status = 'pending'
       OR (status = 'retry' AND next_retry_at <= NOW())
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_ai_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_ai_job() TO service_role;

COMMIT;
