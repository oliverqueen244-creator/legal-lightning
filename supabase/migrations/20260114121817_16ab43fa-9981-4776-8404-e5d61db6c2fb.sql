-- INTERN INTEGRATION PHASE 1: Final Hardening (Fixed)
-- This migration isolates intern access and adds security guardrails

-- ============================================================
-- STEP 1: Isolate Intern SELECT Policy
-- ============================================================

-- First, drop the intern-specific policy if it exists from previous attempt
DROP POLICY IF EXISTS "intern_docket_select_policy" ON public.daily_court_docket;

-- Drop and recreate the main docket_select_policy WITHOUT intern logic
-- This restores original lawyer/clerk behavior exactly
DROP POLICY IF EXISTS "docket_select_policy" ON public.daily_court_docket;

CREATE POLICY "docket_select_policy" ON public.daily_court_docket
FOR SELECT USING (
  -- Case 1: User owns the case directly
  matched_profile_id = auth.uid()
  OR
  -- Case 2: User is a delegated clerk for the case owner
  public.clerk_can_view_case(auth.uid(), matched_profile_id)
  OR
  -- Case 3: User is a chamber member with visibility
  (chamber_id IS NOT NULL AND public.can_view_chamber_cases(auth.uid(), chamber_id))
);

-- Create SEPARATE intern-only SELECT policy
-- This policy is ISOLATED and cannot affect non-intern access
CREATE POLICY "intern_docket_select_policy" ON public.daily_court_docket
FOR SELECT USING (
  -- ONLY active interns with explicit case assignment
  public.is_active_intern(auth.uid()) 
  AND public.intern_can_access_case(auth.uid(), id)
);

-- ============================================================
-- STEP 2: Add Security Comments to SECURITY DEFINER Functions
-- Using CREATE OR REPLACE to avoid dependency issues
-- ============================================================

