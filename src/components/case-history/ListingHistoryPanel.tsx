/**
 * ListingHistoryPanel
 * 
 * SEMANTIC CORRECTION: Displays CAUSE LIST LISTINGS, not "case history".
 * 
 * Each entry represents a date the case appeared on the cause list.
 * Hearings (lawyer-confirmed events) are shown as overlays with "Heard" badge.
 * 
 * This distinction helps lawyers understand:
 * - "Listed" = Case appeared on cause list (system-ingested)
 * - "Heard" = Lawyer confirmed case was actually heard (via post-court note)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ListOrdered,
  Calendar,
  FileText,
  List,
  ChevronRight,
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  CircleDashed,
  Gavel,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ListingHistory, ListingEntry } from '@/hooks/useListingHistory';
import { useMarkAsHeard } from '@/hooks/useHearings';
import { toast } from 'sonner';

interface ListingHistoryPanelProps {
  history: ListingHistory | null | undefined;
  isLoading?: boolean;
  onSelectEntry?: (entry: ListingEntry) => void;
  compact?: boolean;
}

export function ListingHistoryPanel({
  history,
  isLoading,
  onSelectEntry,
  compact = false,
}: ListingHistoryPanelProps) {
  const { mutate: markAsHeard, isPending: isMarking } = useMarkAsHeard();

  const handleMarkHeard = (entry: ListingEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!history?.fingerprint) return;
    
    markAsHeard({
      caseFingerprint: history.fingerprint,
      hearingDate: entry.date,
      courtRoomNo: entry.court_room_no,
      judgeNames: entry.judge_names || undefined,
    }, {
      onSuccess: () => toast.success('Marked as heard'),
      onError: () => toast.error('Failed to mark as heard'),
    });
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <ListOrdered className="h-8 w-8 text-primary animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.total_listings <= 1) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-display tracking-wide">
            <ListOrdered className="h-4 w-4 text-muted-foreground" />
            Listing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            First listing – no previous appearances
          </p>
        </CardContent>
      </Card>
    );
  }

  const ListingEntryCard = ({ entry, index }: { entry: ListingEntry; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === history.entries.length - 1;
    const wasHeard = entry.hearing?.was_heard;
    const hasPostCourtNote = !!entry.postCourtNote;

    return (
      <div
        className={cn(
          'relative pl-6 pb-4',
          onSelectEntry && 'cursor-pointer hover:bg-white/5 rounded-lg transition-colors'
        )}
        onClick={() => onSelectEntry?.(entry)}
      >
        {/* Timeline line */}
        {!isLast && (
          <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-border" />
        )}
        
        {/* Timeline dot - shows heard vs listed status */}
        <div
          className={cn(
            'absolute left-0 top-1.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center',
            wasHeard
              ? 'bg-green-500/20 border-green-500'
              : isFirst
                ? 'bg-muted-foreground/20 border-muted-foreground'
                : 'bg-primary/20 border-primary'
          )}
        >
          {wasHeard ? (
            <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
          ) : (
            <CircleDashed className="w-2 h-2 text-muted-foreground" />
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {format(parseISO(entry.date), 'dd MMM yyyy')}
            </span>
            <Badge variant="outline" className="text-xs">
              Court {entry.court_room_no}
            </Badge>
            
            {/* Status badges - distinguish Listed vs Heard */}
            {wasHeard ? (
              <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                <Gavel className="h-3 w-3 mr-1" />
                Heard
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Listed
              </Badge>
            )}
            
            {entry.status === 'done' && !wasHeard && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                Concluded (unconfirmed)
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Item #{entry.item_no}
            {entry.judge_names && ` • ${entry.judge_names}`}
          </p>

          {/* Document & Argument counts */}
          <div className="flex items-center gap-3 mt-2">
            {entry.documents.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {entry.documents.length} doc{entry.documents.length !== 1 ? 's' : ''}
              </div>
            )}
            {entry.arguments.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <List className="h-3 w-3" />
                {entry.arguments.length} arg{entry.arguments.length !== 1 ? 's' : ''}
              </div>
            )}
            {hasPostCourtNote && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <BookMarked className="h-3 w-3" />
                Note
              </div>
            )}
          </div>

          {/* Hearing outcome if confirmed */}
          {wasHeard && entry.hearing?.outcome && (
            <div className="mt-2 p-2 rounded bg-green-500/10 border border-green-500/20">
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Gavel className="h-3 w-3" />
                Hearing Outcome
              </p>
              <p className="text-sm text-foreground">{entry.hearing.outcome}</p>
            </div>
          )}

          {/* Post-Court Note - human-verified signal */}
          {hasPostCourtNote && (
            <div className="mt-2 p-2 rounded bg-muted/30 border border-border/30">
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <BookMarked className="h-3 w-3" />
                Post-Court Note
              </p>
              {entry.postCourtNote!.what_happened && (
                <p className="text-sm text-foreground">
                  {entry.postCourtNote!.what_happened}
                </p>
              )}
              {entry.postCourtNote!.next_direction && (
                <p className="text-xs text-muted-foreground mt-1">
                  Next: {entry.postCourtNote!.next_direction}
                </p>
              )}
              {entry.postCourtNote!.note_for_next && (
                <p className="text-xs text-muted-foreground/70 italic mt-1">
                  {entry.postCourtNote!.note_for_next}
                </p>
              )}
            </div>
          )}

          {/* Mark as heard button - only show if not already heard */}
          {!wasHeard && !hasPostCourtNote && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => handleMarkHeard(entry, e)}
              disabled={isMarking}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Mark as Heard
            </Button>
          )}
        </div>

        {onSelectEntry && (
          <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between font-display tracking-wide">
          <div className="flex items-center gap-2 text-sm">
            <ListOrdered className="h-4 w-4 text-primary" />
            Listing History
          </div>
          <div className="flex items-center gap-2">
            {history.confirmed_hearings > 0 && (
              <Badge variant="default" className="text-xs bg-green-600">
                {history.confirmed_hearings} heard
              </Badge>
            )}
            <Badge variant="gold" className="text-xs">
              {history.total_listings} listings
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            First: {format(parseISO(history.first_listing), 'dd MMM yyyy')}
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {history.all_documents.length} total docs
          </div>
          <div className="flex items-center gap-1">
            <List className="h-3 w-3" />
            {history.all_arguments.length} total args
          </div>
        </div>

        <Separator className="mb-4" />

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1">
            <CircleDashed className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Listed</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span className="text-green-600">Heard (confirmed)</span>
          </div>
        </div>

        {/* History reminder banner */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20 mb-4">
          <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-xs text-foreground">
            Previous documents and arguments automatically available
          </p>
        </div>

        {/* Timeline */}
        <ScrollArea className={cn('legal-scroll', compact ? 'h-48' : 'h-64')}>
          <div className="space-y-0">
            {history.entries.map((entry, index) => (
              <ListingEntryCard key={entry.docket_id} entry={entry} index={index} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Re-export old component for backward compatibility
// but with updated semantic name
export { ListingHistoryPanel as CaseHistoryPanel };
