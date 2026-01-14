
-- ============================================================
-- INTERN INTEGRATION PHASE 1: Zero-Trust Intern Role
-- Rajasthan High Court (Jaipur & Jodhpur)
-- ============================================================
-- CONSTRAINTS:
-- - NO modification to existing lawyer/clerk/junior permissions
-- - NO weakening of existing RLS
-- - Deny-by-default for all intern access
-- - Time-boxed, case-scoped, read-only visibility
-- ============================================================

-- 1. Add INTERN to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'INTERN';

-- 2. Create intern_accounts table for ephemeral accounts with expiry
CREATE TABLE IF NOT EXISTS public.intern_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chamber_id uuid NOT NULL REFERENCES public.chambers(id) ON DELETE CASCADE,
  supervisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz DEFAULT NULL,
  revocation_reason text DEFAULT NULL,
  intern_name text NOT NULL,
  institution text DEFAULT NULL,
  -- Enforce future expiry on creation
  CONSTRAINT expires_in_future CHECK (expires_at > created_at),
  -- Unique user per chamber (one active assignment at a time)
  CONSTRAINT unique_intern_per_chamber UNIQUE (user_id, chamber_id)
);

-- 3. Create intern_case_assignments table for case-scoped visibility
CREATE TABLE IF NOT EXISTS public.intern_case_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intern_account_id uuid NOT NULL REFERENCES public.intern_accounts(id) ON DELETE CASCADE,
  docket_id uuid NOT NULL REFERENCES public.daily_court_docket(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT NULL,
  notes text DEFAULT NULL,
  -- Prevent duplicate assignments
  CONSTRAINT unique_intern_case UNIQUE (intern_account_id, docket_id)
);

-- 4. Create intern_drafts table for sandboxed drafting (shadow table)
CREATE TABLE IF NOT EXISTS public.intern_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intern_account_id uuid NOT NULL REFERENCES public.intern_accounts(id) ON DELETE CASCADE,
  docket_id uuid NOT NULL REFERENCES public.daily_court_docket(id) ON DELETE CASCADE,
  draft_type text NOT NULL CHECK (draft_type IN ('note', 'summary', 'argument', 'research')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Review workflow
  submitted_for_review boolean NOT NULL DEFAULT false,
  submitted_at timestamptz DEFAULT NULL,
  reviewed_by uuid REFERENCES public.profiles(id) DEFAULT NULL,
  reviewed_at timestamptz DEFAULT NULL,
  review_status text DEFAULT NULL CHECK (review_status IS NULL OR review_status IN ('pending', 'approved', 'rejected')),
  review_notes text DEFAULT NULL
);

-- 5. Create intern_access_log for audit trail
CREATE TABLE IF NOT EXISTS public.intern_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intern_account_id uuid NOT NULL REFERENCES public.intern_accounts(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('view_case', 'create_draft', 'update_draft', 'submit_draft', 'access_denied')),
  target_id uuid DEFAULT NULL,
  target_table text DEFAULT NULL,
  details jsonb DEFAULT NULL,
  logged_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE public.intern_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_case_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_access_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper Functions for Intern Access Control
-- ============================================================

-- Check if user is an active (non-expired, non-revoked) intern
CREATE OR REPLACE FUNCTION public.is_active_intern(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.intern_accounts
    WHERE user_id = _user_id
    AND expires_at > now()
    AND revoked_at IS NULL
  )
$$;

-- Get active intern account ID for a user
CREATE OR REPLACE FUNCTION public.get_intern_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.intern_accounts
  WHERE user_id = _user_id
  AND expires_at > now()
  AND revoked_at IS NULL
  LIMIT 1
$$;

