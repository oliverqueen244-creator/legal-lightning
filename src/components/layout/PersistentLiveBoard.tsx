import { AlertTriangle, Activity, MapPin, WifiOff, Clock, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import { useDocket } from '@/hooks/useDocket';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useInternPermissions } from '@/hooks/useInternPermissions';
import { deriveCourtSessionState, getCurrentItem, CURRENT_ITEM_FALLBACK } from '@/hooks/useCourtSessionState';
import { useWaitTimeEstimate } from '@/hooks/useWaitTimeEstimate';
import { format, differenceInSeconds } from 'date-fns';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface PersistentLiveBoardProps {
  className?: string;
}

// Allowed routes for live board visibility
const ALLOWED_ROUTES = ['/', '/dashboard', '/war-room', '/control-deck', '/courtroom'];

/**
 * Check if current route is allowed for live board display
 */
function useIsAllowedRoute(): boolean {
  const location = useLocation();
  return ALLOWED_ROUTES.some(route => 
    location.pathname === route || location.pathname.startsWith(`${route}/`)
  );
}

/**
 * Compact Live Board Widget - Persistent on court-day screens
 * Shows: Current court item, user's nearest case, item distance, wait time estimate
 * 
 * VISIBILITY RULES:
 * 1. Only on allowed screens (dashboard, case detail, morning brief, courtroom)
 * 2. Only when court session is active OR in passive mode when concluded
 * 3. Hidden from interns
 * 4. Shows passive mode when session concluded
 * 
 * PASSIVE MODE:
 * When court session is inactive, shows:
 * - Court number + "Court session concluded"
 * - Hides: Now, My, Away, wait time, Live Sync indicator
 */

/**
 * P0 FIX: Staleness indicator helper
 * Calculates seconds since last update and returns visual state
 */
