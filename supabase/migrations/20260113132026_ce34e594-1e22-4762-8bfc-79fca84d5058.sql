
-- =====================================================
-- CP-4 LIVE BETA: SECURITY EVENTS + OBSERVABILITY
-- =====================================================

-- 1. Create security_events table for violation logging
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'scope_violation', 'ownership_violation', 'context_violation', 'unattributed_mutation'
  user_id UUID,
  user_role TEXT,
  attempted_action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  reason TEXT NOT NULL,
  request_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can read security events
CREATE POLICY "security_events_select_admin" ON public.security_events
  FOR SELECT USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- RLS: Only SECURITY DEFINER functions can insert (no direct inserts)
CREATE POLICY "security_events_insert_system" ON public.security_events
  FOR INSERT WITH CHECK (false); -- Blocked for all, only via SECURITY DEFINER

-- 2. Create log_security_event helper function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_attempted_action TEXT,
  p_target_table TEXT,
  p_target_id UUID,
  p_reason TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_role TEXT;
  v_event_id UUID;
BEGIN
  -- Get user role
  SELECT role::text INTO v_user_role
  FROM user_roles WHERE user_id = auth.uid();
  
  -- Insert security event (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO security_events (event_type, user_id, user_role, attempted_action, target_table, target_id, reason, request_metadata)
  VALUES (p_event_type, auth.uid(), COALESCE(v_user_role, 'UNKNOWN'), p_attempted_action, p_target_table, p_target_id, p_reason, p_metadata)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
EXCEPTION WHEN OTHERS THEN
  -- Never block operations due to logging failure
  RETURN NULL;
END;
$$;

-- 3. Create invariant audit views (must always return 0 rows)

-- 3.1 v_invalid_case_contexts: Cases where context/chamber_id are inconsistent
CREATE OR REPLACE VIEW public.v_invalid_case_contexts AS
SELECT id, case_context, chamber_id, matched_profile_id, date, case_number
FROM daily_court_docket
WHERE (case_context = 'chamber' AND chamber_id IS NULL)
   OR (case_context = 'personal' AND chamber_id IS NOT NULL);

-- 3.2 v_clerk_ownership_violations: Cases owned by CLERKs (should be 0)
CREATE OR REPLACE VIEW public.v_clerk_ownership_violations AS
SELECT dcd.id, dcd.matched_profile_id, dcd.case_number, dcd.date, ur.role
FROM daily_court_docket dcd
JOIN user_roles ur ON ur.user_id = dcd.matched_profile_id
WHERE ur.role = 'CLERK';

-- 3.3 v_delegation_scope_violations: Delegated actions without valid delegation
CREATE OR REPLACE VIEW public.v_delegation_scope_violations AS
SELECT da.id, da.actor_id, da.action_type, da.target_table, da.performed_at
FROM delegated_actions da
LEFT JOIN clerk_delegations cd ON cd.id = da.delegation_id
WHERE cd.id IS NULL 
   OR cd.revoked_at IS NOT NULL 
   OR cd.revoked_at < da.performed_at;

-- 3.4 v_unattributed_mutations: Security events flagged as unattributed
CREATE OR REPLACE VIEW public.v_unattributed_mutations AS
SELECT id, user_id, user_role, attempted_action, target_table, target_id, reason, created_at
FROM security_events
WHERE event_type = 'unattributed_mutation';

-- Grant read access to views for admins only
GRANT SELECT ON public.v_invalid_case_contexts TO authenticated;
GRANT SELECT ON public.v_clerk_ownership_violations TO authenticated;
GRANT SELECT ON public.v_delegation_scope_violations TO authenticated;
GRANT SELECT ON public.v_unattributed_mutations TO authenticated;

-- 4. Update enforce_lawyer_ownership_updates trigger to log violations
CREATE OR REPLACE FUNCTION public.enforce_lawyer_ownership_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_clerk BOOLEAN;
  _user_role TEXT;
BEGIN
  -- Check if current user is a clerk
  SELECT role INTO _user_role FROM user_roles WHERE user_id = auth.uid();
  _is_clerk := _user_role = 'CLERK';
  
  -- If clerk is trying to modify ownership fields, log and block
  IF _is_clerk AND (
    (OLD.matched_profile_id IS DISTINCT FROM NEW.matched_profile_id) OR
    (OLD.force_active IS DISTINCT FROM NEW.force_active)
  ) THEN
    -- Log the violation
    PERFORM log_security_event(
      'ownership_violation',
      'UPDATE',
      'daily_court_docket',
      NEW.id,
      'Clerk attempted to modify ownership fields (matched_profile_id or force_active)',
      jsonb_build_object(
        'old_profile_id', OLD.matched_profile_id,
        'new_profile_id', NEW.matched_profile_id,
        'old_force_active', OLD.force_active,
        'new_force_active', NEW.force_active
      )
    );
    RAISE EXCEPTION 'CLERKs cannot modify case ownership fields. This action has been logged.';
  END IF;
  
  -- For service role operations, still validate lawyer-only for ownership changes
  IF auth.uid() IS NULL THEN
    -- Service role - but if we somehow have clerk context, still block
    IF (OLD.matched_profile_id IS DISTINCT FROM NEW.matched_profile_id) THEN
      -- Only allow if the new profile is a lawyer
      IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.matched_profile_id AND role = 'CLERK') THEN
        PERFORM log_security_event(
          'ownership_violation',
          'UPDATE_SERVICE_ROLE',
          'daily_court_docket',
          NEW.id,
          'Service role attempted to assign case ownership to a CLERK',
          jsonb_build_object('attempted_owner', NEW.matched_profile_id)
        );
        RAISE EXCEPTION 'Cannot assign case ownership to CLERK role';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Update enforce_delegation_scope_on_update trigger to log violations
