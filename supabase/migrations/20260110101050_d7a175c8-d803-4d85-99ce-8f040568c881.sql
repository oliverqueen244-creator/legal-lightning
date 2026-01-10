-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: ATOMIC LOCKING - Use conditional UPDATE instead of SELECT + UPDATE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.acquire_document_sync_lock(p_case_id UUID, p_lawyer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  case_record RECORD;
  ownership_check RECORD;
BEGIN
  -- STEP 1: Verify ownership and guards BEFORE attempting lock
  SELECT 
    id, profile_id, document_sync_status, 
    last_document_sync_at, document_sync_attempts,
    case_type, case_number, case_year, bench
  INTO ownership_check
  FROM public.tracked_cases
  WHERE id = p_case_id;
  
  IF ownership_check IS NULL THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'case_not_found');
  END IF;
  
  IF ownership_check.profile_id != p_lawyer_id THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'not_owner');
  END IF;
  
  -- Check cooldown (7 days)
  IF ownership_check.last_document_sync_at IS NOT NULL 
     AND ownership_check.last_document_sync_at > (now() - interval '7 days') THEN
    RETURN jsonb_build_object(
      'acquired', false, 
      'reason', 'cooldown_active',
      'next_sync_after', ownership_check.last_document_sync_at + interval '7 days'
    );
  END IF;
  
  -- Check max attempts (10)
  IF ownership_check.document_sync_attempts >= 10 THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'max_attempts_exceeded');
  END IF;

  -- STEP 2: ATOMIC LOCK via conditional UPDATE (the critical fix)
  -- This prevents race conditions by acquiring lock ONLY if not already syncing
  UPDATE public.tracked_cases
  SET document_sync_status = 'syncing'
  WHERE id = p_case_id
    AND document_sync_status != 'syncing'
  RETURNING * INTO case_record;
  
  -- If no row was updated, lock is held by another process
  IF NOT FOUND THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'sync_in_progress');
  END IF;
  
  -- Lock acquired successfully
  RETURN jsonb_build_object('acquired', true, 'case_data', to_jsonb(case_record));
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Release lock - ensure attempts increment on failure, timestamps only on success
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.release_document_sync_lock(
  p_case_id UUID,
  p_success BOOLEAN,
  p_documents_added INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_sync TIMESTAMPTZ;
BEGIN
  next_sync := now() + interval '7 days';
  
  IF p_success THEN
    -- SUCCESS: Update timestamps, document count, and status
    UPDATE public.tracked_cases
    SET 
      document_sync_status = 'synced',
      last_document_sync_at = now(),
      next_document_sync_after = next_sync,
      total_documents_synced = total_documents_synced + p_documents_added,
      document_sync_attempts = document_sync_attempts + 1
    WHERE id = p_case_id;
  ELSE
    -- FAILURE: Only increment attempts, do NOT update timestamps
    -- This ensures cooldown is not poisoned by failed attempts
    UPDATE public.tracked_cases
    SET 
      document_sync_status = 'sync_failed',
      document_sync_attempts = document_sync_attempts + 1
    WHERE id = p_case_id;
  END IF;
END;
$$;