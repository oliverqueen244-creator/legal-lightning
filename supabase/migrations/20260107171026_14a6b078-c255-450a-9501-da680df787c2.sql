-- Fix infinite recursion between chambers and chamber_memberships RLS policies
-- The current setup has circular dependency:
-- chambers SELECT policy queries chamber_memberships
-- chamber_memberships SELECT policy calls is_chamber_owner which queries chambers

-- Drop the problematic policies first
DROP POLICY IF EXISTS "Members can view their chambers" ON public.chambers;
DROP POLICY IF EXISTS "Members can view memberships in their chambers" ON public.chamber_memberships;

-- Recreate chamber_memberships SELECT policy using ONLY is_chamber_member
-- (which is SECURITY DEFINER and safe)
CREATE POLICY "Members can view memberships in their chambers" 
ON public.chamber_memberships 
FOR SELECT 
TO authenticated
USING (
  -- User is the member themselves (direct check, no recursion)
  lawyer_id = auth.uid()
  -- OR user is the owner of the chamber (uses SECURITY DEFINER function)
  OR public.is_chamber_owner(auth.uid(), chamber_id)
);

-- Recreate chambers SELECT policy using SECURITY DEFINER functions
-- This avoids querying chamber_memberships directly in the policy
CREATE POLICY "Members can view their chambers"
ON public.chambers
FOR SELECT
TO authenticated
USING (
  -- User is the owner (direct check)
  owner_id = auth.uid()
  -- OR user is a member (uses SECURITY DEFINER function, bypasses RLS)
  OR public.is_chamber_member(auth.uid(), id)
);