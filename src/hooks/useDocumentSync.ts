import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════
// Explicit Types for RPC and Edge Function responses
// ═══════════════════════════════════════════════════════════════

type CanSyncResult =
  | { allowed: true }
  | { allowed: false; reason: string; next_sync_after?: string };

type SyncSuccess = {
  success: true;
  documents_found: number;
  documents_synced: number;
  documents_skipped: number;
  message?: string;
  next_sync_after: string;
};

type SyncError = {
  error: string;
  reason?: string;
  next_sync_after?: string;
};

type SyncResponse = SyncSuccess | SyncError;

interface SyncStatus {
  document_sync_status: string | null;
  last_document_sync_at: string | null;
  document_sync_attempts: number | null;
  next_document_sync_after: string | null;
  total_documents_synced: number | null;
}

interface SyncedDocument {
  id: string;
  tracked_case_id: string;
  lawyer_id: string;
  court_label: string;
  doc_type: string;
  order_date: string | null;
  source_pdf_url: string;
  stored_pdf_path: string | null;
  pdf_hash: string | null;
  pdf_size_bytes: number | null;
  fetched_at: string;
  created_at: string;
}

/**
 * Hook for lawyers to sync ALL court documents for their tracked cases.
 * Downloads judgments, interim orders, orders, etc. from Case Status page.
 * 
 * RULES:
 * - Manual trigger only (no background sync)
 * - One CAPTCHA solve per sync
 * - 7-day cooldown between syncs
 * - Max 10 attempts per case
 * - Documents deduplicated by PDF hash
 */
