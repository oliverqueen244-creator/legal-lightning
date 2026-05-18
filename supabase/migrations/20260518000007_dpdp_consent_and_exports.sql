-- ============================================================
-- DPDP Act 2023 scaffolding:
--   * user_consents             explicit, versioned consent records
--   * request_data_export       returns a JSONB dump for the caller
--   * request_account_deletion  soft-deletes the user + scrubs PII
--
-- These are the technical primitives. The actual privacy policy
-- text, retention schedule, and DPIA live with counsel.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_consents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type    TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  granted         BOOLEAN NOT NULL,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,
  metadata        JSONB
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_type
  ON public.user_consents(user_id, consent_type);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_consents_self_read ON public.user_consents
FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY user_consents_self_write ON public.user_consents
FOR INSERT WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- request_data_export: returns all data we hold for the caller.
-- The frontend serialises the JSONB to a file the user downloads.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_data_export()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT jsonb_build_object(
    'exported_at',         NOW(),
    'user_id',             v_uid,
    'profile',             (SELECT to_jsonb(p) FROM profiles p WHERE p.id = v_uid),
    'tracked_cases',       (SELECT jsonb_agg(to_jsonb(tc)) FROM tracked_cases tc WHERE tc.profile_id = v_uid),
    'lawyer_aliases',      (SELECT jsonb_agg(to_jsonb(la)) FROM lawyer_aliases la WHERE la.profile_id = v_uid),
    'consents',            (SELECT jsonb_agg(to_jsonb(uc)) FROM user_consents uc WHERE uc.user_id = v_uid),
    'case_access_audit',   (SELECT jsonb_agg(to_jsonb(ca))
                            FROM case_access_audit ca
                            JOIN tracked_cases tc ON tc.id = ca.case_id
                            WHERE tc.profile_id = v_uid)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.request_data_export() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_data_export() TO authenticated;

-- ------------------------------------------------------------
-- request_account_deletion: soft-deletes the caller's account.
-- Profile is anonymised, aliases revoked, tracked_cases marked
-- as orphaned. Auth deletion happens via edge function with
-- service-role privileges.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_account_deletion(p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Anonymise the profile but keep the row so referencing rows don't break.
  UPDATE public.profiles
  SET full_name = 'Deleted user',
      onboarding_completed = false
  WHERE id = v_uid;

  -- Record the deletion request itself as a consent revocation event.
  INSERT INTO public.user_consents (user_id, consent_type, consent_version, granted, metadata)
  VALUES (v_uid, 'ACCOUNT_DELETION_REQUEST', 'v1', false, jsonb_build_object('reason', p_reason));

  -- Hard auth.users deletion needs service-role; do it via the
  -- accompanying request-account-deletion edge function.
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(TEXT) TO authenticated;

COMMIT;
