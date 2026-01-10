import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

/**
 * Valid case proceeding statuses for the Judgment Recording Protocol
 */
export type CaseProceedingStatus =
  | 'listed'
  | 'hearing'
  | 'running'
  | 'adjourned'
  | 'not_reached'
  | 'reserved_for_judgment'
  | 'judgment_pronounced'
  | 'disposed_without_judgment'
  | 'dismissed'
  | 'withdrawn';

/**
 * Statuses that allow judgment recording (JRP-1)
 */
export const JUDGMENT_ELIGIBLE_STATUSES: CaseProceedingStatus[] = [
  'reserved_for_judgment',
  'judgment_pronounced',
];

/**
 * Human-readable labels for case proceeding statuses
 */
export const STATUS_LABELS: Record<CaseProceedingStatus, string> = {
  listed: 'Listed',
  hearing: 'Hearing',
  running: 'Running',
  adjourned: 'Adjourned',
  not_reached: 'Not Reached',
  reserved_for_judgment: 'Reserved for Judgment',
  judgment_pronounced: 'Judgment Pronounced',
  disposed_without_judgment: 'Disposed Without Judgment',
  dismissed: 'Dismissed',
  withdrawn: 'Withdrawn',
};

interface JudgmentEligibility {
  is_eligible: boolean;
  current_status: string;
  reason: string;
}

interface JudgmentAuditEntry {
  id: string;
  case_judgment_id: string;
  tracked_case_id: string;
  saved_by_user_id: string;
  case_status_at_save: CaseProceedingStatus;
  save_method: string;
  action: string;
  saved_at: string;
  metadata: Record<string, unknown>;
}

/**
 * CP-6: Judgment Recording Protocol Hook
 * 
 * Provides status-validated judgment recording with:
 * - Eligibility checking via database function
 * - Status updates
 * - Audit trail access
 * 
 * IMPORTANT: All validation is enforced at database level.
 * Frontend checks are reflective only.
 */
export function useJudgmentRecording(trackedCaseId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Query eligibility from database
  const { 
    data: eligibility, 
    isLoading: isCheckingEligibility,
    refetch: recheckEligibility,
  } = useQuery({
    queryKey: ['judgment-eligibility', trackedCaseId],
    queryFn: async (): Promise<JudgmentEligibility | null> => {
      if (!trackedCaseId) return null;

      const { data, error } = await supabase
        .rpc('get_judgment_eligibility', { p_case_id: trackedCaseId });

      if (error) {
        console.error('[JRP] Eligibility check failed:', error);
        return null;
      }

      // RPC returns array, take first row
      const row = Array.isArray(data) ? data[0] : data;
      return row as JudgmentEligibility;
    },
    enabled: !!trackedCaseId && !!user,
    staleTime: 30000, // 30 seconds
  });

  // Query case proceeding status directly
  const { 
    data: caseData,
    isLoading: isLoadingCase,
  } = useQuery({
    queryKey: ['tracked-case-status', trackedCaseId],
    queryFn: async () => {
      if (!trackedCaseId) return null;

      const { data, error } = await supabase
        .from('tracked_cases')
        .select('id, case_type, case_number, case_year, proceeding_status, judgment_status')
        .eq('id', trackedCaseId)
        .single();

      if (error) {
        console.error('[JRP] Case fetch failed:', error);
        return null;
      }

      return data;
    },
    enabled: !!trackedCaseId && !!user,
    staleTime: 30000,
  });

  // Update case proceeding status
  const updateProceedingStatus = useCallback(async (
    newStatus: CaseProceedingStatus
  ): Promise<boolean> => {
    if (!trackedCaseId || !user) {
      toast.error('Unable to update status');
      return false;
    }

    setIsUpdatingStatus(true);

    try {
      const { data, error } = await supabase
        .rpc('update_case_proceeding_status', {
          p_case_id: trackedCaseId,
          p_new_status: newStatus,
        });

      if (error) {
        throw error;
      }

      toast.success(`Status updated to "${STATUS_LABELS[newStatus]}"`);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['judgment-eligibility', trackedCaseId] });
      queryClient.invalidateQueries({ queryKey: ['tracked-case-status', trackedCaseId] });

      return true;
    } catch (error) {
      console.error('[JRP] Status update failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to update status';
      toast.error(message);
      return false;
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [trackedCaseId, user, queryClient]);

  // Query audit trail for a case
  const { 
    data: auditLog,
    isLoading: isLoadingAudit,
  } = useQuery({
    queryKey: ['judgment-audit-log', trackedCaseId],
    queryFn: async (): Promise<JudgmentAuditEntry[]> => {
      if (!trackedCaseId) return [];

      const { data, error } = await supabase
        .from('judgment_audit_log')
        .select('*')
        .eq('tracked_case_id', trackedCaseId)
        .order('saved_at', { ascending: false });

      if (error) {
        console.error('[JRP] Audit log fetch failed:', error);
        return [];
      }

      return (data || []) as JudgmentAuditEntry[];
    },
    enabled: !!trackedCaseId && !!user,
  });

  // Check if judgment recording is allowed (derived from eligibility)
  const isJudgmentEligible = eligibility?.is_eligible ?? false;
  const currentStatus = (caseData?.proceeding_status as CaseProceedingStatus) ?? 'listed';
  const eligibilityReason = eligibility?.reason ?? 'Judgments can be recorded only after the case reaches the appropriate stage.';

  return {
    // Eligibility
    isJudgmentEligible,
    currentStatus,
    eligibilityReason,
    isCheckingEligibility,
    recheckEligibility,

    // Case data
    caseData,
    isLoadingCase,

    // Status management
    updateProceedingStatus,
    isUpdatingStatus,

    // Audit
    auditLog,
    isLoadingAudit,

    // Constants
    JUDGMENT_ELIGIBLE_STATUSES,
    STATUS_LABELS,
  };
}

/**
 * Hook to get judgment audit statistics (for admin)
 */
export function useJudgmentAuditStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['judgment-audit-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judgment_audit_log')
        .select('action, case_status_at_save, saved_at')
        .order('saved_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[JRP] Audit stats failed:', error);
        return null;
      }

      const entries = data || [];
      const successfulSaves = entries.filter(e => e.action === 'INSERT').length;
      const statusBreakdown = entries.reduce((acc, e) => {
        const status = e.case_status_at_save as string;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalEntries: entries.length,
        successfulSaves,
        statusBreakdown,
        recentEntries: entries.slice(0, 10),
      };
    },
    enabled: !!user,
    staleTime: 60000,
  });
}