export function useDocumentSync() {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncSuccess | null>(null);

  /**
   * Sync all court documents for a tracked case.
   * Triggers CAPTCHA-protected fetch from eCourts Case Status page.
   */
  const syncDocuments = async (caseId: string): Promise<{ success: boolean; error?: string; data?: SyncSuccess }> => {
    if (!user) {
      toast.error('Not authenticated');
      return { success: false, error: 'Not authenticated' };
    }

    setIsSyncing(true);
    setLastResult(null);

    try {
      // Pre-check if sync is allowed (cooldown, max attempts, ownership)
      const { data: rawCanSync, error: checkError } = await supabase
        .rpc('can_sync_documents', { p_case_id: caseId, p_lawyer_id: user.id });

      if (checkError) {
        throw new Error(checkError.message);
      }

      // Cast to explicit type for type safety
      const canSync = rawCanSync as unknown as CanSyncResult;

      if (!canSync.allowed) {
        // TypeScript now knows canSync has reason property when allowed is false
        const failedResult = canSync as { allowed: false; reason: string; next_sync_after?: string };
        
        const messages: Record<string, string> = {
          'case_not_found': 'Case not found',
          'not_owner': 'This case does not belong to you',
          'sync_in_progress': 'A sync is already in progress',
          'cooldown_active': failedResult.next_sync_after 
            ? `Please wait until ${new Date(failedResult.next_sync_after).toLocaleDateString()}`
            : 'Please wait before syncing again',
          'max_attempts_exceeded': 'Maximum sync attempts reached for this case',
        };

        const message = messages[failedResult.reason] || failedResult.reason;
        toast.error(message);
        return { success: false, error: failedResult.reason };
      }

      // Get current session for auth header
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.access_token) {
        toast.error('Session expired, please login again');
        return { success: false, error: 'no_session' };
      }

      // Call the edge function to perform the sync
      const response = await supabase.functions.invoke('sync-case-documents', {
        body: { case_id: caseId },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Cast response to explicit type
      const result = response.data as SyncResponse;

      // Check if error response
      if ('error' in result) {
        const errorResult = result as SyncError;
        
        if (errorResult.reason === 'cooldown_active' && errorResult.next_sync_after) {
          toast.info(`Sync available after ${new Date(errorResult.next_sync_after).toLocaleDateString()}`);
        } else {
          toast.error(errorResult.error);
        }
        
        return { success: false, error: errorResult.error };
      }

      // Success response
      const successResult = result as SyncSuccess;
      setLastResult(successResult);

      if (successResult.documents_synced > 0) {
        toast.success(`Synced ${successResult.documents_synced} document(s)`, {
          description: successResult.message,
        });
      } else if (successResult.documents_found === 0) {
        toast.info('No documents available for download yet');
      } else {
        toast.info('All documents already synced', {
          description: `${successResult.documents_skipped} document(s) were already in your vault`,
        });
      }

      return { success: true, data: successResult };

    } catch (error) {
      console.error('[useDocumentSync] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      toast.error('Document sync failed', { description: errorMessage });
      return { success: false, error: errorMessage };

    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Get the current sync status for a case without triggering a sync
   */
  const getSyncStatus = async (caseId: string): Promise<SyncStatus | null> => {
    const { data, error } = await supabase
      .from('tracked_cases')
      .select(`
        document_sync_status,
        last_document_sync_at,
        document_sync_attempts,
        next_document_sync_after,
        total_documents_synced
      `)
      .eq('id', caseId)
      .single();

    if (error) {
      console.error('[useDocumentSync] getSyncStatus error:', error);
      return null;
    }

    return data as SyncStatus;
  };

  /**
   * Get all synced documents for a case
   */
  const getDocuments = async (caseId: string): Promise<SyncedDocument[]> => {
    const { data, error } = await supabase
      .from('synced_court_documents')
      .select('*')
      .eq('tracked_case_id', caseId)
      .order('order_date', { ascending: false });

    if (error) {
      console.error('[useDocumentSync] getDocuments error:', error);
      return [];
    }

    return (data || []) as SyncedDocument[];
  };

  /**
   * Get a signed URL for downloading a document PDF
   */
  const getDocumentUrl = async (storedPath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('case-documents')
      .createSignedUrl(storedPath, 3600); // 1 hour expiry

    if (error) {
      console.error('[useDocumentSync] getDocumentUrl error:', error);
      return null;
    }

    return data?.signedUrl || null;
  };

  /**
   * Check if a sync can be initiated (for UI state)
   */
  const canSync = async (caseId: string): Promise<{ allowed: boolean; reason?: string; nextSyncAfter?: Date }> => {
    if (!user) {
      return { allowed: false, reason: 'Not authenticated' };
    }

    const { data: rawResult, error } = await supabase
      .rpc('can_sync_documents', { p_case_id: caseId, p_lawyer_id: user.id });

    if (error) {
      return { allowed: false, reason: error.message };
    }

    const result = rawResult as unknown as CanSyncResult;

    if (result.allowed) {
      return { allowed: true };
    }

    // TypeScript now knows result has reason property when allowed is false
    const failedResult = result as { allowed: false; reason: string; next_sync_after?: string };

    return {
      allowed: false,
      reason: failedResult.reason,
      nextSyncAfter: failedResult.next_sync_after ? new Date(failedResult.next_sync_after) : undefined,
    };
  };

  return {
    syncDocuments,
    getSyncStatus,
    getDocuments,
    getDocumentUrl,
    canSync,
    isSyncing,
    lastResult,
  };
}

/**
 * Hook for CAPTCHA usage statistics (unchanged from original)
 */
export function useCaptchaUsage() {
  const { user } = useAuth();

  const getUsageStats = async () => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('captcha_usage_log')
      .select('*')
      .eq('lawyer_id', user.id)
      .order('solved_at', { ascending: false });

    if (error) {
      console.error('[useCaptchaUsage] Error:', error);
      return null;
    }

    const totalSolves = data.length;
    const successfulSolves = data.filter(d => d.success).length;
    const totalCost = data.reduce((sum, d) => sum + (Number(d.cost_credits) || 0), 0);

    return {
      logs: data,
      totalSolves,
      successfulSolves,
      successRate: totalSolves > 0 ? (successfulSolves / totalSolves) * 100 : 0,
      totalCost,
    };
  };

  return { getUsageStats };
}
