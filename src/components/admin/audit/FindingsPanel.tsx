import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X, CheckCircle, AlertCircle, XCircle, Edit2, Trash2 } from 'lucide-react';
import {
  useCreateAuditFinding,
  useUpdateAuditFinding,
  useDeleteAuditFinding,
  AuditDimension,
  AuditFinding,
  FindingSeverity,
  FindingStatus,
} from '@/hooks/useAudit';
import { format } from 'date-fns';

interface FindingsPanelProps {
  auditRunId: string;
  dimension?: AuditDimension;
  findings: AuditFinding[];
  onClose?: () => void;
}

const DIMENSION_LABELS: Record<AuditDimension, string> = {
  user_experience: 'User Experience',
  role_permissions: 'Role & Permissions',
  product_coherence: 'Product Coherence',
  system_failure: 'System & Failure',
  operator_readiness: 'Operator Readiness',
  business_liability: 'Business & Liability',
};

const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-blue-500 text-white',
};

export function FindingsPanel({ auditRunId, dimension, findings, onClose }: FindingsPanelProps) {
  const createFinding = useCreateAuditFinding();
  const updateFinding = useUpdateAuditFinding();
  const deleteFinding = useDeleteAuditFinding();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New finding form state
  const [newArea, setNewArea] = useState('');
  const [newIssue, setNewIssue] = useState('');
  const [newSeverity, setNewSeverity] = useState<FindingSeverity>('medium');
  const [newRecommendation, setNewRecommendation] = useState('');
  const [newDimension, setNewDimension] = useState<AuditDimension>(dimension || 'user_experience');

  const resetForm = () => {
    setNewArea('');
    setNewIssue('');
    setNewSeverity('medium');
    setNewRecommendation('');
    setShowNewForm(false);
  };

  const handleCreate = async () => {
    if (!newArea.trim() || !newIssue.trim()) return;

    await createFinding.mutateAsync({
      audit_run_id: auditRunId,
      dimension: dimension || newDimension,
      area: newArea.trim(),
      issue: newIssue.trim(),
      severity: newSeverity,
      recommendation: newRecommendation.trim() || undefined,
    });

    resetForm();
  };

  const handleStatusChange = async (finding: AuditFinding, newStatus: FindingStatus) => {
    await updateFinding.mutateAsync({
      id: finding.id,
      audit_run_id: auditRunId,
      updates: { status: newStatus },
    });
  };

  const handleDelete = async (finding: AuditFinding) => {
    if (!confirm('Delete this finding? This cannot be undone.')) return;
    await deleteFinding.mutateAsync({ id: finding.id, audit_run_id: auditRunId });
  };

  const sortedFindings = [...findings].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const statusOrder = { open: 0, acknowledged: 1, fixed: 2 };
    
    if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status];
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">
            {dimension ? `${DIMENSION_LABELS[dimension]} Findings` : 'All Findings'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {findings.length} finding(s) • {findings.filter((f) => f.status === 'open').length} open
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowNewForm(true)} className="gap-1">
            <Plus className="h-3 w-3" />
            Add Finding
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Finding Form */}
        {showNewForm && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">New Finding</p>
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {!dimension && (
                <div className="space-y-1">
                  <Label className="text-xs">Dimension</Label>
                  <Select value={newDimension} onValueChange={(v) => setNewDimension(v as AuditDimension)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Area</Label>
                  <Input
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    placeholder="e.g., War Room, Notifications"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Severity</Label>
                  <Select value={newSeverity} onValueChange={(v) => setNewSeverity(v as FindingSeverity)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Issue</Label>
                <Textarea
                  value={newIssue}
                  onChange={(e) => setNewIssue(e.target.value)}
                  placeholder="Describe the issue clearly..."
                  rows={2}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea
                  value={newRecommendation}
                  onChange={(e) => setNewRecommendation(e.target.value)}
                  placeholder="Additional context or observations..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newArea.trim() || !newIssue.trim() || createFinding.isPending}
                >
                  {createFinding.isPending ? 'Adding...' : 'Add Finding'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Findings List */}
        {sortedFindings.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No findings logged yet. Add findings to document issues.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedFindings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                showDimension={!dimension}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FindingCardProps {
  finding: AuditFinding;
  showDimension?: boolean;
  onStatusChange: (finding: AuditFinding, status: FindingStatus) => Promise<void>;
  onDelete: (finding: AuditFinding) => Promise<void>;
}

function FindingCard({ finding, showDimension, onStatusChange, onDelete }: FindingCardProps) {
  const statusIcons = {
    open: <AlertCircle className="h-4 w-4 text-amber-500" />,
    acknowledged: <AlertCircle className="h-4 w-4 text-blue-500" />,
    fixed: <CheckCircle className="h-4 w-4 text-green-500" />,
  };

  return (
    <div
      className={`p-3 rounded-lg border ${
        finding.status === 'fixed'
          ? 'border-green-500/30 bg-green-500/5'
          : finding.severity === 'critical'
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {statusIcons[finding.status]}
            <Badge className={SEVERITY_COLORS[finding.severity]}>{finding.severity}</Badge>
            <Badge variant="outline">{finding.area}</Badge>
            {showDimension && (
              <Badge variant="secondary" className="text-xs">
                {DIMENSION_LABELS[finding.dimension]}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium">{finding.issue}</p>
          {finding.recommendation && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Recommendation:</span> {finding.recommendation}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {format(new Date(finding.created_at), 'MMM d, HH:mm')}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Select
            value={finding.status}
            onValueChange={(v) => onStatusChange(finding, v as FindingStatus)}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="fixed">Fixed</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(finding)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
