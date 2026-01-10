import { useJudgmentRecording, STATUS_LABELS, CaseProceedingStatus } from '@/hooks/useJudgmentRecording';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { FileCheck, Clock, User, Shield } from 'lucide-react';

interface JudgmentAuditPanelProps {
  trackedCaseId: string;
}

/**
 * CP-6: Judgment Recording Protocol - Audit Trail Panel
 * 
 * Displays the audit log for judgment saves on a case.
 * All entries are created automatically by the database trigger.
 */
export function JudgmentAuditPanel({ trackedCaseId }: JudgmentAuditPanelProps) {
  const { auditLog, isLoadingAudit } = useJudgmentRecording(trackedCaseId);

  if (isLoadingAudit) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!auditLog || auditLog.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Judgment Recording Audit
          </CardTitle>
          <CardDescription className="text-xs">
            No judgment recording events for this case
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Judgment Recording Audit
        </CardTitle>
        <CardDescription className="text-xs">
          Protocol-validated saves: {auditLog.length}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-3">
            {auditLog.map((entry) => (
              <div 
                key={entry.id}
                className="p-3 bg-muted/50 rounded-md border border-border/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-medium">
                      {entry.action === 'INSERT' ? 'Judgment Recorded' : 'Judgment Updated'}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {STATUS_LABELS[entry.case_status_at_save as CaseProceedingStatus] || entry.case_status_at_save}
                  </Badge>
                </div>

                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(entry.saved_at), 'PPpp')}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <User className="h-3 w-3" />
                    {entry.saved_by_user_id.slice(0, 8)}...
                  </div>
                </div>

                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground">
                      Method: {entry.save_method}
                    </p>
                    {(entry.metadata as Record<string, unknown>).judgment_date && (
                      <p className="text-[10px] text-muted-foreground">
                        Judgment Date: {String((entry.metadata as Record<string, unknown>).judgment_date)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
