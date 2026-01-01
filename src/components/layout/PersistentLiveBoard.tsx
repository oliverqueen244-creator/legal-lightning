import { AlertTriangle, Activity, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import { useDocket } from '@/hooks/useDocket';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface PersistentLiveBoardProps {
  className?: string;
}

/**
 * Compact Live Board Widget - Persistent on ALL court-day screens
 * Shows: Current court item, user's nearest case, item distance
 * One-tap accessible, non-intrusive, color-coded by urgency
 */
export function PersistentLiveBoard({ className }: PersistentLiveBoardProps) {
  const { profile } = useAuth();
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

  // Urgency levels
  const isPanic = distance > 0 && distance <= 5;
  const isImminent = distance > 0 && distance <= 10;
  const isRunning = distance <= 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
        isPanic && 'bg-destructive/10 border-destructive/50',
        isImminent && !isPanic && 'bg-court-warning/10 border-court-warning/50',
        isRunning && 'bg-primary/10 border-primary/50 gold-glow',
        !isPanic && !isImminent && !isRunning && 'bg-secondary/50 border-border',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Court Status Indicator */}
      <div className="flex items-center gap-2">
        <Activity className={cn(
          'h-4 w-4',
          status === 'hearing' && 'text-court-success',
          status === 'passover' && 'text-court-warning',
          status === 'lunch' && 'text-muted-foreground',
          status === 'adjourned' && 'text-muted-foreground'
        )} />
        <div className="text-xs text-muted-foreground hidden sm:block">
          <MapPin className="h-3 w-3 inline mr-1" />
          Court {item.court_room_no}
        </div>
      </div>

      {/* Current Item */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Now:</span>
        <span className="font-display font-bold text-foreground tabular-nums">
          {currentItem}
        </span>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border" />

      {/* My Next Case */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">My:</span>
        <span className="font-display font-bold text-foreground tabular-nums">
          #{item.item_no}
        </span>
      </div>

      {/* Distance Badge */}
      <Badge
        variant={isPanic ? 'danger' : isImminent ? 'secondary' : isRunning ? 'running' : 'outline'}
        className={cn(
          'text-xs font-mono',
          isPanic && 'flex items-center gap-1'
        )}
      >
        {isPanic && <AlertTriangle className="h-3 w-3" />}
        {isRunning ? 'NOW' : `${distance} away`}
      </Badge>
    </div>
  );
}
