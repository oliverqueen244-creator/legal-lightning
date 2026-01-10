-- Fix: Change trigger to AFTER INSERT to allow FK reference
DROP TRIGGER IF EXISTS trg_validate_judgment_recording ON public.case_judgments;

-- Split into two functions: validation (BEFORE) and audit (AFTER)
CREATE OR REPLACE FUNCTION public.validate_judgment_recording()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_status public.case_proceeding_status;
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

  RETURN NEW;
END;
$$;

-- Audit function (runs AFTER insert/update)
CREATE OR REPLACE FUNCTION public.audit_judgment_recording()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_status public.case_proceeding_status;
  v_user_id UUID;
BEGIN
  -- Get the case status (already validated)
  SELECT proceeding_status INTO v_case_status
  FROM public.tracked_cases
  WHERE id = NEW.tracked_case_id;

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
      'trigger_type', 'jrp_audit'
    )
  );

  RETURN NEW;
END;
$$;

-- Create BEFORE trigger for validation
CREATE TRIGGER trg_validate_judgment_recording
  BEFORE INSERT OR UPDATE ON public.case_judgments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_judgment_recording();

-- Create AFTER trigger for audit
CREATE TRIGGER trg_audit_judgment_recording
  AFTER INSERT OR UPDATE ON public.case_judgments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_judgment_recording();