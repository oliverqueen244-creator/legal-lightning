import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Gavel, Clock, Coffee, SkipForward, Ban, AlertTriangle, Moon, UserCheck } from 'lucide-react';
import type { BoardStatus, LiveBoardCache } from '@/types/database';
import { SyncStatusBadge, SyncTimestamp } from './SyncStatusBadge';
import { useCourtSyncHealth } from '@/hooks/useSyncHealth';
import { isCourtHours } from '@/hooks/useLiveBoard';
import { useCourtOverrides, findOverrideForItem } from '@/hooks/useCourtOverrides';
import { useEffectiveJudge } from '@/hooks/useEffectiveJudge';
import { useRoleSemantics } from '@/hooks/useRoleSemantics';

interface LiveCourtWidgetProps {
  courtRoom: string;
  currentItem: number;
  myItemNumber?: number;
  status?: BoardStatus;
  courtLocation?: string;
  liveBoard?: LiveBoardCache;
  isSupplementary?: boolean;
}

export function LiveCourtWidget({
  courtRoom,
  currentItem,
  myItemNumber,
  status = 'hearing',
  courtLocation = 'Jodhpur Bench',
  liveBoard,
  isSupplementary = false,
}: LiveCourtWidgetProps) {
  const [displayedItem, setDisplayedItem] = useState(currentItem);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const syncHealth = useCourtSyncHealth(courtLocation, courtRoom, liveBoard);
  const courtHoursStatus = isCourtHours();
  const isActive = liveBoard?.is_active ?? false;
  
  // CORRECTNESS PLAN 3: Role-aware labels
  const { caseRunningLabel, caseApproachingLabel, isClerkRole } = useRoleSemantics();
  
  // Fetch court overrides for today
  const { data: overrides = [] } = useCourtOverrides(courtLocation, courtRoom);
  
  // Dynamic judge resolution
  const effectiveJudge = useEffectiveJudge({
    courtLocation,
    courtNo: courtRoom,
    itemNo: currentItem
  });
  
  // Check if current item has a judge override
  const currentOverride = findOverrideForItem(overrides, courtRoom, currentItem);

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
  
  // Enhanced panic logic: Different thresholds for daily vs supplementary
  // Only trigger panic if court is active and in session
  const panicThreshold = isSupplementary ? 10 : 5;
  const isPanic = distance !== null && distance > 0 && distance <= panicThreshold && isActive && courtHoursStatus.inSession;
  const isMyTurn = distance === 0 && isActive && courtHoursStatus.inSession;
  const isCritical = distance !== null && distance > 0 && distance <= 3 && isActive && courtHoursStatus.inSession;

  const getStatusConfig = () => {
    // Court not in session
    if (!courtHoursStatus.inSession || status === 'not_sitting') {
      return {
        icon: Moon,
        label: 'NOT IN SESSION',
        bgClass: 'bg-muted/30',
        borderClass: 'border-muted/50',
      };
    }
    
    // Court in session but not active (not sitting today)
    if (!isActive) {
      return {
        icon: Ban,
        label: 'NOT SITTING TODAY',
        bgClass: 'bg-muted/30',
        borderClass: 'border-muted/50',
      };
    }
    
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

  // Determine if we should show the stale warning
  const showStaleWarning = syncHealth.status === 'stale' && isActive && courtHoursStatus.inSession;

  return (
    // FIX 4: Strengthened right-column court presence on iPad
    <div
      className={`
        glass-card p-6 md:p-8 relative overflow-hidden
        ${isPanic ? 'panic-pulse border-court-danger-light' : ''}
        ${isCritical ? 'border-2 border-court-danger-light' : ''}
        ${isMyTurn ? 'gold-glow border-primary' : ''}
        ${status === 'passover' ? 'card-passover' : ''}
        ${!isActive || !courtHoursStatus.inSession ? 'opacity-75' : ''}
        ${statusConfig.bgClass} ${statusConfig.borderClass}
        md:border-2 md:shadow-lg
      `}
      role="region"
      aria-label={`Live court status for ${courtRoom}`}
      aria-live="polite"
    >
      {/* Background glow effect */}
      {status === 'hearing' && isActive && courtHoursStatus.inSession && (
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, hsl(var(--court-gold) / 0.3), transparent 70%)`,
          }}
        />
      )}

      {/* Stale Data Warning Banner - HARDENING: Never auto-refresh silently */}
      {showStaleWarning && (
        <div className="absolute top-0 left-0 right-0 bg-destructive/90 text-destructive-foreground text-xs text-center py-1.5 px-2 z-20">
          <span className="font-semibold">⚠️ STALE DATA</span> — Last known: {syncHealth.staleSeconds}s ago. Verify before acting.
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between mb-6 relative z-10 ${showStaleWarning ? 'mt-4' : ''}`}>
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-6 w-6 ${isActive && courtHoursStatus.inSession ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl md:text-2xl font-bold text-foreground tracking-wide">
              COURTROOM {courtRoom}
            </h2>
            <p className="text-sm text-muted-foreground">
              {courtLocation}
              {effectiveJudge.judgeName && isActive && courtHoursStatus.inSession && (
                <span className="ml-1">
                  • {effectiveJudge.judgeName.replace(/^(MR\. JUSTICE |MRS\. JUSTICE |MS\. JUSTICE )/gi, 'J. ')}
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {courtHoursStatus.inSession && isActive && (
              <SyncStatusBadge 
                status={syncHealth.status} 
                staleSeconds={syncHealth.staleSeconds}
                size="sm"
                showLabel={true}
              />
            )}
            {isSupplementary && (
              <Badge variant="supplementary" className="text-xs">
                SUPPLEMENTARY
              </Badge>
            )}
            <Badge 
              variant={status === 'hearing' && isActive ? 'default' : 'secondary'}
              className={`
                text-xs font-semibold px-3 py-1
                ${status === 'passover' ? 'bg-muted text-muted-foreground' : ''}
                ${status === 'lunch' ? 'bg-court-warning/20 text-court-warning' : ''}
                ${status === 'adjourned' || !isActive || !courtHoursStatus.inSession ? 'bg-muted/50 text-muted-foreground' : ''}
              `}
            >
              {statusConfig.label}
            </Badge>
          </div>
          {liveBoard && isActive && courtHoursStatus.inSession && (
            <SyncTimestamp lastUpdated={liveBoard.last_updated} />
          )}
        </div>
      </div>

      {/* Judge Override Banner */}
      {currentOverride && currentOverride.new_judge && isActive && courtHoursStatus.inSession && (
        <div className="mb-4 p-3 rounded-lg bg-court-warning/10 border border-court-warning/30 relative z-10">
          <div className="flex items-center gap-2 text-sm">
            <UserCheck className="h-4 w-4 text-court-warning" />
            <span className="text-court-warning font-medium">Judge Override Active</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Items {currentOverride.from_serial ?? 1}-{currentOverride.to_serial ?? '∞'} before{' '}
            <span className="text-foreground font-medium">{currentOverride.new_judge}</span>
          </p>
        </div>
      )}

      {/* Giant Item Number or Not In Session Message */}
      {/* FIX 2: De-absolutized messaging - context added */}
      <div className="text-center py-8 relative z-10">
        {!courtHoursStatus.inSession ? (
          <>
            <Moon className="h-16 w-16 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-lg">Courts not in session</p>
            <p className="text-sm text-muted-foreground mt-1">As per last update · {courtHoursStatus.reason}</p>
          </>
        ) : !isActive ? (
          <>
            <Ban className="h-16 w-16 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-lg">Court not sitting today</p>
            <p className="text-sm text-muted-foreground mt-1">As per last update</p>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* My case distance indicator - only show during active court session */}
      {myItemNumber && isActive && courtHoursStatus.inSession && (
        <div 
          className={`
            mt-4 p-4 rounded-lg text-center relative z-10
            ${isCritical ? 'bg-court-danger/30 border-2 border-court-danger-light/50' : ''}
            ${isPanic && !isCritical ? 'bg-court-danger/20 border border-court-danger-light/30' : ''}
            ${!isPanic && !isMyTurn ? 'bg-secondary/50' : ''}
            ${isMyTurn ? 'bg-primary/20 border border-primary/30' : ''}
          `}
        >
          {isMyTurn ? (
            <div className="flex items-center justify-center gap-2 text-primary font-bold">
              <Gavel className="h-5 w-5 animate-bounce" />
              {/* CORRECTNESS PLAN 3: Role-aware label */}
              <span className="text-lg">{caseRunningLabel}</span>
            </div>
          ) : distance && distance > 0 ? (
            <div className="flex items-center justify-center gap-2">
              {isCritical ? (
                <AlertTriangle className="h-5 w-5 text-court-danger-light animate-pulse" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={`font-medium ${isPanic ? 'text-court-danger-light' : 'text-muted-foreground'}`}>
                {/* CORRECTNESS PLAN 3: Role-aware label */}
                {isClerkRole ? 'Tracked case' : 'Your case'} (#{myItemNumber}) is{' '}
                <span className={`font-bold ${isPanic ? 'text-court-danger-light text-xl' : 'text-primary'}`}>
                  {distance}
                </span>
                {' '}item{distance !== 1 ? 's' : ''} away
                {isSupplementary && isPanic && (
                  <span className="block text-xs mt-1 text-court-warning">
                    ⚡ Supplementary lists move faster!
                  </span>
                )}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">
              {/* CORRECTNESS PLAN 3: Role-aware label */}
              {isClerkRole ? 'Tracked case has passed' : 'Your case has passed'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
