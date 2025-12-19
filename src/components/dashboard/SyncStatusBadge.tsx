import { cn } from '@/lib/utils';
import type { SyncStatus } from '@/hooks/useSyncHealth';

interface SyncStatusBadgeProps {
  status: SyncStatus;
  staleSeconds?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<SyncStatus, { icon: string; label: string; color: string; bgColor: string }> = {
  live: {
    icon: '🟢',
    label: 'LIVE',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20'
  },
  delayed: {
    icon: '🟡',
    label: 'DELAYED',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20'
  },
  stale: {
    icon: '🔴',
    label: 'STALE',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20'
  },
  unknown: {
    icon: '⚪',
    label: 'UNKNOWN',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/20'
  },
  not_in_session: {
    icon: '🌙',
    label: 'OFFLINE',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/20'
  }
};

export function SyncStatusBadge({ 
  status, 
  staleSeconds, 
  showLabel = true, 
  size = 'md',
  className 
}: SyncStatusBadgeProps) {
  const config = statusConfig[status];
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2'
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div 
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        config.bgColor,
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <span className="leading-none">{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
      {staleSeconds !== undefined && status !== 'unknown' && (
        <span className="opacity-75 text-[0.85em]">
          {formatTime(staleSeconds)}
        </span>
      )}
    </div>
  );
}

interface SyncTimestampProps {
  lastUpdated: string;
  className?: string;
}

export function SyncTimestamp({ lastUpdated, className }: SyncTimestampProps) {
  const now = Date.now();
  const updated = new Date(lastUpdated).getTime();
  const seconds = Math.round((now - updated) / 1000);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    return `${Math.floor(seconds / 3600)} hours ago`;
  };

  return (
    <span className={cn('text-xs text-muted-foreground', className)}>
      Last synced: {formatTime(seconds)}
    </span>
  );
}
