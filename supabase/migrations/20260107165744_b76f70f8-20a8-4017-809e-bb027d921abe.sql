-- Fix infinite recursion in chamber_memberships RLS policy
-- The current policy references chamber_memberships within its own RLS check, causing recursion

-- First, create a SECURITY DEFINER function to check chamber membership
CREATE OR REPLACE FUNCTION public.is_chamber_member(_user_id uuid, _chamber_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chamber_memberships
    WHERE lawyer_id = _user_id
      AND chamber_id = _chamber_id
      AND revoked_at IS NULL
  )
$$;

-- Create a function to check if user owns the chamber
CREATE OR REPLACE FUNCTION public.is_chamber_owner(_user_id uuid, _chamber_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chambers
    WHERE id = _chamber_id
      AND owner_id = _user_id
  )
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Members can view memberships in their chambers" ON public.chamber_memberships;

-- Recreate with non-recursive approach using SECURITY DEFINER functions
CREATE POLICY "Members can view memberships in their chambers" 
ON public.chamber_memberships 
FOR SELECT 
TO authenticated
USING (
  public.is_chamber_member(auth.uid(), chamber_id) 
  OR public.is_chamber_owner(auth.uid(), chamber_id)
);