import { useState, useEffect } from 'react';
import { Clock, Timer, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
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
      setEstimatedTime('Your case is marked');
      setEstimatedMinutes(0);
      setProgress(100);
      setUrgencyLevel('now');
      return;
    }

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
          // CORRECTNESS PLAN 2: Use MARKED instead of NOW
          label: 'MARKED',
        };
      case 'urgent':
        return {
          icon: AlertTriangle,
          bgClass: 'bg-court-danger/20 border-court-danger-light',
          textClass: 'text-court-danger-light',
          badgeVariant: 'danger' as const,
          label: 'URGENT',
        };
      case 'warning':
        return {
          icon: Timer,
          bgClass: 'bg-court-warning/20 border-court-warning',
          textClass: 'text-court-warning',
          badgeVariant: 'supplementary' as const,
          label: 'SOON',
        };
      default:
        return {
          icon: Clock,
          bgClass: 'bg-secondary/50 border-border',
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
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Est. Wait Time
          </span>
        </div>
        <Badge variant={config.badgeVariant} className="text-xs">
          {config.label}
        </Badge>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className={`text-2xl font-bold font-display ${config.textClass}`}>
            {estimatedTime}
          </p>
          {casesAhead > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {casesAhead} case{casesAhead !== 1 ? 's' : ''} ahead • Item #{docketItem.item_no}
            </p>
          )}
        </div>
        
        {/* CORRECTNESS PLAN 2: Use MARKED instead of GO NOW */}
        {urgencyLevel === 'now' && (
          <div className="flex items-center gap-1 text-primary animate-pulse">
            <Zap className="h-5 w-5" />
            <span className="text-sm font-bold">MARKED</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {casesAhead > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Item #{currentItem}</span>
            <span>Your Item #{docketItem.item_no}</span>
          </div>
          <Progress 
            value={progress} 
            className="h-2"
          />
        </div>
      )}

      {/* Time breakdown hint */}
      {casesAhead > 0 && estimatedMinutes > 0 && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Based on ~{avgMinutesPerCase} min/case average
        </p>
      )}
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