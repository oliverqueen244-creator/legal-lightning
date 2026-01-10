-- CP-6: Judgment Recording Protocol (Status-Validated)
-- This protocol ensures judgments can only be saved when case status is legally valid

-- 1. Create enum for valid judgment-eligible case statuses
DO $$ BEGIN
  CREATE TYPE public.case_proceeding_status AS ENUM (
    'listed',
    'hearing',
    'running',
    'adjourned',
    'not_reached',
    'reserved_for_judgment',
    'judgment_pronounced',
    'disposed_without_judgment',
    'dismissed',
    'withdrawn'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add case_proceeding_status column to tracked_cases if not exists
ALTER TABLE public.tracked_cases 
ADD COLUMN IF NOT EXISTS proceeding_status public.case_proceeding_status DEFAULT 'listed';

-- 3. Create judgment audit log table
CREATE TABLE IF NOT EXISTS public.judgment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_judgment_id UUID NOT NULL REFERENCES public.case_judgments(id) ON DELETE CASCADE,
  tracked_case_id UUID NOT NULL,
  saved_by_user_id UUID NOT NULL,
  case_status_at_save public.case_proceeding_status NOT NULL,
  save_method TEXT NOT NULL DEFAULT 'judgment_recording_protocol',
  action TEXT NOT NULL DEFAULT 'insert',
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on audit log
ALTER TABLE public.judgment_audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log is read-only for users (can view own audit entries)
CREATE POLICY "Users can view their own judgment audit logs"
  ON public.judgment_audit_log
  FOR SELECT
  USING (saved_by_user_id = auth.uid());

-- Admin can view all audit logs
CREATE POLICY "Admins can view all judgment audit logs"
  ON public.judgment_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- 4. Create helper function to check if case status allows judgment recording
CREATE OR REPLACE FUNCTION public.is_judgment_eligible_status(p_status public.case_proceeding_status)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status IN ('reserved_for_judgment', 'judgment_pronounced');
$$;

-- 5. Create validation trigger function for case_judgments
CREATE OR REPLACE FUNCTION public.validate_judgment_recording()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_status public.case_proceeding_status;
  v_user_id UUID;
BEGIN
  -- Get the current case status
  SELECT proceeding_status INTO v_case_status
  FROM public.tracked_cases
  WHERE id = NEW.tracked_case_id;

  -- If case not found, block
  IF v_case_status IS NULL THEN
    RAISE EXCEPTION 'Judgment cannot be recorded: tracked case not found.';
  END IF;

  -- Validate status allows judgment recording
  IF NOT public.is_judgment_eligible_status(v_case_status) THEN
    RAISE EXCEPTION 'Judgment cannot be recorded before the case reaches a valid judgment stage.';
  END IF;

  -- Get the user making the change
  v_user_id := COALESCE(auth.uid(), NEW.lawyer_id);

  -- Record audit entry
  INSERT INTO public.judgment_audit_log (
    case_judgment_id,
    tracked_case_id,
    saved_by_user_id,
    case_status_at_save,
    save_method,
    action,
    saved_at,
    metadata
  ) VALUES (
    NEW.id,
    NEW.tracked_case_id,
    v_user_id,
    v_case_status,
    'judgment_recording_protocol',
    TG_OP,
    now(),
    jsonb_build_object(
      'judgment_date', NEW.judgment_date,
      'source_url', NEW.source_pdf_url,
      'trigger_type', 'jrp_validation'
    )
  );

  RETURN NEW;
END;
$$;

-- 6. Create the trigger on case_judgments
DROP TRIGGER IF EXISTS trg_validate_judgment_recording ON public.case_judgments;
CREATE TRIGGER trg_validate_judgment_recording
  BEFORE INSERT OR UPDATE ON public.case_judgments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_judgment_recording();

-- 7. Create function to get case judgment eligibility (for frontend)
CREATE OR REPLACE FUNCTION public.get_judgment_eligibility(p_case_id UUID)
RETURNS TABLE(
  is_eligible BOOLEAN,
  current_status TEXT,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.case_proceeding_status;
BEGIN
  SELECT proceeding_status INTO v_status
  FROM public.tracked_cases
  WHERE id = p_case_id;

  IF v_status IS NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'unknown'::TEXT,
      'Case not found'::TEXT;
    RETURN;
  END IF;

  IF public.is_judgment_eligible_status(v_status) THEN
    RETURN QUERY SELECT 
      true::BOOLEAN,
      v_status::TEXT,
      'Case has reached valid judgment stage'::TEXT;
  ELSE
    RETURN QUERY SELECT 
      false::BOOLEAN,
      v_status::TEXT,
      'Judgments can be recorded only after the case reaches the appropriate stage.'::TEXT;
  END IF;

  RETURN;
END;
$$;

-- 8. Create function to update case proceeding status (with validation)
CREATE OR REPLACE FUNCTION public.update_case_proceeding_status(
  p_case_id UUID,
  p_new_status public.case_proceeding_status
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.tracked_cases
    WHERE id = p_case_id AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Case not found or access denied';
  END IF;

  UPDATE public.tracked_cases
  SET proceeding_status = p_new_status,
      updated_at = now()
  WHERE id = p_case_id;

  RETURN true;
END;
$$;

-- 9. Add index for audit queries
CREATE INDEX IF NOT EXISTS idx_judgment_audit_log_case 
  ON public.judgment_audit_log(tracked_case_id);
CREATE INDEX IF NOT EXISTS idx_judgment_audit_log_user 
  ON public.judgment_audit_log(saved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_judgment_audit_log_saved_at 
  ON public.judgment_audit_log(saved_at DESC);

-- 10. Add index for proceeding status queries
CREATE INDEX IF NOT EXISTS idx_tracked_cases_proceeding_status 
  ON public.tracked_cases(proceeding_status);

-- 11. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_judgment_eligible_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_judgment_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_case_proceeding_status TO authenticated;