import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Shield,
  Users,
  Puzzle,
  Zap,
  Wrench,
  Scale,
} from 'lucide-react';
import {
  useAuditRun,
  useAuditFindings,
  useAuditRisks,
  useUpdateAuditRun,
  AuditDimension,
  FindingSeverity,
  AuditStatus,
  GoDecision,
} from '@/hooks/useAudit';
import { FindingsPanel } from './FindingsPanel';
import { RisksPanel } from './RisksPanel';
import { format } from 'date-fns';

interface AuditRunDetailProps {
  auditRunId: string;
  onBack: () => void;
}

const DIMENSIONS: { key: AuditDimension; label: string; icon: React.ReactNode; description: string }[] = [
  {
    key: 'user_experience',
    label: 'User Experience',
    icon: <Users className="h-4 w-4" />,
    description: 'First-time clarity, daily flow, cognitive load, one-tap access, calmness during hearings',
  },
  {
    key: 'role_permissions',
    label: 'Role & Permissions',
    icon: <Shield className="h-4 w-4" />,
    description: 'Senior vs Junior separation, delegation clarity, paid vs free degradation',
  },
  {
    key: 'product_coherence',
    label: 'Product Coherence',
    icon: <Puzzle className="h-4 w-4" />,
    description: 'Feature target role, moment of use, navigation placement, duplication, orphan risk',
  },
  {
    key: 'system_failure',
    label: 'System & Failure',
    icon: <Zap className="h-4 w-4" />,
    description: 'Network loss, delayed data, live board lag, notification failure, graceful degradation',
  },
  {
    key: 'operator_readiness',
    label: 'Operator Readiness',
    icon: <Wrench className="h-4 w-4" />,
    description: 'Debuggability, logs, audit trails, escalation explainability, rollback capability',
  },
  {
    key: 'business_liability',
    label: 'Business & Liability',
    icon: <Scale className="h-4 w-4" />,
    description: 'AI disclaimers, alert promise vs reality, consent, data exposure, subscription enforcement',
  },
];

