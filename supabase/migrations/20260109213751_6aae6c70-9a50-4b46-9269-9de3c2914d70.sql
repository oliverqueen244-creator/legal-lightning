-- ============================================================
-- CORRECTNESS PLAN 3: Part 1 - Create clerk_delegations table
-- ============================================================

-- 1. Create clerk_delegations table for delegation model
CREATE TABLE IF NOT EXISTS public.clerk_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chamber_id UUID REFERENCES public.chambers(id) ON DELETE SET NULL,
  delegated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(clerk_id, lawyer_id)
);

-- Enable RLS on clerk_delegations
ALTER TABLE public.clerk_delegations ENABLE ROW LEVEL SECURITY;

-- Clerk delegations policies
CREATE POLICY "Users can view their own delegations"
ON public.clerk_delegations FOR SELECT
TO authenticated
USING (clerk_id = auth.uid() OR lawyer_id = auth.uid());

CREATE POLICY "Lawyers can create delegations for themselves"
ON public.clerk_delegations FOR INSERT
TO authenticated
WITH CHECK (
  lawyer_id = auth.uid() 
  AND public.has_role(auth.uid(), 'SENIOR')
);

CREATE POLICY "Lawyers can revoke their own delegations"
ON public.clerk_delegations FOR UPDATE
TO authenticated
USING (lawyer_id = auth.uid())
WITH CHECK (lawyer_id = auth.uid());

-- Add comment documenting the security model
COMMENT ON TABLE public.clerk_delegations IS 
'Delegation model for clerk accounts. Clerks must be delegated by a lawyer (SENIOR) to act on their behalf. Clerk actions should be recorded with on_behalf_of semantics.';