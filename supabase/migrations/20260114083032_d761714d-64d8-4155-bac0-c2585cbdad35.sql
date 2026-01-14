
-- Create export audit log table for tracking case exports
CREATE TABLE public.case_export_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  export_type TEXT NOT NULL CHECK (export_type IN ('profile', 'cv', 'empanelment')),
  export_format TEXT NOT NULL CHECK (export_format IN ('pdf-a4', 'pdf-legal', 'csv', 'excel')),
  cases_exported INTEGER NOT NULL DEFAULT 0,
  date_range_start DATE,
  date_range_end DATE,
  exported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.case_export_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own export logs
CREATE POLICY "Users can view their own export logs"
  ON public.case_export_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own export logs
CREATE POLICY "Users can create their own export logs"
  ON public.case_export_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all export logs
CREATE POLICY "Admins can view all export logs"
  ON public.case_export_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Create index for efficient queries
CREATE INDEX idx_case_export_logs_user_id ON public.case_export_logs(user_id);
CREATE INDEX idx_case_export_logs_exported_at ON public.case_export_logs(exported_at DESC);

-- Add comment explaining purpose
COMMENT ON TABLE public.case_export_logs IS 'Audit trail for case exports by lawyers. Tracks all profile/CV exports for accountability.';
