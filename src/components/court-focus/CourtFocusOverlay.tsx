import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, BookOpen, StickyNote, LogOut, WifiOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { useCourtFocusMode, FocusModeCase } from '@/hooks/useCourtFocusMode';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import { useDocket } from '@/hooks/useDocket';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

/**
 * COURT FOCUS MODE OVERLAY
 * 
 * TESTING CHECKLIST (REQUIRED):
 * [ ] iPhone PWA portrait
 * [ ] iPhone PWA landscape
 * [ ] iPad PWA split view
 * [ ] iPad PWA full screen
 * [ ] Desktop browser
 * [ ] Offline mode - banner shows, refresh disabled
 * [ ] Live board delayed - freshness shows stale
 * [ ] Case skipped - status updates correctly
 * [ ] Case running - status shows RUNNING NOW
 * [ ] Exit returns to previous screen
 */

interface CourtFocusOverlayProps {
  className?: string;
}

function StatusBadge({ status, distance }: { status: FocusModeCase['status']; distance: number }) {
  const statusConfig = {
    running: { label: 'RUNNING NOW', className: 'bg-destructive text-destructive-foreground animate-pulse text-lg px-4 py-2' },
    next: { label: `NEXT (${distance} away)`, className: 'bg-warning text-warning-foreground text-lg px-4 py-2' },
    approaching: { label: `${distance} ITEMS AWAY`, className: 'bg-muted text-muted-foreground text-base px-3 py-1' },
    waiting: { label: 'WAITING', className: 'bg-muted text-muted-foreground text-base px-3 py-1' },
    skipped: { label: 'SKIPPED', className: 'bg-destructive/80 text-destructive-foreground text-lg px-4 py-2' },
    passed_over: { label: 'PASSED OVER', className: 'bg-warning text-warning-foreground text-lg px-4 py-2' },
  };

  const config = statusConfig[status];

  return (
    <Badge className={cn('font-bold uppercase tracking-wide', config.className)}>
      {config.label}
    </Badge>
  );
}

