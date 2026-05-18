-- ============================================================
-- NYAYHUB PRODUCTION FIX MIGRATION
-- Apply this as: supabase/migrations/20260518_production_fix.sql
-- Resolves: A-1, A-2, A-3, A-4, A-7, B-1, B-3
-- Author: Audit by Claude, commissioned by Mukesh Purohit
-- Date: 2026-05-18
-- ============================================================

BEGIN;

-- ============================================================
-- A-1: Expand raw_causelists status constraint
-- Without this, scan-lawyer-names crashes on status = 'jobs_created'
-- ============================================================
ALTER TABLE public.raw_causelists DROP CONSTRAINT IF EXISTS raw_causelists_status_check;
ALTER TABLE public.raw_causelists ADD CONSTRAINT raw_causelists_status_check
CHECK (status IN (
  'downloaded', 'extracting', 'text_extracted', 'notes_extracted',
  'scanning', 'scanned', 'extract_error',
  'parsed_complete', 'parsed_empty', 'parsed_incomplete',
  'jobs_created', 'scanned_no_ai', 'skipped_notice',
  'parsing', 'fully_parsed', 'parse_error', 'extraction_failed'
));

-- ============================================================
-- A-2: Fix can_check_judgment to return case_data
-- Without this, check-case-judgment crashes on guardResult.case_data
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_check_judgment(
  p_case_id UUID,
  p_lawyer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case RECORD;
BEGIN
  SELECT * INTO v_case FROM public.tracked_cases WHERE id = p_case_id;

  IF v_case IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'case_not_found');
  END IF;
  IF v_case.profile_id != p_lawyer_id THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_owner');
  END IF;
  IF v_case.judgment_status = 'found' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'judgment_already_found');
  END IF;
  IF v_case.judgment_status IN ('checking', 'check_queued') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'check_in_progress');
  END IF;
  IF v_case.last_judgment_check_at IS NOT NULL
     AND v_case.last_judgment_check_at > (now() - interval '7 days') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'cooldown_active',
      'next_check_after', v_case.last_judgment_check_at + interval '7 days'
    );
  END IF;
  IF v_case.judgment_check_attempts >= 10 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'max_attempts_exceeded');
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'case_data', jsonb_build_object(
      'case_type', v_case.case_type,
      'case_number', v_case.case_number,
      'case_year', v_case.case_year,
      'bench', v_case.bench,
      'judgment_check_attempts', COALESCE(v_case.judgment_check_attempts, 0)
    )
  );
END;
$$;

-- ============================================================
-- A-3: Fix unique constraint for upserts
-- Without this, html-causelist-parse creates duplicates or crashes
-- ============================================================
DROP INDEX IF EXISTS idx_daily_court_docket_unique_case_per_lawyer;
DROP INDEX IF EXISTS idx_daily_court_docket_unique_case_unmatched;
DROP INDEX IF EXISTS idx_docket_unique_case;

