import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface SyncResult {
  success: boolean;
  documents_found: number;
  documents_synced: number;
  documents_skipped: number;
  message?: string;
  next_sync_after?: string;
}

interface SyncError {
  error: string;
  reason?: string;
  next_sync_after?: string;
}

/**
 * Hook for lawyers to sync ALL court documents for their tracked cases.
 * Downloads judgments, interim orders, orders, etc.
 */
export function useDocumentSync() {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const syncDocuments = async (caseId: string) => {
    if (!user) {
      toast.error('Not authenticated');
      return { success: false, error: 'Not authenticated' };
    }

    setIsSyncing(true);

    try {
      // Pre-check if sync is allowed
      const { data: canSync, error: checkError } = await supabase
        .rpc('can_sync_documents', { p_case_id: caseId, p_lawyer_id: user.id });

      if (checkError) throw new Error(checkError.message);

      if (!canSync?.allowed) {
        const messages: Record<string, string> = {
          'case_not_found': 'Case not found',
          'not_owner': 'This case does not belong to you',
          'sync_in_progress': 'Sync already in progress',
          'cooldown_active': `Wait until ${canSync.next_sync_after ? new Date(canSync.next_sync_after).toLocaleDateString() : 'later'}`,
          'max_attempts_exceeded': 'Maximum attempts reached',
        };
        toast.error(messages[canSync.reason] || canSync.reason);
        return { success: false, error: canSync.reason };
      }

      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('check-case-judgment', {
        body: { case_id: caseId },
        headers: { Authorization: `Bearer ${session?.session?.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data as SyncResult | SyncError;

      if ('error' in result) {
        toast.error(result.error);
        return { success: false, error: result.error };
      }

      if (result.documents_synced > 0) {
        toast.success(`Synced ${result.documents_synced} document(s)`);
      } else if (result.documents_found === 0) {
        toast.info('No documents available yet');
      } else {
        toast.info('All documents already synced');
      }

      return { success: true, data: result };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sync failed';
      toast.error(msg);
      return { success: false, error: msg };
    } finally {
      setIsSyncing(false);
    }
  };

  const getSyncStatus = async (caseId: string) => {
    const { data } = await supabase
      .from('tracked_cases')
      .select('document_sync_status, last_document_sync_at, document_sync_attempts, next_document_sync_after, total_documents_synced')
      .eq('id', caseId)
      .single();
    return data;
  };

  const getDocuments = async (caseId: string) => {
    const { data } = await supabase
      .from('synced_court_documents')
      .select('*')
      .eq('tracked_case_id', caseId)
      .order('order_date', { ascending: false });
    return data || [];
  };

  const getDocumentUrl = async (storedPath: string) => {
    const { data } = await supabase.storage
      .from('case-documents')
      .createSignedUrl(storedPath, 3600);
    return data?.signedUrl || null;
  };

  return { syncDocuments, getSyncStatus, getDocuments, getDocumentUrl, isSyncing };
}
