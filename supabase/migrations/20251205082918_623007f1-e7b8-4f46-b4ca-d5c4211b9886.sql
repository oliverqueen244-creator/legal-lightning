-- Phase 1: Database Schema Updates for Vakalat-OS v4.5

-- 1.1 Create court_metadata table
CREATE TABLE IF NOT EXISTS public.court_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bench TEXT NOT NULL CHECK (bench IN ('JAIPUR', 'JODHPUR')),
  court_no TEXT NOT NULL,
  judge_names TEXT,
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bench, court_no)
);

ALTER TABLE public.court_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view court metadata" ON public.court_metadata FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert court metadata" ON public.court_metadata FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update court metadata" ON public.court_metadata FOR UPDATE USING (auth.role() = 'authenticated');

-- 1.2 Create scraper_logs table
CREATE TABLE IF NOT EXISTS public.scraper_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bench TEXT NOT NULL,
  run_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'warning')),
  cases_found INTEGER DEFAULT 0,
  error_message TEXT,
  list_type TEXT DEFAULT 'DAILY',
  court_no TEXT
);

ALTER TABLE public.scraper_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scraper logs" ON public.scraper_logs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert scraper logs" ON public.scraper_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 1.3 Add status column to daily_court_docket (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'daily_court_docket' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.daily_court_docket ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- 1.4 Add petitioner and respondent columns for party names
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'daily_court_docket' 
    AND column_name = 'petitioner'
  ) THEN
    ALTER TABLE public.daily_court_docket ADD COLUMN petitioner TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'daily_court_docket' 
    AND column_name = 'respondent'
  ) THEN
    ALTER TABLE public.daily_court_docket ADD COLUMN respondent TEXT;
  END IF;
END $$;

-- 1.5 Add force_active column for manual override
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'daily_court_docket' 
    AND column_name = 'force_active'
  ) THEN
    ALTER TABLE public.daily_court_docket ADD COLUMN force_active BOOLEAN DEFAULT false;
  END IF;
END $$;