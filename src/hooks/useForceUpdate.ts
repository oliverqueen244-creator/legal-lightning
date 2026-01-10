import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LOCAL_STORAGE_KEY = 'nyayhub_force_update_version';

interface ForceUpdateConfig {
  version: number;
  reason: string;
  triggered_by: string | null;
  triggered_at: string | null;
}

/**
 * PWA Force Update Kill Switch
 * 
 * Checks server-side version and forces a complete cache clear + reload
 * when the server version is higher than the locally stored version.
 * 
 * This allows admins to remotely force all installed PWAs to update.
 */
export function useForceUpdate() {
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only run once per app session
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkForForceUpdate = async () => {
      try {
        // Get local version (default to 0 if not set)
        const localVersionStr = localStorage.getItem(LOCAL_STORAGE_KEY);
        const localVersion = localVersionStr ? parseInt(localVersionStr, 10) : 0;

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

        console.log(`[ForceUpdate] Local: ${localVersion}, Server: ${serverVersion}`);

        // If server version is higher, force update
        if (serverVersion > localVersion) {
          console.log(`[ForceUpdate] Version mismatch detected. Reason: ${config?.reason}`);
          
          // Show toast before clearing
          toast.info('Updating to latest version...', {
            duration: 2000,
          });

          // Wait a moment for toast to show
          await new Promise(resolve => setTimeout(resolve, 500));

          // Perform full cache clear
          await performFullCacheClear();

          // Update local version BEFORE reload to prevent loop
          localStorage.setItem(LOCAL_STORAGE_KEY, serverVersion.toString());

          // Force reload with cache bypass
          window.location.reload();
        }
      } catch (err) {
        console.error('[ForceUpdate] Error during version check:', err);
        // Don't block app on error - just log and continue
      }
    };

    // Run check after a short delay to not block initial render
    const timeoutId = setTimeout(checkForForceUpdate, 1000);

    return () => clearTimeout(timeoutId);
  }, []);
}

/**
 * Clears all caches: Service Worker, IndexedDB, and Cache API
 */
async function performFullCacheClear(): Promise<void> {
  console.log('[ForceUpdate] Starting full cache clear...');

  // 1. Clear Cache Storage (Service Worker caches)
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[ForceUpdate] Cache Storage cleared');
    } catch (err) {
      console.warn('[ForceUpdate] Failed to clear Cache Storage:', err);
    }
  }

  // 2. Clear IndexedDB databases
  if ('indexedDB' in window && 'databases' in indexedDB) {
    try {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map(db => {
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
      console.log('[ForceUpdate] IndexedDB cleared');
    } catch (err) {
      console.warn('[ForceUpdate] Failed to clear IndexedDB:', err);
    }
  }

  // 3. Unregister all Service Workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('[ForceUpdate] Service Workers unregistered');
    } catch (err) {
      console.warn('[ForceUpdate] Failed to unregister Service Workers:', err);
    }
  }

  // 4. Clear localStorage except for the version key (to prevent loop)
  // We'll keep the version key and clear it after setting the new version
  const keysToKeep = [LOCAL_STORAGE_KEY];
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !keysToKeep.includes(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log('[ForceUpdate] localStorage cleared (except version key)');

  console.log('[ForceUpdate] Full cache clear complete');
}
