import { useEffect } from 'react';
import { useFormDirty } from '@/contexts/FormDirtyContext';
import { usePendingSync } from './usePendingSync';

/**
 * SAFE PWA AUTO-UPDATE — PHASE 4: BEFOREUNLOAD SAFETY NET
 * 
 * COURT-CRITICAL: Last-resort protection against data loss.
 * 
 * This hook adds a beforeunload event listener that will show 
 * the browser's native "Leave site?" confirmation dialog if:
 * - Any form has unsaved changes
 * - There are pending offline mutations
 * 
 * This protects against:
 * - Accidental page refresh
 * - Accidental navigation away
 * - Any reload mechanism that bypasses our safety checks
 */

export function useBeforeUnloadGuard() {
  const { hasDirtyForms, dirtyFormIds } = useFormDirty();
  const { pendingCount } = usePendingSync();

  useEffect(() => {
    const hasUnsavedWork = hasDirtyForms || pendingCount > 0;

    if (!hasUnsavedWork) {
      return; // No protection needed
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Debug log for troubleshooting
      console.log('[BeforeUnloadGuard] Preventing unload:', {
        dirtyForms: dirtyFormIds,
        pendingMutations: pendingCount,
      });

      // Standard way to trigger the browser's confirmation dialog
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasDirtyForms, dirtyFormIds, pendingCount]);
}

/**
 * Hook to get current unsaved work status
 * Useful for displaying warnings in UI
 */
export function useUnsavedWorkStatus() {
  const { hasDirtyForms, dirtyFormIds } = useFormDirty();
  const { pendingCount } = usePendingSync();

  return {
    hasUnsavedWork: hasDirtyForms || pendingCount > 0,
    dirtyForms: dirtyFormIds,
    pendingMutations: pendingCount,
  };
}