function useStalenessState(lastUpdated: string | null | undefined) {
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);

  useEffect(() => {
    if (!lastUpdated) return;

    const updateStaleness = () => {
      const lastUpdateTime = new Date(lastUpdated);
      const now = new Date();
      setSecondsSinceUpdate(differenceInSeconds(now, lastUpdateTime));
    };

    // Initial calculation
    updateStaleness();

    // Update every 10 seconds
    const interval = setInterval(updateStaleness, 10000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Visual states based on staleness
  const isStale = secondsSinceUpdate > 90;
  const isWarning = secondsSinceUpdate > 30 && secondsSinceUpdate <= 90;

  return { secondsSinceUpdate, isStale, isWarning };
}

export function PersistentLiveBoard({ className }: PersistentLiveBoardProps) {
  const { profile, role } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { isIntern } = useInternPermissions();
  const isAllowedRoute = useIsAllowedRoute();
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
    const currentItem = getCurrentItem(board);
    const distance = (item.item_no ?? 0) - currentItem;
    
    if (distance < 0) return nearest; // Already passed
    if (!nearest) return { item, board, distance };
    if (distance < nearest.distance) return { item, board, distance };
    return nearest;
  }, null as { item: typeof filteredDocket[0]; board: typeof filteredLiveBoards[0] | undefined; distance: number } | null);

  // CRITICAL FIX: Call hooks UNCONDITIONALLY before any early returns
  const lastUpdatedForStaleness = nearestCase?.board?.last_updated ?? null;
  const { secondsSinceUpdate, isStale, isWarning } = useStalenessState(lastUpdatedForStaleness);
  
  // Derive court session state
  const courtSession = nearestCase ? deriveCourtSessionState(nearestCase.board) : null;
  
  // Wait time estimate
  const waitTime = useWaitTimeEstimate(
    nearestCase?.item.court_location,
    nearestCase?.item.court_room_no,
    nearestCase?.distance ?? 0,
    courtSession?.inSession ?? false
  );

  // ═══════════════════════════════════════════════════════════════════
  // VISIBILITY RULES - All must pass
  // ═══════════════════════════════════════════════════════════════════
  
  // Rule 1: Hide from interns
  if (isIntern) {
    return null;
  }

  // Rule 2: Only show on allowed routes
  if (!isAllowedRoute) {
    return null;
  }

  // Loading state
  if (liveBoardLoading || docketLoading) {
    return (
      <div className={cn('h-10 bg-secondary/50 rounded-lg animate-pulse', className)} />
    );
  }

  // Rule 3: No cases today - hide completely
  if (!nearestCase) {
    return null;
  }

  const { item, board, distance } = nearestCase;
  
  // Derive session state from the found board
  const currentItem = getCurrentItem(board);
  
  // Format last update time for display
  const lastUpdateTime = board?.last_updated 
    ? format(new Date(board.last_updated), 'h:mm a')
    : null;

  // ═══════════════════════════════════════════════════════════════════
  // PASSIVE MODE - When session has concluded
  // ═══════════════════════════════════════════════════════════════════
  if (courtSession?.isSessionConcluded || !courtSession?.inSession) {
    return (
      <TooltipProvider>
        <div
          className={cn(
            'relative flex items-center gap-3 px-3 py-2 rounded-lg border',
            'bg-muted/30 border-border/50',
            className
          )}
          role="status"
          aria-live="polite"
        >
          {/* Court Status Indicator - Dimmed */}
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground/50" />
            <div className="text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 inline mr-1" />
              Court {item.court_room_no}
            </div>
          </div>

          {/* Session Concluded Message */}
          <Badge variant="secondary" className="text-xs font-normal">
            Court session concluded
          </Badge>

          {/* Tooltip with reason */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground/70 cursor-help">
                {courtSession?.reasonText || 'Session ended'}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-sm">
                Court status will update when the next session begins.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // ACTIVE MODE - Court in session
  // ═══════════════════════════════════════════════════════════════════
  
  // Urgency levels (only when in session)
  const isPanic = isOnline && distance > 0 && distance <= 5;
  const isImminent = isOnline && distance > 0 && distance <= 10;
  const isRunning = isOnline && distance <= 0;

  return (
    <TooltipProvider>
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
          !isOnline && 'text-muted-foreground',
          isOnline && 'text-court-success'
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

      {/* Distance Badge */}
      <Badge
        variant={!isOnline ? 'secondary' : isPanic ? 'danger' : isImminent ? 'secondary' : isRunning ? 'running' : 'outline'}
        className={cn(
          'text-xs font-mono',
          isPanic && isOnline && 'flex items-center gap-1',
          !isOnline && 'opacity-50'
        )}
      >
        {isPanic && isOnline && <AlertTriangle className="h-3 w-3" />}
        {isRunning && isOnline ? 'MARKED' : `${distance} away`}
      </Badge>

      {/* Wait Time Estimate - Only when in session and cases away > 0 */}
      {isOnline && waitTime.displayText && distance > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span className="hidden sm:inline">{waitTime.displayText}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm">
              Estimated wait based on ~{waitTime.avgMinutesPerCase} min/case average.
              {!waitTime.isReliable && ' This is an approximate estimate.'}
            </p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Staleness Indicator + Live Sync */}
      {lastUpdateTime && isOnline && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                'flex items-center gap-1 text-xs',
                isStale && 'text-amber-500',
                isWarning && 'text-muted-foreground',
                !isStale && !isWarning && 'text-court-success'
              )}
            >
              <div className={cn(
                'h-2 w-2 rounded-full',
                isStale && 'bg-amber-500',
                isWarning && 'bg-muted-foreground',
                !isStale && !isWarning && 'bg-court-success animate-pulse'
              )} />
              <span className="hidden sm:inline">
                {isStale ? 'Stale' : 'Live Sync'}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm">
              {isStale 
                ? 'Court data has not been updated recently. Verify with court display.'
                : `Last updated: ${lastUpdateTime}. Data refreshes automatically.`}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
    </TooltipProvider>
  );
}
