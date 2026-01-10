
-- CP-5 PHASE 1: DELEGATION SCOPES
-- Create enum for delegation scopes
DO $$ BEGIN
  CREATE TYPE public.delegation_scope AS ENUM (
    'view_cases',
    'upload_documents', 
    'add_notes',
    'track_hearings',
    'mark_presence'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add scopes column to clerk_delegations
ALTER TABLE public.clerk_delegations 
ADD COLUMN IF NOT EXISTS scopes delegation_scope[] NOT NULL DEFAULT ARRAY['view_cases']::delegation_scope[];

-- Add index for efficient scope queries
CREATE INDEX IF NOT EXISTS idx_clerk_delegations_active 
ON public.clerk_delegations(clerk_id, lawyer_id) 
WHERE revoked_at IS NULL;

-- CP-5 PHASE 2: DELEGATED ACTIONS ATTRIBUTION TABLE
-- Every delegated action must be logged
CREATE TABLE IF NOT EXISTS public.delegated_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  on_behalf_of uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chamber_id uuid REFERENCES public.chambers(id) ON DELETE SET NULL,
  delegation_id uuid NOT NULL REFERENCES public.clerk_delegations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  action_details jsonb,
  performed_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on delegated_actions
ALTER TABLE public.delegated_actions ENABLE ROW LEVEL SECURITY;

-- Lawyers can view actions performed on their behalf
CREATE POLICY "Lawyers can view actions on their behalf"
ON public.delegated_actions
FOR SELECT
TO authenticated
USING (
  on_behalf_of = auth.uid()
  OR actor_id = auth.uid()
  OR has_role(auth.uid(), 'ADMIN')
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_delegated_actions_lawyer 
ON public.delegated_actions(on_behalf_of, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_delegated_actions_actor 
ON public.delegated_actions(actor_id, performed_at DESC);

-- CP-5 PHASE 3: HELPER FUNCTION - Check if clerk has valid delegation with scope
CREATE OR REPLACE FUNCTION public.has_delegation_scope(
  _clerk_id uuid, 
  _lawyer_id uuid,
  _scope delegation_scope
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clerk_delegations
    WHERE clerk_id = _clerk_id 
    AND lawyer_id = _lawyer_id
    AND revoked_at IS NULL
    AND _scope = ANY(scopes)
  )
$$;

-- CP-5 PHASE 3: HELPER FUNCTION - Get active delegation for clerk-lawyer pair
CREATE OR REPLACE FUNCTION public.get_active_delegation(
  _clerk_id uuid, 
  _lawyer_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.clerk_delegations
  WHERE clerk_id = _clerk_id 
  AND lawyer_id = _lawyer_id
  AND revoked_at IS NULL
  LIMIT 1
$$;

-- CP-5 PHASE 4: UPDATE RLS FOR CLERKS WITH DELEGATION
-- Drop existing SELECT policy and recreate with delegation support
DROP POLICY IF EXISTS "Users can view own and chamber cases" ON public.daily_court_docket;

CREATE POLICY "Users can view own, chamber, and delegated cases"
ON public.daily_court_docket
FOR SELECT
TO authenticated
USING (
  -- Personal case owner
  (case_context = 'personal' AND matched_profile_id = auth.uid())
  OR
  -- Chamber member viewing chamber case
  (case_context = 'chamber' AND chamber_id IS NOT NULL AND can_view_chamber_cases(auth.uid(), chamber_id))
  OR
  -- Unmatched cases visible to lawyers
  (matched_profile_id IS NULL AND is_lawyer_role(auth.uid()))
  OR
  -- CP-5: Clerks with delegation can view delegated lawyer's cases
  (matched_profile_id IS NOT NULL AND is_delegated_clerk(auth.uid(), matched_profile_id))
);

-- Drop existing UPDATE policy and recreate with delegation support
DROP POLICY IF EXISTS "Case owners and chamber members can update" ON public.daily_court_docket;

CREATE POLICY "Case owners, chamber members, and delegated clerks can update"
ON public.daily_court_docket
FOR UPDATE
TO authenticated
USING (
  -- Personal case owner
  (case_context = 'personal' AND matched_profile_id = auth.uid())
  OR
  -- Chamber member
  (case_context = 'chamber' AND chamber_id IS NOT NULL AND can_view_chamber_cases(auth.uid(), chamber_id))
  OR
  -- Unmatched cases
  (matched_profile_id IS NULL AND is_lawyer_role(auth.uid()))
  OR
  -- CP-5: Delegated clerk (with any scope except ownership actions)
  (matched_profile_id IS NOT NULL AND is_delegated_clerk(auth.uid(), matched_profile_id))
)
WITH CHECK (
  -- Personal case owner
  (case_context = 'personal' AND matched_profile_id = auth.uid())
  OR
  -- Chamber member
  (case_context = 'chamber' AND chamber_id IS NOT NULL AND can_view_chamber_cases(auth.uid(), chamber_id))
  OR
  -- Unmatched cases
  (matched_profile_id IS NULL AND is_lawyer_role(auth.uid()))
  OR
  -- CP-5: Delegated clerk
  (matched_profile_id IS NOT NULL AND is_delegated_clerk(auth.uid(), matched_profile_id))
);

-- CP-5 PHASE 5: HARD ENFORCEMENT - Prevent clerks from modifying ownership fields
-- This trigger ensures clerks cannot escalate privileges via delegation
CREATE OR REPLACE FUNCTION public.enforce_lawyer_ownership_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if ownership fields are being modified
  IF (
    OLD.matched_profile_id IS DISTINCT FROM NEW.matched_profile_id
    OR OLD.force_active IS DISTINCT FROM NEW.force_active
    OR OLD.matched_role IS DISTINCT FROM NEW.matched_role
    OR OLD.match_method IS DISTINCT FROM NEW.match_method
    OR OLD.match_confidence IS DISTINCT FROM NEW.match_confidence
  ) THEN
    -- Must be a lawyer role to modify these fields
    IF NOT public.is_lawyer_role(auth.uid()) THEN
      RAISE EXCEPTION 'CLERK role cannot modify ownership fields (matched_profile_id, force_active, etc.). Only SENIOR, JUNIOR, or ADMIN roles may update these fields.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for update enforcement
DROP TRIGGER IF EXISTS trg_enforce_lawyer_ownership_updates ON public.daily_court_docket;
CREATE TRIGGER trg_enforce_lawyer_ownership_updates
  BEFORE UPDATE ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lawyer_ownership_updates();

-- CP-5 PHASE 6: FUNCTION TO LOG DELEGATED ACTION
CREATE OR REPLACE FUNCTION public.log_delegated_action(
  _actor_id uuid,
  _on_behalf_of uuid,
  _action_type text,
  _target_table text,
  _target_id uuid,
  _action_details jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _delegation_id uuid;
  _chamber_id uuid;
  _new_id uuid;
BEGIN
  -- Get active delegation
  SELECT id, chamber_id INTO _delegation_id, _chamber_id
  FROM public.clerk_delegations
  WHERE clerk_id = _actor_id 
  AND lawyer_id = _on_behalf_of
  AND revoked_at IS NULL
  LIMIT 1;
  
  IF _delegation_id IS NULL THEN
    RAISE EXCEPTION 'No active delegation exists between actor % and lawyer %', _actor_id, _on_behalf_of;
  END IF;
  
  INSERT INTO public.delegated_actions (
    actor_id, on_behalf_of, chamber_id, delegation_id,
    action_type, target_table, target_id, action_details
  ) VALUES (
    _actor_id, _on_behalf_of, _chamber_id, _delegation_id,
    _action_type, _target_table, _target_id, _action_details
  )
  RETURNING id INTO _new_id;
  
  RETURN _new_id;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block action
  RAISE WARNING 'Failed to log delegated action: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- Add realtime support for delegated_actions
ALTER PUBLICATION supabase_realtime ADD TABLE public.delegated_actions;
