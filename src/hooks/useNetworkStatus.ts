import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Central hook for network status tracking with blocking toast support.
 * Used across the app to guard offline write actions.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online', {
        description: 'Connection restored. You can now send messages and make changes.',
        duration: 3000,
      });
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline', {
        description: 'Some features require internet connection.',
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Blocks an action if offline. Shows a blocking toast.
   * Returns true if action should be blocked (offline).
   */
  const blockIfOffline = useCallback((actionName?: string): boolean => {
    if (!navigator.onLine) {
      toast.error('Internet connection required', {
        description: actionName 
          ? `Cannot ${actionName} while offline.`
          : 'This action requires an internet connection.',
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
