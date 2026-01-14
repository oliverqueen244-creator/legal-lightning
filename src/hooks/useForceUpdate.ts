import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePWAUpdateSafety } from './usePWAUpdateSafety';
import { usePendingSync } from './usePendingSync';
import { useNetworkStatus } from './useNetworkStatus';

const LOCAL_STORAGE_KEY = 'nyayhub_force_update_version';
const DEFERRED_UPDATE_KEY = 'nyayhub_deferred_force_update';

/**
 * SAFE PWA AUTO-UPDATE — FORCE UPDATE WITH DATA PROTECTION
 * 
 * COURT-CRITICAL: Force updates now respect data integrity.
 * 
 * Rules:
 * 1. Check safety conditions before proceeding
 * 2. Attempt to sync pending mutations before clearing
 * 3. NEVER delete IndexedDB databases with pending mutations
 * 4. If unsafe, defer update and retry on next app load
 * 
 * Data integrity > Freshness. Always.
 */

interface ForceUpdateConfig {
  version: number;
  reason: string;
  triggered_by: string | null;
  triggered_at: string | null;
}

interface DeferredUpdate {
  version: number;
  reason: string;
  deferredAt: string;
}

export function useForceUpdate() {
  const hasChecked = useRef(false);
  const { isSafeToReload, blockingReasons } = usePWAUpdateSafety();
  const { pendingCount, syncPendingMutations, isSyncing } = usePendingSync();
  const { isOnline } = useNetworkStatus();
  
  // Track if we're showing the blocked dialog
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedConfig, setBlockedConfig] = useState<ForceUpdateConfig | null>(null);

  useEffect(() => {
    // Only run once per app session
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkForForceUpdate = async () => {
      try {
        // Get local version (default to 0 if not set)
        const localVersionStr = localStorage.getItem(LOCAL_STORAGE_KEY);
        const localVersion = localVersionStr ? parseInt(localVersionStr, 10) : 0;

        // Check for deferred update first
        const deferredStr = localStorage.getItem(DEFERRED_UPDATE_KEY);
        let deferredUpdate: DeferredUpdate | null = null;
        if (deferredStr) {
          try {
            deferredUpdate = JSON.parse(deferredStr);
          } catch {
            localStorage.removeItem(DEFERRED_UPDATE_KEY);
          }
        }

        // Fetch server version from app_config
        const { data, error } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'force_update_version')
          .single();

        if (error) {
          console.warn('[ForceUpdate] Failed to fetch version:', error.message);
          return;
        }

        const config = data?.value as unknown as ForceUpdateConfig;
        const serverVersion = config?.version ?? 0;

        console.log(`[ForceUpdate] Local: ${localVersion}, Server: ${serverVersion}, Pending: ${pendingCount}`);

        // If server version is higher OR we have a deferred update, attempt update
        const needsUpdate = serverVersion > localVersion || 
          (deferredUpdate && deferredUpdate.version > localVersion);

        if (!needsUpdate) {
          // Clear any stale deferred update
          if (deferredUpdate) {
            localStorage.removeItem(DEFERRED_UPDATE_KEY);
          }
          return;
        }

        const updateVersion = serverVersion > localVersion ? serverVersion : deferredUpdate!.version;
        const updateReason = serverVersion > localVersion ? config?.reason : deferredUpdate!.reason;

        console.log(`[ForceUpdate] Update required. Reason: ${updateReason}`);

        // SAFETY CHECK: Can we safely update?
        if (!isSafeToReload) {
          console.log('[ForceUpdate] ⚠️ Unsafe to update:', blockingReasons);
          
          // Store deferred update for next session
          const deferred: DeferredUpdate = {
            version: updateVersion,
            reason: updateReason || 'System update',
            deferredAt: new Date().toISOString(),
          };
          localStorage.setItem(DEFERRED_UPDATE_KEY, JSON.stringify(deferred));
          
          // Show blocking info to user
          setBlockedConfig({
            version: updateVersion,
            reason: updateReason || 'System update',
            triggered_by: config?.triggered_by || null,
            triggered_at: config?.triggered_at || null,
          });
          setIsBlocked(true);
          
          toast.warning('Update deferred', {
            description: 'Your work is protected. Update will apply when safe.',
            duration: 5000,
          });
          
          return;
        }

        // SYNC ATTEMPT: If online and has pending mutations, try to sync first
        if (isOnline && pendingCount > 0) {
          console.log(`[ForceUpdate] Syncing ${pendingCount} pending mutations before update...`);
          toast.info('Syncing your data before update...', { duration: 2000 });
          
          try {
            await syncPendingMutations();
            console.log('[ForceUpdate] Sync completed successfully');
          } catch (syncError) {
            console.error('[ForceUpdate] Sync failed:', syncError);
            // If sync fails, defer the update
            const deferred: DeferredUpdate = {
              version: updateVersion,
              reason: updateReason || 'System update',
              deferredAt: new Date().toISOString(),
            };
            localStorage.setItem(DEFERRED_UPDATE_KEY, JSON.stringify(deferred));
            
            toast.error('Update deferred', {
              description: 'Failed to sync data. Will retry next time.',
              duration: 5000,
            });
            return;
          }
        }

        // PROCEED WITH UPDATE
        console.log(`[ForceUpdate] ✓ Safe to update. Proceeding...`);
        toast.info('Updating to latest version...', { duration: 2000 });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Perform cache clear (preserving critical data)
        await performSafeCacheClear();

        // Update local version BEFORE reload to prevent loop
        localStorage.setItem(LOCAL_STORAGE_KEY, updateVersion.toString());
        
        // Clear deferred update flag
        localStorage.removeItem(DEFERRED_UPDATE_KEY);

        // Force reload with cache bypass
        window.location.reload();
      } catch (err) {
        console.error('[ForceUpdate] Error during version check:', err);
      }
    };

    // Run check after a short delay to not block initial render
    const timeoutId = setTimeout(checkForForceUpdate, 1000);

    return () => clearTimeout(timeoutId);
  }, [isSafeToReload, blockingReasons, pendingCount, syncPendingMutations, isOnline]);

  return { isBlocked, blockedConfig, setIsBlocked };
}

