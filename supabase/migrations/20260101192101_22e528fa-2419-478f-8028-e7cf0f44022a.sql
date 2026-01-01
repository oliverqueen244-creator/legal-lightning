-- ========================================
-- JUDGE INTELLIGENCE: LAWYER-SCOPED MEMORY MODEL
-- Append-only observation tables for judge behavior
-- ========================================

-- 1. Personal Memory: Lawyer's own observations about judges
CREATE TABLE public.judge_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  judge_name TEXT NOT NULL,
  bench TEXT NOT NULL, -- JAIPUR or JODHPUR
  court_no TEXT,
  
  -- Observation content (raw text only, no scoring)
  observation_text TEXT NOT NULL,
  observation_type TEXT NOT NULL DEFAULT 'general', -- general, procedural, timing, preference
  
  -- Source context (for traceability)
  source_docket_id UUID REFERENCES daily_court_docket(id) ON DELETE SET NULL,
  source_case_number TEXT,
  hearing_date DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent updates (append-only)
  CONSTRAINT observation_immutable CHECK (true)
);

-- 2. Chamber Sharing Consent: Opt-in for sharing observations
CREATE TABLE public.judge_observation_sharing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chamber_id TEXT NOT NULL, -- Chamber identifier (e.g., senior's profile id or explicit chamber code)
  
  -- Consent flags
  share_own_observations BOOLEAN NOT NULL DEFAULT false,
  view_chamber_observations BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  
  UNIQUE(lawyer_id, chamber_id)
);

-- 3. Public Procedural Patterns: Aggregate bench-level data only
-- This stores ONLY procedural cadence, never judge characterization
CREATE TABLE public.bench_procedural_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bench TEXT NOT NULL, -- JAIPUR or JODHPUR
  court_no TEXT NOT NULL,
  pattern_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Aggregate timing data only (no judge characterization)
  avg_start_time TIME,
  avg_lunch_duration_minutes INTEGER,
  typical_items_per_hour NUMERIC(4,1),
  
  -- Source metadata
  observations_count INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(bench, court_no, pattern_date)
);

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

ALTER TABLE public.judge_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_observation_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bench_procedural_patterns ENABLE ROW LEVEL SECURITY;

-- Personal observations: Only owner can view/insert
CREATE POLICY "Lawyers can view own observations"
  ON public.judge_observations FOR SELECT
  USING (auth.uid() = lawyer_id);

CREATE POLICY "Lawyers can insert own observations"
  ON public.judge_observations FOR INSERT
  WITH CHECK (auth.uid() = lawyer_id);

-- NO UPDATE/DELETE policies - append only!

-- Sharing consent: Only owner can manage
CREATE POLICY "Lawyers can view own sharing settings"
  ON public.judge_observation_sharing FOR SELECT
  USING (auth.uid() = lawyer_id);

CREATE POLICY "Lawyers can insert own sharing settings"
  ON public.judge_observation_sharing FOR INSERT
  WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Lawyers can update own sharing settings"
  ON public.judge_observation_sharing FOR UPDATE
  USING (auth.uid() = lawyer_id);

-- Chamber observations: View if consent exists
CREATE POLICY "Lawyers can view chamber observations"
  ON public.judge_observations FOR SELECT
  USING (
    -- Own observations
    auth.uid() = lawyer_id
    OR
    -- Chamber observations where both parties have consented
    EXISTS (
      SELECT 1 FROM judge_observation_sharing my_consent
      WHERE my_consent.lawyer_id = auth.uid()
      AND my_consent.view_chamber_observations = true
      AND my_consent.revoked_at IS NULL
      AND EXISTS (
        SELECT 1 FROM judge_observation_sharing their_consent
        WHERE their_consent.lawyer_id = judge_observations.lawyer_id
        AND their_consent.chamber_id = my_consent.chamber_id
        AND their_consent.share_own_observations = true
        AND their_consent.revoked_at IS NULL
      )
    )
  );

-- Public patterns: Anyone can view (aggregate only)
CREATE POLICY "Anyone can view procedural patterns"
  ON public.bench_procedural_patterns FOR SELECT
  USING (true);

-- Only service role can insert patterns (aggregated by system)
CREATE POLICY "Service role can manage patterns"
  ON public.bench_procedural_patterns FOR ALL
  USING (true)
  WITH CHECK (true);

-- ========================================
-- INDEXES
-- ========================================

CREATE INDEX idx_judge_observations_lawyer ON public.judge_observations(lawyer_id);
CREATE INDEX idx_judge_observations_judge ON public.judge_observations(judge_name);
CREATE INDEX idx_judge_observations_bench ON public.judge_observations(bench);
CREATE INDEX idx_judge_observations_created ON public.judge_observations(created_at DESC);
CREATE INDEX idx_judge_sharing_chamber ON public.judge_observation_sharing(chamber_id);
CREATE INDEX idx_procedural_patterns_bench ON public.bench_procedural_patterns(bench, court_no);