function CaseCard({ focusCase }: { focusCase: FocusModeCase }) {
  const { docketItem, liveBoard, distance, status } = focusCase;

  return (
    <Card className="flex-1 flex flex-col justify-center p-6 md:p-8 border-2 border-primary/30 bg-card/95 backdrop-blur">
      {/* Status Badge - Largest visual element */}
      <div className="flex justify-center mb-6">
        <StatusBadge status={status} distance={distance} />
      </div>

      {/* Case Details */}
      <div className="space-y-4 text-center">
        {/* Case Number - Full, not truncated */}
        <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
          {docketItem.case_number || 'Case Number Unavailable'}
        </h2>

        {/* Party Names */}
        <div className="text-muted-foreground space-y-1">
          {docketItem.petitioner && (
            <p className="text-sm md:text-base truncate">
              <span className="font-medium">Pet:</span> {docketItem.petitioner}
            </p>
          )}
          {docketItem.respondent && (
            <p className="text-sm md:text-base truncate">
              <span className="font-medium">Res:</span> {docketItem.respondent}
            </p>
          )}
        </div>

        {/* Court Info Grid */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Court</p>
            <p className="text-lg font-bold text-foreground">{docketItem.court_room_no || '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Bench</p>
            <p className="text-lg font-bold text-foreground">{docketItem.court_location || '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Item</p>
            <p className="text-lg font-bold text-foreground">
              {docketItem.item_no || '—'}
              {liveBoard?.current_item && (
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}/ {liveBoard.current_item}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Live Board Context */}
        {liveBoard && (
          <div className="pt-4 text-sm text-muted-foreground">
            <p>
              Current item in court: <span className="font-bold text-foreground">{liveBoard.current_item}</span>
              {liveBoard.is_supplementary_running && ' (Supplementary)'}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function NoCaseCard() {
  return (
    <Card className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 border-2 border-border/50 bg-card/95 backdrop-blur">
      <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl font-bold text-foreground mb-2">
        Waiting for live update
      </h2>
      <p className="text-muted-foreground text-center max-w-sm">
        Data may be stale. Pull to refresh or tap the refresh button below.
      </p>
      <p className="text-sm text-muted-foreground/70 mt-2">
        No matched case currently active
      </p>
    </Card>
  );
}

function OfflineBanner() {
  return (
    <div className="bg-destructive/90 text-destructive-foreground px-4 py-2 flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />
      <span className="font-medium text-sm">
        Working Offline — Some features unavailable
      </span>
    </div>
  );
}

function BlockedActionsOverlay() {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="p-6 max-w-sm mx-4 border-destructive/50">
        <div className="flex items-center gap-3 mb-4">
          <WifiOff className="h-6 w-6 text-destructive" />
          <h3 className="font-bold text-foreground">Offline Mode</h3>
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          You can view cached case information, but the following are unavailable:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Sending messages</li>
          <li>Uploading documents</li>
          <li>Escalations</li>
          <li>Case updates</li>
        </ul>
      </Card>
    </div>
  );
}

export function CourtFocusOverlay({ className }: CourtFocusOverlayProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOnline, blockIfOffline } = useNetworkStatus();
  const { refetch: refetchLiveBoard } = useLiveBoard();
  const { refetch: refetchDocket } = useDocket();
  
  const {
    isActive,
    activationReason,
    focusCase,
    exitFocusMode,
    lastUpdatedAt,
  } = useCourtFocusMode();

  // Disable scroll when active
  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isActive]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (blockIfOffline('refresh')) return;
    
    await Promise.all([
      refetchLiveBoard(),
      refetchDocket(),
      queryClient.invalidateQueries({ queryKey: ['court-notifications'] }),
    ]);
  }, [blockIfOffline, refetchLiveBoard, refetchDocket, queryClient]);

  // Handle war room navigation
  const handleOpenWarRoom = useCallback(() => {
    if (!focusCase?.docketItem.id) return;
    exitFocusMode();
    navigate(`/war-room/${focusCase.docketItem.id}`);
  }, [focusCase, exitFocusMode, navigate]);

  // Handle exit
  const handleExit = useCallback(() => {
    exitFocusMode();
  }, [exitFocusMode]);

  if (!isActive) return null;

  return (
    <div 
      className={cn(
        'fixed inset-0 z-[100] bg-background flex flex-col',
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Court Focus Mode"
    >
      {/* Offline Banner - Always visible when offline */}
      {!isOnline && <OfflineBanner />}

      {/* MANDATORY HEADER */}
      <header className="flex-shrink-0 border-b border-border bg-card/95 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Mode indicator */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-bold uppercase text-xs">
              Focus Mode
            </Badge>
            {activationReason && activationReason !== 'manual' && (
              <span className="text-xs text-muted-foreground">
                (Auto: {activationReason.replace('_', ' ')})
              </span>
            )}
          </div>

          {/* Right: Freshness Indicator (NON-REMOVABLE) */}
          <FreshnessIndicator
            lastUpdated={lastUpdatedAt ? new Date(lastUpdatedAt) : null}
            onRefresh={handleRefresh}
            showLabel
            size="sm"
          />
        </div>

        {/* Connectivity State */}
        <div className="mt-2 flex items-center gap-2">
          <div className={cn(
            'h-2 w-2 rounded-full',
            isOnline ? 'bg-green-500' : 'bg-destructive'
          )} />
          <span className="text-xs text-muted-foreground">
            {isOnline ? 'Connected' : 'Offline'}
          </span>
        </div>
      </header>

      {/* PRIMARY CONTENT (80% visual priority) */}
      <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
        {focusCase ? (
          <CaseCard focusCase={focusCase} />
        ) : (
          <NoCaseCard />
        )}
      </main>

      {/* FOOTER ACTION BAR */}
      <footer className="flex-shrink-0 border-t border-border bg-card/95 backdrop-blur p-4">
        <div className="grid grid-cols-4 gap-2 max-w-lg mx-auto">
          {/* Refresh Now */}
          <Button
            variant="outline"
            size="lg"
            onClick={handleRefresh}
            disabled={!isOnline}
            className="flex flex-col items-center gap-1 h-auto py-3"
            title={!isOnline ? 'Cannot refresh — offline' : 'Refresh Now'}
          >
            <RefreshCw className="h-5 w-5" />
            <span className="text-xs">Refresh</span>
          </Button>

          {/* Open War Room */}
          <Button
            variant="outline"
            size="lg"
            onClick={handleOpenWarRoom}
            disabled={!focusCase}
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <BookOpen className="h-5 w-5" />
            <span className="text-xs">War Room</span>
          </Button>

          {/* Add Quick Note - offline-safe placeholder */}
          <Button
            variant="outline"
            size="lg"
            disabled
            className="flex flex-col items-center gap-1 h-auto py-3 opacity-50"
            title="Quick notes coming soon"
          >
            <StickyNote className="h-5 w-5" />
            <span className="text-xs">Note</span>
          </Button>

          {/* Exit Focus Mode */}
          <Button
            variant="default"
            size="lg"
            onClick={handleExit}
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-xs">Exit</span>
          </Button>
        </div>

        {/* Disabled action explanation */}
        {!isOnline && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            Refresh disabled while offline
          </p>
        )}
      </footer>
    </div>
  );
}