CREATE UNIQUE INDEX idx_daily_court_docket_unique_case
ON daily_court_docket (
  court_location, court_room_no, case_number, date,
  COALESCE(matched_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- ============================================================
-- A-4 + A-7: Trigger cleanup — drop all, recreate only necessary 6
-- Without this, every INSERT fires 3 match attempts + duplicate validations
-- ============================================================

-- Drop every trigger on daily_court_docket
DROP TRIGGER IF EXISTS on_docket_insert_match_aliases ON public.daily_court_docket;
DROP TRIGGER IF EXISTS trigger_auto_match_on_insert ON public.daily_court_docket;
DROP TRIGGER IF EXISTS auto_match_on_insert ON public.daily_court_docket;
DROP TRIGGER IF EXISTS auto_match_on_update ON public.daily_court_docket;
DROP TRIGGER IF EXISTS auto_match_before_insert ON public.daily_court_docket;
DROP TRIGGER IF EXISTS set_case_fingerprint ON public.daily_court_docket;
DROP TRIGGER IF EXISTS enforce_match_auditability ON public.daily_court_docket;
DROP TRIGGER IF EXISTS trg_validate_case_context ON public.daily_court_docket;
DROP TRIGGER IF EXISTS validate_case_context_trigger ON public.daily_court_docket;
DROP TRIGGER IF EXISTS enforce_lawyer_ownership ON public.daily_court_docket;
DROP TRIGGER IF EXISTS enforce_lawyer_ownership_trigger ON public.daily_court_docket;
DROP TRIGGER IF EXISTS trg_enforce_lawyer_ownership_insert ON public.daily_court_docket;
DROP TRIGGER IF EXISTS trg_enforce_lawyer_ownership_update ON public.daily_court_docket;
DROP TRIGGER IF EXISTS trg_enforce_lawyer_ownership_updates ON public.daily_court_docket;
DROP TRIGGER IF EXISTS enforce_delegation_scope_trigger ON public.daily_court_docket;

-- Recreate the 6 triggers that are actually needed

-- 1. Alias matching (synchronous, in-DB, no HTTP calls)
CREATE TRIGGER trg_auto_match_before_insert
  BEFORE INSERT ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_match_on_insert();

-- 2. Case fingerprint generation
CREATE TRIGGER trg_set_case_fingerprint
  BEFORE INSERT OR UPDATE ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_case_fingerprint();

-- 3. Match auditability (match_method required when matched_profile_id is set)
CREATE TRIGGER trg_enforce_match_auditability
  BEFORE INSERT OR UPDATE ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_match_method_on_profile();

-- 4. Case context validation (chamber_id required for chamber context)
CREATE TRIGGER trg_validate_case_context
  BEFORE INSERT OR UPDATE ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_case_context();

-- 5. Lawyer-only ownership enforcement (with security event logging)
CREATE TRIGGER trg_enforce_lawyer_ownership
  BEFORE UPDATE ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lawyer_ownership_updates();

-- 6. Delegation scope enforcement for clerks
CREATE TRIGGER trg_enforce_delegation_scope
  BEFORE UPDATE ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_delegation_scope_on_update();

-- ============================================================
-- B-1: Drop dangerously permissive RLS policies
-- These grant ALL authenticated users full access, not just service role
-- Service role bypasses RLS — it doesn't need policies
-- ============================================================

DROP POLICY IF EXISTS "Service role can manage ai_jobs" ON public.ai_jobs;
DROP POLICY IF EXISTS "Service role can insert causelists" ON public.raw_causelists;
DROP POLICY IF EXISTS "Service role can update causelists" ON public.raw_causelists;
DROP POLICY IF EXISTS "Service role can insert notes" ON public.cause_list_notes;
DROP POLICY IF EXISTS "Service role can manage queue" ON public.case_parse_queue;
DROP POLICY IF EXISTS "Service role can insert court overrides" ON public.court_overrides;
DROP POLICY IF EXISTS "Service role can update court overrides" ON public.court_overrides;
DROP POLICY IF EXISTS "Service role can manage cache" ON public.ai_parse_cache;
DROP POLICY IF EXISTS "Service role can manage case durations" ON public.case_item_durations;
DROP POLICY IF EXISTS "Service role can manage court averages" ON public.court_avg_duration;
DROP POLICY IF EXISTS "Service role can manage queue" ON public.document_processing_queue;

-- ============================================================
-- B-3: Restore comprehensive docket SELECT policy
-- Without this, admins see nothing and lawyers can't see unmatched cases
-- ============================================================

DROP POLICY IF EXISTS "docket_select_policy" ON public.daily_court_docket;
DROP POLICY IF EXISTS "intern_docket_select_policy" ON public.daily_court_docket;

CREATE POLICY "docket_select_policy" ON public.daily_court_docket
FOR SELECT USING (
  -- Admin: full visibility
  public.has_role(auth.uid(), 'ADMIN'::app_role)
  OR
  -- Case owner
  (matched_profile_id = auth.uid())
  OR
  -- Chamber member
  (chamber_id IS NOT NULL AND public.can_view_chamber_cases(auth.uid(), chamber_id))
  OR
  -- Lawyers can see unmatched cases for claiming
  (matched_profile_id IS NULL AND public.is_lawyer_role(auth.uid()))
  OR
  -- Delegated clerk
  (matched_profile_id IS NOT NULL AND public.clerk_can_view_case(auth.uid(), matched_profile_id))
  OR
  -- Active intern with assignment
  (public.is_active_intern(auth.uid()) AND public.intern_can_access_case(auth.uid(), id))
);

-- ============================================================
-- B-6: Fix SQL wildcard injection in normalize_lawyer_name
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_lawyer_name(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
BEGIN
  IF name IS NULL THEN RETURN NULL; END IF;
  normalized := UPPER(TRIM(name));
  normalized := regexp_replace(normalized, '^(SENIOR ADV\.?\s*|SR\.?\s*ADV\.?\s*)', '', 'i');
  normalized := regexp_replace(normalized, '^(JUNIOR ADV\.?\s*|JR\.?\s*ADV\.?\s*)', '', 'i');
  normalized := regexp_replace(normalized, '^(ADV\.?\s+|ADVOCATE\s+|ADVT\.?\s+|ADVC\.?\s+)', '', 'i');
  normalized := regexp_replace(normalized, '^(MR\.?\s+|MRS\.?\s+|MS\.?\s+|MISS\s+)', '', 'i');
  normalized := regexp_replace(normalized, '^(DR\.?\s+|PROF\.?\s+)', '', 'i');
  normalized := regexp_replace(normalized, '^(SHRI\s+|SMT\.?\s+|KUMARI\s+|KU\.?\s+)', '', 'i');
  normalized := regexp_replace(normalized, '^(LD\.?\s+|LEARNED\s+)', '', 'i');
  normalized := regexp_replace(normalized, '^(ADHIVAKTA\s+|VAKIL\s+)', '', 'i');
  normalized := regexp_replace(normalized, '\s+', ' ', 'g');
  normalized := regexp_replace(normalized, '[.,;:]+$', '');
  -- Escape SQL wildcards to prevent injection via ILIKE
  normalized := replace(normalized, '\', '\\');
  normalized := replace(normalized, '%', '\%');
  normalized := replace(normalized, '_', '\_');
  RETURN TRIM(normalized);
END;
$$;

-- ============================================================
-- Rate limiting table for credit-consuming endpoints (B-5)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  user_id UUID NOT NULL,
  action_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action_key, window_start)
);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
-- No user-facing policy; only accessed via SECURITY DEFINER function

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_max_requests INTEGER,
  p_window_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  v_window_start := date_trunc('hour', now())
    + (floor(EXTRACT(MINUTE FROM now()) / p_window_minutes) * p_window_minutes || ' minutes')::interval;

  INSERT INTO rate_limit_counters (user_id, action_key, window_start, request_count)
  VALUES (p_user_id, p_action, v_window_start, 1)
  ON CONFLICT (user_id, action_key, window_start)
  DO UPDATE SET request_count = rate_limit_counters.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

-- Cleanup old rate limit entries daily
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rate_limit_counters(window_start);

COMMIT;
