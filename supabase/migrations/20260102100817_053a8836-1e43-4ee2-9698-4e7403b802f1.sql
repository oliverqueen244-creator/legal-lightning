-- =====================================================
-- CHAMBER MAPPING: Non-Owning Coordination Layer
-- =====================================================
-- CRITICAL: Chambers are for coordination ONLY.
-- They do NOT grant access to cases, documents, notes, or observations.
-- All data remains lawyer-scoped per existing RLS.
-- =====================================================

-- 1. Create chamber_role enum (skip if exists from failed migration)
DO $$ BEGIN
  CREATE TYPE public.chamber_role AS ENUM ('senior', 'junior', 'clerk');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Drop tables if they exist from partial migration
DROP TABLE IF EXISTS public.chamber_invites CASCADE;
DROP TABLE IF EXISTS public.chamber_memberships CASCADE;
DROP TABLE IF EXISTS public.chambers CASCADE;

-- 3. Create chambers table
CREATE TABLE public.chambers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chambers_owner_name_unique UNIQUE (owner_id, name)
);

-- 4. Create chamber_memberships table
CREATE TABLE public.chamber_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamber_id uuid NOT NULL REFERENCES public.chambers(id) ON DELETE CASCADE,
  lawyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_chamber chamber_role NOT NULL DEFAULT 'junior',
  invited_by uuid REFERENCES public.profiles(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  CONSTRAINT chamber_memberships_unique_active UNIQUE (chamber_id, lawyer_id)
);

-- 5. Create chamber_invites table
CREATE TABLE public.chamber_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamber_id uuid NOT NULL REFERENCES public.chambers(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  invited_email text,
  role_in_chamber chamber_role NOT NULL DEFAULT 'junior',
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz NULL,
  used_by uuid REFERENCES public.profiles(id)
);

-- 6. Enable RLS on all tables
ALTER TABLE public.chambers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamber_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamber_invites ENABLE ROW LEVEL SECURITY;

-- 7. Create indexes
CREATE INDEX idx_chamber_memberships_lawyer ON public.chamber_memberships(lawyer_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_chamber_memberships_chamber ON public.chamber_memberships(chamber_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_chamber_invites_code ON public.chamber_invites(invite_code) WHERE used_at IS NULL;
CREATE INDEX idx_chamber_invites_email ON public.chamber_invites(invited_email) WHERE used_at IS NULL;

-- =====================================================
-- RLS POLICIES (created after all tables exist)
-- =====================================================

-- CHAMBERS policies
CREATE POLICY "Owners can view own chambers"
ON public.chambers FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Members can view their chambers"
ON public.chambers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chamber_memberships cm
    WHERE cm.chamber_id = chambers.id
    AND cm.lawyer_id = auth.uid()
    AND cm.revoked_at IS NULL
  )
);

CREATE POLICY "Users can create chambers they own"
ON public.chambers FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their chambers"
ON public.chambers FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their chambers"
ON public.chambers FOR DELETE
USING (auth.uid() = owner_id);

-- CHAMBER_MEMBERSHIPS policies
CREATE POLICY "Members can view memberships in their chambers"
ON public.chamber_memberships FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chamber_memberships my_membership
    WHERE my_membership.chamber_id = chamber_memberships.chamber_id
    AND my_membership.lawyer_id = auth.uid()
    AND my_membership.revoked_at IS NULL
  )
  OR
  EXISTS (
    SELECT 1 FROM public.chambers c
    WHERE c.id = chamber_memberships.chamber_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Chamber owners can invite members"
ON public.chamber_memberships FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chambers c
    WHERE c.id = chamber_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Chamber owners can update memberships"
ON public.chamber_memberships FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chambers c
    WHERE c.id = chamber_memberships.chamber_id
    AND c.owner_id = auth.uid()
  )
);

-- CHAMBER_INVITES policies
CREATE POLICY "Chamber owners can view invites"
ON public.chamber_invites FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chambers c
    WHERE c.id = chamber_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can view invites for their email"
ON public.chamber_invites FOR SELECT
USING (
  invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND used_at IS NULL
  AND expires_at > now()
);

CREATE POLICY "Chamber owners can create invites"
ON public.chamber_invites FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chambers c
    WHERE c.id = chamber_id
    AND c.owner_id = auth.uid()
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Chamber owners can delete invites"
ON public.chamber_invites FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.chambers c
    WHERE c.id = chamber_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Invitees can update to mark as used"
ON public.chamber_invites FOR UPDATE
USING (used_at IS NULL AND expires_at > now())
WITH CHECK (used_by = auth.uid());

-- 8. Add chamber_uuid to judge_observation_sharing for proper FK
ALTER TABLE public.judge_observation_sharing 
ADD COLUMN IF NOT EXISTS chamber_uuid uuid REFERENCES public.chambers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_judge_observation_sharing_chamber_uuid 
ON public.judge_observation_sharing(chamber_uuid) WHERE revoked_at IS NULL;