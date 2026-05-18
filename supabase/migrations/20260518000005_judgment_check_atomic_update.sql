-- ============================================================
-- Server-side atomic update for tracked_cases after a judgment
-- check. Uses Postgres NOW() so cooldown/cooldown-window math is
-- consistent regardless of edge-runtime clock skew.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.record_judgment_check_result(
  p_case_id UUID,
  p_judgment_found BOOLEAN,
  p_cooldown_days INTEGER DEFAULT 7
)
RETURNS public.tracked_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.tracked_cases;
BEGIN
  UPDATE public.tracked_cases
  SET last_judgment_check_at = NOW(),
      judgment_check_attempts = COALESCE(judgment_check_attempts, 0) + 1,
      next_judgment_check_after = NOW() + (p_cooldown_days || ' days')::interval,
      judgment_status = CASE WHEN p_judgment_found THEN 'found' ELSE 'not_found' END,
      judgment_found_at = CASE
        WHEN p_judgment_found AND judgment_found_at IS NULL THEN NOW()
        ELSE judgment_found_at
      END
  WHERE id = p_case_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_judgment_check_result(UUID, BOOLEAN, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_judgment_check_result(UUID, BOOLEAN, INTEGER) TO service_role, authenticated;

COMMIT;
