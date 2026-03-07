import { useState, useEffect, useCallback } from 'react';
import { Activity, Play, SkipForward, AlertCircle, WifiOff, Zap } from 'lucide-react';
import { useOfflineCache } from './useOfflineCache';
import { useNetworkStatus } from './useNetworkStatus';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ConflictData } from '@/components/sync/ConflictResolutionDialog';

export interface PendingMutation {
  id?: number;
  type: 'insert' | 'update' | 'upsert';
  table: string;
  data: any;
  createdAt: number;
  conflictColumns?: string;
}

/**
 * Hook to manage pending mutations sync.
 * Only used for post-court notes.
 * 
 * HARDENING FIX: Now accepts a conflict handler callback from SyncConflictContext
 * to ensure conflicts are always surfaced via the global dialog.
 */
export function usePendingSync(
  onConflictDetected?: (conflict: ConflictData) => Promise<'keep-local' | 'discard-local'>
) {
  const { isOnline } = useNetworkStatus();
  const {
    queueMutation,
    getPendingMutations,
    clearPendingMutation
  } = useOfflineCache();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check for pending mutations on mount and when online status changes
  const refreshPendingCount = useCallback(async () => {
    try {
      const mutations = await getPendingMutations();
      setPendingCount(mutations.length);
    } catch {
      setPendingCount(0);
    }
  }, [getPendingMutations]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  /**
   * Check for conflict and return conflict data if found
   */
  const checkForConflict = useCallback(async (mutation: PendingMutation): Promise<ConflictData | null> => {
    if (mutation.table !== 'post_court_notes') return null;

    const {
      case_fingerprint,
      hearing_date,
      author_id,
      updated_at: localUpdatedAt,
      what_happened,
      next_direction,
      note_for_next,
    } = mutation.data;

    if (!localUpdatedAt) return null;

    const { data: serverNote } = await supabase
      .from('post_court_notes')
      .select('*')
      .eq('case_fingerprint', case_fingerprint)
      .eq('hearing_date', hearing_date)
      .eq('author_id', author_id)
      .maybeSingle();

    if (serverNote && new Date(serverNote.updated_at) > new Date(localUpdatedAt)) {
      // HARDENING FIX: Return full conflict data for dialog
      return {
        localVersion: {
          what_happened,
          next_direction,
          note_for_next,
          updated_at: localUpdatedAt,
        },
        serverVersion: {
          what_happened: serverNote.what_happened,
          next_direction: serverNote.next_direction,
          note_for_next: serverNote.note_for_next,
          updated_at: serverNote.updated_at,
        },
        caseFingerprint: case_fingerprint,
        hearingDate: hearing_date,
      };
    }

    return null;
  }, []);

  const performMutation = useCallback(async (mutation: PendingMutation): Promise<any> => {
    const { type, table, data, conflictColumns } = mutation;

    // Only handle post_court_notes for now
    if (table !== 'post_court_notes') {
      return new Error('Unsupported table for offline sync');
    }

    switch (type) {
      case 'insert': {
        const insertResult = await supabase.from('post_court_notes').insert(data);
        return insertResult.error;
      }
      case 'update': {
        const updateResult = await supabase.from('post_court_notes').update(data).eq('id', data.id);
        return updateResult.error;
      }
      case 'upsert': {
        const upsertResult = await supabase.from('post_court_notes').upsert(data, {
          onConflict: conflictColumns || 'case_fingerprint,hearing_date,author_id',
        });
        return upsertResult.error;
      }
      default:
        return new Error('Unknown mutation type');
    }
  }, []);

  const syncPendingMutations = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    let synced = 0;
    let failed = 0;

    try {
      const mutations = await getPendingMutations();

      for (const mutation of mutations) {
        try {
          // Cast to PendingMutation type
          const typedMutation = mutation as unknown as PendingMutation;

          if (typedMutation.table === 'post_court_notes') {
            // Check for conflict before syncing
            const conflict = await checkForConflict(typedMutation);

            if (conflict) {
              // HARDENING FIX: Surface conflict via global dialog if handler provided
              if (onConflictDetected) {
                const choice = await onConflictDetected(conflict);

                if (choice === 'discard-local') {
                  // User chose to discard - clear mutation without applying
                  await clearPendingMutation(mutation.id!);
                  toast.info('Local changes discarded', {
                    description: 'Loaded latest version from server.',
                  });
                  continue;
                }
                // choice === 'keep-local' - proceed with upsert below
              } else {
                // No handler - skip and mark as needing review
                failed++;
                continue;
              }
            }
          }

          // Perform the sync
          const error = await performMutation(typedMutation);

          if (error) {
            console.error('Sync error:', error);
            failed++;
          } else {
            await clearPendingMutation(mutation.id!);
            synced++;
          }
        } catch (err) {
          console.error('Mutation sync failed:', err);
          failed++;
        }
      }

      await refreshPendingCount();

      if (synced > 0) {
        toast.success(`Synced ${synced} pending change${synced > 1 ? 's' : ''}`, {
          description: 'Your personal notes have been saved.',
        });
      }

      if (failed > 0) {
        toast.warning(`${failed} change${failed > 1 ? 's' : ''} need${failed === 1 ? 's' : ''} review`, {
          description: 'Some notes could not be synced automatically.',
        });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, getPendingMutations, clearPendingMutation, onConflictDetected, refreshPendingCount, checkForConflict, performMutation]);

  // Sync pending mutations when coming online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      syncPendingMutations();
    }
  }, [isOnline, pendingCount, isSyncing, syncPendingMutations]);

  const queuePostCourtNote = useCallback(async (noteData: any) => {
    await queueMutation('upsert', 'post_court_notes', {
      ...noteData,
      updated_at: new Date().toISOString(),
    });
    await refreshPendingCount();

    // HARDENING FIX: Precise offline language
    toast.success('Saved locally', {
      description: 'Personal notes will sync when online.',
    });
  }, [queueMutation, refreshPendingCount]);

  return {
    pendingCount,
    isSyncing,
    syncPendingMutations,
    queuePostCourtNote,
    refreshPendingCount,
  };
}
