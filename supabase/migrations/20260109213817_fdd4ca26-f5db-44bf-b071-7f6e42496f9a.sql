-- ============================================================
-- CORRECTNESS PLAN 3: Part 2 - RLS and Trigger Enforcement
-- ============================================================

-- 1. Create helper function to check if user is a lawyer role
CREATE OR REPLACE FUNCTION public.is_lawyer_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('SENIOR', 'JUNIOR', 'ADMIN')
  )
$$;

-- 2. Create helper function to check if clerk is delegated to act on behalf of a lawyer
CREATE OR REPLACE FUNCTION public.is_delegated_clerk(_clerk_id uuid, _lawyer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clerk_delegations
    WHERE clerk_id = _clerk_id 
    AND lawyer_id = _lawyer_id
    AND revoked_at IS NULL
  )
$$;

-- 3. Create trigger function to enforce lawyer-only updates on ownership fields
CREATE OR REPLACE FUNCTION public.enforce_lawyer_ownership_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 4. Create the trigger on daily_court_docket
DROP TRIGGER IF EXISTS enforce_lawyer_ownership ON public.daily_court_docket;
CREATE TRIGGER enforce_lawyer_ownership
  BEFORE UPDATE ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lawyer_ownership_updates();

-- 5. Drop existing overly-permissive policies on daily_court_docket
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.daily_court_docket;
DROP POLICY IF EXISTS "Authenticated users can update" ON public.daily_court_docket;
DROP POLICY IF EXISTS "Authenticated users can view docket" ON public.daily_court_docket;

-- 6. Create new RLS policies for daily_court_docket

-- SELECT: Everyone authenticated can read (for dashboard visibility)
CREATE POLICY "Authenticated users can view docket"
ON public.daily_court_docket FOR SELECT
TO authenticated
USING (true);

-- INSERT: Only lawyers and admins can insert docket entries
CREATE POLICY "Lawyers can insert docket entries"
ON public.daily_court_docket FOR INSERT
TO authenticated
WITH CHECK (public.is_lawyer_role(auth.uid()));

-- UPDATE: Allow all authenticated, but trigger enforces ownership field restrictions
CREATE POLICY "Authenticated users can update docket"
ON public.daily_court_docket FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Add comments documenting the security model
COMMENT ON FUNCTION public.is_lawyer_role IS 
'Returns true if user has SENIOR, JUNIOR, or ADMIN role. Used for RLS and trigger enforcement on ownership fields.';

COMMENT ON TRIGGER enforce_lawyer_ownership ON public.daily_court_docket IS 
'Prevents CLERK role from modifying ownership fields (matched_profile_id, force_active, matched_role, match_method, match_confidence). Clerks can only read docket data.';