-- Check if intern can access a specific case (has active assignment)
CREATE OR REPLACE FUNCTION public.intern_can_access_case(_user_id uuid, _docket_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
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

-- Check if user is a supervisor for an intern
CREATE OR REPLACE FUNCTION public.is_intern_supervisor(_user_id uuid, _intern_account_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.intern_accounts
    WHERE id = _intern_account_id
    AND supervisor_id = _user_id
  )
$$;

-- Check if user can manage interns in a chamber
CREATE OR REPLACE FUNCTION public.can_manage_chamber_interns(_user_id uuid, _chamber_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
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

-- ============================================================
-- RLS Policies for intern_accounts
-- ============================================================

-- Interns can view their own account
CREATE POLICY intern_accounts_select_own ON public.intern_accounts
  FOR SELECT USING (user_id = auth.uid());

-- Supervisors and admins can view intern accounts
CREATE POLICY intern_accounts_select_supervisor ON public.intern_accounts
  FOR SELECT USING (
    supervisor_id = auth.uid() 
    OR has_role(auth.uid(), 'ADMIN')
    OR can_manage_chamber_interns(auth.uid(), chamber_id)
  );

-- Only supervisors/admins can insert intern accounts
CREATE POLICY intern_accounts_insert ON public.intern_accounts
  FOR INSERT WITH CHECK (
    (supervisor_id = auth.uid() AND can_manage_chamber_interns(auth.uid(), chamber_id))
    OR has_role(auth.uid(), 'ADMIN')
  );

-- Only supervisors/admins can update intern accounts (e.g., revoke)
CREATE POLICY intern_accounts_update ON public.intern_accounts
  FOR UPDATE USING (
    supervisor_id = auth.uid() 
    OR has_role(auth.uid(), 'ADMIN')
    OR can_manage_chamber_interns(auth.uid(), chamber_id)
  );

-- Only admins can delete intern accounts
CREATE POLICY intern_accounts_delete ON public.intern_accounts
  FOR DELETE USING (has_role(auth.uid(), 'ADMIN'));

-- ============================================================
-- RLS Policies for intern_case_assignments
-- ============================================================

-- Interns can view their own assignments
CREATE POLICY intern_case_assignments_select_intern ON public.intern_case_assignments
  FOR SELECT USING (
    intern_account_id = get_intern_account_id(auth.uid())
  );

-- Supervisors can view and manage assignments for their interns
CREATE POLICY intern_case_assignments_select_supervisor ON public.intern_case_assignments
  FOR SELECT USING (
    is_intern_supervisor(auth.uid(), intern_account_id)
    OR has_role(auth.uid(), 'ADMIN')
  );

-- Only lawyers can create case assignments
CREATE POLICY intern_case_assignments_insert ON public.intern_case_assignments
  FOR INSERT WITH CHECK (
    assigned_by = auth.uid()
    AND is_lawyer_role(auth.uid())
    AND is_intern_supervisor(auth.uid(), intern_account_id)
  );

-- Supervisors can update assignments
CREATE POLICY intern_case_assignments_update ON public.intern_case_assignments
  FOR UPDATE USING (
    is_intern_supervisor(auth.uid(), intern_account_id)
    OR has_role(auth.uid(), 'ADMIN')
  );

-- Supervisors can delete assignments
CREATE POLICY intern_case_assignments_delete ON public.intern_case_assignments
  FOR DELETE USING (
    is_intern_supervisor(auth.uid(), intern_account_id)
    OR has_role(auth.uid(), 'ADMIN')
  );

-- ============================================================
-- RLS Policies for intern_drafts
-- ============================================================

-- Interns can view and edit their own drafts
CREATE POLICY intern_drafts_select_own ON public.intern_drafts
  FOR SELECT USING (
    intern_account_id = get_intern_account_id(auth.uid())
  );

-- Interns can insert drafts for assigned cases only
CREATE POLICY intern_drafts_insert ON public.intern_drafts
  FOR INSERT WITH CHECK (
    intern_account_id = get_intern_account_id(auth.uid())
    AND intern_can_access_case(auth.uid(), docket_id)
    AND is_active_intern(auth.uid())
  );

-- Interns can update their own drafts (only non-submitted)
CREATE POLICY intern_drafts_update_own ON public.intern_drafts
  FOR UPDATE USING (
    intern_account_id = get_intern_account_id(auth.uid())
    AND submitted_for_review = false
  );

-- Supervisors can view drafts from their interns
CREATE POLICY intern_drafts_select_supervisor ON public.intern_drafts
  FOR SELECT USING (
    is_intern_supervisor(auth.uid(), intern_account_id)
    OR has_role(auth.uid(), 'ADMIN')
  );

-- Supervisors can update drafts (for review)
CREATE POLICY intern_drafts_update_supervisor ON public.intern_drafts
  FOR UPDATE USING (
    is_intern_supervisor(auth.uid(), intern_account_id)
    OR has_role(auth.uid(), 'ADMIN')
  );

-- Only supervisors can delete drafts (interns cannot delete)
CREATE POLICY intern_drafts_delete ON public.intern_drafts
  FOR DELETE USING (
    is_intern_supervisor(auth.uid(), intern_account_id)
    OR has_role(auth.uid(), 'ADMIN')
  );

-- ============================================================
-- RLS Policies for intern_access_log
-- ============================================================

-- Interns can view their own access logs
CREATE POLICY intern_access_log_select_own ON public.intern_access_log
  FOR SELECT USING (
    intern_account_id = get_intern_account_id(auth.uid())
  );

-- Supervisors and admins can view all logs
CREATE POLICY intern_access_log_select_supervisor ON public.intern_access_log
  FOR SELECT USING (
    is_intern_supervisor(auth.uid(), intern_account_id)
    OR has_role(auth.uid(), 'ADMIN')
  );

-- System/service role can insert logs (via trigger or edge function)
CREATE POLICY intern_access_log_insert ON public.intern_access_log
  FOR INSERT WITH CHECK (true);

-- No updates to access logs (immutable)
-- No delete policy for regular users (logs are permanent)
CREATE POLICY intern_access_log_delete ON public.intern_access_log
  FOR DELETE USING (has_role(auth.uid(), 'ADMIN'));

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger to auto-update updated_at on intern_drafts
CREATE OR REPLACE FUNCTION public.update_intern_draft_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_intern_drafts_updated_at
  BEFORE UPDATE ON public.intern_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_intern_draft_timestamp();

-- Trigger to set submitted_at when submitted_for_review becomes true
CREATE OR REPLACE FUNCTION public.set_draft_submitted_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.submitted_for_review = true AND OLD.submitted_for_review = false THEN
    NEW.submitted_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER set_intern_draft_submitted_at
  BEFORE UPDATE ON public.intern_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_draft_submitted_timestamp();

-- ============================================================
-- MODIFY EXISTING daily_court_docket RLS FOR INTERN ACCESS
-- This adds a new condition WITHOUT weakening existing policies
-- ============================================================

-- Drop and recreate the docket select policy to include intern access
DROP POLICY IF EXISTS docket_select_policy ON public.daily_court_docket;

CREATE POLICY docket_select_policy ON public.daily_court_docket
  FOR SELECT USING (
    -- ADMIN: Full access (unchanged)
    has_role(auth.uid(), 'ADMIN')
    OR
    -- Personal cases: Owner access (unchanged)
    ((case_context = 'personal') AND (matched_profile_id = auth.uid()))
    OR
    -- Chamber cases: Member access (unchanged)
    ((case_context = 'chamber') AND (chamber_id IS NOT NULL) AND can_view_chamber_cases(auth.uid(), chamber_id))
    OR
    -- Unmatched cases: Lawyer access (unchanged)
    ((matched_profile_id IS NULL) AND is_lawyer_role(auth.uid()))
    OR
    -- Clerk delegation access (unchanged)
    ((matched_profile_id IS NOT NULL) AND clerk_can_view_case(auth.uid(), matched_profile_id))
    OR
    -- NEW: Intern case-scoped access (DENY by default, only if explicitly assigned)
    intern_can_access_case(auth.uid(), id)
  );

-- ============================================================
-- SCHEDULED JOB: Auto-revoke expired intern accounts
-- This will be called by an edge function on a schedule
-- ============================================================

CREATE OR REPLACE FUNCTION public.revoke_expired_intern_accounts()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
-- INDEXES for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_intern_accounts_user_id ON public.intern_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_intern_accounts_expires_at ON public.intern_accounts(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_intern_case_assignments_intern ON public.intern_case_assignments(intern_account_id);
CREATE INDEX IF NOT EXISTS idx_intern_case_assignments_docket ON public.intern_case_assignments(docket_id);
CREATE INDEX IF NOT EXISTS idx_intern_drafts_intern ON public.intern_drafts(intern_account_id);
CREATE INDEX IF NOT EXISTS idx_intern_access_log_intern ON public.intern_access_log(intern_account_id);
