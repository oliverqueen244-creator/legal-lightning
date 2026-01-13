
-- =====================================================
-- CP-4 SAFE ACTIVATION + DELEGATION HARDENING
-- Phase 1 & 2: Security functions, triggers, and RLS
-- =====================================================

-- =====================================================
-- PART 1: ENHANCED SECURITY FUNCTIONS
-- =====================================================

-- 1A. Check if user is a CLERK role
CREATE OR REPLACE FUNCTION public.is_clerk_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'CLERK'
  )
$$;

-- 1B. Enhanced scope check - can clerk view cases
CREATE OR REPLACE FUNCTION public.clerk_can_view_case(_clerk_id uuid, _case_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clerk_delegations
    WHERE clerk_id = _clerk_id 
    AND lawyer_id = _case_owner_id
    AND revoked_at IS NULL
    AND 'view_cases'::delegation_scope = ANY(scopes)
  )
$$;

-- 1C. Check if clerk can edit specific case
CREATE OR REPLACE FUNCTION public.clerk_can_edit_case(_clerk_id uuid, _case_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clerk_delegations
    WHERE clerk_id = _clerk_id 
    AND lawyer_id = _case_owner_id
    AND revoked_at IS NULL
    AND 'edit_cases'::delegation_scope = ANY(scopes)
  )
$$;

-- =====================================================
-- PART 2: HARDENED OWNERSHIP TRIGGER (No bypasses)
-- =====================================================

CREATE OR REPLACE FUNCTION public.enforce_lawyer_ownership_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_user_id uuid;
  _is_lawyer boolean;
  _is_clerk boolean;
BEGIN
  -- Get current user (may be NULL for service role operations)
  _current_user_id := auth.uid();
  
  -- Check if ownership fields are being modified
  IF (
    OLD.matched_profile_id IS DISTINCT FROM NEW.matched_profile_id
    OR OLD.force_active IS DISTINCT FROM NEW.force_active
    OR OLD.matched_role IS DISTINCT FROM NEW.matched_role
    OR OLD.match_method IS DISTINCT FROM NEW.match_method
    OR OLD.match_confidence IS DISTINCT FROM NEW.match_confidence
  ) THEN
    
    -- CRITICAL: Even service role operations must respect ownership rules
    -- Only allow NULL user if match_method indicates automated system operation
    IF _current_user_id IS NULL THEN
      -- Automated operations must use specific match_methods
      IF NEW.match_method NOT IN ('auto_match', 'system_backfill', 'trigger_match') THEN
        RAISE EXCEPTION 'Service role operations modifying ownership must use valid automated match_method';
      END IF;
      -- Automated operations cannot set ownership to a non-lawyer
      IF NEW.matched_profile_id IS NOT NULL AND NOT public.is_lawyer_role(NEW.matched_profile_id) THEN
        RAISE EXCEPTION 'Automated operations cannot assign ownership to non-lawyer profiles';
      END IF;
      RETURN NEW;
    END IF;
    
    -- Check role of current user
    _is_lawyer := public.is_lawyer_role(_current_user_id);
    _is_clerk := public.is_clerk_role(_current_user_id);
    
    -- INVARIANT A: Clerks are ALWAYS blocked from modifying ownership
    IF _is_clerk THEN
      RAISE EXCEPTION 'CLERK role cannot modify ownership fields. Only SENIOR, JUNIOR, or ADMIN roles may update these fields.';
    END IF;
    
    -- Must be a lawyer to modify ownership
    IF NOT _is_lawyer THEN
      RAISE EXCEPTION 'Only lawyer roles (SENIOR, JUNIOR, ADMIN) may modify case ownership fields.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- =====================================================
