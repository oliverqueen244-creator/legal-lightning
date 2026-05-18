-- ============================================================
-- Bar Council of India enrollment verification.
-- bar_registration_number already exists on profiles. Add an
-- explicit verification state + admin-controlled approval column.
-- ============================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bar_council_state TEXT,
  ADD COLUMN IF NOT EXISTS bci_verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (bci_verification_status IN ('pending', 'submitted', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS bci_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bci_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bci_rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_bci_status_pending
  ON public.profiles(bci_verification_status)
  WHERE bci_verification_status IN ('submitted', 'pending');

-- Admin-only RPC to approve / reject. Lawyers themselves can only set
-- 'submitted' (via the BCI step in onboarding); only admins move it to
-- 'verified' or 'rejected'.
CREATE OR REPLACE FUNCTION public.set_bci_verification_status(
  p_user_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  IF p_status NOT IN ('verified', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'invalid status %', p_status;
  END IF;

  UPDATE public.profiles
  SET bci_verification_status = p_status,
      bci_verified_at         = CASE WHEN p_status = 'verified' THEN NOW() ELSE NULL END,
      bci_verified_by         = CASE WHEN p_status = 'verified' THEN auth.uid() ELSE NULL END,
      bci_rejection_reason    = CASE WHEN p_status = 'rejected' THEN p_reason ELSE NULL END
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.set_bci_verification_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_bci_verification_status(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
