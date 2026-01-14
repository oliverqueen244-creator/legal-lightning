import { useState, useEffect } from 'react';
import { RefreshCw, Wifi, WifiOff, AlertTriangle, Clock } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { cn } from '@/lib/utils';

/**
 * COURT-SAFETY FIX #1: Data Freshness Indicator
 * 
 * Shows how old the data is with color-coded status:
 * - Green: Live/recent (< 60s)
 * - Yellow: Stale warning (60s - 5min)
 * - Red: Very stale or offline (> 5min)
 * 
 * This prevents lawyers from acting on stale information in court.
 */

interface FreshnessIndicatorProps {
  lastUpdated: Date | string | null | undefined;
  onRefresh?: () => void;
  isRefetching?: boolean;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

type FreshnessStatus = 'live' | 'recent' | 'stale' | 'very-stale' | 'offline' | 'unknown';

function getSecondsSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 1000);
}

function getFreshnessStatus(seconds: number | null, isOnline: boolean): FreshnessStatus {
  if (!isOnline) return 'offline';
  if (seconds === null) return 'unknown';
  // P1-4: Standardized thresholds - Live ≤30s, Recent ≤5min, Stale >5min
  if (seconds <= 30) return 'live';
  if (seconds <= 300) return 'recent';
  if (seconds <= 600) return 'stale';
  return 'very-stale';
}

function formatTimeSince(seconds: number | null): string {
  if (seconds === null) return 'Unknown';
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function FreshnessIndicator({
  lastUpdated,
  onRefresh,
  isRefetching = false,
  className,
  showLabel = true,
  size = 'sm',
}: FreshnessIndicatorProps) {
  const { isOnline } = useNetworkStatus();
  const [secondsSince, setSecondsSince] = useState<number | null>(() => 
    getSecondsSince(lastUpdated)
  );

  // Update every second for accuracy
  useEffect(() => {
    setSecondsSince(getSecondsSince(lastUpdated));
    const interval = setInterval(() => {
      setSecondsSince(getSecondsSince(lastUpdated));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const status = getFreshnessStatus(secondsSince, isOnline);

  // DECLUTTER: Only primary "Connected" stays visually prominent (green)
  // All other freshness indicators: reduced opacity, no pill styling, smaller font, neutral color
  const statusConfig: Record<FreshnessStatus, {
    icon: typeof Wifi;
    color: string;
    bgColor: string;
    dotColor: string;
    label: string;
    isPrimary: boolean;
  }> = {
    live: {
      icon: Wifi,
      color: 'text-court-success',
      bgColor: 'bg-court-success/10',
      dotColor: 'bg-court-success',
      label: 'Connected',  // P1-1: "Live" → "Connected" to avoid implying real-time guarantee
      isPrimary: true,
    },
    recent: {
      icon: Clock,
      color: 'text-muted-foreground',
      bgColor: 'bg-transparent',
      dotColor: 'bg-muted-foreground/50',
      label: 'Updated',
      isPrimary: false,
    },
    stale: {
      icon: AlertTriangle,
      color: 'text-muted-foreground',
      bgColor: 'bg-transparent',
      dotColor: 'bg-yellow-500/50',
      label: 'Stale',
      isPrimary: false,
    },
    'very-stale': {
      icon: AlertTriangle,
      color: 'text-destructive/70',
      bgColor: 'bg-transparent',
      dotColor: 'bg-destructive/50',
      label: 'Very stale',
      isPrimary: false,
    },
    offline: {
      icon: WifiOff,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      dotColor: 'bg-destructive',
      label: 'Offline',
      isPrimary: true, // Keep offline prominent as it's critical
    },
    unknown: {
      icon: Clock,
      color: 'text-muted-foreground/60',
      bgColor: 'bg-transparent',
      dotColor: 'bg-muted-foreground/30',
      label: '',
      isPrimary: false,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';

  // DECLUTTER: Non-primary indicators are smaller and less visually prominent
  const effectiveSizeClasses = config.isPrimary 
    ? sizeClasses 
    : 'text-[10px] px-1.5 py-0.5';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Data freshness: ${config.label}, ${formatTimeSince(secondsSince)}`}
      className={cn(
        'inline-flex items-center gap-1 transition-colors',
        config.isPrimary ? 'rounded-full font-medium' : 'rounded font-normal opacity-80',
        config.bgColor,
        config.color,
        effectiveSizeClasses,
        className
      )}
    >
      {/* Pulsing dot for live status only */}
      {config.isPrimary && (
        <span className={cn(
          'rounded-full shrink-0',
          dotSize,
          config.dotColor,
          status === 'live' && 'animate-pulse'
        )} />
      )}
      
      {showLabel && config.label && (
        <span className="shrink-0">{config.label}</span>
      )}
      
      {/* DECLUTTER: Removed separator for non-primary states */}
      {config.isPrimary && showLabel && <span className="opacity-50">|</span>}
      
      <span className={cn(!config.isPrimary && 'opacity-70')}>{formatTimeSince(secondsSince)}</span>
      
      {onRefresh && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          disabled={isRefetching || !isOnline}
          className={cn(
            'ml-0.5 p-0.5 rounded hover:bg-white/10 transition-colors',
            (isRefetching || !isOnline) && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Refresh data"
        >
          <RefreshCw className={cn(iconSize, isRefetching && 'animate-spin')} />
        </button>
      )}
    </div>
  );
}
