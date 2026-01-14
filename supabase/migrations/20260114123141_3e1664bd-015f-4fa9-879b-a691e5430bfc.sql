-- Phase 2A: Supervisor Control & Review
-- SECURITY REVIEW: 2026-01-14
-- SCOPE: Additive only. No permission expansion for interns.

-- 1. Feature flag for intern supervision (disabled by default)
INSERT INTO app_config (key, value) VALUES 
  ('feature_intern_supervision_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. RLS policy for supervisors to view their supervised interns
-- Supervisors can SELECT intern_accounts where they are the supervisor
CREATE POLICY "supervisors_view_own_interns"
ON public.intern_accounts
FOR SELECT
TO authenticated
USING (supervisor_id = auth.uid());

-- 3. RLS policy for supervisors to manage case assignments for their interns
CREATE POLICY "supervisors_manage_assignments"
ON public.intern_case_assignments
FOR ALL
TO authenticated
USING (
  assigned_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM intern_accounts ia 
    WHERE ia.id = intern_account_id 
    AND ia.supervisor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM intern_accounts ia 
    WHERE ia.id = intern_account_id 
    AND ia.supervisor_id = auth.uid()
  )
);

-- 4. RLS policy for supervisors to view and update drafts from their interns
CREATE POLICY "supervisors_view_intern_drafts"
ON public.intern_drafts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM intern_accounts ia 
    WHERE ia.id = intern_account_id 
    AND ia.supervisor_id = auth.uid()
  )
);

CREATE POLICY "supervisors_review_intern_drafts"
ON public.intern_drafts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM intern_accounts ia 
    WHERE ia.id = intern_account_id 
    AND ia.supervisor_id = auth.uid()
  )
)
WITH CHECK (
  -- Supervisors can only update review fields, not content
  -- This is enforced at application layer, RLS allows the update
  EXISTS (
    SELECT 1 FROM intern_accounts ia 
    WHERE ia.id = intern_account_id 
    AND ia.supervisor_id = auth.uid()
  )
);

-- 5. RLS policy for supervisors to read access logs for their interns
CREATE POLICY "supervisors_view_intern_logs"
ON public.intern_access_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM intern_accounts ia 
    WHERE ia.id = intern_account_id 
    AND ia.supervisor_id = auth.uid()
  )
);

-- 6. Add index for supervisor lookups
CREATE INDEX IF NOT EXISTS idx_intern_accounts_supervisor 
ON public.intern_accounts(supervisor_id) 
WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_intern_drafts_submitted 
ON public.intern_drafts(submitted_for_review, submitted_at) 
WHERE submitted_for_review = true;

-- 7. Create helper function for draft review (SECURITY DEFINER with guardrails)
/**
 * SECURITY REVIEW: 2026-01-14
 * 
 * PURPOSE: Allow supervisors to approve/reject intern drafts
 * 
 * GUARDRAILS:
 * - SECURITY DEFINER with explicit search_path
 * - Validates supervisor owns the intern
 * - Only updates review fields, never content
 * - Logs all review actions
 * - Does NOT auto-merge to any master table
 */
CREATE OR REPLACE FUNCTION public.review_intern_draft(
  p_draft_id UUID,
  p_status TEXT,  -- 'approved' or 'rejected'
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intern_account_id UUID;
  v_supervisor_id UUID;
BEGIN
  -- Validate status
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: must be approved or rejected';
  END IF;
  
  -- Get draft info and verify supervisor relationship
  SELECT d.intern_account_id, ia.supervisor_id
  INTO v_intern_account_id, v_supervisor_id
  FROM intern_drafts d
  JOIN intern_accounts ia ON ia.id = d.intern_account_id
  WHERE d.id = p_draft_id
  AND d.submitted_for_review = true;
  
  IF v_intern_account_id IS NULL THEN
    RAISE EXCEPTION 'Draft not found or not submitted for review';
  END IF;
  
  IF v_supervisor_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized: you are not the supervisor for this intern';
  END IF;
  
  -- Update draft with review
  UPDATE intern_drafts
  SET 
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_status = p_status,
    review_notes = p_notes
  WHERE id = p_draft_id;
  
  -- Log the review action
  INSERT INTO intern_access_log (intern_account_id, action_type, target_table, target_id, details)
  VALUES (
    v_intern_account_id,
    'draft_reviewed',
    'intern_drafts',
    p_draft_id,
    jsonb_build_object(
      'status', p_status,
      'reviewer', auth.uid(),
      'has_notes', p_notes IS NOT NULL
    )
  );
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.review_intern_draft IS 
'SECURITY REVIEW: 2026-01-14
Allows supervisors to approve/reject intern drafts.
- Validates supervisor relationship
- Only updates review fields, never content
- Does NOT auto-merge to any master table
- Approval is symbolic only - requires manual lawyer action for real use';

-- 8. Grant execute to authenticated users (RLS in function validates supervisor)
GRANT EXECUTE ON FUNCTION public.review_intern_draft TO authenticated;