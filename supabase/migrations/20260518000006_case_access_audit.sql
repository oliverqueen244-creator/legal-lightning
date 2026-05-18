-- ============================================================
-- Case-access audit log. Required by Bar Council ethics audits:
-- "who looked at which case and when". Logged for mutations only
-- (SELECT triggers are not supported in Postgres and selecting
-- every row read would crush latency).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.case_access_audit (
  id          BIGSERIAL PRIMARY KEY,
  case_id     UUID NOT NULL,
  table_name  TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_id    UUID,
  actor_role  TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diff        JSONB
);

CREATE INDEX IF NOT EXISTS idx_case_access_audit_case_changed
  ON public.case_access_audit(case_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_access_audit_actor_changed
  ON public.case_access_audit(actor_id, changed_at DESC);

ALTER TABLE public.case_access_audit ENABLE ROW LEVEL SECURITY;

-- Admins and the case owner can read their own audit trail.
CREATE POLICY case_access_audit_read ON public.case_access_audit
FOR SELECT USING (
  public.has_role(auth.uid(), 'ADMIN'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.tracked_cases tc
    WHERE tc.id = case_access_audit.case_id
      AND tc.profile_id = auth.uid()
  )
);

-- Only the trigger (SECURITY DEFINER) writes; no direct INSERT policy needed.

CREATE OR REPLACE FUNCTION public.log_tracked_case_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_case_id UUID := COALESCE(NEW.id, OLD.id);
  v_diff JSONB;
BEGIN
  IF v_actor_id IS NOT NULL THEN
    SELECT role::text INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_diff := jsonb_build_object(
      'before', to_jsonb(OLD) - 'updated_at',
      'after',  to_jsonb(NEW) - 'updated_at'
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_diff := jsonb_build_object('after', to_jsonb(NEW));
  ELSE
    v_diff := jsonb_build_object('before', to_jsonb(OLD));
  END IF;

  INSERT INTO public.case_access_audit (case_id, table_name, action, actor_id, actor_role, diff)
  VALUES (v_case_id, TG_TABLE_NAME, TG_OP, v_actor_id, v_actor_role, v_diff);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_tracked_cases_audit ON public.tracked_cases;
CREATE TRIGGER trg_tracked_cases_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.tracked_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tracked_case_audit();

-- case_documents uses docket_id not case_id; instrumenting it needs a
-- separate trigger that joins to tracked_cases. Punted for now.

COMMIT;
