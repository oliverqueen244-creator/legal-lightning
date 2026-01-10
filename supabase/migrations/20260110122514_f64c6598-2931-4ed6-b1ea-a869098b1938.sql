-- Drop existing SELECT policy and create one that includes ADMIN access
DROP POLICY IF EXISTS "Users can view own, chamber, and delegated cases" ON daily_court_docket;

CREATE POLICY "Users can view own, chamber, delegated, or admin cases"
ON daily_court_docket
FOR SELECT
TO authenticated
USING (
  -- ADMIN users can view ALL cases
  has_role(auth.uid(), 'ADMIN')
  OR
  -- Personal cases: user owns the case
  ((case_context = 'personal') AND (matched_profile_id = auth.uid()))
  OR
  -- Chamber cases: user is a member of the chamber
  ((case_context = 'chamber') AND (chamber_id IS NOT NULL) AND can_view_chamber_cases(auth.uid(), chamber_id))
  OR
  -- Unmatched cases: any lawyer can view (for potential claiming)
  ((matched_profile_id IS NULL) AND is_lawyer_role(auth.uid()))
  OR
  -- Delegated access: clerk has been delegated by the case owner
  ((matched_profile_id IS NOT NULL) AND is_delegated_clerk(auth.uid(), matched_profile_id))
);