export function AuditRunDetail({ auditRunId, onBack }: AuditRunDetailProps) {
  const { data: auditRun, isLoading: isLoadingRun } = useAuditRun(auditRunId);
  const { data: findings = [] } = useAuditFindings(auditRunId);
  const { data: risks = [] } = useAuditRisks(auditRunId);
  const updateAuditRun = useUpdateAuditRun();

  const [activeTab, setActiveTab] = useState('dimensions');
  const [selectedDimension, setSelectedDimension] = useState<AuditDimension | null>(null);

  if (isLoadingRun || !auditRun) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading audit...</div>
      </div>
    );
  }

  const findingsBySeverity = {
    critical: findings.filter((f) => f.severity === 'critical'),
    high: findings.filter((f) => f.severity === 'high'),
    medium: findings.filter((f) => f.severity === 'medium'),
    low: findings.filter((f) => f.severity === 'low'),
  };

  const openFindings = findings.filter((f) => f.status === 'open');
  const criticalOpen = openFindings.filter((f) => f.severity === 'critical');

  const risksByType = {
    ux: risks.filter((r) => r.risk_type === 'ux'),
    trust: risks.filter((r) => r.risk_type === 'trust'),
    operational: risks.filter((r) => r.risk_type === 'operational'),
    legal: risks.filter((r) => r.risk_type === 'legal'),
    scale: risks.filter((r) => r.risk_type === 'scale'),
  };

  const canComplete = !criticalOpen.length || auditRun.go_decision === 'no_go';

  const handleCompleteAudit = async (decision: GoDecision, justification: string) => {
    let status: AuditStatus = 'pass';
    if (decision === 'no_go') status = 'fail';
    else if (decision === 'conditional_go' || openFindings.length > 0) status = 'conditional';

    await updateAuditRun.mutateAsync({
      id: auditRunId,
      updates: {
        completed_at: new Date().toISOString(),
        overall_status: status,
        go_decision: decision,
        go_justification: justification,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl font-bold text-foreground">{auditRun.audit_name}</h2>
            {auditRun.overall_status && (
              <Badge
                className={
                  auditRun.overall_status === 'pass'
                    ? 'bg-green-600'
                    : auditRun.overall_status === 'conditional'
                    ? 'bg-amber-600'
                    : 'bg-destructive'
                }
              >
                {auditRun.overall_status.toUpperCase()}
              </Badge>
            )}
            {auditRun.go_decision && (
              <Badge
                className={
                  auditRun.go_decision === 'go'
                    ? 'bg-green-700'
                    : auditRun.go_decision === 'conditional_go'
                    ? 'bg-amber-700'
                    : 'bg-destructive'
                }
              >
                {auditRun.go_decision === 'conditional_go' ? 'CONDITIONAL GO' : auditRun.go_decision.toUpperCase()}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {auditRun.audit_scope === 'release' ? 'Release Audit' : auditRun.audit_scope === 'full-system' ? 'Full System Audit' : 'Feature Audit'}
            {' • '}Started {format(new Date(auditRun.started_at), 'MMM d, yyyy HH:mm')}
            {auditRun.completed_at && ` • Completed ${format(new Date(auditRun.completed_at), 'MMM d, yyyy HH:mm')}`}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Critical"
          count={findingsBySeverity.critical.length}
          open={findingsBySeverity.critical.filter((f) => f.status === 'open').length}
          variant="critical"
        />
        <SummaryCard
          title="High"
          count={findingsBySeverity.high.length}
          open={findingsBySeverity.high.filter((f) => f.status === 'open').length}
          variant="high"
        />
        <SummaryCard
          title="Medium"
          count={findingsBySeverity.medium.length}
          open={findingsBySeverity.medium.filter((f) => f.status === 'open').length}
          variant="medium"
        />
        <SummaryCard
          title="Low"
          count={findingsBySeverity.low.length}
          open={findingsBySeverity.low.filter((f) => f.status === 'open').length}
          variant="low"
        />
      </div>

      {/* Critical Blocker Warning */}
      {criticalOpen.length > 0 && !auditRun.completed_at && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Release Blocked</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {criticalOpen.length} critical finding(s) remain open. 
                  Audit cannot be marked PASS until all critical findings are resolved.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
          <TabsTrigger value="findings">
            Findings ({findings.length})
          </TabsTrigger>
          <TabsTrigger value="risks">
            Risks ({risks.length})
          </TabsTrigger>
          <TabsTrigger value="decision">Decision</TabsTrigger>
        </TabsList>

        <TabsContent value="dimensions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Audit Dimensions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Evaluate each dimension systematically. Click to add findings.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {DIMENSIONS.map((dim) => {
                const dimFindings = findings.filter((f) => f.dimension === dim.key);
                const dimOpen = dimFindings.filter((f) => f.status === 'open');
                const hasCritical = dimFindings.some((f) => f.severity === 'critical' && f.status === 'open');

                return (
                  <div
                    key={dim.key}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedDimension === dim.key
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    } ${hasCritical ? 'border-destructive/50' : ''}`}
                    onClick={() => setSelectedDimension(selectedDimension === dim.key ? null : dim.key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-muted-foreground">{dim.icon}</div>
                        <div>
                          <p className="font-medium">{dim.label}</p>
                          <p className="text-sm text-muted-foreground">{dim.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {dimFindings.length > 0 ? (
                          <>
                            <Badge variant="outline">{dimFindings.length} findings</Badge>
                            {dimOpen.length > 0 && (
                              <Badge variant="destructive">{dimOpen.length} open</Badge>
                            )}
                          </>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Not evaluated
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {selectedDimension && (
            <FindingsPanel
              auditRunId={auditRunId}
              dimension={selectedDimension}
              findings={findings.filter((f) => f.dimension === selectedDimension)}
              onClose={() => setSelectedDimension(null)}
            />
          )}
        </TabsContent>

        <TabsContent value="findings" className="space-y-4">
          <FindingsPanel
            auditRunId={auditRunId}
            findings={findings}
          />
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <RisksPanel
            auditRunId={auditRunId}
            risks={risks}
            risksByType={risksByType}
          />
        </TabsContent>

        <TabsContent value="decision" className="space-y-4">
          <DecisionPanel
            auditRun={auditRun}
            findings={findings}
            openFindings={openFindings}
            criticalOpen={criticalOpen}
            canComplete={canComplete}
            onComplete={handleCompleteAudit}
            isUpdating={updateAuditRun.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  count: number;
  open: number;
  variant: 'critical' | 'high' | 'medium' | 'low';
}

function SummaryCard({ title, count, open, variant }: SummaryCardProps) {
  const colors = {
    critical: 'text-destructive border-destructive/30',
    high: 'text-orange-500 border-orange-500/30',
    medium: 'text-amber-500 border-amber-500/30',
    low: 'text-blue-500 border-blue-500/30',
  };

  return (
    <Card className={`border ${colors[variant]}`}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-2xl font-bold ${colors[variant].split(' ')[0]}`}>{count}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
          {open > 0 && (
            <Badge variant="destructive" className="text-xs">
              {open} open
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface DecisionPanelProps {
  auditRun: any;
  findings: any[];
  openFindings: any[];
  criticalOpen: any[];
  canComplete: boolean;
  onComplete: (decision: GoDecision, justification: string) => Promise<void>;
  isUpdating: boolean;
}

function DecisionPanel({
  auditRun,
  findings,
  openFindings,
  criticalOpen,
  canComplete,
  onComplete,
  isUpdating,
}: DecisionPanelProps) {
  const [decision, setDecision] = useState<GoDecision | ''>('');
  const [justification, setJustification] = useState('');

  if (auditRun.completed_at) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Audit Decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3 mb-2">
              {auditRun.go_decision === 'go' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {auditRun.go_decision === 'conditional_go' && <AlertCircle className="h-5 w-5 text-amber-500" />}
              {auditRun.go_decision === 'no_go' && <XCircle className="h-5 w-5 text-destructive" />}
              <span className="font-medium text-lg">
                {auditRun.go_decision === 'go' && 'GO - Safe to Release'}
                {auditRun.go_decision === 'conditional_go' && 'CONDITIONAL GO - Release with Constraints'}
                {auditRun.go_decision === 'no_go' && 'NO-GO - Release Blocked'}
              </span>
            </div>
            {auditRun.go_justification && (
              <p className="text-sm text-muted-foreground">{auditRun.go_justification}</p>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            <p>Total Findings: {findings.length}</p>
            <p>Open at Close: {openFindings.length}</p>
            <p>Completed: {format(new Date(auditRun.completed_at), 'MMM d, yyyy HH:mm')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Close Audit</CardTitle>
        <p className="text-sm text-muted-foreground">
          Make a GO / NO-GO decision. This cannot be undone.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audit Summary */}
        <div className="p-4 rounded-lg bg-muted space-y-2">
          <p className="font-medium">Audit Summary</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Findings</p>
              <p className="text-lg font-bold">{findings.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Open Findings</p>
              <p className="text-lg font-bold text-amber-500">{openFindings.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Critical Open</p>
              <p className={`text-lg font-bold ${criticalOpen.length > 0 ? 'text-destructive' : 'text-green-500'}`}>
                {criticalOpen.length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Dimensions Evaluated</p>
              <p className="text-lg font-bold">
                {new Set(findings.map((f) => f.dimension)).size}/6
              </p>
            </div>
          </div>
        </div>

        {/* Warning if not all dimensions evaluated */}
        {findings.length === 0 && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-amber-500 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>No findings logged. Absence of findings is considered an audit failure.</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Decision Selection */}
        <div className="space-y-2">
          <Label>Decision</Label>
          <Select value={decision} onValueChange={(v) => setDecision(v as GoDecision)}>
            <SelectTrigger>
              <SelectValue placeholder="Select decision..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="go" disabled={criticalOpen.length > 0}>
                GO - Safe to expose to real advocates
              </SelectItem>
              <SelectItem value="conditional_go" disabled={criticalOpen.length > 0}>
                CONDITIONAL GO - Safe with listed constraints
              </SelectItem>
              <SelectItem value="no_go">
                NO-GO - Release blocked
              </SelectItem>
            </SelectContent>
          </Select>
          {criticalOpen.length > 0 && (
            <p className="text-xs text-destructive">
              GO and CONDITIONAL GO disabled: {criticalOpen.length} critical finding(s) remain open.
            </p>
          )}
        </div>

        {/* Justification */}
        <div className="space-y-2">
          <Label>Justification (Required)</Label>
          <Textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="One-sentence justification for the decision..."
            rows={3}
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            onClick={() => decision && onComplete(decision, justification)}
            disabled={!decision || !justification.trim() || isUpdating}
          >
            {isUpdating ? 'Closing...' : 'Close Audit'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
