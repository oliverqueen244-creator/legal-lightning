import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookMarked } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { PostCourtNote } from '@/hooks/usePostCourtCapture';

interface PostCourtNoteCardProps {
  note: PostCourtNote;
  compact?: boolean;
}

// Display component for showing a post-court note in history/war room
export function PostCourtNoteCard({ note, compact = false }: PostCourtNoteCardProps) {
  const hasContent = note.what_happened || note.next_direction || note.note_for_next;
  
  if (!hasContent) return null;

  return (
    <Card className="border-border/30 bg-muted/10">
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start gap-3">
          <BookMarked className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
                Post-Court Note
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(note.hearing_date), 'd MMM yyyy')}
              </span>
            </div>

            {note.what_happened && (
              <p className={`text-foreground ${compact ? 'text-sm' : 'text-base'}`}>
                {note.what_happened}
              </p>
            )}

            {note.next_direction && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Next:</span> {note.next_direction}
              </p>
            )}

            {note.note_for_next && (
              <p className="text-sm text-muted-foreground/80 italic">
                Note: {note.note_for_next}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}