-- ============================================
-- VAKALAT OS - STEP 1: Create audit table
-- ============================================

CREATE TABLE IF NOT EXISTS public.docket_cleanup_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_docket_id UUID NOT NULL,
    date DATE NOT NULL,
    court_location TEXT,
    court_room_no TEXT,
    case_number TEXT,
    original_created_at TIMESTAMPTZ,
    reason TEXT NOT NULL,
    cleaned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.docket_cleanup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cleanup logs" 
ON public.docket_cleanup_log 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'ADMIN'::app_role
));

CREATE POLICY "Service role can insert cleanup logs" 
ON public.docket_cleanup_log 
FOR INSERT 
WITH CHECK (true);