/**
 * SAFE Cache Clear — Preserves critical user data
 * 
 * CRITICAL: Never delete databases that may contain user data:
 * - vakalat-os-cache: Contains pending offline mutations
 * - nyayhub-query-cache: Contains React Query cached data
 * 
 * We ONLY clear:
 * - Service Worker caches (static assets)
 * - localStorage (except critical keys)
 */
async function performSafeCacheClear(): Promise<void> {
  console.log('[ForceUpdate] Starting SAFE cache clear (preserving user data)...');

  // List of IndexedDB databases to PRESERVE (never delete)
  const PROTECTED_DATABASES = [
    'vakalat-os-cache',      // Pending mutations, offline queue
    'nyayhub-query-cache',   // React Query cache
    'VakalatDB',             // Main offline cache
  ];

  // 1. Clear Cache Storage (Service Worker caches) - safe to clear
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[ForceUpdate] ✓ Cache Storage cleared');
    } catch (err) {
      console.warn('[ForceUpdate] Failed to clear Cache Storage:', err);
    }
  }

  // 2. Clear ONLY non-critical IndexedDB databases
  if ('indexedDB' in window && 'databases' in indexedDB) {
    try {
      const databases = await indexedDB.databases();
      const toDelete = databases.filter(db => 
        db.name && !PROTECTED_DATABASES.some(protectedDb => 
          db.name!.toLowerCase().includes(protectedDb.toLowerCase())
        )
      );
      
      console.log('[ForceUpdate] IndexedDB databases:', {
        total: databases.map(d => d.name),
        preserving: PROTECTED_DATABASES,
        toDelete: toDelete.map(d => d.name),
      });

      await Promise.all(
        toDelete.map(db => {
          if (db.name) {
            return new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(db.name!);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            });
          }
          return Promise.resolve();
        })
      );
      console.log('[ForceUpdate] ✓ Non-critical IndexedDB cleared (preserved user data)');
    } catch (err) {
      console.warn('[ForceUpdate] Failed to clear IndexedDB:', err);
    }
  }

  // 3. Unregister all Service Workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('[ForceUpdate] ✓ Service Workers unregistered');
    } catch (err) {
      console.warn('[ForceUpdate] Failed to unregister Service Workers:', err);
    }
  }

  // 4. Clear localStorage except for critical keys
  const keysToKeep = [
    LOCAL_STORAGE_KEY,
    DEFERRED_UPDATE_KEY,
    'supabase.auth.token', // Preserve auth session
    'sb-',                 // Supabase keys prefix
  ];
  
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !keysToKeep.some(keep => key.startsWith(keep) || key === keep)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log('[ForceUpdate] ✓ localStorage cleared (preserved auth & version keys)');

  console.log('[ForceUpdate] SAFE cache clear complete — user data preserved');
}

/**
 * Export for manual testing/admin use
 */
export async function triggerSafeCacheClear() {
  await performSafeCacheClear();
}
