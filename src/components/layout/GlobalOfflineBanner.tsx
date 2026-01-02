import { WifiOff, CloudOff, AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePendingSync } from '@/hooks/usePendingSync';
import { cn } from '@/lib/utils';

/**
 * COURT-SAFETY FIX #3: Enhanced Global Offline Banner
 * 
 * HARDENING FIX: Appears at top of app layout when offline.
 * Cannot be dismissed. Present on all routes.
 * Uses precise, non-absolute language about offline capabilities.
 * 
 * MOBILE-FIRST: Prominent, can't be missed, lists blocked features.
 */

// Features that are blocked when offline
const BLOCKED_FEATURES = [
  'Sending messages',
  'Uploading documents', 
  'WhatsApp escalations',
  'Case updates',
];

export function GlobalOfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const { pendingCount } = usePendingSync();
  const [showExpanded, setShowExpanded] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  // Show "Back online" message briefly when reconnecting
  useEffect(() => {
    if (isOnline && pendingCount === 0) {
      // Check if we were previously offline
      const wasOffline = sessionStorage.getItem('vakalat_was_offline');
      if (wasOffline === 'true') {
        setJustReconnected(true);
        sessionStorage.removeItem('vakalat_was_offline');
        const timeout = setTimeout(() => setJustReconnected(false), 3000);
        return () => clearTimeout(timeout);
      }
    }
    if (!isOnline) {
      sessionStorage.setItem('vakalat_was_offline', 'true');
    }
  }, [isOnline, pendingCount]);

  // Show pending changes indicator even when online
  if (isOnline && pendingCount > 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-court-warning/90 text-foreground px-4 py-2.5 text-center text-sm font-medium flex items-center justify-center gap-2 z-[100]"
      >
        <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{pendingCount} pending change{pendingCount !== 1 ? 's' : ''} syncing...</span>
      </div>
    );
  }

  // Show brief "Back online" confirmation
  if (justReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-green-600/90 text-white px-4 py-2.5 text-center text-sm font-medium flex items-center justify-center gap-2 z-[100] animate-in slide-in-from-top-2"
      >
        <span>✓ Back online — all features available</span>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'bg-destructive text-destructive-foreground z-[100] transition-all duration-200',
        showExpanded ? 'py-4' : 'py-2.5'
      )}
    >
      {/* Primary banner - always visible */}
      <div className="px-4 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold">
          <WifiOff className="h-4 w-4 shrink-0 animate-pulse" aria-hidden="true" />
          <span>
            Working Offline — Some features unavailable
          </span>
          <button
            onClick={() => setShowExpanded(!showExpanded)}
            className="ml-2 text-xs underline opacity-80 hover:opacity-100"
            aria-expanded={showExpanded}
          >
            {showExpanded ? 'Hide details' : 'What works?'}
          </button>
        </div>
        
        {/* Pending count */}
        {pendingCount > 0 && (
          <p className="text-xs mt-1 opacity-90">
            {pendingCount} change{pendingCount !== 1 ? 's' : ''} saved locally, will sync when online
          </p>
        )}
      </div>

      {/* Expanded details - shows blocked features */}
      {showExpanded && (
        <div className="mt-3 px-4 animate-in slide-in-from-top-2 duration-200">
          <div className="max-w-md mx-auto bg-black/20 rounded-lg p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium">Blocked while offline:</p>
                <ul className="space-y-1 list-disc list-inside opacity-90">
                  {BLOCKED_FEATURES.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <p className="pt-1 border-t border-white/20 text-green-200">
                  ✓ Viewing cases and documents is still available
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
