-- ============================================
-- CP-4 PHASE 0: SAFETY HARDENING
-- Prevent CLERKs from being set as case owners
-- ============================================

-- Create trigger to enforce lawyer-only ownership on matched_profile_id
CREATE OR REPLACE FUNCTION public.enforce_lawyer_only_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If matched_profile_id is being set to a non-null value
  IF NEW.matched_profile_id IS NOT NULL THEN
    -- Verify the target profile is a lawyer role (SENIOR, JUNIOR, ADMIN)
    IF NOT public.is_lawyer_role(NEW.matched_profile_id) THEN
      RAISE EXCEPTION 'Cannot assign case ownership to non-lawyer profile. matched_profile_id must reference a SENIOR, JUNIOR, or ADMIN role.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on INSERT
DROP TRIGGER IF EXISTS trg_enforce_lawyer_ownership_insert ON daily_court_docket;
CREATE TRIGGER trg_enforce_lawyer_ownership_insert
  BEFORE INSERT ON daily_court_docket
  FOR EACH ROW
  WHEN (NEW.matched_profile_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_lawyer_only_ownership();

-- Create trigger on UPDATE  
DROP TRIGGER IF EXISTS trg_enforce_lawyer_ownership_update ON daily_court_docket;
CREATE TRIGGER trg_enforce_lawyer_ownership_update
  BEFORE UPDATE ON daily_court_docket
  FOR EACH ROW
  WHEN (NEW.matched_profile_id IS DISTINCT FROM OLD.matched_profile_id AND NEW.matched_profile_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_lawyer_only_ownership();

-- ============================================
-- CP-4 PHASE 1: CASE CONTEXT MODEL
-- Introduce case_context enum and chamber linkage
-- ============================================

-- Create the case_context enum
DO $$ BEGIN
  CREATE TYPE public.case_context AS ENUM ('personal', 'chamber');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add case_context column to daily_court_docket
ALTER TABLE public.daily_court_docket 
ADD COLUMN IF NOT EXISTS case_context public.case_context NOT NULL DEFAULT 'personal';

-- Add chamber_id for chamber-context cases (nullable, only set when case_context = 'chamber')
ALTER TABLE public.daily_court_docket 
ADD COLUMN IF NOT EXISTS chamber_id uuid REFERENCES public.chambers(id) ON DELETE SET NULL;

-- Add index for efficient chamber case queries
CREATE INDEX IF NOT EXISTS idx_docket_chamber_context 
ON public.daily_court_docket(chamber_id, case_context) 
WHERE case_context = 'chamber';

-- Add index for personal cases by owner
CREATE INDEX IF NOT EXISTS idx_docket_personal_owner
ON public.daily_court_docket(matched_profile_id, case_context)
WHERE case_context = 'personal';

-- ============================================
-- CP-4 PHASE 3: CHAMBER VISIBILITY RLS
-- Allow chamber members to view chamber cases
-- ============================================

-- Helper function: Check if user can view a chamber's cases
CREATE OR REPLACE FUNCTION public.can_view_chamber_cases(_user_id uuid, _chamber_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    -- Chamber owner can view
    EXISTS (
      SELECT 1 FROM public.chambers 
      WHERE id = _chamber_id AND owner_id = _user_id
    )
    OR
    -- Active chamber member can view
    EXISTS (
      SELECT 1 FROM public.chamber_memberships
      WHERE chamber_id = _chamber_id 
      AND lawyer_id = _user_id 
      AND revoked_at IS NULL
    )
  )
$$;

-- Update RLS policy for daily_court_docket SELECT
-- Users can view:
-- 1. Their own personal cases (matched_profile_id = user)
-- 2. Chamber cases where they are a member/owner
DROP POLICY IF EXISTS "Authenticated users can view docket" ON public.daily_court_docket;

CREATE POLICY "Users can view own and chamber cases"
ON public.daily_court_docket
FOR SELECT
TO authenticated
USING (
  -- Personal cases: user is the owner
  (case_context = 'personal' AND matched_profile_id = auth.uid())
  OR
  -- Chamber cases: user is member/owner of the chamber
  (case_context = 'chamber' AND chamber_id IS NOT NULL AND public.can_view_chamber_cases(auth.uid(), chamber_id))
  OR
  -- Unmatched cases can be viewed by lawyers (for matching purposes)
  (matched_profile_id IS NULL AND public.is_lawyer_role(auth.uid()))
);

-- Tighten UPDATE policy - only case owner can update their cases
DROP POLICY IF EXISTS "Authenticated users can update docket" ON public.daily_court_docket;

CREATE POLICY "Case owners and chamber members can update"
ON public.daily_court_docket
FOR UPDATE
TO authenticated
USING (
  -- Personal case owner
  (case_context = 'personal' AND matched_profile_id = auth.uid())
  OR
  -- Chamber case member/owner
  (case_context = 'chamber' AND chamber_id IS NOT NULL AND public.can_view_chamber_cases(auth.uid(), chamber_id))
  OR
  -- Lawyers can update unmatched cases (for matching)
  (matched_profile_id IS NULL AND public.is_lawyer_role(auth.uid()))
)
WITH CHECK (
  -- Maintain ownership rules on update
  (case_context = 'personal' AND matched_profile_id = auth.uid())
  OR
  (case_context = 'chamber' AND chamber_id IS NOT NULL AND public.can_view_chamber_cases(auth.uid(), chamber_id))
  OR
  (matched_profile_id IS NULL AND public.is_lawyer_role(auth.uid()))
);

-- Validation trigger: chamber_id must be set when case_context = 'chamber'
CREATE OR REPLACE FUNCTION public.validate_case_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If case_context is 'chamber', chamber_id must be set
  IF NEW.case_context = 'chamber' AND NEW.chamber_id IS NULL THEN
    RAISE EXCEPTION 'chamber_id is required when case_context is ''chamber''';
  END IF;
  
  -- If case_context is 'personal', chamber_id should be null
  IF NEW.case_context = 'personal' AND NEW.chamber_id IS NOT NULL THEN
    RAISE EXCEPTION 'chamber_id must be NULL when case_context is ''personal''';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_case_context ON daily_court_docket;
CREATE TRIGGER trg_validate_case_context
  BEFORE INSERT OR UPDATE ON daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_case_context();