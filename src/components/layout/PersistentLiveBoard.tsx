import { AlertTriangle, Activity, MapPin, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import { useDocket } from '@/hooks/useDocket';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { format } from 'date-fns';

interface PersistentLiveBoardProps {
  className?: string;
}

/**
 * Compact Live Board Widget - Persistent on ALL court-day screens
 * Shows: Current court item, user's nearest case, item distance
 * One-tap accessible, non-intrusive, color-coded by urgency
 * 
 * P0 FIX: Shows OFFLINE overlay when offline to prevent false confidence
 */
export function PersistentLiveBoard({ className }: PersistentLiveBoardProps) {
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const formattedDate = format(new Date(), 'yyyy-MM-dd');
  const { data: liveBoards, isLoading: liveBoardLoading } = useLiveBoard();
  const { data: docket, isLoading: docketLoading } = useDocket(formattedDate);

  // Get user's bench filter
  const userBenches = profile?.bench?.split(',').map(b => b.trim().toUpperCase()) ?? [];
  
  // Filter live boards and docket by user's bench
  const filteredLiveBoards = liveBoards?.filter((board) => {
    if (userBenches.length === 0) return true;
    return userBenches.some(bench => board.court_location?.toUpperCase().includes(bench));
  }) ?? [];

  const filteredDocket = docket?.filter((item) => {
    if (userBenches.length === 0) return true;
    return userBenches.some(bench => item.court_location?.toUpperCase().includes(bench));
  }) ?? [];

  // Find user's nearest case (smallest item number that hasn't passed)
  const nearestCase = filteredDocket.reduce((nearest, item) => {
    const board = filteredLiveBoards.find(
      b => b.court_location === item.court_location && b.court_no === item.court_room_no
    );
    const currentItem = board?.current_item ?? 0;
    const distance = (item.item_no ?? 0) - currentItem;
    
    if (distance < 0) return nearest; // Already passed
    if (!nearest) return { item, board, distance };
    if (distance < nearest.distance) return { item, board, distance };
    return nearest;
  }, null as { item: typeof filteredDocket[0]; board: typeof filteredLiveBoards[0] | undefined; distance: number } | null);

  // Loading state
  if (liveBoardLoading || docketLoading) {
    return (
      <div className={cn('h-10 bg-secondary/50 rounded-lg animate-pulse', className)} />
    );
  }

  // No cases today
  if (!nearestCase) {
    return null;
  }

  const { item, board, distance } = nearestCase;
  const currentItem = board?.current_item ?? 0;
  const status = board?.status ?? 'hearing';

  // Urgency levels - DISABLED when offline (P0 FIX)
  const isPanic = isOnline && distance > 0 && distance <= 5;
  const isImminent = isOnline && distance > 0 && distance <= 10;
  const isRunning = isOnline && distance <= 0;

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
        // P0 FIX: Dim all urgency styles when offline
        !isOnline && 'bg-muted/50 border-muted opacity-70',
        isOnline && isPanic && 'bg-destructive/10 border-destructive/50',
        isOnline && isImminent && !isPanic && 'bg-court-warning/10 border-court-warning/50',
        isOnline && isRunning && 'bg-primary/10 border-primary/50 gold-glow',
        isOnline && !isPanic && !isImminent && !isRunning && 'bg-secondary/50 border-border',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* HARDENING FIX: OFFLINE OVERLAY - Precise language */}
      {!isOnline && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg z-10">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm">
            <WifiOff className="h-4 w-4" />
            <span>OFFLINE — Court status may be outdated</span>
          </div>
        </div>
      )}

      {/* Court Status Indicator */}
      <div className="flex items-center gap-2">
        <Activity className={cn(
          'h-4 w-4',
          // P0 FIX: Dim status colors when offline
          !isOnline && 'text-muted-foreground',
          isOnline && status === 'hearing' && 'text-court-success',
          isOnline && status === 'passover' && 'text-court-warning',
          isOnline && status === 'lunch' && 'text-muted-foreground',
          isOnline && status === 'adjourned' && 'text-muted-foreground'
        )} />
        <div className="text-xs text-muted-foreground hidden sm:block">
          <MapPin className="h-3 w-3 inline mr-1" />
          Court {item.court_room_no}
        </div>
      </div>

      {/* Current Item */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Now:</span>
        <span className={cn(
          "font-display font-bold tabular-nums",
          !isOnline ? "text-muted-foreground" : "text-foreground"
        )}>
          {currentItem}
        </span>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border" />

      {/* My Next Case */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">My:</span>
        <span className={cn(
          "font-display font-bold tabular-nums",
          !isOnline ? "text-muted-foreground" : "text-foreground"
        )}>
          #{item.item_no}
        </span>
      </div>

      {/* Distance Badge - P0 FIX: Show muted version when offline */}
      <Badge
        variant={!isOnline ? 'secondary' : isPanic ? 'danger' : isImminent ? 'secondary' : isRunning ? 'running' : 'outline'}
        className={cn(
          'text-xs font-mono',
          isPanic && isOnline && 'flex items-center gap-1',
          !isOnline && 'opacity-50'
        )}
      >
        {isPanic && isOnline && <AlertTriangle className="h-3 w-3" />}
        {isRunning && isOnline ? 'NOW' : `${distance} away`}
      </Badge>
    </div>
  );
}
