
-- =====================================================
-- CP-4 SAFE ACTIVATION + DELEGATION HARDENING
-- Phase 1 & 2: Complete security overhaul
-- =====================================================

-- =====================================================
-- PART 0: ADD MISSING DELEGATION SCOPES
-- =====================================================

ALTER TYPE public.delegation_scope ADD VALUE IF NOT EXISTS 'edit_cases';
ALTER TYPE public.delegation_scope ADD VALUE IF NOT EXISTS 'manage_documents';
