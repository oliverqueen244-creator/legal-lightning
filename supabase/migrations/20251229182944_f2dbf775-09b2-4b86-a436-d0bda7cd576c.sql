-- 1. Create user-facing view that hides internal fields
CREATE OR REPLACE VIEW public.user_docket_view AS
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
  -- Excluded: match_confidence, match_method, matched_role, needs_review, case_fingerprint, fingerprint_matched_at, source_url
FROM public.daily_court_docket;

-- Grant access to authenticated users
GRANT SELECT ON public.user_docket_view TO authenticated;

-- 2. Create token usage tracking table
CREATE TABLE IF NOT EXISTS public.token_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  provider text NOT NULL,
  tokens_used bigint NOT NULL DEFAULT 0,
  job_count integer NOT NULL DEFAULT 0,
  budget_limit bigint DEFAULT 1000000,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(usage_date, provider)
);

-- Enable RLS on token_usage_daily
ALTER TABLE public.token_usage_daily ENABLE ROW LEVEL SECURITY;

-- Only admins can view token usage
CREATE POLICY "Admins can view token usage" ON public.token_usage_daily
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'ADMIN'
  ));

-- Service role can manage token usage
CREATE POLICY "Service role can manage token usage" ON public.token_usage_daily
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_type text NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'individual', 'chamber')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'expired')),
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage subscriptions (for Stripe webhooks)
CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'ADMIN'
  ));

-- 4. Create archive table for old causelist text content
CREATE TABLE IF NOT EXISTS public.raw_causelists_archive (
  id uuid PRIMARY KEY,
  bench text NOT NULL,
  list_date date NOT NULL,
  list_type text NOT NULL,
  text_content text,
  archived_at timestamp with time zone DEFAULT now()
);

-- Enable RLS (admin only)
ALTER TABLE public.raw_causelists_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view archives" ON public.raw_causelists_archive
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'ADMIN'
  ));

-- 5. Function to archive old causelist text content (older than 30 days)
CREATE OR REPLACE FUNCTION public.archive_old_causelists()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count integer;
BEGIN
  -- Move text_content to archive for causelists older than 30 days
  WITH to_archive AS (
    SELECT id, bench, list_date, list_type, text_content
    FROM raw_causelists
    WHERE list_date < CURRENT_DATE - INTERVAL '30 days'
    AND text_content IS NOT NULL
    AND status = 'parsed'
  )
  INSERT INTO raw_causelists_archive (id, bench, list_date, list_type, text_content)
  SELECT id, bench, list_date, list_type, text_content
  FROM to_archive
  ON CONFLICT (id) DO NOTHING;

  -- Clear text_content from main table
  UPDATE raw_causelists
  SET text_content = NULL
  WHERE list_date < CURRENT_DATE - INTERVAL '30 days'
  AND text_content IS NOT NULL
  AND status = 'parsed';

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;

-- 6. Function to cleanup old scraper logs (older than 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_scraper_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM scraper_logs
  WHERE run_at < CURRENT_DATE - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 7. Function to check subscription status (for RLS)
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
    AND status IN ('active', 'trialing')
    AND (current_period_end IS NULL OR current_period_end > NOW())
  )
$$;

-- 8. Trigger to update updated_at on subscriptions
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Trigger to update updated_at on token_usage_daily
CREATE TRIGGER update_token_usage_updated_at
  BEFORE UPDATE ON public.token_usage_daily
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();