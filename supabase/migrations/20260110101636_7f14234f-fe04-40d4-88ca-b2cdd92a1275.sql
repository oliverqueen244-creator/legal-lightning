-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 1: Attempt counting - increment ONLY on failure, NOT on success
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
    -- SUCCESS: Update timestamps and document count
    -- ❌ Do NOT increment document_sync_attempts on success
    UPDATE public.tracked_cases
    SET 
      document_sync_status = 'synced',
      last_document_sync_at = now(),
      next_document_sync_after = next_sync,
      total_documents_synced = total_documents_synced + p_documents_added
    WHERE id = p_case_id;
  ELSE
    -- FAILURE: Only increment attempts, do NOT update timestamps
    -- ✅ Only count failed syncs toward the limit
    UPDATE public.tracked_cases
    SET 
      document_sync_status = 'sync_failed',
      document_sync_attempts = document_sync_attempts + 1
    WHERE id = p_case_id;
  END IF;
END;
$$;