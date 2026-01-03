import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { usePendingSync } from './usePendingSync';
import { useSyncConflict } from '@/contexts/SyncConflictContext';
import { useCourtMode } from './useCourtMode';
import { useFormDirty } from '@/contexts/FormDirtyContext';

/**
 * SAFE PWA AUTO-UPDATE — PHASE 1: UPDATE SAFETY EVALUATOR
 * 
 * COURT-CRITICAL: This hook determines if it's safe to reload the PWA.
 * Violating ANY safety check is a HARD NO for reload.
 * 
 * In a courtroom product, freshness is optional.
 * Data integrity and user trust are mandatory.
 */

export interface UpdateSafetyState {
  /** True only if ALL safety conditions are met (excludes visibility) */
  isSafeToReload: boolean;
  /** Human-readable reasons why reload is blocked */
  blockingReasons: string[];
  /** Whether the app is currently visible to the user */
  isVisible: boolean;
}

interface SafetyCheck {
  name: string;
  reason: string;
  isSafe: boolean;
}

export function usePWAUpdateSafety(): UpdateSafetyState {
  const { isOnline } = useNetworkStatus();
  const { pendingCount, isSyncing } = usePendingSync();
  const { hasActiveConflict } = useSyncConflict();
  const { settings: courtModeSettings } = useCourtMode();
  const { hasDirtyForms } = useFormDirty();
  
  const [isVisible, setIsVisible] = useState(
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );

  // Track visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsVisible(visible);
      console.log('[PWA Safety] Visibility changed:', visible ? 'visible' : 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Memoize safety checks to avoid recalculating on every render
  const safetyState = useMemo((): UpdateSafetyState => {
    // Safety checks that must ALL pass (excluding visibility - handled separately)
    const checks: SafetyCheck[] = [
      {
        name: 'pending_mutations',
        reason: 'Pending offline data waiting to sync',
        isSafe: pendingCount === 0,
      },
      {
        name: 'active_sync',
        reason: 'Sync operation in progress',
        isSafe: !isSyncing,
      },
      {
        name: 'dirty_forms',
        reason: 'Unsaved form data',
        isSafe: !hasDirtyForms,
      },
      {
        name: 'conflict_dialog',
        reason: 'Conflict resolution in progress',
        isSafe: !hasActiveConflict,
      },
      {
        name: 'connectivity',
        reason: 'Device is offline',
        isSafe: isOnline,
      },
      {
        name: 'court_mode',
        reason: 'Court Mode is active',
        isSafe: !courtModeSettings?.court_mode_enabled,
      },
    ];

    const failingChecks = checks.filter(check => !check.isSafe);
    const blockingReasons = failingChecks.map(check => check.reason);
    const isSafeToReload = failingChecks.length === 0;

    // Debug logging for testing
    if (failingChecks.length > 0) {
      console.log('[PWA Safety] Blocking reasons:', blockingReasons);
    } else {
      console.log('[PWA Safety] All safety checks passed, isVisible:', isVisible);
    }

    return {
      isSafeToReload,
      blockingReasons,
      isVisible,
    };
  }, [
    pendingCount,
    isSyncing,
    hasDirtyForms,
    hasActiveConflict,
    isOnline,
    courtModeSettings?.court_mode_enabled,
    isVisible,
  ]);

  return safetyState;
}
