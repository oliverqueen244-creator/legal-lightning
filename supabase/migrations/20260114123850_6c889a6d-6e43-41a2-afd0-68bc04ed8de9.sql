-- Phase 2B: Supervisor Visibility & Friction Reduction
-- SECURITY REVIEW: 2026-01-14
-- SCOPE: Additive, supervisor-only, fully removable via feature flag

-- 1. Feature flag for Phase 2B (disabled by default)
INSERT INTO app_config (key, value) VALUES 
  ('feature_intern_supervision_phase2b_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Add ability to extend intern expiry (supervisor-only update)
-- No new SECURITY DEFINER needed - use existing RLS on intern_accounts
-- Supervisors can already UPDATE via intern_accounts_update policy

-- 3. Create a view for supervisor activity digest (read-only)
-- This aggregates existing data without creating new tables
CREATE OR REPLACE VIEW public.v_intern_activity_digest AS
SELECT 
  ia.supervisor_id,
  ia.id as intern_account_id,
  ia.intern_name,
  ia.expires_at,
  ia.revoked_at,
  ia.created_at as intern_created_at,
  -- Count of pending drafts (submitted but not reviewed)
  (
    SELECT COUNT(*) 
    FROM intern_drafts id 
    WHERE id.intern_account_id = ia.id 
    AND id.submitted_for_review = true 
    AND id.review_status IS NULL
  ) as pending_drafts_count,
  -- Count of approved drafts
  (
    SELECT COUNT(*) 
    FROM intern_drafts id 
    WHERE id.intern_account_id = ia.id 
    AND id.review_status = 'approved'
  ) as approved_drafts_count,
  -- Count of rejected drafts
  (
    SELECT COUNT(*) 
    FROM intern_drafts id 
    WHERE id.intern_account_id = ia.id 
    AND id.review_status = 'rejected'
  ) as rejected_drafts_count,
  -- Count of assigned cases
  (
    SELECT COUNT(*) 
    FROM intern_case_assignments ica 
    WHERE ica.intern_account_id = ia.id
  ) as assigned_cases_count,
  -- Last activity timestamp
  (
    SELECT MAX(logged_at) 
    FROM intern_access_log ial 
    WHERE ial.intern_account_id = ia.id
  ) as last_activity_at,
  -- Days until expiry
  EXTRACT(DAY FROM (ia.expires_at - now()))::int as days_until_expiry
FROM intern_accounts ia
WHERE ia.revoked_at IS NULL;

-- Grant SELECT to authenticated (RLS handled via supervisor_id filter in app)
GRANT SELECT ON public.v_intern_activity_digest TO authenticated;

COMMENT ON VIEW public.v_intern_activity_digest IS 
'Phase 2B: Read-only supervisor digest view.
Aggregates existing data from intern_drafts, intern_case_assignments, intern_access_log.
No new data created. Supervisor-only via application-level filtering.
Fully removable by dropping this view.';

-- 4. Create index for efficient digest queries
CREATE INDEX IF NOT EXISTS idx_intern_access_log_account_time 
ON public.intern_access_log(intern_account_id, logged_at DESC);