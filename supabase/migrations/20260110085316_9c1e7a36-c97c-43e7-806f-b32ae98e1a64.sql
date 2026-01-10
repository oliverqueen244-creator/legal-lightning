-- Court Orders Backend System (Fixed)
-- Rajasthan High Court - Jaipur & Jodhpur Benches Only

-- 1. ENUM: Bench locations (if not exists)
DO $$ BEGIN
  CREATE TYPE public.rhc_bench AS ENUM ('JAIPUR', 'JODHPUR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. ENUM: Job statuses (if not exists)
DO $$ BEGIN
  CREATE TYPE public.order_job_status AS ENUM (
    'pending', 
    'running', 
    'completed', 
    'failed', 
    'captcha_blocked',
    'manual_required'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. ENUM: Order fetch triggers (if not exists)
DO $$ BEGIN
  CREATE TYPE public.order_fetch_trigger AS ENUM (
    'manual',
    'backfill',
    'post_listing',
    'scheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Main table: Tracked cases (if not exists)
CREATE TABLE IF NOT EXISTS public.tracked_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_type TEXT NOT NULL,
  case_number INTEGER NOT NULL,
  case_year INTEGER NOT NULL,
  bench rhc_bench NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  petitioner TEXT,
  respondent TEXT,
  petitioner_advocate TEXT,
  respondent_advocate TEXT,
  case_status TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_orders_check_at TIMESTAMPTZ,
  orders_count INTEGER NOT NULL DEFAULT 0,
  listed_today BOOLEAN NOT NULL DEFAULT false,
  last_listed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_tracked_case UNIQUE (profile_id, case_type, case_number, case_year, bench)
);

-- 5. Court orders table (fixed unique constraint)
CREATE TABLE IF NOT EXISTS public.court_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_case_id UUID NOT NULL REFERENCES public.tracked_cases(id) ON DELETE CASCADE,
  order_date DATE NOT NULL,
  order_type TEXT,
  bench rhc_bench NOT NULL,
  source_pdf_url TEXT,
  stored_pdf_path TEXT,
  pdf_hash TEXT,
  pdf_size_bytes INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fetch_trigger order_fetch_trigger NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique index instead of constraint (allows COALESCE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_order_per_case_date_hash 
ON public.court_orders (tracked_case_id, order_date, COALESCE(pdf_hash, 'no_hash'));

-- 6. Job state tracking
CREATE TABLE IF NOT EXISTS public.order_fetch_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL,
  tracked_case_id UUID REFERENCES public.tracked_cases(id) ON DELETE CASCADE,
  court_order_id UUID REFERENCES public.court_orders(id) ON DELETE CASCADE,
  bench rhc_bench,
  status order_job_status NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  error_reason TEXT,
  captcha_required BOOLEAN NOT NULL DEFAULT false,
  orders_found INTEGER,
  pdfs_downloaded INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 7. CAPTCHA queue for manual intervention
CREATE TABLE IF NOT EXISTS public.captcha_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.order_fetch_jobs(id) ON DELETE CASCADE,
  captcha_image_url TEXT,
  captcha_image_base64 TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  solution TEXT,
  solved_by UUID REFERENCES public.profiles(id),
  solved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_tracked_cases_profile ON public.tracked_cases(profile_id);
CREATE INDEX IF NOT EXISTS idx_tracked_cases_bench ON public.tracked_cases(bench);
CREATE INDEX IF NOT EXISTS idx_tracked_cases_listed ON public.tracked_cases(listed_today) WHERE listed_today = true;
CREATE INDEX IF NOT EXISTS idx_court_orders_case ON public.court_orders(tracked_case_id);
CREATE INDEX IF NOT EXISTS idx_court_orders_date ON public.court_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_fetch_jobs_status ON public.order_fetch_jobs(status) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_order_fetch_jobs_next ON public.order_fetch_jobs(next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_captcha_queue_pending ON public.captcha_queue(status) WHERE status = 'pending';

-- 9. Enable RLS
ALTER TABLE public.tracked_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_fetch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captcha_queue ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies: tracked_cases
DROP POLICY IF EXISTS "Users can view their own tracked cases" ON public.tracked_cases;
CREATE POLICY "Users can view their own tracked cases"
ON public.tracked_cases FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own tracked cases" ON public.tracked_cases;
CREATE POLICY "Users can insert their own tracked cases"
ON public.tracked_cases FOR INSERT
TO authenticated
WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own tracked cases" ON public.tracked_cases;
CREATE POLICY "Users can update their own tracked cases"
ON public.tracked_cases FOR UPDATE
TO authenticated
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own tracked cases" ON public.tracked_cases;
CREATE POLICY "Users can delete their own tracked cases"
ON public.tracked_cases FOR DELETE
TO authenticated
USING (profile_id = auth.uid());

-- 11. RLS Policies: court_orders
DROP POLICY IF EXISTS "Users can view orders for their tracked cases" ON public.court_orders;
CREATE POLICY "Users can view orders for their tracked cases"
ON public.court_orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tracked_cases tc
    WHERE tc.id = tracked_case_id
    AND tc.profile_id = auth.uid()
  )
);

-- 12. RLS Policies: order_fetch_jobs
DROP POLICY IF EXISTS "Users can view jobs for their tracked cases" ON public.order_fetch_jobs;
CREATE POLICY "Users can view jobs for their tracked cases"
ON public.order_fetch_jobs FOR SELECT
TO authenticated
USING (
  tracked_case_id IS NULL OR
  EXISTS (
    SELECT 1 FROM public.tracked_cases tc
    WHERE tc.id = tracked_case_id
    AND tc.profile_id = auth.uid()
  )
);

-- 13. RLS Policies: captcha_queue (admin only)
DROP POLICY IF EXISTS "Admins can view captcha queue" ON public.captcha_queue;
CREATE POLICY "Admins can view captcha queue"
ON public.captcha_queue FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

DROP POLICY IF EXISTS "Admins can update captcha queue" ON public.captcha_queue;
CREATE POLICY "Admins can update captcha queue"
ON public.captcha_queue FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

-- 14. Trigger for updated_at
DROP TRIGGER IF EXISTS update_tracked_cases_updated_at ON public.tracked_cases;
CREATE TRIGGER update_tracked_cases_updated_at
BEFORE UPDATE ON public.tracked_cases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 15. Function: Lock case for job processing
CREATE OR REPLACE FUNCTION public.try_lock_case_for_job(
  p_case_id UUID,
  p_job_type TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.order_fetch_jobs
    WHERE tracked_case_id = p_case_id
    AND status = 'running'
  ) THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO public.order_fetch_jobs (job_type, tracked_case_id, status, started_at)
  VALUES (p_job_type, p_case_id, 'running', now())
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$;

-- 16. Function: Get next pending job
CREATE OR REPLACE FUNCTION public.get_next_pending_job(p_bench rhc_bench DEFAULT NULL)
RETURNS TABLE (
  job_id UUID,
  job_type TEXT,
  case_id UUID,
  bench rhc_bench
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.job_type,
    j.tracked_case_id,
    j.bench
  FROM public.order_fetch_jobs j
  WHERE j.status = 'pending'
  AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= now())
  AND (p_bench IS NULL OR j.bench = p_bench)
  ORDER BY j.priority ASC, j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$;