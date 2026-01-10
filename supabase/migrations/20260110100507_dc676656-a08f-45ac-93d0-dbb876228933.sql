-- ═══════════════════════════════════════════════════════════════════════════
-- CASE DOCUMENT SYNC SYSTEM
-- New table for synced court documents (separate from existing case_documents)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create doc_sync_type enum for document classification
DO $$ BEGIN
  CREATE TYPE doc_sync_type AS ENUM ('judgment', 'interim_order', 'order', 'unknown');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create document_sync_status enum  
DO $$ BEGIN
  CREATE TYPE document_sync_status AS ENUM (
    'not_synced',
    'sync_queued', 
    'syncing',
    'synced',
    'sync_failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add document sync fields to tracked_cases
ALTER TABLE public.tracked_cases 
  ADD COLUMN IF NOT EXISTS document_sync_status document_sync_status DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS last_document_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_sync_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_document_sync_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_documents_synced INTEGER DEFAULT 0;

-- 4. Create synced_court_documents table (separate from case_documents which is for docket)
CREATE TABLE IF NOT EXISTS public.synced_court_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_case_id UUID NOT NULL REFERENCES public.tracked_cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Raw label from court (e.g. "Interim Order", "Judgment", "Order")
  court_label TEXT NOT NULL,
  
  -- Classified document type
  doc_type doc_sync_type NOT NULL DEFAULT 'unknown',
  
  -- Date from court table (nullable - court may not always provide)
  order_date DATE NULL,
  
  -- Source and storage
  source_pdf_url TEXT NOT NULL,
  stored_pdf_path TEXT,
  pdf_hash TEXT, -- SHA-256 hash for deduplication
  pdf_size_bytes INTEGER,
  
  -- Timestamps
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Deduplication constraint: unique per case + pdf_hash
  CONSTRAINT unique_synced_doc_per_case_hash UNIQUE (tracked_case_id, pdf_hash)
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_synced_docs_tracked_case_id 
  ON public.synced_court_documents(tracked_case_id);
  
CREATE INDEX IF NOT EXISTS idx_synced_docs_lawyer_id 
  ON public.synced_court_documents(lawyer_id);
  
CREATE INDEX IF NOT EXISTS idx_synced_docs_pdf_hash 
  ON public.synced_court_documents(pdf_hash);

CREATE INDEX IF NOT EXISTS idx_synced_docs_doc_type 
  ON public.synced_court_documents(doc_type);

-- 6. Enable RLS on synced_court_documents
ALTER TABLE public.synced_court_documents ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies - lawyers can only access their own documents
CREATE POLICY "Lawyers view own synced docs" 
  ON public.synced_court_documents FOR SELECT 
  USING (auth.uid() = lawyer_id);

CREATE POLICY "System insert synced docs" 
  ON public.synced_court_documents FOR INSERT 
  WITH CHECK (true); -- Edge function uses service role

CREATE POLICY "Lawyers delete own synced docs" 
  ON public.synced_court_documents FOR DELETE 
  USING (auth.uid() = lawyer_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- ATOMIC COUNTER FUNCTIONS (MANDATORY - no JS increments)
-- ═══════════════════════════════════════════════════════════════════════════

-- 8. Atomic increment for document sync attempts
CREATE OR REPLACE FUNCTION public.increment_document_sync_attempt(p_case_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.tracked_cases 
  SET document_sync_attempts = document_sync_attempts + 1
  WHERE id = p_case_id
  RETURNING document_sync_attempts INTO new_count;
  
  RETURN COALESCE(new_count, 0);
END;
$$;

-- 9. Atomic increment for document count
CREATE OR REPLACE FUNCTION public.increment_document_count(p_case_id UUID, p_increment INTEGER DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.tracked_cases 
  SET total_documents_synced = total_documents_synced + p_increment
  WHERE id = p_case_id
  RETURNING total_documents_synced INTO new_count;
  
  RETURN COALESCE(new_count, 0);
END;
$$;

-- 10. Acquire sync lock atomically (prevents concurrent syncs)
CREATE OR REPLACE FUNCTION public.acquire_document_sync_lock(p_case_id UUID, p_lawyer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  case_record RECORD;
BEGIN
  -- Select FOR UPDATE to lock the row
  SELECT * INTO case_record
  FROM public.tracked_cases
  WHERE id = p_case_id
  FOR UPDATE NOWAIT; -- Fail immediately if locked
  
  IF case_record IS NULL THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'case_not_found');
  END IF;
  
  -- Verify ownership
  IF case_record.profile_id != p_lawyer_id THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'not_owner');
  END IF;
  
  -- Check if already syncing
  IF case_record.document_sync_status = 'syncing' THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'sync_in_progress');
  END IF;
  
  -- Check cooldown (7 days)
  IF case_record.last_document_sync_at IS NOT NULL 
     AND case_record.last_document_sync_at > (now() - interval '7 days') THEN
    RETURN jsonb_build_object(
      'acquired', false, 
      'reason', 'cooldown_active',
      'next_sync_after', case_record.last_document_sync_at + interval '7 days'
    );
  END IF;
  
  -- Check max attempts (10)
  IF case_record.document_sync_attempts >= 10 THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'max_attempts_exceeded');
  END IF;
  
  -- Acquire lock by setting status to 'syncing'
  UPDATE public.tracked_cases
  SET document_sync_status = 'syncing'
  WHERE id = p_case_id;
  
  RETURN jsonb_build_object('acquired', true, 'case_data', to_jsonb(case_record));
  
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'lock_held_by_another');
END;
$$;

-- 11. Release sync lock and update stats
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
    UPDATE public.tracked_cases
    SET 
      document_sync_status = 'synced',
      last_document_sync_at = now(),
      next_document_sync_after = next_sync,
      total_documents_synced = total_documents_synced + p_documents_added
    WHERE id = p_case_id;
  ELSE
    -- On failure, don't update last_document_sync_at (per requirements)
    UPDATE public.tracked_cases
    SET 
      document_sync_status = 'sync_failed',
      document_sync_attempts = document_sync_attempts + 1
    WHERE id = p_case_id;
  END IF;
END;
$$;

-- 12. Check if sync is allowed (for client-side pre-check)
CREATE OR REPLACE FUNCTION public.can_sync_documents(p_case_id UUID, p_lawyer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  case_record RECORD;
BEGIN
  SELECT * INTO case_record
  FROM public.tracked_cases
  WHERE id = p_case_id;
  
  IF case_record IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'case_not_found');
  END IF;
  
  IF case_record.profile_id != p_lawyer_id THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_owner');
  END IF;
  
  IF case_record.document_sync_status = 'syncing' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'sync_in_progress');
  END IF;
  
  IF case_record.last_document_sync_at IS NOT NULL 
     AND case_record.last_document_sync_at > (now() - interval '7 days') THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'cooldown_active',
      'next_sync_after', case_record.last_document_sync_at + interval '7 days'
    );
  END IF;
  
  IF case_record.document_sync_attempts >= 10 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'max_attempts_exceeded');
  END IF;
  
  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- 13. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_document_sync_attempt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_document_count(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_document_sync_lock(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_document_sync_lock(UUID, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_sync_documents(UUID, UUID) TO authenticated;