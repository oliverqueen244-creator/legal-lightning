import { useState, useEffect } from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * COURT-SAFETY FIX #2: Pull-to-Refresh Hint
 * 
 * Makes pull-to-refresh obvious with:
 * - First-time tooltip on app load
 * - Visual indicator when content is stale
 * - Persists hint dismissal in localStorage
 */

interface PullToRefreshHintProps {
  onRefresh: () => void;
  isRefetching?: boolean;
  showPersistentHint?: boolean;
  className?: string;
}

const HINT_STORAGE_KEY = 'vakalat_pull_refresh_hint_seen';

export function PullToRefreshHint({
  onRefresh,
  isRefetching = false,
  showPersistentHint = false,
  className,
}: PullToRefreshHintProps) {
  const [showHint, setShowHint] = useState(false);
  const [hasSeenHint, setHasSeenHint] = useState(true); // Default true to prevent flash

  useEffect(() => {
    const seen = localStorage.getItem(HINT_STORAGE_KEY);
    if (!seen) {
      setHasSeenHint(false);
      setShowHint(true);
      // Auto-dismiss after 5 seconds but remember for future
      const timeout = setTimeout(() => {
        setShowHint(false);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleDismiss = () => {
    setShowHint(false);
    setHasSeenHint(true);
    localStorage.setItem(HINT_STORAGE_KEY, 'true');
  };

  const handleRefresh = () => {
    handleDismiss();
    onRefresh();
  };

  // Show hint if: first time user OR content is stale and persistent hint enabled
  const shouldShow = showHint || (showPersistentHint && !isRefetching);

  if (!shouldShow) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 py-3 px-4 bg-primary/10 border-b border-primary/20',
        'text-sm text-primary animate-in slide-in-from-top-2 duration-300',
        className
      )}
    >
      {!hasSeenHint ? (
        // First-time hint
        <>
          <ArrowDown className="h-4 w-4 animate-bounce" />
          <span className="font-medium">Pull down to refresh for latest data</span>
          <button
            onClick={handleDismiss}
            className="ml-2 text-xs underline opacity-70 hover:opacity-100"
          >
            Got it
          </button>
        </>
      ) : (
        // Stale content hint
        <>
          <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
          <span>Data may be outdated</span>
          <button
            onClick={handleRefresh}
            disabled={isRefetching}
            className="ml-2 font-medium underline hover:no-underline"
          >
            Tap to refresh
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Inline refresh button for screens without pull-to-refresh
 */
interface RefreshButtonProps {
  onRefresh: () => void;
  isRefetching?: boolean;
  label?: string;
  className?: string;
}

export function RefreshButton({
  onRefresh,
  isRefetching = false,
  label = 'Refresh',
  className,
}: RefreshButtonProps) {
  return (
    <button
      onClick={onRefresh}
      disabled={isRefetching}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium',
        'rounded-lg border border-border bg-background/50',
        'hover:bg-secondary transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      <RefreshCw className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
      {label}
    </button>
  );
}
