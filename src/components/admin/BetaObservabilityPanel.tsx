import { RefreshCw, Shield, ShieldAlert, ShieldCheck, Users, FileKey, Activity, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBetaObservability } from '@/hooks/useBetaObservability';
import { format } from 'date-fns';

export function BetaObservabilityPanel() {
  const { stats, securityEvents, invariantHealth, isLoading, refetchAll } = useBetaObservability();

  const getEventTypeBadge = (eventType: string) => {
    switch (eventType) {
      case 'scope_violation':
        return <Badge variant="destructive">Scope Violation</Badge>;
      case 'ownership_violation':
        return <Badge variant="destructive">Ownership Violation</Badge>;
      case 'context_violation':
        return <Badge className="bg-orange-500">Context Violation</Badge>;
      case 'unattributed_mutation':
        return <Badge variant="secondary">Unattributed</Badge>;
      default:
        return <Badge variant="outline">{eventType}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Live Beta Observability</h2>
          <p className="text-sm text-muted-foreground">
            Real-time security monitoring for CP-4/CP-5 enforcement
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Invariant Health Check */}
      <Card className={invariantHealth.isHealthy ? 'border-green-500/50' : 'border-destructive'}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {invariantHealth.isHealthy ? (
              <ShieldCheck className="h-5 w-5 text-green-500" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            )}
            System Invariants
          </CardTitle>
          <CardDescription>
            All checks must show 0 for a healthy system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InvariantCard
              label="Invalid Contexts"
              value={invariantHealth.invalidContexts}
              description="case_context ↔ chamber_id mismatch"
            />
            <InvariantCard
              label="Clerk Ownership"
              value={invariantHealth.clerkOwnershipViolations}
              description="Cases owned by CLERKs"
            />
            <InvariantCard
              label="Scope Violations"
              value={invariantHealth.delegationScopeViolations}
              description="Delegated actions without scope"
            />
            <InvariantCard
              label="Unattributed"
              value={invariantHealth.unattributedMutations}
              description="Mutations without logging"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          icon={<Users className="h-4 w-4" />}
          label="Active Chambers"
          value={stats.activeChambers}
        />
        <StatsCard
          icon={<FileKey className="h-4 w-4" />}
          label="Active Delegations"
          value={stats.activeDelegations}
        />
        <StatsCard
          icon={<Activity className="h-4 w-4" />}
          label="Delegated Actions (24h)"
          value={stats.delegatedActions24h}
        />
        <StatsCard
          icon={<Shield className="h-4 w-4" />}
          label="Blocked Actions (24h)"
          value={stats.blockedActions24h}
          variant={stats.blockedActions24h > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Security Events Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Security Events (Last 50)
          </CardTitle>
          <CardDescription>
            All blocked operations and violations are logged here
          </CardDescription>
        </CardHeader>
        <CardContent>
          {securityEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No security events recorded</p>
              <p className="text-xs">This is good! The system is operating cleanly.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Time</TableHead>
                    <TableHead className="w-[140px]">Type</TableHead>
                    <TableHead className="w-[100px]">Role</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {securityEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-xs">
                        {format(new Date(event.created_at), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell>{getEventTypeBadge(event.event_type)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {event.user_role || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {event.attempted_action}
                      </TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate" title={event.reason}>
                        {event.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InvariantCard({ label, value, description }: { label: string; value: number; description: string }) {
  const isHealthy = value === 0;
  return (
    <div className={`p-3 rounded-lg border ${isHealthy ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium">{label}</span>
        <span className={`text-lg font-bold ${isHealthy ? 'text-green-500' : 'text-destructive'}`}>
          {value}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">{description}</p>
    </div>
  );
}

function StatsCard({ 
  icon, 
  label, 
  value, 
  variant = 'default' 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number;
  variant?: 'default' | 'warning';
}) {
  return (
    <Card className={variant === 'warning' && value > 0 ? 'border-orange-500/50' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${variant === 'warning' && value > 0 ? 'text-orange-500' : ''}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
