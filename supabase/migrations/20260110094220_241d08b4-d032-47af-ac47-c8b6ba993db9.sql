-- Drop the partial enum/tables if they were partially created
DROP TABLE IF EXISTS public.judgment_check_jobs;
DROP TABLE IF EXISTS public.captcha_usage_log;
DROP TABLE IF EXISTS public.case_judgments;
DROP TYPE IF EXISTS public.judgment_status;

-- Judgment status enum
CREATE TYPE public.judgment_status AS ENUM (
  'not_checked',
  'check_queued', 
  'checking',
  'not_found',
  'found'
);

-- Add judgment tracking fields to tracked_cases
ALTER TABLE public.tracked_cases
ADD COLUMN IF NOT EXISTS judgment_status public.judgment_status DEFAULT 'not_checked',
ADD COLUMN IF NOT EXISTS last_judgment_check_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS judgment_check_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS judgment_found_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_judgment_check_after TIMESTAMPTZ;

-- Case judgments table (FINAL judgments only, lawyer-scoped)
CREATE TABLE public.case_judgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_case_id UUID NOT NULL REFERENCES public.tracked_cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.profiles(id),
  judgment_date DATE NOT NULL,
  source_pdf_url TEXT,
  stored_pdf_path TEXT,
  pdf_hash TEXT,
  pdf_size_bytes INTEGER,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_judgment_per_case UNIQUE (tracked_case_id)
);

-- CAPTCHA usage log for cost attribution
CREATE TABLE public.captcha_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES public.profiles(id),
  tracked_case_id UUID REFERENCES public.tracked_cases(id),
  provider TEXT NOT NULL DEFAULT '2captcha',
  cost_credits NUMERIC(10,4) DEFAULT 0,
  solved_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN NOT NULL,
  solve_time_ms INTEGER,
  error_reason TEXT,
  captcha_type TEXT DEFAULT 'image',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Judgment check job queue (scoped to lawyer-owned cases only)
CREATE TABLE public.judgment_check_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_case_id UUID NOT NULL REFERENCES public.tracked_cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  error_reason TEXT,
  captcha_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Partial unique index for active jobs (only one pending/processing per case)
CREATE UNIQUE INDEX idx_unique_active_job_per_case 
ON public.judgment_check_jobs(tracked_case_id) 
WHERE status IN ('pending', 'processing');

-- Other indexes
CREATE INDEX idx_case_judgments_lawyer ON public.case_judgments(lawyer_id);
CREATE INDEX idx_case_judgments_tracked_case ON public.case_judgments(tracked_case_id);
CREATE INDEX idx_captcha_usage_lawyer ON public.captcha_usage_log(lawyer_id);
CREATE INDEX idx_captcha_usage_date ON public.captcha_usage_log(solved_at);
CREATE INDEX idx_judgment_jobs_status ON public.judgment_check_jobs(status, next_attempt_at);
CREATE INDEX idx_judgment_jobs_lawyer ON public.judgment_check_jobs(lawyer_id);
CREATE INDEX idx_tracked_cases_judgment_status ON public.tracked_cases(judgment_status);

-- RLS Policies
ALTER TABLE public.case_judgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captcha_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judgment_check_jobs ENABLE ROW LEVEL SECURITY;

-- Case judgments: Lawyer can only see their own
CREATE POLICY "Lawyers see own judgments"
ON public.case_judgments FOR SELECT
USING (lawyer_id = auth.uid());

CREATE POLICY "System can insert judgments"
ON public.case_judgments FOR INSERT
WITH CHECK (lawyer_id = auth.uid());

-- CAPTCHA usage: Lawyer can only see their own usage
CREATE POLICY "Lawyers see own captcha usage"
ON public.captcha_usage_log FOR SELECT
USING (lawyer_id = auth.uid());

-- Judgment jobs: Lawyer can see/create their own
CREATE POLICY "Lawyers see own judgment jobs"
ON public.judgment_check_jobs FOR SELECT
USING (lawyer_id = auth.uid());

CREATE POLICY "Lawyers create own judgment jobs"
ON public.judgment_check_jobs FOR INSERT
WITH CHECK (lawyer_id = auth.uid());

-- Function to validate case ownership before job creation
CREATE OR REPLACE FUNCTION public.validate_case_ownership(
  p_case_id UUID,
  p_lawyer_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tracked_cases
    WHERE id = p_case_id
    AND profile_id = p_lawyer_id
  );
END;
$$;

-- Function to check if judgment check is allowed (guards)
CREATE OR REPLACE FUNCTION public.can_check_judgment(
  p_case_id UUID,
  p_lawyer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case RECORD;
  v_cooldown_days INTEGER := 7;
  v_max_attempts INTEGER := 10;
BEGIN
  SELECT * INTO v_case
  FROM public.tracked_cases
  WHERE id = p_case_id;
  
  IF v_case IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'case_not_found');
  END IF;
  
  IF v_case.profile_id != p_lawyer_id THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_owner');
  END IF;
  
  IF v_case.judgment_status = 'found' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'judgment_already_found');
  END IF;
  
  IF v_case.judgment_status = 'checking' OR v_case.judgment_status = 'check_queued' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'check_in_progress');
  END IF;
  
  IF v_case.last_judgment_check_at IS NOT NULL 
     AND v_case.last_judgment_check_at > (now() - (v_cooldown_days || ' days')::interval) THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'cooldown_active',
      'next_check_after', v_case.last_judgment_check_at + (v_cooldown_days || ' days')::interval
    );
  END IF;
  
  IF v_case.judgment_check_attempts >= v_max_attempts THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'max_attempts_exceeded');
  END IF;
  
  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Function to queue a judgment check (with all guards)
CREATE OR REPLACE FUNCTION public.queue_judgment_check(
  p_case_id UUID,
  p_lawyer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_check JSONB;
  v_job_id UUID;
BEGIN
  v_can_check := public.can_check_judgment(p_case_id, p_lawyer_id);
  
  IF NOT (v_can_check->>'allowed')::boolean THEN
    RETURN v_can_check;
  END IF;
  
  UPDATE public.tracked_cases
  SET judgment_status = 'check_queued'
  WHERE id = p_case_id;
  
  INSERT INTO public.judgment_check_jobs (tracked_case_id, lawyer_id, status, priority)
  VALUES (p_case_id, p_lawyer_id, 'pending', 1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_job_id;
  
  IF v_job_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'job_already_queued');
  END IF;
  
  RETURN jsonb_build_object('allowed', true, 'job_id', v_job_id);
END;
$$;