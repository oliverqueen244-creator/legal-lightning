-- STEP 1: Create enums for execution policies and hearing likelihood

-- Policy scope enum
CREATE TYPE public.policy_scope AS ENUM ('GLOBAL', 'COURT', 'BENCH', 'UNKNOWN');

-- Priority rule enum
CREATE TYPE public.priority_rule AS ENUM ('SUPPLEMENTARY_FIRST', 'MAIN_ONLY', 'TIME_BOUND', 'UNSPECIFIED');

-- Time condition enum  
CREATE TYPE public.time_condition AS ENUM ('IF_TIME_PERMITS', 'FIXED_ORDER', 'UNKNOWN');

-- Hearing likelihood enum (for derived field on docket)
CREATE TYPE public.hearing_likelihood AS ENUM ('LIKELY', 'CONDITIONAL', 'LOW_PROBABILITY', 'UNKNOWN');

-- STEP 2: Create daily_execution_policies table
CREATE TABLE public.daily_execution_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_causelist_id UUID NOT NULL REFERENCES public.raw_causelists(id) ON DELETE CASCADE,
  policy_text TEXT NOT NULL,
  policy_scope public.policy_scope NOT NULL DEFAULT 'UNKNOWN',
  priority_rule public.priority_rule NOT NULL DEFAULT 'UNSPECIFIED',
  time_condition public.time_condition NOT NULL DEFAULT 'UNKNOWN',
  authority_level TEXT NOT NULL DEFAULT 'JUDICIAL_NOTE',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.95,
  court_no TEXT NULL,
  bench TEXT NULL,
  source_page_number INTEGER NULL,
  derived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- STEP 3: Add hearing_likelihood to daily_court_docket
ALTER TABLE public.daily_court_docket 
ADD COLUMN hearing_likelihood public.hearing_likelihood DEFAULT 'UNKNOWN';

-- Add likelihood_derived_at to track when likelihood was computed
ALTER TABLE public.daily_court_docket 
ADD COLUMN likelihood_derived_at TIMESTAMP WITH TIME ZONE NULL;

-- Add likelihood_reason to explain the derivation (for transparency)
ALTER TABLE public.daily_court_docket 
ADD COLUMN likelihood_reason TEXT NULL;

-- STEP 4: Create indexes for efficient queries
CREATE INDEX idx_execution_policies_causelist ON public.daily_execution_policies(raw_causelist_id);
CREATE INDEX idx_execution_policies_scope ON public.daily_execution_policies(policy_scope, priority_rule);
CREATE INDEX idx_docket_hearing_likelihood ON public.daily_court_docket(hearing_likelihood) WHERE hearing_likelihood IS NOT NULL;

-- STEP 5: Enable RLS on new table
ALTER TABLE public.daily_execution_policies ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read execution policies (they are derived from public court documents)
CREATE POLICY "Execution policies are readable by authenticated users"
ON public.daily_execution_policies
FOR SELECT
TO authenticated
USING (true);

-- Policy: Only admins can insert/update policies (derived during parsing)
CREATE POLICY "Only admins can manage execution policies"
ON public.daily_execution_policies
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  )
);

-- STEP 6: Add comments for documentation
COMMENT ON TABLE public.daily_execution_policies IS 'Stores NOTE-derived execution policies from causelists. Policies are authoritative judicial instructions that affect hearing likelihood.';
COMMENT ON COLUMN public.daily_execution_policies.policy_text IS 'Verbatim NOTE text from causelist';
COMMENT ON COLUMN public.daily_execution_policies.policy_scope IS 'Scope of policy: GLOBAL (all courts), COURT (specific court), BENCH (specific judges), UNKNOWN';
COMMENT ON COLUMN public.daily_execution_policies.priority_rule IS 'How cases should be prioritized based on this policy';
COMMENT ON COLUMN public.daily_execution_policies.time_condition IS 'Time-based conditions mentioned in the NOTE';
COMMENT ON COLUMN public.daily_execution_policies.authority_level IS 'Source authority - always JUDICIAL_NOTE for court-derived policies';
COMMENT ON COLUMN public.daily_execution_policies.confidence IS 'Extraction confidence score (0.00-1.00)';

COMMENT ON COLUMN public.daily_court_docket.hearing_likelihood IS 'Derived (not predicted) likelihood of hearing based on execution policies';
COMMENT ON COLUMN public.daily_court_docket.likelihood_derived_at IS 'When the hearing likelihood was last computed';
COMMENT ON COLUMN public.daily_court_docket.likelihood_reason IS 'Human-readable explanation of why this likelihood was assigned';