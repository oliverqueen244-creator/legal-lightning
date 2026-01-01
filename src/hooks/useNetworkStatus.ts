import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

/**
 * DEBOUNCE THRESHOLD for network status changes.
 * Prevents flapping toasts when connection is unstable.
 * HARDENING: ≥3 seconds as per court-day hardening requirements.
 */
const NETWORK_DEBOUNCE_MS = 3000;

/**
 * Central hook for network status tracking with blocking toast support.
 * Used across the app to guard offline write actions.
 * 
 * HARDENING: Debounces online/offline changes to prevent flapping.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      // Clear any pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Debounce: only confirm online after stable for 3+ seconds
      debounceTimerRef.current = setTimeout(() => {
        if (navigator.onLine && !lastStatusRef.current) {
          lastStatusRef.current = true;
          setIsOnline(true);
          toast.success('Back online', {
            description: 'Connection restored. You can now send messages and make changes.',
            duration: 3000,
          });
        }
      }, NETWORK_DEBOUNCE_MS);
    };
    
    const handleOffline = () => {
      // Clear any pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Debounce: only confirm offline after stable for 3+ seconds
      debounceTimerRef.current = setTimeout(() => {
        if (!navigator.onLine && lastStatusRef.current) {
          lastStatusRef.current = false;
          setIsOnline(false);
          toast.warning('You are offline', {
            description: 'Some features require internet connection.',
            duration: 5000,
          });
        }
      }, NETWORK_DEBOUNCE_MS);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Blocks an action if offline. Shows a blocking toast.
   * Returns true if action should be blocked (offline).
   * 
   * HARDENING FIX: Uses precise language about offline capabilities.
   */
  const blockIfOffline = useCallback((actionName?: string): boolean => {
    if (!navigator.onLine) {
      toast.error('Connection required for this action', {
        description: actionName 
          ? `Cannot ${actionName} while offline. Viewing is available.`
          : 'This action requires a connection. Viewing is available.',
        duration: 4000,
      });
      return true;
    }
    return false;
  }, []);

  return {
    isOnline,
    blockIfOffline,
  };
}
