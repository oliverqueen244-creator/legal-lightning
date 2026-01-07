-- Fix: Include court_room_no in unique constraint to prevent cross-court collisions

-- Drop the problematic index that's missing court_room_no
DROP INDEX IF EXISTS idx_docket_unique_case;

-- Create the correct unique index that includes court_room_no
CREATE UNIQUE INDEX idx_docket_unique_case ON public.daily_court_docket (date, court_location, court_room_no, case_number);

-- Create a gap audit table to track missing item ranges
CREATE TABLE IF NOT EXISTS public.causelist_gap_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_causelist_id uuid NOT NULL REFERENCES public.raw_causelists(id) ON DELETE CASCADE,
  court_no text NOT NULL,
  expected_items integer NOT NULL,
  actual_items integer NOT NULL,
  coverage_percent numeric NOT NULL,
  missing_ranges jsonb DEFAULT '[]'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.causelist_gap_audit ENABLE ROW LEVEL SECURITY;

-- Admins can view gap audits
CREATE POLICY "Admins can view gap audits"
  ON public.causelist_gap_audit
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'ADMIN'::app_role
  ));

-- Service role can insert gap audits
CREATE POLICY "Service role can insert gap audits"
  ON public.causelist_gap_audit
  FOR INSERT
  WITH CHECK (true);

-- Add index for efficient lookups
CREATE INDEX idx_gap_audit_causelist ON public.causelist_gap_audit(raw_causelist_id);
CREATE INDEX idx_gap_audit_coverage ON public.causelist_gap_audit(coverage_percent) WHERE coverage_percent < 80;