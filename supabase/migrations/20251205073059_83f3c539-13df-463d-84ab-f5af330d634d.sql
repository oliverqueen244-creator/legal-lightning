-- Create sync_status table to track sync health
CREATE TABLE public.sync_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name TEXT NOT NULL,
  last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_source_timestamp TIMESTAMP WITH TIME ZONE,
  sync_latency_ms INTEGER,
  status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for quick lookups
CREATE INDEX idx_sync_status_source ON sync_status(source_name, last_sync_at DESC);

-- Enable RLS
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- Anyone can view sync status
CREATE POLICY "Anyone can view sync status"
  ON public.sync_status FOR SELECT
  USING (true);

-- Authenticated users can insert sync status
CREATE POLICY "Authenticated users can insert sync status"
  ON public.sync_status FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create data_validation_logs table
CREATE TABLE public.data_validation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  validation_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'warning', 'fail')),
  details JSONB,
  court_location TEXT,
  court_no TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for validation logs
CREATE INDEX idx_validation_logs_type ON data_validation_logs(validation_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.data_validation_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can view validation logs
CREATE POLICY "Anyone can view validation logs"
  ON public.data_validation_logs FOR SELECT
  USING (true);

-- Authenticated users can insert validation logs
CREATE POLICY "Authenticated users can insert validation logs"
  ON public.data_validation_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Add source_timestamp column to live_board_cache
ALTER TABLE public.live_board_cache 
ADD COLUMN IF NOT EXISTS source_timestamp TIMESTAMP WITH TIME ZONE;

-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function for auto-matching aliases
CREATE OR REPLACE FUNCTION public.trigger_auto_match_aliases()
RETURNS TRIGGER AS $$
BEGIN
  -- Call edge function via pg_net
  PERFORM extensions.http_post(
    url := 'https://pwpnnixoscppfzjogcgj.supabase.co/functions/v1/auto-match-aliases',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cG5uaXhvc2NwcGZ6am9nY2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTY5NzAsImV4cCI6MjA4MDMzMjk3MH0.DzT7tDz74hGo3WMHO2EACM2GkqrdXns1I3OXwHsTrRc"}'::jsonb,
    body := json_build_object(
      'docket_id', NEW.id,
      'petitioner_lawyer', NEW.petitioner_lawyer,
      'respondent_lawyer', NEW.respondent_lawyer
    )::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on INSERT to daily_court_docket
DROP TRIGGER IF EXISTS on_docket_insert_match_aliases ON daily_court_docket;
CREATE TRIGGER on_docket_insert_match_aliases
  AFTER INSERT ON daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_match_aliases();

-- Enable realtime for sync_status
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_status;