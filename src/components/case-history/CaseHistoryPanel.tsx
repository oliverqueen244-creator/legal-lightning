import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  History,
  Calendar,
  FileText,
  List,
  ChevronRight,
  AlertTriangle,
  BookMarked,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CaseHistory, CaseHistoryEntry } from '@/hooks/useCaseHistory';

interface CaseHistoryPanelProps {
  history: CaseHistory | null | undefined;
  isLoading?: boolean;
  onSelectEntry?: (entry: CaseHistoryEntry) => void;
  compact?: boolean;
}

export function CaseHistoryPanel({
  history,
  isLoading,
  onSelectEntry,
  compact = false,
}: CaseHistoryPanelProps) {
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <History className="h-8 w-8 text-primary animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.total_appearances <= 1) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-display tracking-wide">
            <History className="h-4 w-4 text-muted-foreground" />
            Case History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            First appearance - no previous history
          </p>
        </CardContent>
      </Card>
    );
  }

  const HistoryEntryCard = ({ entry, index }: { entry: CaseHistoryEntry; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === history.entries.length - 1;

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
        
        {/* Timeline dot */}
        <div
          className={cn(
            'absolute left-0 top-1.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center',
            isFirst
              ? 'bg-muted-foreground/20 border-muted-foreground'
              : 'bg-primary/20 border-primary'
          )}
        >
          {isFirst ? (
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-primary" />
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {format(parseISO(entry.date), 'dd MMM yyyy')}
            </span>
            <Badge variant="outline" className="text-xs">
              Court {entry.court_room_no}
            </Badge>
            {entry.status === 'done' && (
              <Badge variant="secondary" className="text-xs">
                Concluded
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Item #{entry.item_no}
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
            {entry.postCourtNote && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <BookMarked className="h-3 w-3" />
                Note
              </div>
            )}
          </div>

          {/* Post-Court Note - human-verified signal */}
          {entry.postCourtNote && (
            <div className="mt-2 p-2 rounded bg-muted/30 border border-border/30">
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <BookMarked className="h-3 w-3" />
                Post-Court Note
              </p>
              {entry.postCourtNote.what_happened && (
                <p className="text-sm text-foreground">
                  {entry.postCourtNote.what_happened}
                </p>
              )}
              {entry.postCourtNote.next_direction && (
                <p className="text-xs text-muted-foreground mt-1">
                  Next: {entry.postCourtNote.next_direction}
                </p>
              )}
              {entry.postCourtNote.note_for_next && (
                <p className="text-xs text-muted-foreground/70 italic mt-1">
                  {entry.postCourtNote.note_for_next}
                </p>
              )}
            </div>
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
            <History className="h-4 w-4 text-primary" />
            Case History
          </div>
          <Badge variant="gold" className="text-xs">
            {history.total_appearances} appearances
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            First: {format(parseISO(history.first_appearance), 'dd MMM yyyy')}
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
              <HistoryEntryCard key={entry.docket_id} entry={entry} index={index} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
