/**
 * INTERN INTEGRATION PHASE 1 + 2B: Zero-Trust Intern Permissions
 * 
 * Provides strict permission checks for interns.
 * All permissions default to DENY.
 * 
 * POST-EXPIRY BEHAVIOR:
 * - When expires_at <= now() OR revoked_at IS NOT NULL:
 *   - is_active_intern() returns FALSE at DB level
 *   - All case access denied via RLS
 *   - Drafts become read-only (cannot create/modify)
 *   - Existing drafts remain visible to supervisors only
 * 
 * HARD-DENIED ACTIONS (compile-time constants):
 * - canOwnCases: false
 * - canApproveDocuments: false
 * - canExport: false
 * - canPrint: false
 * - canDownload: false
 * - canSeeClientContact: false
 * - canSendWhispers: false
 * - canAccessVirtualCourt: false
 * - canModifyCaseMetadata: false
 * - canPersistToMaster: false
 * 
 * ============================================================
 * INTERN FEATURE SET COMPLETE as of Phase 2B (2026-01-14).
 * Any expansion requires new audit + design approval.
 * ============================================================
 * 
 * SECURITY REVIEW: 2026-01-14
 */

import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

export interface InternPermissions {
  isIntern: boolean;
  isActiveIntern: boolean;
  internAccountId: string | null;
  expiresAt: Date | null;
  
  // All permissions are DENY by default
  canOwnCases: false;
  canApproveDocuments: false;
  canExport: false;
  canPrint: false;
  canDownload: false;
  canSeeClientContact: false;
  canSendWhispers: false;
  canAccessVirtualCourt: false;
  canModifyCaseMetadata: false;
  canPersistToMaster: false;
  
  // Allowed actions (limited)
  canViewAssignedCases: boolean;
  canCreateDrafts: boolean;
  canSubmitForReview: boolean;
}

export function useInternPermissions(): InternPermissions {
  const { role, user } = useAuth();
  const isIntern = role === 'INTERN';

  const { data: internAccount } = useQuery({
    queryKey: ['intern-account', user?.id],
    queryFn: async () => {
      if (!user?.id || !isIntern) return null;
      
      const { data, error } = await supabase
        .from('intern_accounts')
        .select('id, expires_at, revoked_at')
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error || !data) return null;
      return data;
    },
    enabled: isIntern && !!user?.id,
    staleTime: 60000, // Check every minute
  });

  const isActiveIntern = isIntern && !!internAccount;
  
  return {
    isIntern,
    isActiveIntern,
    internAccountId: internAccount?.id ?? null,
    expiresAt: internAccount?.expires_at ? new Date(internAccount.expires_at) : null,
    
    // HARD DENY - These are compile-time constants
    canOwnCases: false as const,
    canApproveDocuments: false as const,
    canExport: false as const,
    canPrint: false as const,
    canDownload: false as const,
    canSeeClientContact: false as const,
    canSendWhispers: false as const,
    canAccessVirtualCourt: false as const,
    canModifyCaseMetadata: false as const,
    canPersistToMaster: false as const,
    
    // Limited allowances
    canViewAssignedCases: isActiveIntern,
    canCreateDrafts: isActiveIntern,
    canSubmitForReview: isActiveIntern,
  };
}

/**
 * Guard component to block intern access to sensitive features
 */
export function useInternGuard() {
  const { isIntern, internAccountId } = useInternPermissions();
  
  const blockIfIntern = useCallback((action: string) => {
    if (isIntern) {
      console.warn(`[InternGuard] Blocked action: ${action}`);
      // Log access denial for audit trail (fire and forget)
      if (internAccountId) {
        void supabase.rpc('log_intern_access', {
          p_action_type: 'access_denied',
          p_target_table: null,
          p_target_id: null,
          p_details: { blocked_action: action }
        });
      }
      return true;
    }
    return false;
  }, [isIntern, internAccountId]);

  return { blockIfIntern };
}

/**
 * Log intern case view for audit trail
 */
export function useInternAccessLogger() {
  const { isActiveIntern, internAccountId } = useInternPermissions();
  
  const logCaseView = useCallback(async (docketId: string) => {
    if (!isActiveIntern || !internAccountId) return;
    
    try {
      await supabase.rpc('log_intern_access', {
        p_action_type: 'case_view',
        p_target_table: 'daily_court_docket',
        p_target_id: docketId,
        p_details: null
      });
    } catch {
      // Fail silently - never block operations due to logging
    }
  }, [isActiveIntern, internAccountId]);
  
  return { logCaseView };
}
