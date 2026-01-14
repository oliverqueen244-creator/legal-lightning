/**
 * INTERN INTEGRATION PHASE 2B: Passive Supervisor Signals
 * 
 * Passive badge/strip showing pending intern work.
 * NOT interruptive. Supervisor can ignore entirely.
 * 
 * SCOPE CONSTRAINTS:
 * - Read-only display
 * - No actions from this component
 * - Feature-flagged (disabled by default)
 * - Fully removable
 * 
 * SECURITY REVIEW: 2026-01-14
 */

import { FileText, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  usePhase2BEnabled,
  useSupervisorSignals 
} from '@/hooks/useInternSupervision';

/**
 * Passive badge showing pending intern work
 * Does nothing on click - just informational
 */
export function SupervisorSignalBadge() {
  const { data: isEnabled } = usePhase2BEnabled();
  const { pendingDraftsTotal, internsExpiringIn7Days, hasSignals } = useSupervisorSignals();
  
  // Feature flag check
  if (!isEnabled || !hasSignals) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-2">
      {pendingDraftsTotal > 0 && (
        <Badge variant="secondary" className="text-xs gap-1">
          <FileText className="h-3 w-3" />
          {pendingDraftsTotal} pending
        </Badge>
      )}
      {internsExpiringIn7Days.length > 0 && (
        <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300">
          <Clock className="h-3 w-3" />
          {internsExpiringIn7Days.length} expiring
        </Badge>
      )}
    </div>
  );
}

/**
 * Passive strip for placement in header or sidebar
 */
export function SupervisorSignalStrip() {
  const { data: isEnabled } = usePhase2BEnabled();
  const { pendingDraftsTotal, internsWithPending, internsExpiringIn7Days } = useSupervisorSignals();
  
  if (!isEnabled) {
    return null;
  }
  
  const hasWork = pendingDraftsTotal > 0;
  const hasExpiring = internsExpiringIn7Days.length > 0;
  
  if (!hasWork && !hasExpiring) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/30 rounded-md text-xs text-muted-foreground">
      {hasWork && (
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {pendingDraftsTotal} draft{pendingDraftsTotal !== 1 ? 's' : ''} from {internsWithPending} intern{internsWithPending !== 1 ? 's' : ''}
        </span>
      )}
      {hasWork && hasExpiring && <span className="text-border">•</span>}
      {hasExpiring && (
        <span className="flex items-center gap-1 text-amber-600">
          <Clock className="h-3 w-3" />
          {internsExpiringIn7Days.length} expiring soon
        </span>
      )}
    </div>
  );
}
