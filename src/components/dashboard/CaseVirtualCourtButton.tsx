import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Video, Loader2, AlertTriangle } from 'lucide-react';
import { useVirtualCourt } from '@/hooks/useVirtualCourt';
import { useInternPermissions } from '@/hooks/useInternPermissions';
import { cn } from '@/lib/utils';
import { VCBetaBadge } from './VCBetaWarning';
interface CaseVirtualCourtButtonProps {
  courtLocation: string | null | undefined;
  courtRoomNo: string | null | undefined;
  /** Compact mode for inline use in cards */
  compact?: boolean;
  className?: string;
}

/**
 * Join Virtual Court button for individual case items.
 * 
 * CANONICAL RULE: VC links are court-level, date-scoped resources.
 * This button resolves VC via (court_location + court_room_no + today's date).
 * Different cases in the same court on the same date share the SAME VC link.
 * 
 * NEVER resolves VC via case_id.
 */
export function CaseVirtualCourtButton({
  courtLocation,
  courtRoomNo,
  compact = false,
  className,
}: CaseVirtualCourtButtonProps) {
  const [showStaleWarning, setShowStaleWarning] = useState(false);
  const internPermissions = useInternPermissions();
  
  // CANONICAL: Resolve VC via court + date, NOT case_id
  const { vcData, isLoading, logClick } = useVirtualCourt(
    courtLocation ?? undefined,
    courtRoomNo ?? undefined
  );

  // SECURITY: Block intern access - don't even render the button
  if (internPermissions.isIntern) {
    return null;
  }

  // Don't render if no court info
  if (!courtLocation || !courtRoomNo) {
    return null;
  }

  // ANTI-STALE GUARD: Handle click with verification
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card navigation

    if (vcData.isValid && vcData.data?.vc_join_url) {
      // Valid VC - open meeting
      logClick();
      window.open(vcData.data.vc_join_url, '_blank', 'noopener,noreferrer');
    } else {
      // Stale or invalid VC - show blocking interstitial
      setShowStaleWarning(true);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Button
        variant="outline"
        size={compact ? 'sm' : 'default'}
        disabled
        className={cn('text-muted-foreground', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        {!compact && 'Checking VC...'}
      </Button>
    );
  }

  return (
    <TooltipProvider>
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={vcData.isValid ? 'default' : 'outline'}
              size={compact ? 'sm' : 'default'}
              onClick={handleClick}
              className={cn(
                vcData.isValid
                  ? 'bg-court-success hover:bg-court-success/90 text-white'
                  : 'text-muted-foreground border-muted',
                className
              )}
            >
              <Video className="h-4 w-4 mr-1.5" />
              {compact ? 'VC' : vcData.isValid ? 'Join Virtual Court' : 'VC Not Verified'}
              {compact && <VCBetaBadge className="ml-1" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {vcData.isValid ? (
              <p className="text-xs">Court-level virtual hearing for today</p>
            ) : (
              <p className="text-xs">{vcData.reason || 'Virtual Court link not verified for today'}</p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* ANTI-STALE GUARD: Blocking interstitial dialog */}
        <Dialog open={showStaleWarning} onOpenChange={setShowStaleWarning}>
          <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-court-warning">
                <AlertTriangle className="h-5 w-5" />
                Virtual Court Not Verified
              </DialogTitle>
              <DialogDescription className="text-left pt-2">
                Virtual Court link for Court {courtRoomNo} has not been verified today.
                Please refresh or check court notice.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStaleWarning(false);
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
}
