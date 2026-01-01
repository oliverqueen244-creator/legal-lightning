-- Create enum types for audit system
CREATE TYPE public.audit_status AS ENUM ('pass', 'conditional', 'fail');
CREATE TYPE public.audit_dimension AS ENUM (
  'user_experience',
  'role_permissions', 
  'product_coherence',
  'system_failure',
  'operator_readiness',
  'business_liability'
);
CREATE TYPE public.finding_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.finding_status AS ENUM ('open', 'acknowledged', 'fixed');
CREATE TYPE public.risk_type AS ENUM ('ux', 'trust', 'operational', 'legal', 'scale');
CREATE TYPE public.audit_scope AS ENUM ('release', 'feature', 'full-system');
CREATE TYPE public.go_decision AS ENUM ('go', 'conditional_go', 'no_go');

-- Create audit_runs table
CREATE TABLE public.audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_name TEXT NOT NULL,
  audit_scope audit_scope NOT NULL DEFAULT 'feature',
  conducted_by UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  overall_status audit_status,
  go_decision go_decision,
  go_justification TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_findings table
CREATE TABLE public.audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID REFERENCES public.audit_runs(id) ON DELETE CASCADE NOT NULL,
  dimension audit_dimension NOT NULL,
  area TEXT NOT NULL,
  issue TEXT NOT NULL,
  severity finding_severity NOT NULL DEFAULT 'medium',
  recommendation TEXT,
  status finding_status NOT NULL DEFAULT 'open',
  verified_feature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_risks table
CREATE TABLE public.audit_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID REFERENCES public.audit_runs(id) ON DELETE CASCADE NOT NULL,
  risk_type risk_type NOT NULL,
  description TEXT NOT NULL,
  impact TEXT NOT NULL,
  mitigation TEXT,
  severity finding_severity NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_risks ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin only access
CREATE POLICY "Admins can view audit runs"
ON public.audit_runs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

CREATE POLICY "Admins can insert audit runs"
ON public.audit_runs FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

CREATE POLICY "Admins can update audit runs"
ON public.audit_runs FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

CREATE POLICY "Admins can delete audit runs"
ON public.audit_runs FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

-- Findings policies
CREATE POLICY "Admins can view audit findings"
ON public.audit_findings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

CREATE POLICY "Admins can insert audit findings"
ON public.audit_findings FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

CREATE POLICY "Admins can update audit findings"
ON public.audit_findings FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

CREATE POLICY "Admins can delete audit findings"
ON public.audit_findings FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

-- Risks policies
CREATE POLICY "Admins can view audit risks"
ON public.audit_risks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

CREATE POLICY "Admins can insert audit risks"
ON public.audit_risks FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

CREATE POLICY "Admins can update audit risks"
ON public.audit_risks FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

CREATE POLICY "Admins can delete audit risks"
ON public.audit_risks FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'ADMIN'::app_role
));

-- Trigger for updated_at on findings
CREATE TRIGGER update_audit_findings_updated_at
BEFORE UPDATE ON public.audit_findings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();