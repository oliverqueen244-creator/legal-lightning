import { useState, useEffect, useRef } from 'react';
import { Clock, Timer, AlertTriangle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { DocketItem, LiveBoardCache } from '@/types/database';
import { 
  useCourtSessionState, 
  getCurrentItem, 
  shouldShowWaitTime,
  type CourtSessionState 
} from '@/hooks/useCourtSessionState';

interface CaseTimeEstimatorProps {
  docketItem: DocketItem;
  liveBoard?: LiveBoardCache;
  avgMinutesPerCase?: number;
  /** Optional pre-computed session state to avoid duplicate computation */
  courtSession?: CourtSessionState;
}

export function CaseTimeEstimator({ 
  docketItem, 
  liveBoard,
  avgMinutesPerCase = 6, // Default 6 minutes per case
  courtSession: externalSession
}: CaseTimeEstimatorProps) {
  const [estimatedTime, setEstimatedTime] = useState<string>('--');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [urgencyLevel, setUrgencyLevel] = useState<'safe' | 'warning' | 'urgent' | 'now'>('safe');
  
  // Track previous casesAhead for one-time transition toast
  const prevCasesAheadRef = useRef<number | null>(null);

  // CORRECTNESS PLAN 2: Use canonical session state
  const derivedSession = useCourtSessionState(liveBoard);
  const courtSession = externalSession ?? derivedSession;

  useEffect(() => {
    // CORRECTNESS PLAN 2: Hide if not in hearing session
    if (!liveBoard || !docketItem.item_no || !shouldShowWaitTime(courtSession)) {
      setEstimatedTime('No data');
      return;
    }

    const currentItem = getCurrentItem(liveBoard);
    const myItem = docketItem.item_no;
    const casesAhead = myItem - currentItem;

    if (casesAhead <= 0) {
      // CORRECTNESS PLAN 2: Use MARKED instead of certainty-implying language
      setEstimatedTime('Your item number has been reached in the current court sequence.');
      setEstimatedMinutes(0);
      setProgress(100);
      setUrgencyLevel('now');
      
      // One-time transition toast when case becomes MARKED
      if (prevCasesAheadRef.current !== null && prevCasesAheadRef.current > 0) {
        toast(`Your case has reached its turn in Court ${docketItem.court_room_no || 'N/A'}.`, {
          duration: 4000,
        });
      }
      prevCasesAheadRef.current = casesAhead;
      return;
    }
    
    // Update ref for non-MARKED cases
    prevCasesAheadRef.current = casesAhead;

    // Calculate estimated time
    const totalMinutes = casesAhead * avgMinutesPerCase;
    setEstimatedMinutes(totalMinutes);

    // Format time
    if (totalMinutes < 60) {
      setEstimatedTime(`~${Math.round(totalMinutes)} mins`);
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const mins = Math.round(totalMinutes % 60);
      setEstimatedTime(`~${hours}h ${mins}m`);
    }

    // Calculate progress (assuming max 50 items in a day)
    const progressValue = Math.min(((currentItem / myItem) * 100), 100);
    setProgress(progressValue);

    // Set urgency level
    if (totalMinutes <= 15) {
      setUrgencyLevel('urgent');
    } else if (totalMinutes <= 30) {
      setUrgencyLevel('warning');
    } else {
      setUrgencyLevel('safe');
    }
  }, [liveBoard, docketItem, avgMinutesPerCase, courtSession]);

  const getUrgencyConfig = () => {
    switch (urgencyLevel) {
      case 'now':
        return {
          icon: Zap,
          bgClass: 'bg-primary/20 border-primary',
          textClass: 'text-primary',
          badgeVariant: 'gold' as const,
          label: 'MARKED',
        };
      case 'urgent':
        return {
          icon: AlertTriangle,
          bgClass: 'bg-court-danger/10 border-court-danger-light/50',
          textClass: 'text-court-danger-light',
          badgeVariant: 'danger' as const,
          label: 'SOON',
        };
      case 'warning':
        return {
          icon: Timer,
          bgClass: 'bg-court-warning/10 border-court-warning/50',
          textClass: 'text-court-warning',
          badgeVariant: 'supplementary' as const,
          label: 'QUEUED',
        };
      default:
        return {
          icon: Clock,
          bgClass: 'bg-secondary/30 border-border',
          textClass: 'text-muted-foreground',
          badgeVariant: 'secondary' as const,
          label: 'SCHEDULED',
        };
    }
  };

  const config = getUrgencyConfig();
  const Icon = config.icon;

  // CORRECTNESS PLAN 2: Hide entirely when not in hearing session
  if (!liveBoard || !shouldShowWaitTime(courtSession)) {
    return null;
  }

  const currentItem = getCurrentItem(liveBoard);
  const casesAhead = (docketItem.item_no || 0) - currentItem;

  return (
    <div className={`rounded-lg border p-3 ${config.bgClass}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.textClass}`} />
          <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">
            Sequence Status
          </span>
        </div>
        <Badge variant={config.badgeVariant} className="text-xs">
          {config.label}
        </Badge>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className={`text-lg font-semibold ${config.textClass}`}>
            {estimatedTime}
          </p>
          {casesAhead <= 0 && (
            <p className="text-sm text-foreground font-medium mt-1">
              Verify with court display.
            </p>
          )}
          {casesAhead > 0 && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              {casesAhead} item{casesAhead !== 1 ? 's' : ''} ahead • #{docketItem.item_no}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar - suppressed visual weight */}
      {casesAhead > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground/60 mb-1">
            <span>#{currentItem}</span>
            <span>#{docketItem.item_no}</span>
          </div>
          <Progress 
            value={progress} 
            className="h-1.5"
          />
        </div>
      )}

      {/* Micro-context - neutral, procedural */}
      <p className="text-[10px] text-muted-foreground/50 mt-2">
        Derived from court sequence data.
      </p>
    </div>
  );
}

// Compact version for DocketCard
export function CaseTimeEstimatorCompact({ 
  docketItem, 
  liveBoard,
  avgMinutesPerCase = 6,
  courtSession: externalSession
}: CaseTimeEstimatorProps) {
  // CORRECTNESS PLAN 2: Use canonical session state
  const derivedSession = useCourtSessionState(liveBoard);
  const courtSession = externalSession ?? derivedSession;

  // CORRECTNESS PLAN 2: Hide entirely when not in hearing session
  if (!liveBoard || !docketItem.item_no || !shouldShowWaitTime(courtSession)) {
    return null;
  }

  const currentItem = getCurrentItem(liveBoard);
  const myItem = docketItem.item_no;
  const casesAhead = myItem - currentItem;

  if (casesAhead <= 0) {
    // CORRECTNESS PLAN 2: Use MARKED instead of NOW!
    return (
      <div className="flex items-center gap-1 text-primary animate-pulse">
        <Zap className="h-3 w-3" />
        <span className="text-xs font-bold">MARKED</span>
      </div>
    );
  }

  const totalMinutes = casesAhead * avgMinutesPerCase;
  let timeStr = '';
  
  if (totalMinutes < 60) {
    timeStr = `~${Math.round(totalMinutes)}m`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    timeStr = `~${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
  }

  const isUrgent = totalMinutes <= 15;
  const isWarning = totalMinutes <= 30;

  return (
    <div className={`flex items-center gap-1 ${isUrgent ? 'text-court-danger-light' : isWarning ? 'text-court-warning' : 'text-muted-foreground'}`}>
      <Clock className="h-3 w-3" />
      <span className="text-xs font-medium">{timeStr}</span>
    </div>
  );
}