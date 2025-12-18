import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sun,
  AlertTriangle,
  CheckCircle,
  Eye,
  Users,
  FileText,
  History,
  ChevronRight,
  Clock,
  Scale,
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { MorningBrief, MorningBriefCase } from '@/hooks/useMorningBrief';

interface MorningBriefPanelProps {
  brief: MorningBrief | null | undefined;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function MorningBriefPanel({ brief, isLoading, onRefresh }: MorningBriefPanelProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Sun className="h-12 w-12 text-primary animate-pulse" />
            <p className="text-muted-foreground">Generating your morning brief...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!brief || brief.total_cases === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display tracking-wide">
            <Sun className="h-5 w-5 text-primary" />
            Morning Brief
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No cases scheduled for today
          </p>
        </CardContent>
      </Card>
    );
  }

  const CaseCard = ({ caseItem }: { caseItem: MorningBriefCase }) => {
    const hasRisks = Object.values(caseItem.risks).some(Boolean);
    
    return (
      <div
        className={cn(
          'p-4 rounded-lg glass-card cursor-pointer transition-all hover:bg-white/10',
          hasRisks && 'border-l-4 border-l-court-danger-light'
        )}
        onClick={() => navigate(`/war-room/${caseItem.id}`)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Case header */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-display font-bold text-foreground">
                #{caseItem.item_no}
              </span>
              <span className="text-foreground truncate">
                {caseItem.case_number}
              </span>
              {caseItem.hasHistory && (
                <Badge variant="outline" className="text-xs">
                  <History className="h-3 w-3 mr-1" />
                  {caseItem.previousAppearances} prior
                </Badge>
              )}
            </div>

            {/* Court info */}
            <p className="text-sm text-muted-foreground mb-3">
              Court {caseItem.court_room_no} • {caseItem.court_location}
              {caseItem.judge_names && ` • ${caseItem.judge_names}`}
            </p>

            {/* Risk flags */}
            {hasRisks && (
              <div className="flex flex-wrap gap-2 mb-3">
                {caseItem.risks.missing_documents && (
                  <Badge variant="danger" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    No Documents
                  </Badge>
                )}
                {caseItem.risks.pending_review && (
                  <Badge variant="secondary" className="text-xs bg-court-warning/20 text-court-warning border-court-warning/30">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending Review
                  </Badge>
                )}
                {caseItem.risks.low_readiness && !caseItem.risks.missing_documents && (
                  <Badge variant="danger" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Low Readiness
                  </Badge>
                )}
                {caseItem.risks.late_listed && (
                  <Badge variant="outline" className="text-xs">
                    Late Listed
                  </Badge>
                )}
              </div>
            )}

            {/* Readiness bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Readiness</span>
                <span
                  className={cn(
                    'font-medium',
                    caseItem.readiness.level === 'safe' && 'text-court-success',
                    caseItem.readiness.level === 'review' && 'text-court-warning',
                    caseItem.readiness.level === 'senior_required' && 'text-court-danger-light'
                  )}
                >
                  {caseItem.readiness.total}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    caseItem.readiness.level === 'safe' && 'bg-court-success',
                    caseItem.readiness.level === 'review' && 'bg-court-warning',
                    caseItem.readiness.level === 'senior_required' && 'bg-court-danger-light'
                  )}
                  style={{ width: `${caseItem.readiness.total}%` }}
                />
              </div>
            </div>

            {/* Suggestion */}
            <div
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg text-sm',
                caseItem.suggestion === 'attend' && 'bg-court-danger/10 text-court-danger-light',
                caseItem.suggestion === 'delegate' && 'bg-court-success/10 text-court-success',
                caseItem.suggestion === 'monitor' && 'bg-primary/10 text-primary'
              )}
            >
              {caseItem.suggestion === 'attend' && <Scale className="h-4 w-4" />}
              {caseItem.suggestion === 'delegate' && <Users className="h-4 w-4" />}
              {caseItem.suggestion === 'monitor' && <Eye className="h-4 w-4" />}
              <span className="font-medium capitalize">{caseItem.suggestion}</span>
              <span className="text-xs opacity-80">— {caseItem.suggestionReason}</span>
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between font-display tracking-wide">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-primary" />
            Morning Brief
          </div>
          <Badge variant="outline" className="text-xs">
            {format(new Date(brief.generated_at), 'HH:mm')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-2xl font-bold text-foreground">{brief.total_cases}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-court-danger/10">
            <p className="text-2xl font-bold text-court-danger-light">{brief.summary.attend_count}</p>
            <p className="text-xs text-muted-foreground">Attend</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-court-success/10">
            <p className="text-2xl font-bold text-court-success">{brief.summary.delegate_count}</p>
            <p className="text-xs text-muted-foreground">Delegate</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/10">
            <p className="text-2xl font-bold text-primary">{brief.summary.monitor_count}</p>
            <p className="text-xs text-muted-foreground">Monitor</p>
          </div>
        </div>

        {/* High risk alert */}
        {brief.summary.high_risk_count > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-court-danger/10 border border-court-danger/30">
            <AlertTriangle className="h-5 w-5 text-court-danger-light flex-shrink-0" />
            <p className="text-sm text-court-danger-light">
              <strong>{brief.summary.high_risk_count}</strong> case{brief.summary.high_risk_count !== 1 ? 's' : ''} need{brief.summary.high_risk_count === 1 ? 's' : ''} immediate attention
            </p>
          </div>
        )}

        <Separator />

        {/* Case list */}
        <ScrollArea className="h-[400px] legal-scroll pr-4">
          <div className="space-y-3">
            {brief.cases.map((caseItem) => (
              <CaseCard key={caseItem.id} caseItem={caseItem} />
            ))}
          </div>
        </ScrollArea>

        {/* Refresh button */}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onRefresh}
          >
            Refresh Brief
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
