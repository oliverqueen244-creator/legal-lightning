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
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Clock, Save } from 'lucide-react';
import { usePWAUpdateSafety } from '@/hooks/usePWAUpdateSafety';
import { usePendingSync } from '@/hooks/usePendingSync';

/**
 * SAFE PWA AUTO-UPDATE — Force Update Blocked Dialog
 * 
 * Shown when a force update is required but cannot proceed safely.
 * Explains why and gives user options.
 */

interface ForceUpdateBlockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateReason?: string;
}

export function ForceUpdateBlockedDialog({
  open,
  onOpenChange,
  updateReason,
}: ForceUpdateBlockedDialogProps) {
  const { blockingReasons } = usePWAUpdateSafety();
  const { pendingCount, isSyncing } = usePendingSync();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-court-warning" />
            Update Deferred
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <p>
                A system update is available but has been <strong>deferred</strong> to 
                protect your work.
              </p>

              {updateReason && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">Update reason:</p>
                  <p className="text-sm font-medium">{updateReason}</p>
                </div>
              )}

              {blockingReasons.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Waiting for:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {blockingReasons.map((reason, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {pendingCount > 0 && (
                <div className="flex items-center gap-2 p-2 rounded bg-court-warning/10 text-court-warning text-sm">
                  <Save className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {pendingCount} pending change{pendingCount !== 1 ? 's' : ''} to sync
                  </span>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                The update will apply automatically once your work is saved and 
                conditions are safe.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSyncing}>
            Continue Working
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isSyncing}
            onClick={() => {
              // Just dismiss - update will happen when safe
              onOpenChange(false);
            }}
          >
            {isSyncing ? 'Syncing...' : 'Understood'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
