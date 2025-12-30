-- Court Mode Settings table
CREATE TABLE public.court_mode_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  court_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  court_mode_bench TEXT CHECK (court_mode_bench IN ('JODHPUR', 'JAIPUR', 'BOTH')),
  court_mode_start TIME NOT NULL DEFAULT '10:30:00',
  court_mode_end TIME NOT NULL DEFAULT '17:00:00',
  whatsapp_escalation_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.court_mode_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own court mode settings"
  ON public.court_mode_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own court mode settings"
  ON public.court_mode_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own court mode settings"
  ON public.court_mode_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  docket_id UUID REFERENCES public.daily_court_docket(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('approaching', 'skipped', 'removed', 'anomaly')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  item_distance INTEGER,
  threshold_crossed TEXT CHECK (threshold_crossed IN ('early_warning', 'imminent', 'immediate', 'exception')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'read', 'acknowledged', 'escalated')),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Notification Escalations audit log
CREATE TABLE public.notification_escalations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp')),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  case_fingerprint TEXT,
  escalation_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Enable RLS
ALTER TABLE public.notification_escalations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own escalations"
  ON public.notification_escalations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert escalations"
  ON public.notification_escalations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all escalations"
  ON public.notification_escalations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'ADMIN'::app_role
  ));

-- Unique constraint to prevent multiple WhatsApp escalations per case per day
CREATE UNIQUE INDEX idx_escalation_case_per_day 
  ON public.notification_escalations(user_id, case_fingerprint, escalation_date, channel)
  WHERE status = 'sent';

-- Indexes for performance
CREATE INDEX idx_notifications_user_status ON public.notifications(user_id, status);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_court_mode_user ON public.court_mode_settings(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_court_mode_settings_updated_at
  BEFORE UPDATE ON public.court_mode_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;