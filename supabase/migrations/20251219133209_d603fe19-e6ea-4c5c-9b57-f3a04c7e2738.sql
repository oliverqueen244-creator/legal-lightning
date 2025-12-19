-- 1. Create raw_causelists table (authoritative PDF records)
CREATE TABLE public.raw_causelists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_message_id BIGINT,
  file_name TEXT,
  bench TEXT NOT NULL CHECK (bench IN ('JAIPUR', 'JODHPUR')),
  list_type TEXT NOT NULL CHECK (list_type IN ('DAILY', 'SUPPLEMENTARY')),
  list_date DATE NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  page_count INTEGER,
  text_content TEXT, -- Cached plain text extraction
  status TEXT DEFAULT 'downloaded' CHECK (status IN ('downloaded', 'notes_extracted', 'scanning', 'scanned')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(telegram_message_id)
);

-- 2. Create cause_list_notes table (registry notes)
CREATE TABLE public.cause_list_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_causelist_id UUID NOT NULL REFERENCES public.raw_causelists(id) ON DELETE CASCADE,
  note_type TEXT CHECK (note_type IN ('NOTE', 'IMPORTANT', 'DIRECTION', 'OTHER')),
  note_text TEXT NOT NULL,
  page_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create case_parse_queue table (account-isolated parsing queue)
CREATE TABLE public.case_parse_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raw_causelist_id UUID NOT NULL REFERENCES public.raw_causelists(id) ON DELETE CASCADE,
  matched_alias TEXT NOT NULL,
  page_range TEXT,
  item_range TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error_message TEXT,
  cases_parsed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 4. Create profile_scan_log table (tracks scans per profile per causelist)
CREATE TABLE public.profile_scan_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raw_causelist_id UUID NOT NULL REFERENCES public.raw_causelists(id) ON DELETE CASCADE,
  aliases_searched TEXT[],
  matches_found INTEGER DEFAULT 0,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, raw_causelist_id)
);

-- Enable RLS on all tables
ALTER TABLE public.raw_causelists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cause_list_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_parse_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_scan_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for raw_causelists (public read, service role write)
CREATE POLICY "Anyone can view causelists"
ON public.raw_causelists FOR SELECT
USING (true);

CREATE POLICY "Service role can insert causelists"
ON public.raw_causelists FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update causelists"
ON public.raw_causelists FOR UPDATE
USING (true);

-- RLS Policies for cause_list_notes (public read)
CREATE POLICY "Anyone can view notes"
ON public.cause_list_notes FOR SELECT
USING (true);

CREATE POLICY "Service role can insert notes"
ON public.cause_list_notes FOR INSERT
WITH CHECK (true);

-- RLS Policies for case_parse_queue (account-isolated)
CREATE POLICY "Users can view own queue items"
ON public.case_parse_queue FOR SELECT
USING (auth.uid() = profile_id);

CREATE POLICY "Service role can manage queue"
ON public.case_parse_queue FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for profile_scan_log (account-isolated)
CREATE POLICY "Users can view own scan logs"
ON public.profile_scan_log FOR SELECT
USING (auth.uid() = profile_id);

CREATE POLICY "Service role can manage scan logs"
ON public.profile_scan_log FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_raw_causelists_date ON public.raw_causelists(list_date DESC);
CREATE INDEX idx_raw_causelists_status ON public.raw_causelists(status);
CREATE INDEX idx_case_parse_queue_status ON public.case_parse_queue(status);
CREATE INDEX idx_case_parse_queue_profile ON public.case_parse_queue(profile_id);
CREATE INDEX idx_profile_scan_log_profile ON public.profile_scan_log(profile_id);