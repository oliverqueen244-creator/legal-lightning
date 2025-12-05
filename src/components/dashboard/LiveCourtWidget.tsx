import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Gavel, Clock, Coffee, SkipForward, Ban } from 'lucide-react';
import type { BoardStatus, LiveBoardCache } from '@/types/database';
import { SyncStatusBadge, SyncTimestamp } from './SyncStatusBadge';
import { useCourtSyncHealth } from '@/hooks/useSyncHealth';

interface LiveCourtWidgetProps {
  courtRoom: string;
  currentItem: number;
  myItemNumber?: number;
  status?: BoardStatus;
  courtLocation?: string;
  liveBoard?: LiveBoardCache;
}

export function LiveCourtWidget({
  courtRoom,
  currentItem,
  myItemNumber,
  status = 'hearing',
  courtLocation = 'Jodhpur Bench',
  liveBoard,
}: LiveCourtWidgetProps) {
  const [displayedItem, setDisplayedItem] = useState(currentItem);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const syncHealth = useCourtSyncHealth(courtLocation, courtRoom, liveBoard);

  // Animate number changes
  useEffect(() => {
    if (currentItem !== displayedItem) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayedItem(currentItem);
        setIsAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [currentItem, displayedItem]);

  const distance = myItemNumber ? myItemNumber - currentItem : null;
  const isPanic = distance !== null && distance > 0 && distance < 5;
  const isMyTurn = distance === 0;

  const getStatusConfig = () => {
    switch (status) {
      case 'passover':
        return {
          icon: SkipForward,
          label: 'SKIPPED',
          bgClass: 'bg-muted/50',
          borderClass: 'border-muted-foreground/30',
        };
      case 'lunch':
        return {
          icon: Coffee,
          label: 'LUNCH BREAK',
          bgClass: 'bg-court-warning/10',
          borderClass: 'border-court-warning/30',
        };
      case 'adjourned':
        return {
          icon: Ban,
          label: 'ADJOURNED',
          bgClass: 'bg-muted/30',
          borderClass: 'border-muted/50',
        };
      default:
        return {
          icon: Gavel,
          label: 'IN SESSION',
          bgClass: '',
          borderClass: '',
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={`
        glass-card p-6 md:p-8 relative overflow-hidden
        ${isPanic ? 'panic-pulse border-court-danger-light' : ''}
        ${isMyTurn ? 'gold-glow border-primary' : ''}
        ${status === 'passover' ? 'card-passover' : ''}
        ${statusConfig.bgClass} ${statusConfig.borderClass}
      `}
      role="region"
      aria-label={`Live court status for ${courtRoom}`}
      aria-live="polite"
    >
      {/* Background glow effect */}
      {status === 'hearing' && (
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, hsl(var(--court-gold) / 0.3), transparent 70%)`,
          }}
        />
      )}

      {/* Stale Data Warning Banner */}
      {syncHealth.status === 'stale' && (
        <div className="absolute top-0 left-0 right-0 bg-destructive/90 text-destructive-foreground text-xs text-center py-1 px-2 z-20">
          ⚠️ Data may be outdated ({syncHealth.staleSeconds}s since last sync)
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between mb-6 relative z-10 ${syncHealth.status === 'stale' ? 'mt-4' : ''}`}>
        <div className="flex items-center gap-3">
          <StatusIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl md:text-2xl font-bold text-foreground tracking-wide">
              COURTROOM {courtRoom}
            </h2>
            <p className="text-sm text-muted-foreground">{courtLocation}</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <SyncStatusBadge 
              status={syncHealth.status} 
              staleSeconds={syncHealth.staleSeconds}
              size="sm"
              showLabel={true}
            />
            <Badge 
              variant={status === 'hearing' ? 'default' : 'secondary'}
              className={`
                text-xs font-semibold px-3 py-1
                ${status === 'passover' ? 'bg-muted text-muted-foreground' : ''}
                ${status === 'lunch' ? 'bg-court-warning/20 text-court-warning' : ''}
                ${status === 'adjourned' ? 'bg-muted/50 text-muted-foreground' : ''}
              `}
            >
              {statusConfig.label}
            </Badge>
          </div>
          {liveBoard && (
            <SyncTimestamp lastUpdated={liveBoard.last_updated} />
          )}
        </div>
      </div>

      {/* Giant Item Number */}
      <div className="text-center py-8 relative z-10">
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-2">
          Current Item
        </p>
        <div 
          className={`
            giant-number transition-all duration-300
            ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
            ${status === 'passover' ? 'text-muted-foreground' : ''}
          `}
          aria-label={`Item number ${displayedItem}`}
        >
          {displayedItem}
        </div>
      </div>

      {/* My case distance indicator */}
      {myItemNumber && (
        <div 
          className={`
            mt-4 p-4 rounded-lg text-center relative z-10
            ${isPanic ? 'bg-court-danger/20 border border-court-danger-light/30' : 'bg-secondary/50'}
            ${isMyTurn ? 'bg-primary/20 border border-primary/30' : ''}
          `}
        >
          {isMyTurn ? (
            <div className="flex items-center justify-center gap-2 text-primary font-bold">
              <Gavel className="h-5 w-5 animate-bounce" />
              <span className="text-lg">YOUR CASE IS NOW!</span>
            </div>
          ) : distance && distance > 0 ? (
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className={`font-medium ${isPanic ? 'text-court-danger-light' : 'text-muted-foreground'}`}>
                Your case (#{myItemNumber}) is{' '}
                <span className={`font-bold ${isPanic ? 'text-court-danger-light' : 'text-primary'}`}>
                  {distance}
                </span>
                {' '}item{distance !== 1 ? 's' : ''} away
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">Your case has passed</span>
          )}
        </div>
      )}
    </div>
  );
}