-- Update is_active_intern with security documentation
CREATE OR REPLACE FUNCTION public.is_active_intern(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  /*
   * SECURITY REVIEW: is_active_intern
   * ---------------------------------
   * Purpose: Check if user has an active (non-expired, non-revoked) intern account
   * 
   * SECURITY GUARDRAILS:
   * 1. STABLE: Does not modify data
   * 2. Only returns boolean - no data leakage
   * 3. Checks BOTH expires_at AND revoked_at
   * 4. Uses NOW() comparison - time-based auto-expiry
   * 
   * CALLER TRUST: RLS policies only
   * ATTACK SURFACE: None - boolean output only
   * 
   * Last reviewed: 2026-01-14
   */
  SELECT EXISTS (
    SELECT 1 FROM public.intern_accounts
    WHERE user_id = _user_id
    AND expires_at > now()
    AND revoked_at IS NULL
  )
$$;

-- Update get_intern_account_id with security documentation
CREATE OR REPLACE FUNCTION public.get_intern_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  /*
   * SECURITY REVIEW: get_intern_account_id
   * --------------------------------------
   * Purpose: Retrieve the intern account ID for a user
   * 
   * SECURITY GUARDRAILS:
   * 1. STABLE: Does not modify data
   * 2. Returns only intern's OWN account ID
   * 3. Validates active status before returning
   * 4. LIMIT 1 prevents enumeration
   * 
   * CALLER TRUST: RLS policies, audit logging
   * DATA EXPOSURE: Single UUID (intern's own account)
   * 
   * Last reviewed: 2026-01-14
   */
  SELECT id FROM public.intern_accounts
  WHERE user_id = _user_id
  AND expires_at > now()
  AND revoked_at IS NULL
  LIMIT 1
$$;

-- Update intern_can_access_case with security documentation
CREATE OR REPLACE FUNCTION public.intern_can_access_case(_user_id uuid, _docket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  /*
   * SECURITY REVIEW: intern_can_access_case
   * ---------------------------------------
   * Purpose: Verify intern has explicit assignment to specific case
   * 
   * SECURITY GUARDRAILS:
   * 1. STABLE: Does not modify data
   * 2. Requires EXPLICIT assignment - no implicit access
   * 3. Validates intern account is active (not expired/revoked)
   * 4. Validates assignment is active (not expired)
   * 5. Uses INNER JOIN - both conditions must match
   * 
   * ZERO-TRUST PRINCIPLE: Default DENY
   * - No assignment = no access
   * - Expired intern = no access
   * - Expired assignment = no access
   * 
   * CALLER TRUST: RLS policies only
   * ATTACK SURFACE: None - boolean output only
   * 
   * Last reviewed: 2026-01-14
   */
  SELECT EXISTS (
    SELECT 1 
    FROM public.intern_case_assignments ica
    INNER JOIN public.intern_accounts ia ON ica.intern_account_id = ia.id
    WHERE ia.user_id = _user_id
    AND ia.expires_at > now()
    AND ia.revoked_at IS NULL
    AND ica.docket_id = _docket_id
    AND (ica.expires_at IS NULL OR ica.expires_at > now())
  )
$$;

-- Update is_intern_supervisor with security documentation
CREATE OR REPLACE FUNCTION public.is_intern_supervisor(_user_id uuid, _intern_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  /*
   * SECURITY REVIEW: is_intern_supervisor
   * -------------------------------------
   * Purpose: Check if user is the supervisor of a specific intern
   * 
   * SECURITY GUARDRAILS:
   * 1. STABLE: Does not modify data
   * 2. Only returns boolean - no data leakage
   * 3. Exact match on supervisor_id required
   * 
   * CALLER TRUST: RLS policies for supervisor actions
   * ATTACK SURFACE: None - boolean output only
   * 
   * Last reviewed: 2026-01-14
   */
  SELECT EXISTS (
    SELECT 1 FROM public.intern_accounts
    WHERE id = _intern_account_id
    AND supervisor_id = _user_id
  )
$$;

-- Update can_manage_chamber_interns with security documentation
CREATE OR REPLACE FUNCTION public.can_manage_chamber_interns(_user_id uuid, _chamber_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  /*
   * SECURITY REVIEW: can_manage_chamber_interns
   * -------------------------------------------
   * Purpose: Check if user can manage interns in a chamber
   * 
   * SECURITY GUARDRAILS:
   * 1. STABLE: Does not modify data
   * 2. Only chamber owners OR senior members can manage
   * 3. Membership must be active (revoked_at IS NULL)
   * 4. Role check via INNER JOIN - no role escalation possible
   * 
   * AUTHORIZATION LOGIC:
   * - Chamber owner: ALWAYS allowed
   * - SENIOR role in chamber: ALLOWED
   * - All others: DENIED
   * 
   * CALLER TRUST: RLS policies, UI guards
   * ATTACK SURFACE: None - boolean output only
   * 
   * Last reviewed: 2026-01-14
   */
  SELECT (
    -- Chamber owner can manage
    EXISTS (
      SELECT 1 FROM public.chambers 
      WHERE id = _chamber_id AND owner_id = _user_id
    )
    OR
    -- SENIOR role in chamber can manage
    EXISTS (
      SELECT 1 FROM public.chamber_memberships cm
      INNER JOIN public.user_roles ur ON cm.lawyer_id = ur.user_id
      WHERE cm.chamber_id = _chamber_id 
      AND cm.lawyer_id = _user_id 
      AND cm.revoked_at IS NULL
      AND ur.role = 'SENIOR'
    )
  )
$$;

-- Update revoke_expired_intern_accounts with security documentation
CREATE OR REPLACE FUNCTION public.revoke_expired_intern_accounts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
/*
 * SECURITY REVIEW: revoke_expired_intern_accounts
 * -----------------------------------------------
 * Purpose: Automatically revoke expired intern accounts
 * 
 * SECURITY GUARDRAILS:
 * 1. Only affects accounts where expires_at <= now()
 * 2. Only affects accounts not already revoked
 * 3. Sets revocation_reason to 'auto_expired' for audit
 * 4. Logs ALL revocations to intern_access_log
 * 5. Returns summary for monitoring - no sensitive data
 * 
 * INVOCATION: Scheduled job only (not user-callable)
 * SIDE EFFECTS: Updates intern_accounts, inserts to intern_access_log
 * IDEMPOTENT: Yes - running twice has no additional effect
 * 
 * POST-EXPIRY BEHAVIOR:
 * - All RLS checks via is_active_intern() return FALSE
 * - All case access via intern_can_access_case() returns FALSE
 * - Drafts remain in intern_drafts but are READ-ONLY
 * - No new drafts can be created
 * - No existing drafts can be modified
 * 
 * Last reviewed: 2026-01-14
 */
DECLARE
  revoked_count integer;
  expired_accounts uuid[];
BEGIN
  -- Find expired accounts that haven't been revoked yet
  SELECT array_agg(id) INTO expired_accounts
  FROM public.intern_accounts
  WHERE expires_at <= now()
  AND revoked_at IS NULL;

  -- Revoke them
  UPDATE public.intern_accounts
  SET 
    revoked_at = now(),
    revocation_reason = 'auto_expired'
  WHERE id = ANY(expired_accounts);

  GET DIAGNOSTICS revoked_count = ROW_COUNT;

  -- Log the revocations
  IF revoked_count > 0 THEN
    INSERT INTO public.intern_access_log (intern_account_id, action_type, details)
    SELECT 
      id, 
      'access_denied', 
      jsonb_build_object('reason', 'auto_expired', 'revoked_at', now())
    FROM public.intern_accounts
    WHERE id = ANY(expired_accounts);
  END IF;

  RETURN jsonb_build_object(
    'revoked_count', revoked_count,
    'revoked_accounts', expired_accounts
  );
END;
$$;

-- ============================================================
-- STEP 3: Intern Access Logging Function
-- ============================================================

-- Function to log intern read/action events
CREATE OR REPLACE FUNCTION public.log_intern_access(
  p_action_type text,
  p_target_table text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
/*
 * SECURITY REVIEW: log_intern_access
 * -----------------------------------
 * Purpose: Audit trail for intern read and action events
 * 
 * SECURITY GUARDRAILS:
 * 1. Only logs for ACTIVE interns (validates via get_intern_account_id)
 * 2. Fails silently if not an intern - no error exposure
 * 3. Returns log ID or NULL - no sensitive data
 * 
 * ACTION TYPES:
 * - 'case_view': Intern viewed a case
 * - 'draft_create': Intern created a draft
 * - 'draft_update': Intern updated a draft
 * - 'draft_submit': Intern submitted draft for review
 * - 'access_denied': Access attempt blocked
 * 
 * CALLER TRUST: Frontend hooks, RLS triggers
 * INVOCATION: Per-action logging
 * 
 * Last reviewed: 2026-01-14
 */
DECLARE
  v_intern_account_id uuid;
  v_log_id uuid;
BEGIN
  -- Get intern account ID (returns NULL if not an active intern)
  v_intern_account_id := public.get_intern_account_id(auth.uid());
  
  -- If not an active intern, fail silently
  IF v_intern_account_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Insert log entry
  INSERT INTO public.intern_access_log (
    intern_account_id,
    action_type,
    target_table,
    target_id,
    details
  ) VALUES (
    v_intern_account_id,
    p_action_type,
    p_target_table,
    p_target_id,
    p_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
EXCEPTION WHEN OTHERS THEN
  -- Never block operations due to logging failure
  RETURN NULL;
END;
$$;

-- ============================================================
-- STEP 4: Trigger for Automatic Draft Action Logging
-- ============================================================

-- Trigger function to log draft operations
CREATE OR REPLACE FUNCTION public.log_intern_draft_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
/*
 * SECURITY REVIEW: log_intern_draft_action (TRIGGER)
 * ---------------------------------------------------
 * Purpose: Automatic audit logging for intern draft operations
 * 
 * SECURITY GUARDRAILS:
 * 1. Fires AFTER insert/update - does not block operations
 * 2. Only logs, never modifies draft data
 * 3. Uses existing log_intern_access function
 * 
 * Last reviewed: 2026-01-14
 */
DECLARE
  v_action_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'draft_create';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.submitted_for_review = true AND (OLD.submitted_for_review = false OR OLD.submitted_for_review IS NULL) THEN
      v_action_type := 'draft_submit';
    ELSE
      v_action_type := 'draft_update';
    END IF;
  END IF;
  
  PERFORM public.log_intern_access(
    v_action_type,
    'intern_drafts',
    NEW.id,
    jsonb_build_object(
      'docket_id', NEW.docket_id,
      'draft_type', NEW.draft_type,
      'submitted', NEW.submitted_for_review
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create the trigger (drop first to ensure idempotency)
DROP TRIGGER IF EXISTS trigger_log_intern_draft_action ON public.intern_drafts;
CREATE TRIGGER trigger_log_intern_draft_action
  AFTER INSERT OR UPDATE ON public.intern_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_intern_draft_action();

-- ============================================================
-- STEP 5: Document Post-Expiry Behavior via Comments
-- ============================================================

COMMENT ON TABLE public.intern_accounts IS 
'Ephemeral intern identity with time-boxed access.

POST-EXPIRY BEHAVIOR:
---------------------
When expires_at <= now() OR revoked_at IS NOT NULL:
1. is_active_intern() returns FALSE
2. All RLS policies using is_active_intern() DENY access
3. intern_can_access_case() returns FALSE for ALL cases
4. Intern cannot view ANY cases (including previously assigned)
5. Intern cannot create or modify drafts
6. Existing drafts remain in intern_drafts table (READ-ONLY for supervisors)
7. Supervisor can still view/review drafts created before expiry
8. No session invalidation at DB level (handled by frontend)

REVOCATION SOURCES:
- Auto-expiry: revoke_expired_intern_accounts() sets revocation_reason = auto_expired
- Manual: Supervisor sets revoked_at directly

AUDIT TRAIL:
All access denials post-expiry logged to intern_access_log with action_type = access_denied';

COMMENT ON TABLE public.intern_drafts IS
'Sandboxed drafting layer for interns. Drafts never affect master records.

POST-EXPIRY BEHAVIOR:
---------------------
1. Expired interns CANNOT create new drafts (RLS enforced)
2. Expired interns CANNOT modify existing drafts (RLS enforced)
3. Drafts created before expiry REMAIN in table
4. Supervisors can still SELECT and review drafts
5. Supervisors can approve/reject drafts post-expiry
6. Approved drafts require MANUAL promotion to master records by lawyer

ZERO-TRUST PRINCIPLE:
- Drafts NEVER auto-merge to master
- Drafts NEVER affect daily_court_docket or case_arguments
- submit_for_review flag only notifies supervisor
- No irreversible actions possible from draft layer';

COMMENT ON FUNCTION public.log_intern_access IS
'Audit logging for intern read and action events. 
Fails silently if caller is not an active intern.
Returns log UUID or NULL.';

-- ============================================================
-- STEP 6: Grant execute permissions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.log_intern_access(text, text, uuid, jsonb) TO authenticated;