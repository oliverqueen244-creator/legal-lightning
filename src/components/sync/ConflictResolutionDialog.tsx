import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

export interface ConflictData {
  localVersion: {
    what_happened?: string;
    next_direction?: string;
    note_for_next?: string;
    updated_at: string;
  };
  serverVersion: {
    what_happened?: string;
    next_direction?: string;
    note_for_next?: string;
    updated_at: string;
  };
  caseFingerprint: string;
  hearingDate: string;
}

interface ConflictResolutionDialogProps {
  open: boolean;
  conflict: ConflictData | null;
  onKeepLocal: () => void;
  onDiscardLocal: () => void;
  onClose: () => void;
}

/**
 * P0 FIX: Conflict Resolution Dialog
 * 
 * Shows when an offline note conflicts with a server version.
 * User must explicitly choose which version to keep.
 * NO silent overwrites allowed.
 */
export function ConflictResolutionDialog({
  open,
  conflict,
  onKeepLocal,
  onDiscardLocal,
  onClose,
}: ConflictResolutionDialogProps) {
  if (!conflict) return null;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            This note was updated elsewhere
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              Your offline changes conflict with updates made on another device or by another user.
              Review before saving.
            </p>
            
            <div className="grid gap-4 mt-4">
              {/* Local Version */}
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
                <div className="text-sm font-medium text-primary mb-1">
                  Your Version (saved {formatDate(conflict.localVersion.updated_at)})
                </div>
                {conflict.localVersion.what_happened && (
                  <p className="text-sm text-foreground line-clamp-2">
                    {conflict.localVersion.what_happened}
                  </p>
                )}
              </div>

              {/* Server Version */}
              <div className="p-3 rounded-lg border border-muted bg-muted/30">
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Server Version (updated {formatDate(conflict.serverVersion.updated_at)})
                </div>
                {conflict.serverVersion.what_happened && (
                  <p className="text-sm text-foreground line-clamp-2">
                    {conflict.serverVersion.what_happened}
                  </p>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onDiscardLocal} className="sm:order-1">
            Discard & Load Latest
          </AlertDialogCancel>
          <AlertDialogAction onClick={onKeepLocal} className="sm:order-2">
            Keep My Version
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