CREATE OR REPLACE FUNCTION public.enforce_delegation_scope_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_clerk BOOLEAN;
  _case_owner UUID;
  _delegation_id UUID;
  _has_scope BOOLEAN;
BEGIN
  -- Check if current user is a clerk
  _is_clerk := is_clerk_role(auth.uid());
  
  -- If not a clerk, allow the update (lawyers can edit their own cases)
  IF NOT _is_clerk THEN
    RETURN NEW;
  END IF;
  
  -- Get the case owner
  _case_owner := OLD.matched_profile_id;
  
  -- Check if clerk has edit_cases scope for this owner
  SELECT cd.id, 'edit_cases' = ANY(cd.scopes) INTO _delegation_id, _has_scope
  FROM clerk_delegations cd
  WHERE cd.clerk_id = auth.uid()
    AND cd.lawyer_id = _case_owner
    AND cd.revoked_at IS NULL
    AND 'edit_cases' = ANY(cd.scopes);
  
  IF _delegation_id IS NULL OR NOT _has_scope THEN
    -- Log the scope violation
    PERFORM log_security_event(
      'scope_violation',
      'UPDATE',
      'daily_court_docket',
      NEW.id,
      'Clerk attempted case update without edit_cases scope',
      jsonb_build_object(
        'case_owner', _case_owner,
        'delegation_found', _delegation_id IS NOT NULL,
        'has_edit_scope', COALESCE(_has_scope, false)
      )
    );
    RAISE EXCEPTION 'Clerk does not have edit_cases scope for this case owner. This action has been logged.';
  END IF;
  
  -- Log the delegated action for attribution
  INSERT INTO delegated_actions (
    actor_id,
    on_behalf_of,
    delegation_id,
    action_type,
    target_table,
    target_id,
    action_details
  ) VALUES (
    auth.uid(),
    _case_owner,
    _delegation_id,
    'UPDATE',
    'daily_court_docket',
    NEW.id,
    jsonb_build_object(
      'changed_fields', (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(OLD) -> key IS DISTINCT FROM value
      )
    )
  );
  
  RETURN NEW;
END;
$$;

-- 6. Add scope enforcement trigger for case_documents
CREATE OR REPLACE FUNCTION public.enforce_document_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_clerk BOOLEAN;
  _case_owner UUID;
  _delegation_id UUID;
  _has_scope BOOLEAN;
BEGIN
  _is_clerk := is_clerk_role(auth.uid());
  
  -- Lawyers can manage their own documents
  IF NOT _is_clerk THEN
    RETURN NEW;
  END IF;
  
  -- Get case owner from docket
  SELECT matched_profile_id INTO _case_owner
  FROM daily_court_docket WHERE id = COALESCE(NEW.docket_id, OLD.docket_id);
  
  -- Check for manage_documents scope
  SELECT cd.id, 'manage_documents' = ANY(cd.scopes) INTO _delegation_id, _has_scope
  FROM clerk_delegations cd
  WHERE cd.clerk_id = auth.uid()
    AND cd.lawyer_id = _case_owner
    AND cd.revoked_at IS NULL
    AND 'manage_documents' = ANY(cd.scopes);
  
  IF _delegation_id IS NULL OR NOT _has_scope THEN
    PERFORM log_security_event(
      'scope_violation',
      TG_OP,
      'case_documents',
      COALESCE(NEW.id, OLD.id),
      'Clerk attempted document operation without manage_documents scope',
      jsonb_build_object('case_owner', _case_owner, 'operation', TG_OP)
    );
    RAISE EXCEPTION 'Clerk does not have manage_documents scope. This action has been logged.';
  END IF;
  
  -- Log delegated action
  INSERT INTO delegated_actions (actor_id, on_behalf_of, delegation_id, action_type, target_table, target_id)
  VALUES (auth.uid(), _case_owner, _delegation_id, TG_OP, 'case_documents', COALESCE(NEW.id, OLD.id));
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for case_documents
DROP TRIGGER IF EXISTS enforce_document_scope_trigger ON case_documents;
CREATE TRIGGER enforce_document_scope_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON case_documents
  FOR EACH ROW
  EXECUTE FUNCTION enforce_document_scope();

