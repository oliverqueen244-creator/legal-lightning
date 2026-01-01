import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ConflictResolutionDialog, ConflictData } from '@/components/sync/ConflictResolutionDialog';

interface SyncConflictContextValue {
  /** Shows conflict dialog and returns user's choice */
  showConflict: (conflict: ConflictData) => Promise<'keep-local' | 'discard-local'>;
  /** Whether a conflict is currently being shown */
  hasActiveConflict: boolean;
}

const SyncConflictContext = createContext<SyncConflictContextValue | null>(null);

interface SyncConflictProviderProps {
  children: ReactNode;
}

/**
 * HARDENING FIX: Global provider for sync conflict resolution.
 * 
 * Ensures ConflictResolutionDialog is always rendered at app level
 * and cannot be missed during background sync operations.
 */
export function SyncConflictProvider({ children }: SyncConflictProviderProps) {
  const [activeConflict, setActiveConflict] = useState<ConflictData | null>(null);
  const [resolvePromise, setResolvePromise] = useState<{
    resolve: (choice: 'keep-local' | 'discard-local') => void;
  } | null>(null);

  const showConflict = useCallback((conflict: ConflictData): Promise<'keep-local' | 'discard-local'> => {
    return new Promise((resolve) => {
      setActiveConflict(conflict);
      setResolvePromise({ resolve });
    });
  }, []);

  const handleKeepLocal = useCallback(() => {
    resolvePromise?.resolve('keep-local');
    setActiveConflict(null);
    setResolvePromise(null);
  }, [resolvePromise]);

  const handleDiscardLocal = useCallback(() => {
    resolvePromise?.resolve('discard-local');
    setActiveConflict(null);
    setResolvePromise(null);
  }, [resolvePromise]);

  const handleClose = useCallback(() => {
    // Do nothing - conflict cannot be dismissed without choice
    // This is intentional: modal must be blocking
  }, []);

  return (
    <SyncConflictContext.Provider
      value={{
        showConflict,
        hasActiveConflict: activeConflict !== null,
      }}
    >
      {children}
      
      {/* Conflict dialog rendered at app level - always available */}
      <ConflictResolutionDialog
        open={activeConflict !== null}
        conflict={activeConflict}
        onKeepLocal={handleKeepLocal}
        onDiscardLocal={handleDiscardLocal}
        onClose={handleClose}
      />
    </SyncConflictContext.Provider>
  );
}

export function useSyncConflict() {
  const context = useContext(SyncConflictContext);
  if (!context) {
    throw new Error('useSyncConflict must be used within a SyncConflictProvider');
  }
  return context;
}
