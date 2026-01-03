import { useEffect, useRef, useCallback, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { usePWAUpdateSafety } from './usePWAUpdateSafety';
import { useNetworkStatus } from './useNetworkStatus';
import { toast } from 'sonner';

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
  
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  const updatePendingRef = useRef(false);
  const lastCheckRef = useRef<number>(0);

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
      console.log('[PWA] Update available');
      setUpdateAvailable(true);
      updatePendingRef.current = true;
    }
  }, [needRefresh]);

  // Attempt to apply update when conditions change
  useEffect(() => {
    if (!updatePendingRef.current || !needRefresh) return;

    // RULE 1: If app is hidden AND safe → Silent reload
    if (!isVisible && isSafeToReload) {
      console.log('[PWA] Conditions met for silent reload - applying update');
      updateServiceWorker(true);
      return;
    }

    // RULE 2: If app is visible AND safe → We'll apply on next visibility change
    // This is handled by the visibility effect below

    // RULE 3: If not safe → Show toast (but only once)
    if (!isSafeToReload && isVisible) {
      // Don't spam toasts - only show when update first detected
      if (updatePendingRef.current) {
        toast.info('Update ready', {
          description: 'Will apply when safe. Your work is protected.',
          duration: 5000,
        });
      }
    }
  }, [needRefresh, isVisible, isSafeToReload, updateServiceWorker]);

  // Apply update when app becomes hidden (if safe)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'hidden' &&
        updatePendingRef.current &&
        needRefresh
      ) {
        // Re-check safety at the moment of visibility change
        // Note: We can't use isSafeToReload directly here because it includes visibility check
        // We need to check other conditions only
        console.log('[PWA] App hidden - checking if update can be applied');
        // The useEffect above will handle this when isVisible changes
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    
    // Small delay to show the toast
    setTimeout(() => {
      updateServiceWorker(true);
    }, 500);
    
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
