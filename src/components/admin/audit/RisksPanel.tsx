import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X, Trash2, AlertTriangle, Users, Shield, Wrench, Scale, TrendingUp } from 'lucide-react';
import {
  useCreateAuditRisk,
  useDeleteAuditRisk,
  AuditRisk,
  RiskType,
  FindingSeverity,
} from '@/hooks/useAudit';
import { format } from 'date-fns';

interface RisksPanelProps {
  auditRunId: string;
  risks: AuditRisk[];
  risksByType: Record<RiskType, AuditRisk[]>;
}

const RISK_TYPE_CONFIG: Record<RiskType, { label: string; icon: React.ReactNode; description: string }> = {
  ux: {
    label: 'UX Risk',
    icon: <Users className="h-4 w-4" />,
    description: 'User experience issues that may cause confusion or frustration',
  },
  trust: {
    label: 'Trust Risk',
    icon: <Shield className="h-4 w-4" />,
    description: 'Issues that may erode user confidence in the product',
  },
  operational: {
    label: 'Operational Risk',
    icon: <Wrench className="h-4 w-4" />,
    description: 'Issues affecting system operation, debugging, or support',
  },
  legal: {
    label: 'Legal Risk',
    icon: <Scale className="h-4 w-4" />,
    description: 'Compliance, liability, or regulatory concerns',
  },
  scale: {
    label: 'Scale Risk',
    icon: <TrendingUp className="h-4 w-4" />,
    description: 'Issues that may emerge at larger user volumes',
  },
};

const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-blue-500 text-white',
};

export function RisksPanel({ auditRunId, risks, risksByType }: RisksPanelProps) {
  const createRisk = useCreateAuditRisk();
  const deleteRisk = useDeleteAuditRisk();

  const [showNewForm, setShowNewForm] = useState(false);
  const [newType, setNewType] = useState<RiskType>('ux');
  const [newDescription, setNewDescription] = useState('');
  const [newImpact, setNewImpact] = useState('');
  const [newMitigation, setNewMitigation] = useState('');
  const [newSeverity, setNewSeverity] = useState<FindingSeverity>('medium');

  const resetForm = () => {
    setNewType('ux');
    setNewDescription('');
    setNewImpact('');
    setNewMitigation('');
    setNewSeverity('medium');
    setShowNewForm(false);
  };

  const handleCreate = async () => {
    if (!newDescription.trim() || !newImpact.trim()) return;

    await createRisk.mutateAsync({
      audit_run_id: auditRunId,
      risk_type: newType,
      description: newDescription.trim(),
      impact: newImpact.trim(),
      severity: newSeverity,
      mitigation: newMitigation.trim() || undefined,
    });

    resetForm();
  };

  const handleDelete = async (risk: AuditRisk) => {
    if (!confirm('Delete this risk? This cannot be undone.')) return;
    await deleteRisk.mutateAsync({ id: risk.id, audit_run_id: auditRunId });
  };

  return (
    <div className="space-y-4">
      {/* Risk Summary by Type */}
      <div className="grid gap-3 md:grid-cols-5">
        {(Object.keys(RISK_TYPE_CONFIG) as RiskType[]).map((type) => {
          const typeRisks = risksByType[type];
          const config = RISK_TYPE_CONFIG[type];
          const hasCritical = typeRisks.some((r) => r.severity === 'critical');

          return (
            <Card
              key={type}
              className={`${hasCritical ? 'border-destructive/50' : ''}`}
            >
              <CardContent className="py-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-muted-foreground">{config.icon}</div>
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
                <p className="text-2xl font-bold">{typeRisks.length}</p>
                {hasCritical && (
                  <Badge variant="destructive" className="mt-1 text-xs">
                    Has Critical
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Risk Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowNewForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Log Risk
        </Button>
      </div>

      {/* New Risk Form */}
      {showNewForm && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">Log New Risk</p>
              <Button size="sm" variant="ghost" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Risk Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as RiskType)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RISK_TYPE_CONFIG) as RiskType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {RISK_TYPE_CONFIG[type].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Severity</Label>
                <Select value={newSeverity} onValueChange={(v) => setNewSeverity(v as FindingSeverity)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe the risk..."
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Impact</Label>
              <Textarea
                value={newImpact}
                onChange={(e) => setNewImpact(e.target.value)}
                placeholder="What happens if this risk materializes?"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Mitigation (optional)</Label>
              <Textarea
                value={newMitigation}
                onChange={(e) => setNewMitigation(e.target.value)}
                placeholder="How can this risk be mitigated?"
                rows={2}
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newDescription.trim() || !newImpact.trim() || createRisk.isPending}
              >
                {createRisk.isPending ? 'Logging...' : 'Log Risk'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risks List by Type */}
      {(Object.keys(RISK_TYPE_CONFIG) as RiskType[]).map((type) => {
        const typeRisks = risksByType[type];
        if (typeRisks.length === 0) return null;

        const config = RISK_TYPE_CONFIG[type];

        return (
          <Card key={type}>
            <CardHeader className="py-3">
              <div className="flex items-center gap-2">
                {config.icon}
                <CardTitle className="text-base">{config.label}</CardTitle>
                <Badge variant="outline">{typeRisks.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {typeRisks.map((risk) => (
                <RiskCard key={risk.id} risk={risk} onDelete={handleDelete} />
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Empty State */}
      {risks.length === 0 && !showNewForm && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>No risks logged yet.</p>
            <p className="text-sm">Document risks to ensure comprehensive audit coverage.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface RiskCardProps {
  risk: AuditRisk;
  onDelete: (risk: AuditRisk) => Promise<void>;
}

function RiskCard({ risk, onDelete }: RiskCardProps) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        risk.severity === 'critical'
          ? 'border-destructive/30 bg-destructive/5'
          : risk.severity === 'high'
          ? 'border-orange-500/30 bg-orange-500/5'
          : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Badge className={SEVERITY_COLORS[risk.severity]}>{risk.severity}</Badge>
          </div>
          <p className="text-sm font-medium">{risk.description}</p>
          <div className="text-xs space-y-1">
            <p>
              <span className="font-medium text-muted-foreground">Impact:</span> {risk.impact}
            </p>
            {risk.mitigation && (
              <p>
                <span className="font-medium text-muted-foreground">Mitigation:</span> {risk.mitigation}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {format(new Date(risk.created_at), 'MMM d, HH:mm')}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(risk)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
