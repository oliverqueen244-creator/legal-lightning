import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ClipboardList, AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react';
import { useAuditRuns, useDeleteAuditRun, AuditRun, AuditStatus, GoDecision } from '@/hooks/useAudit';
import { useAuth } from '@/hooks/useAuth';
import { NewAuditDialog } from './NewAuditDialog';
import { AuditRunDetail } from './AuditRunDetail';
import { format } from 'date-fns';

export function AuditConsole() {
  const { user } = useAuth();
  const { data: auditRuns, isLoading } = useAuditRuns();
  const deleteAuditRun = useDeleteAuditRun();
  
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

  const getStatusBadge = (status: AuditStatus | null) => {
    if (!status) return <Badge variant="outline">In Progress</Badge>;
    
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-600 text-white">PASS</Badge>;
      case 'conditional':
        return <Badge className="bg-amber-600 text-white">CONDITIONAL</Badge>;
      case 'fail':
        return <Badge variant="destructive">FAIL</Badge>;
    }
  };

  const getDecisionBadge = (decision: GoDecision | null) => {
    if (!decision) return null;
    
    switch (decision) {
      case 'go':
        return <Badge className="bg-green-700 text-white">GO</Badge>;
      case 'conditional_go':
        return <Badge className="bg-amber-700 text-white">CONDITIONAL GO</Badge>;
      case 'no_go':
        return <Badge variant="destructive">NO-GO</Badge>;
    }
  };

  const getScopeLabel = (scope: string) => {
    switch (scope) {
      case 'release': return 'Release Audit';
      case 'feature': return 'Feature Audit';
      case 'full-system': return 'Full System Audit';
      default: return scope;
    }
  };

  if (selectedAuditId) {
    return (
      <AuditRunDetail
        auditRunId={selectedAuditId}
        onBack={() => setSelectedAuditId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Audit Console</h2>
          <p className="text-sm text-muted-foreground">
            Internal quality assurance and release readiness system
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Start New Audit
        </Button>
      </div>

      {/* Warning Banner */}
      <Card className="border-amber-500/50 bg-amber-500/10">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-500">Audit System Purpose</p>
              <p className="text-muted-foreground mt-1">
                This system exists to find flaws, not to praise the product. 
                Absence of findings is considered an audit failure. 
                If something cannot be audited, it is a blind spot.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Runs List */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Active Audits
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Completed
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <FileText className="h-4 w-4" />
            All Audits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading audits...
              </CardContent>
            </Card>
          ) : (
            <AuditRunsList
              runs={auditRuns?.filter(r => !r.completed_at) || []}
              onSelect={setSelectedAuditId}
              onDelete={(id) => deleteAuditRun.mutate(id)}
              getStatusBadge={getStatusBadge}
              getDecisionBadge={getDecisionBadge}
              getScopeLabel={getScopeLabel}
            />
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <AuditRunsList
            runs={auditRuns?.filter(r => r.completed_at) || []}
            onSelect={setSelectedAuditId}
            onDelete={(id) => deleteAuditRun.mutate(id)}
            getStatusBadge={getStatusBadge}
            getDecisionBadge={getDecisionBadge}
            getScopeLabel={getScopeLabel}
          />
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <AuditRunsList
            runs={auditRuns || []}
            onSelect={setSelectedAuditId}
            onDelete={(id) => deleteAuditRun.mutate(id)}
            getStatusBadge={getStatusBadge}
            getDecisionBadge={getDecisionBadge}
            getScopeLabel={getScopeLabel}
          />
        </TabsContent>
      </Tabs>

      {/* New Audit Dialog */}
      <NewAuditDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        userId={user?.id}
        onSuccess={(id) => {
          setShowNewDialog(false);
          setSelectedAuditId(id);
        }}
      />
    </div>
  );
}

interface AuditRunsListProps {
  runs: AuditRun[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  getStatusBadge: (status: AuditStatus | null) => JSX.Element;
  getDecisionBadge: (decision: GoDecision | null) => JSX.Element | null;
  getScopeLabel: (scope: string) => string;
}

function AuditRunsList({ 
  runs, 
  onSelect, 
  onDelete,
  getStatusBadge, 
  getDecisionBadge, 
  getScopeLabel 
}: AuditRunsListProps) {
  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No audits found in this category.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <Card 
          key={run.id} 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onSelect(run.id)}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground">{run.audit_name}</h3>
                  {getStatusBadge(run.overall_status)}
                  {getDecisionBadge(run.go_decision)}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{getScopeLabel(run.audit_scope)}</span>
                  <span>Started: {format(new Date(run.started_at), 'MMM d, yyyy HH:mm')}</span>
                  {run.completed_at && (
                    <span>Completed: {format(new Date(run.completed_at), 'MMM d, yyyy HH:mm')}</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this audit run? This cannot be undone.')) {
                    onDelete(run.id);
                  }
                }}
                className="text-destructive hover:text-destructive"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
