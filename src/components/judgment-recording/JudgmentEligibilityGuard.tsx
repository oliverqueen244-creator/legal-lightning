import { ReactNode } from 'react';
import { useJudgmentRecording, CaseProceedingStatus, STATUS_LABELS } from '@/hooks/useJudgmentRecording';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Info, CheckCircle2, Lock } from 'lucide-react';

interface JudgmentEligibilityGuardProps {
  trackedCaseId: string;
  children: ReactNode;
  /** If true, shows status selector even when eligible */
  showStatusControl?: boolean;
  /** Compact mode for inline usage */
  compact?: boolean;
}

/**
 * CP-6: Judgment Recording Protocol - Eligibility Guard
 * 
 * This component gates judgment recording UI based on case status.
 * It reflects backend truth and does not make authorization decisions.
 * 
 * Language is deliberately neutral - no AI, prediction, or automation terms.
 */
export function JudgmentEligibilityGuard({
  trackedCaseId,
  children,
  showStatusControl = false,
  compact = false,
}: JudgmentEligibilityGuardProps) {
  const {
    isJudgmentEligible,
    currentStatus,
    eligibilityReason,
    isCheckingEligibility,
    updateProceedingStatus,
    isUpdatingStatus,
    JUDGMENT_ELIGIBLE_STATUSES,
    STATUS_LABELS,
  } = useJudgmentRecording(trackedCaseId);

  // Loading state
  if (isCheckingEligibility) {
    return compact ? (
      <Skeleton className="h-8 w-32" />
    ) : (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // Status selector for changing case status
  const StatusSelector = () => (
    <Select
      value={currentStatus}
      onValueChange={(value) => updateProceedingStatus(value as CaseProceedingStatus)}
      disabled={isUpdatingStatus}
    >
      <SelectTrigger className={compact ? "h-8 text-xs" : "h-10"}>
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(STATUS_LABELS) as CaseProceedingStatus[]).map((status) => (
          <SelectItem key={status} value={status}>
            <div className="flex items-center gap-2">
              <span>{STATUS_LABELS[status]}</span>
              {JUDGMENT_ELIGIBLE_STATUSES.includes(status) && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  Judgment Ready
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // Compact mode: inline badge + optional selector
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isJudgmentEligible ? (
          <Badge variant="default" className="bg-green-600 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Judgment Eligible
          </Badge>
        ) : (
          <Badge variant="secondary">
            <Lock className="h-3 w-3 mr-1" />
            {STATUS_LABELS[currentStatus]}
          </Badge>
        )}
        {showStatusControl && <StatusSelector />}
        {isJudgmentEligible && children}
      </div>
    );
  }

  // Full mode: alert + content
  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <Alert variant={isJudgmentEligible ? "default" : "destructive"}>
        <div className="flex items-start gap-3">
          {isJudgmentEligible ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <Info className="h-5 w-5 mt-0.5" />
          )}
          <div className="flex-1 space-y-2">
            <AlertTitle className="text-sm font-medium">
              {isJudgmentEligible 
                ? 'Case is eligible for judgment recording' 
                : 'Judgment recording not available'
              }
            </AlertTitle>
            <AlertDescription className="text-xs">
              {eligibilityReason}
            </AlertDescription>

            {/* Current status badge */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Current status:</span>
              <Badge variant={isJudgmentEligible ? "default" : "secondary"}>
                {STATUS_LABELS[currentStatus]}
              </Badge>
            </div>
          </div>
        </div>
      </Alert>

      {/* Status control (if enabled and not eligible) */}
      {showStatusControl && !isJudgmentEligible && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Update case status
          </label>
          <StatusSelector />
          <p className="text-[10px] text-muted-foreground">
            Status changes are recorded for audit purposes.
          </p>
        </div>
      )}

      {/* Render children only when eligible */}
      {isJudgmentEligible ? (
        children
      ) : (
        <div className="opacity-50 pointer-events-none select-none">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Simple status badge without guard functionality
 */
export function JudgmentStatusBadge({ 
  trackedCaseId,
  showLabel = true,
}: { 
  trackedCaseId: string;
  showLabel?: boolean;
}) {
  const { isJudgmentEligible, currentStatus, isCheckingEligibility, STATUS_LABELS } = 
    useJudgmentRecording(trackedCaseId);

  if (isCheckingEligibility) {
    return <Skeleton className="h-5 w-20" />;
  }

  return (
    <Badge 
      variant={isJudgmentEligible ? "default" : "secondary"}
      className={isJudgmentEligible ? "bg-green-600 text-white" : ""}
    >
      {isJudgmentEligible ? (
        <>
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {showLabel && "Judgment Ready"}
        </>
      ) : (
        <>
          {showLabel && STATUS_LABELS[currentStatus]}
        </>
      )}
    </Badge>
  );
}