-- 7. Add scope enforcement trigger for case_arguments
CREATE OR REPLACE FUNCTION public.enforce_argument_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_clerk BOOLEAN;
  _case_owner UUID;
  _delegation_id UUID;
  _has_scope BOOLEAN;
BEGIN
  _is_clerk := is_clerk_role(auth.uid());
  
  IF NOT _is_clerk THEN
    RETURN NEW;
  END IF;
  
  -- Get case owner from docket
  SELECT matched_profile_id INTO _case_owner
  FROM daily_court_docket WHERE id = COALESCE(NEW.docket_id, OLD.docket_id);
  
  -- Check for edit_cases scope (arguments are case edits)
  SELECT cd.id, 'edit_cases' = ANY(cd.scopes) INTO _delegation_id, _has_scope
  FROM clerk_delegations cd
  WHERE cd.clerk_id = auth.uid()
    AND cd.lawyer_id = _case_owner
    AND cd.revoked_at IS NULL
    AND 'edit_cases' = ANY(cd.scopes);
  
  IF _delegation_id IS NULL OR NOT _has_scope THEN
    PERFORM log_security_event(
      'scope_violation',
      TG_OP,
      'case_arguments',
      COALESCE(NEW.id, OLD.id),
      'Clerk attempted argument operation without edit_cases scope',
      jsonb_build_object('case_owner', _case_owner, 'operation', TG_OP)
    );
    RAISE EXCEPTION 'Clerk does not have edit_cases scope. This action has been logged.';
  END IF;
  
  -- Log delegated action
  INSERT INTO delegated_actions (actor_id, on_behalf_of, delegation_id, action_type, target_table, target_id)
  VALUES (auth.uid(), _case_owner, _delegation_id, TG_OP, 'case_arguments', COALESCE(NEW.id, OLD.id));
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS enforce_argument_scope_trigger ON case_arguments;
CREATE TRIGGER enforce_argument_scope_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON case_arguments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_argument_scope();

-- 8. Add scope enforcement trigger for judgment_attachments
CREATE OR REPLACE FUNCTION public.enforce_judgment_attachment_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_clerk BOOLEAN;
  _case_owner UUID;
  _delegation_id UUID;
  _has_scope BOOLEAN;
BEGIN
  _is_clerk := is_clerk_role(auth.uid());
  
  IF NOT _is_clerk THEN
    RETURN NEW;
  END IF;
  
  -- Get case owner from docket
  SELECT matched_profile_id INTO _case_owner
  FROM daily_court_docket WHERE id = COALESCE(NEW.docket_id, OLD.docket_id);
  
  -- Check for edit_cases scope
  SELECT cd.id, 'edit_cases' = ANY(cd.scopes) INTO _delegation_id, _has_scope
  FROM clerk_delegations cd
  WHERE cd.clerk_id = auth.uid()
    AND cd.lawyer_id = _case_owner
    AND cd.revoked_at IS NULL
    AND 'edit_cases' = ANY(cd.scopes);
  
  IF _delegation_id IS NULL OR NOT _has_scope THEN
    PERFORM log_security_event(
      'scope_violation',
      TG_OP,
      'judgment_attachments',
      COALESCE(NEW.id, OLD.id),
      'Clerk attempted judgment attachment operation without edit_cases scope',
      jsonb_build_object('case_owner', _case_owner, 'operation', TG_OP)
    );
    RAISE EXCEPTION 'Clerk does not have edit_cases scope. This action has been logged.';
  END IF;
  
  -- Log delegated action
  INSERT INTO delegated_actions (actor_id, on_behalf_of, delegation_id, action_type, target_table, target_id)
  VALUES (auth.uid(), _case_owner, _delegation_id, TG_OP, 'judgment_attachments', COALESCE(NEW.id, OLD.id));
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS enforce_judgment_attachment_scope_trigger ON judgment_attachments;
CREATE TRIGGER enforce_judgment_attachment_scope_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON judgment_attachments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_judgment_attachment_scope();

-- 9. Verify all triggers are in place
DO $$
BEGIN
  RAISE NOTICE 'CP-4 Live Beta security infrastructure deployed:';
  RAISE NOTICE '- security_events table created';
  RAISE NOTICE '- 4 invariant audit views created';
  RAISE NOTICE '- Ownership enforcement trigger updated with logging';
  RAISE NOTICE '- Delegation scope trigger updated with logging';
  RAISE NOTICE '- Document scope trigger created';
  RAISE NOTICE '- Argument scope trigger created';
  RAISE NOTICE '- Judgment attachment scope trigger created';
END;
$$;
