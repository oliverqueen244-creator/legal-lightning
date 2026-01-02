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
  if (seconds < 60) return 'live';
  if (seconds < 300) return 'recent';
  if (seconds < 600) return 'stale';
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

  const statusConfig: Record<FreshnessStatus, {
    icon: typeof Wifi;
    color: string;
    bgColor: string;
    dotColor: string;
    label: string;
  }> = {
    live: {
      icon: Wifi,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      dotColor: 'bg-green-500',
      label: 'Live',
    },
    recent: {
      icon: Clock,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      dotColor: 'bg-green-400',
      label: 'Updated',
    },
    stale: {
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      dotColor: 'bg-yellow-500',
      label: 'Stale',
    },
    'very-stale': {
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      dotColor: 'bg-destructive',
      label: 'Very stale',
    },
    offline: {
      icon: WifiOff,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      dotColor: 'bg-destructive',
      label: 'Offline',
    },
    unknown: {
      icon: Clock,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      dotColor: 'bg-muted-foreground',
      label: 'Unknown',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Data freshness: ${config.label}, ${formatTimeSince(secondsSince)}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors',
        config.bgColor,
        config.color,
        sizeClasses,
        className
      )}
    >
      {/* Pulsing dot for live status */}
      <span className={cn(
        'rounded-full shrink-0',
        dotSize,
        config.dotColor,
        status === 'live' && 'animate-pulse'
      )} />
      
      {showLabel && (
        <span className="shrink-0">{config.label}</span>
      )}
      
      <span className="opacity-80">|</span>
      
      <span>{formatTimeSince(secondsSince)}</span>
      
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