-- PART 3: CHAMBER CONTEXT VALIDATION TRIGGER (Enhanced)
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_case_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- INVARIANT B: Chamber isolation
  
  -- If case_context is 'chamber', chamber_id must be set
  IF NEW.case_context = 'chamber' AND NEW.chamber_id IS NULL THEN
    RAISE EXCEPTION 'chamber_id is required when case_context is ''chamber''';
  END IF;
  
  -- If case_context is 'personal', chamber_id must be null
  IF NEW.case_context = 'personal' AND NEW.chamber_id IS NOT NULL THEN
    RAISE EXCEPTION 'chamber_id must be NULL when case_context is ''personal''';
  END IF;
  
  -- If chamber_id is being set, verify the chamber exists
  IF NEW.chamber_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.chambers WHERE id = NEW.chamber_id) THEN
      RAISE EXCEPTION 'Invalid chamber_id: chamber does not exist';
    END IF;
  END IF;
  
  -- Prevent implicit migration: personal cases cannot be moved to chambers
  IF TG_OP = 'UPDATE' THEN
    IF OLD.case_context = 'personal' AND NEW.case_context = 'chamber' THEN
      RAISE EXCEPTION 'Personal cases cannot be migrated to chambers. Create new chamber cases instead.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- =====================================================
-- PART 4: DELEGATION SCOPE ENFORCEMENT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.enforce_delegation_scope_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_user_id uuid;
  _is_clerk boolean;
  _case_owner_id uuid;
  _delegation_id uuid;
BEGIN
  _current_user_id := auth.uid();
  
  -- Skip for non-authenticated (system) operations
  IF _current_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  _is_clerk := public.is_clerk_role(_current_user_id);
  
  -- Only enforce for CLERK role
  IF NOT _is_clerk THEN
    RETURN NEW;
  END IF;
  
  -- Get case owner
  _case_owner_id := COALESCE(OLD.matched_profile_id, NEW.matched_profile_id);
  
  -- If no owner, clerk cannot edit
  IF _case_owner_id IS NULL THEN
    RAISE EXCEPTION 'CLERK cannot modify unowned cases';
  END IF;
  
  -- INVARIANT D: Check delegation scope
  SELECT id INTO _delegation_id
  FROM public.clerk_delegations
  WHERE clerk_id = _current_user_id 
  AND lawyer_id = _case_owner_id
  AND revoked_at IS NULL
  AND 'edit_cases'::delegation_scope = ANY(scopes);
  
  IF _delegation_id IS NULL THEN
    RAISE EXCEPTION 'CLERK lacks ''edit_cases'' scope for this case owner. Delegation scope required.';
  END IF;
  
  -- Log the delegated action
  INSERT INTO public.delegated_actions (
    actor_id,
    on_behalf_of,
    delegation_id,
    action_type,
    target_table,
    target_id,
    action_details
  ) VALUES (
    _current_user_id,
    _case_owner_id,
    _delegation_id,
    'UPDATE',
    'daily_court_docket',
    NEW.id,
    jsonb_build_object(
      'changed_fields', CASE 
        WHEN OLD.status IS DISTINCT FROM NEW.status THEN jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status))
        ELSE '{}'::jsonb
      END,
      'scope_used', 'edit_cases'
    )
  );
  
  RETURN NEW;
END;
$function$;

-- =====================================================
-- PART 5: DROP EXISTING POLICIES AND RECREATE
-- =====================================================

-- Drop existing docket policies
DROP POLICY IF EXISTS "Users can view own, chamber, delegated, or admin cases" ON public.daily_court_docket;
DROP POLICY IF EXISTS "Case owners, chamber members, and delegated clerks can update" ON public.daily_court_docket;
DROP POLICY IF EXISTS "Lawyers can insert docket entries" ON public.daily_court_docket;
DROP POLICY IF EXISTS "docket_select_policy" ON public.daily_court_docket;
DROP POLICY IF EXISTS "docket_insert_policy" ON public.daily_court_docket;
DROP POLICY IF EXISTS "docket_update_policy" ON public.daily_court_docket;
DROP POLICY IF EXISTS "docket_delete_policy" ON public.daily_court_docket;

