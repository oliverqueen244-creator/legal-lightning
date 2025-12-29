-- Create ai_jobs table for decoupled AI processing
CREATE TABLE public.ai_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'court_parse', 'lawyer_parse', etc.
  provider TEXT, -- 'google', 'openai', 'openrouter'
  payload JSONB NOT NULL, -- { causelist_id, court_no, court_text, alias, profile_id }
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, retry
  result JSONB, -- parsed cases or error info
  retries INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  priority INTEGER NOT NULL DEFAULT 0, -- higher = more urgent
  tokens_used INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Service role can manage ai_jobs"
ON public.ai_jobs FOR ALL
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view ai_jobs"
ON public.ai_jobs FOR SELECT
USING (auth.role() = 'authenticated');

-- Indexes for efficient querying
CREATE INDEX idx_ai_jobs_status ON public.ai_jobs(status);
CREATE INDEX idx_ai_jobs_priority_created ON public.ai_jobs(priority DESC, created_at ASC);
CREATE INDEX idx_ai_jobs_next_retry ON public.ai_jobs(next_retry_at) WHERE status = 'retry';

-- Enable realtime for monitoring
ALTER TABLE public.ai_jobs REPLICA IDENTITY FULL;

COMMENT ON TABLE public.ai_jobs IS 'Decoupled AI job queue - edge functions insert jobs, worker processes them';