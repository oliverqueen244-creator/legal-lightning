-- Create AI response cache table to store parsed results
CREATE TABLE public.ai_parse_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text_hash text NOT NULL,
  prompt_hash text NOT NULL,
  response_json jsonb NOT NULL,
  provider text NOT NULL,
  tokens_used integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  hit_count integer DEFAULT 0
);

-- Create unique index on text_hash + prompt_hash for fast lookups
CREATE UNIQUE INDEX ai_parse_cache_lookup_idx ON public.ai_parse_cache (text_hash, prompt_hash);

-- Create index for cleanup of expired entries
CREATE INDEX ai_parse_cache_expires_idx ON public.ai_parse_cache (expires_at);

-- Enable RLS
ALTER TABLE public.ai_parse_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role can manage cache"
  ON public.ai_parse_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add request tracking to case_parse_queue
ALTER TABLE public.case_parse_queue 
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS provider_used text;