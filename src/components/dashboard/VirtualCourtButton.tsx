import { useState } from 'react';
import { Video, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useVirtualCourt } from '@/hooks/useVirtualCourt';
import { cn } from '@/lib/utils';

interface VirtualCourtButtonProps {
  courtLocation: string;
  courtRoomNo: string;
  variant?: 'default' | 'compact';
  className?: string;
}

/**
 * Button to join Virtual Court (Webex) meeting.
 * 
 * Only shows when:
 * - VC data exists for this court
 * - Data was extracted today
 * - Confidence score meets threshold
 * 
 * Opens Webex join URL in new tab. Never auto-fills or auto-submits.
 */
export function VirtualCourtButton({
  courtLocation,
  courtRoomNo,
  variant = 'default',
  className,
}: VirtualCourtButtonProps) {
  const { vcData, isLoading, logClick } = useVirtualCourt(courtLocation, courtRoomNo);
  const [hasClicked, setHasClicked] = useState(false);

  const handleJoinClick = () => {
    if (!vcData.isValid || !vcData.data?.vc_join_url) return;

    // Log click for beta monitoring
    logClick();
    setHasClicked(true);

    // Open in new tab
    window.open(vcData.data.vc_join_url, '_blank', 'noopener,noreferrer');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground text-sm', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking VC...</span>
      </div>
    );
  }

  // No valid VC data - show disabled state with clear messaging
  if (!vcData.isValid) {
    if (variant === 'compact') {
      return null; // Don't show anything in compact mode if no VC
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-2 text-muted-foreground text-sm opacity-60', className)}>
              <Video className="h-4 w-4" />
              <span>VC not available</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{vcData.reason || 'Virtual court link not verified for today'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Valid VC data - show join button
  const { vc_confidence, vc_meeting_id } = vcData.data!;

  return (
    <div className={cn('space-y-2', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleJoinClick}
              variant={hasClicked ? 'secondary' : 'default'}
              size={variant === 'compact' ? 'sm' : 'default'}
              className={cn(
                'w-full gap-2',
                !hasClicked && 'bg-emerald-600 hover:bg-emerald-700 text-white'
              )}
            >
              <Video className="h-4 w-4" />
              <span>{hasClicked ? 'Rejoin Virtual Court' : 'Join Virtual Court'}</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">
              Meeting ID: {vc_meeting_id}
              <br />
              Opens Webex in new tab. You will need to enter your name.
              <br />
              <span className="text-muted-foreground">
                Source: Today's causelist
              </span>
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Confidence indicator for transparency */}
      {vc_confidence !== null && variant !== 'compact' && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          {vc_confidence >= 90 ? (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-600">
              Verified from causelist
            </Badge>
          ) : vc_confidence >= 60 ? (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-amber-500/10 border-amber-500/30 text-amber-600">
              Inferred from causelist
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              Low confidence
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline VC indicator for DocketCard
 */
export function VirtualCourtIndicator({
  courtLocation,
  courtRoomNo,
}: {
  courtLocation: string;
  courtRoomNo: string;
}) {
  const { vcData, isLoading, logClick } = useVirtualCourt(courtLocation, courtRoomNo);

  if (isLoading || !vcData.isValid) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    logClick();
    window.open(vcData.data!.vc_join_url!, '_blank', 'noopener,noreferrer');
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs hover:bg-emerald-500/20 transition-colors"
          >
            <Video className="h-3 w-3" />
            <span>VC</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Join Virtual Court (opens Webex)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