-- 5A. SELECT Policy: Scope-enforced viewing
CREATE POLICY "docket_select_policy" ON public.daily_court_docket
FOR SELECT
USING (
  -- ADMIN can see everything
  has_role(auth.uid(), 'ADMIN'::app_role)
  OR
  -- Personal case owner
  (case_context = 'personal' AND matched_profile_id = auth.uid())
  OR
  -- Chamber member/owner can see chamber cases
  (case_context = 'chamber' AND chamber_id IS NOT NULL AND can_view_chamber_cases(auth.uid(), chamber_id))
  OR
  -- Lawyers can see unmatched cases for claiming
  (matched_profile_id IS NULL AND is_lawyer_role(auth.uid()))
  OR
  -- Clerks with view_cases scope for the owner
  (matched_profile_id IS NOT NULL AND clerk_can_view_case(auth.uid(), matched_profile_id))
);

-- 5B. INSERT Policy: Lawyers only, clerks blocked
CREATE POLICY "docket_insert_policy" ON public.daily_court_docket
FOR INSERT
WITH CHECK (
  is_lawyer_role(auth.uid())
  AND NOT is_clerk_role(auth.uid())
);

-- 5C. UPDATE Policy: Scope-enforced updates
CREATE POLICY "docket_update_policy" ON public.daily_court_docket
FOR UPDATE
USING (
  -- Personal case owner (lawyer only)
  (case_context = 'personal' AND matched_profile_id = auth.uid() AND is_lawyer_role(auth.uid()))
  OR
  -- Chamber owner/member who is a lawyer
  (case_context = 'chamber' AND chamber_id IS NOT NULL AND can_view_chamber_cases(auth.uid(), chamber_id) AND is_lawyer_role(auth.uid()))
  OR
  -- Lawyers can claim unmatched cases
  (matched_profile_id IS NULL AND is_lawyer_role(auth.uid()))
  OR
  -- Clerks with edit_cases scope (trigger validates and logs)
  (matched_profile_id IS NOT NULL AND clerk_can_edit_case(auth.uid(), matched_profile_id))
)
WITH CHECK (
  (case_context = 'personal' AND matched_profile_id = auth.uid() AND is_lawyer_role(auth.uid()))
  OR
  (case_context = 'chamber' AND chamber_id IS NOT NULL AND can_view_chamber_cases(auth.uid(), chamber_id) AND is_lawyer_role(auth.uid()))
  OR
  (matched_profile_id IS NULL AND is_lawyer_role(auth.uid()))
  OR
  (matched_profile_id IS NOT NULL AND clerk_can_edit_case(auth.uid(), matched_profile_id))
);

-- 5D. DELETE Policy: Admins only
CREATE POLICY "docket_delete_policy" ON public.daily_court_docket
FOR DELETE
USING (
  has_role(auth.uid(), 'ADMIN'::app_role)
);

-- =====================================================
-- PART 6: CHAMBER POLICIES (SENIOR/ADMIN creation)
-- =====================================================

DROP POLICY IF EXISTS "Chamber owners can manage their chambers" ON public.chambers;
DROP POLICY IF EXISTS "Users can view chambers they own or are members of" ON public.chambers;
DROP POLICY IF EXISTS "chambers_select_policy" ON public.chambers;
DROP POLICY IF EXISTS "chambers_insert_policy" ON public.chambers;
DROP POLICY IF EXISTS "chambers_update_policy" ON public.chambers;
DROP POLICY IF EXISTS "chambers_delete_policy" ON public.chambers;

CREATE POLICY "chambers_select_policy" ON public.chambers
FOR SELECT
USING (
  owner_id = auth.uid()
  OR is_chamber_member(auth.uid(), id)
  OR has_role(auth.uid(), 'ADMIN'::app_role)
);

