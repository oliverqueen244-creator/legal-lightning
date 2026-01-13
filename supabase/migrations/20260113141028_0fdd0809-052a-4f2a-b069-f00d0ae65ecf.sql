-- Add Virtual Court (VC) columns to daily_court_docket
-- These store Webex meeting information extracted from causelists

-- Create VC provider enum
DO $$ BEGIN
  CREATE TYPE public.vc_provider AS ENUM ('webex');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add VC columns to daily_court_docket
ALTER TABLE public.daily_court_docket
ADD COLUMN IF NOT EXISTS vc_provider public.vc_provider,
ADD COLUMN IF NOT EXISTS vc_meeting_id TEXT,
ADD COLUMN IF NOT EXISTS vc_join_url TEXT,
ADD COLUMN IF NOT EXISTS vc_source TEXT DEFAULT 'causelist',
ADD COLUMN IF NOT EXISTS vc_extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS vc_confidence SMALLINT CHECK (vc_confidence IS NULL OR (vc_confidence >= 0 AND vc_confidence <= 100));

-- Create index for efficient VC queries by date and court
CREATE INDEX IF NOT EXISTS idx_docket_vc_date_court 
ON public.daily_court_docket(date, court_location, court_room_no) 
WHERE vc_meeting_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.daily_court_docket.vc_provider IS 'Virtual court provider (webex)';
COMMENT ON COLUMN public.daily_court_docket.vc_meeting_id IS 'Normalized meeting ID (digits only)';
COMMENT ON COLUMN public.daily_court_docket.vc_join_url IS 'Deep-link join URL for virtual court';
COMMENT ON COLUMN public.daily_court_docket.vc_source IS 'Source of VC data (causelist)';
COMMENT ON COLUMN public.daily_court_docket.vc_extracted_at IS 'When VC data was extracted from causelist';
COMMENT ON COLUMN public.daily_court_docket.vc_confidence IS 'Confidence score 0-100 for VC extraction';

-- Create table for VC click event logging (beta monitoring)
CREATE TABLE IF NOT EXISTS public.vc_click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  docket_id UUID REFERENCES public.daily_court_docket(id),
  vc_meeting_id TEXT NOT NULL,
  court_location TEXT NOT NULL,
  court_room_no TEXT NOT NULL,
  click_date DATE NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on vc_click_events
ALTER TABLE public.vc_click_events ENABLE ROW LEVEL SECURITY;

-- RLS: Users can insert their own click events
CREATE POLICY "users_can_log_vc_clicks"
ON public.vc_click_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS: Admin can view all click events
CREATE POLICY "admins_can_view_vc_clicks"
ON public.vc_click_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  )
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_vc_clicks_date 
ON public.vc_click_events(click_date, court_location);