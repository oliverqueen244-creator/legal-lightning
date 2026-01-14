import { useCauseListNotes } from '@/hooks/useCauseListNotes';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, FileText, Info, Megaphone } from 'lucide-react';
import { VCBetaWarning } from './VCBetaWarning';

interface CauseListNotesWidgetProps {
  date?: string;
  bench?: string;
}

export function CauseListNotesWidget({ date, bench }: CauseListNotesWidgetProps) {
  const targetDate = date || format(new Date(), 'yyyy-MM-dd');
  const { data: notes, isLoading } = useCauseListNotes(targetDate, bench);

  const getNoteIcon = (type: string | null) => {
    switch (type) {
      case 'IMPORTANT':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'DIRECTION':
        return <Megaphone className="h-4 w-4 text-primary" />;
      case 'NOTE':
        return <Info className="h-4 w-4 text-muted-foreground" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getNoteBadgeVariant = (type: string | null) => {
    switch (type) {
      case 'IMPORTANT':
        return 'destructive';
      case 'DIRECTION':
        return 'default';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!notes || notes.length === 0) {
    return null; // Don't show widget if no notes
  }

  // Group notes by type for better organization
  const importantNotes = notes.filter(n => n.note_type === 'IMPORTANT');
  const directionNotes = notes.filter(n => n.note_type === 'DIRECTION');
  const otherNotes = notes.filter(n => n.note_type !== 'IMPORTANT' && n.note_type !== 'DIRECTION');

  const sortedNotes = [...importantNotes, ...directionNotes, ...otherNotes];

  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Court Notes</h3>
          <Badge variant="secondary" className="ml-auto text-xs">
            {notes.length}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Official registry notes affecting today's proceedings
        </p>
      </div>

      <ScrollArea className="max-h-64">
        <div className="p-3 space-y-2">
          {sortedNotes.map((note) => (
            <div
              key={note.id}
              className={`p-3 rounded-md border text-sm ${
                note.note_type === 'IMPORTANT' 
                  ? 'bg-destructive/10 border-destructive/30' 
                  : note.note_type === 'DIRECTION'
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-muted/30 border-border/50'
              }`}
            >
              <div className="flex items-start gap-2">
                {getNoteIcon(note.note_type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge 
                      variant={getNoteBadgeVariant(note.note_type) as any}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {note.note_type || 'NOTE'}
                    </Badge>
                    {note.causelist && (
                      <span className="text-[10px] text-muted-foreground">
                        {note.causelist.bench} • {note.causelist.list_type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {note.note_text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      {/* DECLUTTER: Demoted disclaimer - smaller, italic, no background */}
      <p className="px-3 py-2 text-[9px] text-muted-foreground/60 text-center italic">
        Notes affect case scheduling but do not guarantee hearing. Actual proceedings may vary.
      </p>

      {/* Beta Warning with fallback VC Meeting IDs */}
      <div className="px-3 pb-3">
        <VCBetaWarning />
      </div>
    </div>
  );
}