CREATE POLICY "chambers_insert_policy" ON public.chambers
FOR INSERT
WITH CHECK (
  owner_id = auth.uid()
  AND (
    has_role(auth.uid(), 'SENIOR'::app_role)
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  )
);

CREATE POLICY "chambers_update_policy" ON public.chambers
FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "chambers_delete_policy" ON public.chambers
FOR DELETE
USING (
  owner_id = auth.uid()
  OR has_role(auth.uid(), 'ADMIN'::app_role)
);

-- =====================================================
-- PART 7: DELEGATION POLICIES (SENIOR/ADMIN creation)
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own delegations" ON public.clerk_delegations;
DROP POLICY IF EXISTS "Lawyers can create delegations for themselves" ON public.clerk_delegations;
DROP POLICY IF EXISTS "Lawyers can revoke their own delegations" ON public.clerk_delegations;
DROP POLICY IF EXISTS "delegations_select_policy" ON public.clerk_delegations;
DROP POLICY IF EXISTS "delegations_insert_policy" ON public.clerk_delegations;
DROP POLICY IF EXISTS "delegations_update_policy" ON public.clerk_delegations;
DROP POLICY IF EXISTS "delegations_delete_policy" ON public.clerk_delegations;

CREATE POLICY "delegations_select_policy" ON public.clerk_delegations
FOR SELECT
USING (
  clerk_id = auth.uid()
  OR lawyer_id = auth.uid()
  OR has_role(auth.uid(), 'ADMIN'::app_role)
);

CREATE POLICY "delegations_insert_policy" ON public.clerk_delegations
FOR INSERT
WITH CHECK (
  lawyer_id = auth.uid()
  AND (
    has_role(auth.uid(), 'SENIOR'::app_role)
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  )
);

CREATE POLICY "delegations_update_policy" ON public.clerk_delegations
FOR UPDATE
USING (lawyer_id = auth.uid())
WITH CHECK (lawyer_id = auth.uid());

CREATE POLICY "delegations_delete_policy" ON public.clerk_delegations
FOR DELETE
USING (false);

-- =====================================================
-- PART 8: DELEGATED ACTIONS AUDIT TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "delegated_actions_select" ON public.delegated_actions;
DROP POLICY IF EXISTS "delegated_actions_insert" ON public.delegated_actions;
DROP POLICY IF EXISTS "delegated_actions_select_policy" ON public.delegated_actions;
DROP POLICY IF EXISTS "delegated_actions_insert_policy" ON public.delegated_actions;

CREATE POLICY "delegated_actions_select_policy" ON public.delegated_actions
FOR SELECT
USING (
  actor_id = auth.uid()
  OR on_behalf_of = auth.uid()
  OR has_role(auth.uid(), 'ADMIN'::app_role)
);

CREATE POLICY "delegated_actions_insert_policy" ON public.delegated_actions
FOR INSERT
WITH CHECK (
  actor_id = auth.uid()
);

-- =====================================================
-- PART 9: ENSURE TRIGGERS ARE IN PLACE
-- =====================================================

DROP TRIGGER IF EXISTS validate_case_context_trigger ON public.daily_court_docket;
CREATE TRIGGER validate_case_context_trigger
BEFORE INSERT OR UPDATE ON public.daily_court_docket
FOR EACH ROW
EXECUTE FUNCTION public.validate_case_context();

DROP TRIGGER IF EXISTS enforce_lawyer_ownership_trigger ON public.daily_court_docket;
CREATE TRIGGER enforce_lawyer_ownership_trigger
BEFORE UPDATE ON public.daily_court_docket
FOR EACH ROW
EXECUTE FUNCTION public.enforce_lawyer_ownership_updates();

DROP TRIGGER IF EXISTS enforce_delegation_scope_trigger ON public.daily_court_docket;
CREATE TRIGGER enforce_delegation_scope_trigger
BEFORE UPDATE ON public.daily_court_docket
FOR EACH ROW
EXECUTE FUNCTION public.enforce_delegation_scope_on_update();
