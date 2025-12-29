-- Fix the view to use security invoker (default) instead of security definer
-- Drop and recreate the view
DROP VIEW IF EXISTS public.user_docket_view;

CREATE VIEW public.user_docket_view 
WITH (security_invoker = true)
AS
SELECT 
  id,
  date,
  court_location,
  court_room_no,
  item_no,
  case_number,
  petitioner,
  respondent,
  petitioner_lawyer,
  respondent_lawyer,
  list_type,
  status,
  force_active,
  judge_names,
  matched_profile_id,
  created_at
FROM public.daily_court_docket;

-- Grant access to authenticated users
GRANT SELECT ON public.user_docket_view TO authenticated;