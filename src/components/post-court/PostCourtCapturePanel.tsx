import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SensitiveViewGuard, SensitiveContentNotice } from '@/components/ui/SensitiveViewGuard';
import { BookMarked, ChevronRight, X, Check } from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { 
  usePendingCaptures, 
  useSavePostCourtNote, 
  useSkipCapture,
  type PendingCapture 
} from '@/hooks/usePostCourtCapture';
import { useFormDirtyState } from '@/contexts/FormDirtyContext';

const FORM_ID = 'post-court-capture';

export function PostCourtCapturePanel() {
  const { data: pendingCases, isLoading } = usePendingCaptures();
  const saveNote = useSavePostCourtNote();
  const { skipAll, isSkipped } = useSkipCapture();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [formData, setFormData] = useState({
    what_happened: '',
    next_direction: '',
    note_for_next: ''
  });

  // SAFE PWA AUTO-UPDATE: Track form dirty state
  const { setDirty, setClean } = useFormDirtyState(FORM_ID);

  // Mark clean when form is reset
  useEffect(() => {
    const hasContent = formData.what_happened || formData.next_direction || formData.note_for_next;
    if (!hasContent) {
      setClean();
    }
  }, [formData, setClean]);

  // Don't show if skipped for today
  if (isSkipped()) return null;
  
  // Don't show if no pending cases
  if (isLoading || !pendingCases || pendingCases.length === 0) return null;

  const currentCase = pendingCases[currentIndex];
  if (!currentCase) return null;

  const isLastCase = currentIndex === pendingCases.length - 1;
  const hearingIsToday = isToday(parseISO(currentCase.hearing_date));

  const handleSave = async () => {
    try {
      await saveNote.mutateAsync({
        case_fingerprint: currentCase.case_fingerprint,
        docket_id: currentCase.docket_id,
        hearing_date: currentCase.hearing_date,
        what_happened: formData.what_happened || undefined,
        next_direction: formData.next_direction || undefined,
        note_for_next: formData.note_for_next || undefined,
      });
      
      // SAFE PWA AUTO-UPDATE: Mark form clean after successful save
      setClean();
      toast.success('Note captured');
      moveToNext();
    } catch (error) {
      toast.error('Failed to save note');
    }
  };

  const handleSkip = () => {
    // SAFE PWA AUTO-UPDATE: Mark form clean when skipping
    setClean();
    moveToNext();
  };

  const handleSkipAll = () => {
    setClean();
    skipAll();
    toast.success('Skipped for today');
  };

  const moveToNext = () => {
    setFormData({ what_happened: '', next_direction: '', note_for_next: '' });
    if (!isLastCase) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <Card className="border-border/30 bg-background">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Post-Court Capture
            </span>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {currentIndex + 1} of {pendingCases.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipAll}
            className="text-xs text-muted-foreground h-7"
          >
            Skip all for today
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Sensitive content notice */}
        <SensitiveContentNotice />
        
        <SensitiveViewGuard 
          contentType="personal-notes"
          showWatermark={true}
          disableSelection={false}
          disableContextMenu={false}
        >
          {/* Case identifier */}
          <div className="pb-3 border-b border-border/30">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display text-lg text-foreground">
                #{currentCase.item_no}
              </span>
              <span className="text-foreground">
                {currentCase.case_number}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Court {currentCase.court_room_no} • {hearingIsToday ? 'Today' : format(parseISO(currentCase.hearing_date), 'd MMM')}
            </p>
          </div>

          {/* Simple capture fields - no formatting, no requirements */}
          <div className="space-y-3 mt-3">
            <div>
              <Label htmlFor="what_happened" className="text-sm text-muted-foreground">
                What happened today?
              </Label>
              <Textarea
                id="what_happened"
                placeholder="Brief note... (optional)"
                value={formData.what_happened}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, what_happened: e.target.value }));
                  if (e.target.value) setDirty(); // SAFE PWA AUTO-UPDATE: Mark dirty on input
                }}
                className="mt-1 min-h-[60px] resize-none bg-muted/30 border-border/30"
              />
            </div>

            <div>
              <Label htmlFor="next_direction" className="text-sm text-muted-foreground">
                Next date / direction
              </Label>
              <Textarea
                id="next_direction"
                placeholder="e.g. Posted for 15 Jan... (optional)"
                value={formData.next_direction}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, next_direction: e.target.value }));
                  if (e.target.value) setDirty(); // SAFE PWA AUTO-UPDATE: Mark dirty on input
                }}
                className="mt-1 min-h-[40px] resize-none bg-muted/30 border-border/30"
              />
            </div>

            <div>
              <Label htmlFor="note_for_next" className="text-sm text-muted-foreground">
                Note for next time
              </Label>
              <Textarea
                id="note_for_next"
                placeholder="Reminder for future... (optional)"
                value={formData.note_for_next}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, note_for_next: e.target.value }));
                  if (e.target.value) setDirty(); // SAFE PWA AUTO-UPDATE: Mark dirty on input
                }}
                className="mt-1 min-h-[40px] resize-none bg-muted/30 border-border/30"
              />
            </div>
          </div>
        </SensitiveViewGuard>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Skip
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saveNote.isPending}
              className="min-w-[80px]"
            >
              {saveNote.isPending ? (
                'Saving...'
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
            
            {!isLastCase && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}