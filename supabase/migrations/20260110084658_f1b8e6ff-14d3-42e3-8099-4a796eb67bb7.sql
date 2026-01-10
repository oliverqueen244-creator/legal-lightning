-- PWA Force Update Kill Switch
-- Creates app_config table for remote version control

CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for PWA version check without auth)
CREATE POLICY "Anyone can read app_config"
ON public.app_config FOR SELECT
TO anon, authenticated
USING (true);

-- Only admins can update
CREATE POLICY "Only admins can update app_config"
ON public.app_config FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
);

-- Only admins can insert
CREATE POLICY "Only admins can insert app_config"
ON public.app_config FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'ADMIN')
);

-- Insert initial version - set to 2 to force immediate update for bench naming fix
INSERT INTO app_config (key, value) 
VALUES ('force_update_version', '{"version": 2, "reason": "Bench naming convention update - Rajasthan High Court", "triggered_by": "system", "triggered_at": "2026-01-10T09:00:00Z"}');