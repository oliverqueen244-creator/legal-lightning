-- Fix RLS policies for sensitive tables

-- 1. ai_jobs: Restrict to admins only (not all authenticated users)
DROP POLICY IF EXISTS "Authenticated users can view ai_jobs" ON public.ai_jobs;

CREATE POLICY "Admins can view ai_jobs" 
ON public.ai_jobs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'ADMIN'::app_role
  )
);

-- 2. daily_court_docket: Restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view docket" ON public.daily_court_docket;

CREATE POLICY "Authenticated users can view docket" 
ON public.daily_court_docket 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- 3. raw_causelists: Restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view causelists" ON public.raw_causelists;

CREATE POLICY "Authenticated users can view causelists" 
ON public.raw_causelists 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- 4. ai_parse_cache: Already secure (service role only), add explicit authenticated read for cache hits
CREATE POLICY "Authenticated users can view cache" 
ON public.ai_parse_cache 
FOR SELECT 
USING (auth.role() = 'authenticated');