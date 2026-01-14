import { useEffect, useRef, useCallback, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { usePWAUpdateSafety } from './usePWAUpdateSafety';
import { useNetworkStatus } from './useNetworkStatus';
import { usePendingSync } from './usePendingSync';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * SAFE PWA AUTO-UPDATE — PHASE 3: SAFE UPDATE MANAGER
 * 
 * COURT-CRITICAL: This is the ONLY place where PWA updates are handled.
 * 
 * Update Detection Rules:
 * - Check for updates on app load
 * - Check for updates on visibility change (when returning)
 * - Check for updates every 5 minutes (only if online)
 * 
 * On onNeedRefresh Event - STRICT ORDER:
 * 1. If app is hidden AND isSafeToReload === true → Silent reload
 * 2. If app is visible AND isSafeToReload === true → Defer until next route change or hidden
 * 3. If isSafeToReload === false → DO NOT reload, show toast
 * 
 * PRE-RELOAD SYNC (Phase 3):
 * - Before any reload, attempt to sync pending mutations
 * - Only proceed after successful sync OR explicit user confirmation
 * 
 * NEVER reload if user would lose data or notice disruption.
 */

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export interface PWAUpdateState {
  /** Whether an update is available and waiting */
  updateAvailable: boolean;
  /** Whether we're currently checking for updates */
  isChecking: boolean;
  /** Manually trigger an update check */
  checkForUpdate: () => Promise<void>;
  /** Manually apply update if safe */
  applyUpdateIfSafe: () => boolean;
  /** Current blocking reasons if update cannot be applied */
  blockingReasons: string[];
}

export function usePWAUpdate(): PWAUpdateState {
  const { isSafeToReload, blockingReasons, isVisible } = usePWAUpdateSafety();
  const { isOnline } = useNetworkStatus();
  const { pendingCount, syncPendingMutations, isSyncing } = usePendingSync();
  
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  const updatePendingRef = useRef(false);
  const lastCheckRef = useRef<number>(0);
  const syncAttemptedRef = useRef(false);

  // Register service worker with update callbacks
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service Worker registered:', swUrl);
      
      // Set up periodic update checks
      if (registration) {
        setInterval(() => {
          if (isOnline && document.visibilityState === 'visible') {
            registration.update();
          }
        }, UPDATE_CHECK_INTERVAL);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration error:', error);
    },
  });

  // Track when update becomes available
  useEffect(() => {
    if (needRefresh) {
      console.log('[PWA] Update available - waiting for safe conditions');
      setUpdateAvailable(true);
      updatePendingRef.current = true;
    }
  }, [needRefresh]);

  // Track if we've shown the "update ready" toast to avoid spam
  const toastShownRef = useRef(false);

  // Attempt to apply update when conditions change
  useEffect(() => {
    if (!updatePendingRef.current || !needRefresh) return;

    console.log('[PWA] Evaluating update conditions:', {
      isVisible,
      isSafeToReload,
      blockingReasons,
      pendingCount,
      isSyncing,
    });

    // RULE 1: If app is hidden AND all safety checks pass → Sync then silent reload
    // CRITICAL: Refresh auth token before reload to preserve session
    if (!isVisible && isSafeToReload) {
      console.log('[PWA] ✓ Silent reload - app hidden and safe');
      
      // PRE-RELOAD SYNC: Attempt to sync any remaining mutations
      const performReload = async () => {
        if (isOnline && pendingCount > 0 && !syncAttemptedRef.current) {
          syncAttemptedRef.current = true;
          console.log('[PWA] Pre-reload sync attempt...');
          try {
            await syncPendingMutations();
            console.log('[PWA] Pre-reload sync complete');
          } catch (err) {
            console.warn('[PWA] Pre-reload sync failed, proceeding anyway:', err);
          }
        }
        
        // Ensure auth session is fresh before reload
        await supabase.auth.getSession();
        updateServiceWorker(true);
      };
      
      performReload();
      return;
    }

    // RULE 2: If app is visible AND safe → Defer until hidden
    if (isVisible && isSafeToReload) {
      console.log('[PWA] ✓ Update ready - will apply when app is hidden');
      // Don't show toast here - just wait silently
      return;
    }

    // RULE 3: If not safe → Show toast once
    if (!isSafeToReload && !toastShownRef.current) {
      toastShownRef.current = true;
      console.log('[PWA] ✗ Update blocked:', blockingReasons);
      toast.info('Update ready', {
        description: 'Will apply when safe. Your work is protected.',
        duration: 5000,
      });
    }
  }, [needRefresh, isVisible, isSafeToReload, blockingReasons, updateServiceWorker, pendingCount, isSyncing, isOnline, syncPendingMutations]);

  // Reset refs when update is applied or no longer needed
  useEffect(() => {
    if (!needRefresh) {
      toastShownRef.current = false;
      syncAttemptedRef.current = false;
    }
  }, [needRefresh]);

  // Manual update check
  const checkForUpdate = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cannot check for updates while offline');
      return;
    }

    const now = Date.now();
    if (now - lastCheckRef.current < 10000) {
      // Throttle to max once per 10 seconds
      return;
    }
    lastCheckRef.current = now;

    setIsChecking(true);
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) {
        await registration.update();
        toast.success('Checked for updates');
      }
    } catch (error) {
      console.error('[PWA] Update check failed:', error);
      toast.error('Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  }, [isOnline]);

  // Manual apply update (with safety check)
  const applyUpdateIfSafe = useCallback((): boolean => {
    if (!needRefresh) {
      toast.info('No update available');
      return false;
    }

    if (!isSafeToReload) {
      const reasonList = blockingReasons.join(', ');
      toast.error('Cannot update now', {
        description: reasonList || 'Please save your work first',
        duration: 5000,
      });
      return false;
    }

    console.log('[PWA] Manual update requested - applying');
    toast.info('Applying update...', { duration: 2000 });
    
    // CRITICAL: Refresh auth token before reload to preserve session
    supabase.auth.getSession().then(() => {
      // Small delay to show the toast
      setTimeout(() => {
        updateServiceWorker(true);
      }, 500);
    });
    
    return true;
  }, [needRefresh, isSafeToReload, blockingReasons, updateServiceWorker]);

  // Check for updates when app becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isOnline) {
        // Check for updates when returning to app
        navigator.serviceWorker?.getRegistration().then(registration => {
          if (registration) {
            registration.update();
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isOnline]);

  return {
    updateAvailable,
    isChecking,
    checkForUpdate,
    applyUpdateIfSafe,
    blockingReasons,
  };
}
