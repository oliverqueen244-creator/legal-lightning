import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * Global Offline Banner - Single source of truth for offline state
 * 
 * HARDENING FIX: Appears at top of app layout when offline.
 * Cannot be dismissed. Present on all routes.
 * Uses precise, non-absolute language about offline capabilities.
 */
export function GlobalOfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-destructive/90 text-destructive-foreground px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 z-[100]"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Offline mode — some features are unavailable.</span>
    </div>
  );
}
