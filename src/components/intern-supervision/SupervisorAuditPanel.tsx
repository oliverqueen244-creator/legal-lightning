/**
 * INTERN INTEGRATION PHASE 2B: Supervisor Audit Panel
 * 
 * READ-ONLY audit view for supervisors showing:
 * - Intern identity (name, institution, expiry date)
 * - Assigned cases
 * - Draft activity timeline
 * - Access log summary (last 7/30 days)
 * - Expiry countdown banner
 * 
 * SCOPE CONSTRAINTS:
 * - Strictly read-only
 * - No exports
 * - No bulk actions
 * - No analytics charts
 * - No notifications
 * - Respects existing RLS (no bypass)
 * 
 * INTERN FEATURE SET COMPLETE as of Phase 2B.
 * Any expansion requires new audit + design approval.
 * 
 * SECURITY REVIEW: 2026-01-14
 */

import { useState } from 'react';
import { 
  GraduationCap, 
  Clock, 
  FileText, 
  Folder, 
  Activity, 
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  User
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  usePhase2BEnabled,
  useInternSupervisionEnabled,
  useInternActivityDigest,
  useInternTimeline,
  useInternAssignments,
  type InternActivityDigest,
  type InternAccessLogEntry
} from '@/hooks/useInternSupervision';
import { format, formatDistanceToNow, subDays } from 'date-fns';

/**
 * Main Supervisor Audit Panel
 * Lists all supervised interns with drill-down capability
 */
export function SupervisorAuditPanel() {
  const { data: isEnabled } = useInternSupervisionEnabled();
  const { data: isPhase2BEnabled } = usePhase2BEnabled();
  const { data: digest = [], isLoading } = useInternActivityDigest();
  const [selectedIntern, setSelectedIntern] = useState<InternActivityDigest | null>(null);
  
  // Feature flag check - require both Phase 2A and Phase 2B
  if (!isEnabled || !isPhase2BEnabled) {
    return null;
  }
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5" />
            Intern Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (digest.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5" />
            Intern Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No interns under your supervision.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" />
              Intern Audit
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {digest.length} intern{digest.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <CardDescription>
            Read-only view of intern activity. No exports allowed.
          </CardDescription>
        </CardHeader>
      </Card>
      
      {/* Intern List with drill-down */}
      <div className="space-y-3">
        {digest.map(intern => (
          <InternAuditCard 
            key={intern.intern_account_id} 
            intern={intern}
            isExpanded={selectedIntern?.intern_account_id === intern.intern_account_id}
            onToggle={() => setSelectedIntern(
              selectedIntern?.intern_account_id === intern.intern_account_id 
                ? null 
                : intern
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual intern audit card with expandable details
 */
function InternAuditCard({ 
  intern, 
  isExpanded,
  onToggle 
}: { 
  intern: InternActivityDigest;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isExpiringSoon = intern.days_until_expiry !== null && 
                          intern.days_until_expiry >= 0 && 
                          intern.days_until_expiry <= 7;
  const isExpired = intern.days_until_expiry !== null && intern.days_until_expiry < 0;
  const isRevoked = !!intern.revoked_at;
  
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className={`transition-colors ${
        isExpired || isRevoked 
          ? 'border-destructive/30 bg-destructive/5' 
          : isExpiringSoon 
            ? 'border-amber-500/30 bg-amber-500/5' 
            : ''
      }`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-sm font-medium">
                    {intern.intern_name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Since {format(new Date(intern.intern_created_at), 'dd MMM yyyy')}
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Status badges */}
                {isRevoked ? (
                  <Badge variant="destructive" className="text-xs">Revoked</Badge>
                ) : isExpired ? (
                  <Badge variant="destructive" className="text-xs">Expired</Badge>
                ) : isExpiringSoon ? (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-500">
                    {intern.days_until_expiry === 0 
                      ? 'Expires today' 
                      : intern.days_until_expiry === 1 
                        ? 'Expires tomorrow'
                        : `${intern.days_until_expiry}d left`
                    }
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Active</Badge>
                )}
                
                {/* Quick stats */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {(intern.pending_drafts_count || 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {intern.pending_drafts_count}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Folder className="h-3 w-3" />
                    {intern.assigned_cases_count || 0}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Separator className="mb-4" />
            <InternAuditDetails intern={intern} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * Detailed audit view for a single intern
 */
function InternAuditDetails({ intern }: { intern: InternActivityDigest }) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
        <TabsTrigger value="cases" className="text-xs">Cases</TabsTrigger>
        <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
      </TabsList>
      
      <TabsContent value="overview" className="mt-4">
        <InternOverviewTab intern={intern} />
      </TabsContent>
      
      <TabsContent value="cases" className="mt-4">
        <InternCasesTab internAccountId={intern.intern_account_id} />
      </TabsContent>
      
      <TabsContent value="activity" className="mt-4">
        <InternActivityTab internAccountId={intern.intern_account_id} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * Overview tab - summary stats
 */
function InternOverviewTab({ intern }: { intern: InternActivityDigest }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Expiry Info */}
      <Card className="col-span-2">
        <CardHeader className="py-3">
          <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Expiry
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-lg font-medium">
            {format(new Date(intern.expires_at), 'dd MMM yyyy')}
          </p>
          <p className="text-xs text-muted-foreground">
            {intern.days_until_expiry !== null && intern.days_until_expiry >= 0
              ? `${intern.days_until_expiry} day${intern.days_until_expiry !== 1 ? 's' : ''} remaining`
              : 'Expired'}
          </p>
        </CardContent>
      </Card>
      
      {/* Draft Stats */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Pending
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-2xl font-bold text-primary">
            {intern.pending_drafts_count || 0}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
            <Folder className="h-3 w-3" />
            Cases
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-2xl font-bold">
            {intern.assigned_cases_count || 0}
          </p>
        </CardContent>
      </Card>
      
      {/* Review Stats */}
      <div className="col-span-2 md:col-span-4 grid grid-cols-3 gap-2">
        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
          <FileText className="h-4 w-4 text-amber-600" />
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="font-medium">{intern.pending_drafts_count || 0}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-md">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <div>
            <p className="text-xs text-muted-foreground">Approved</p>
            <p className="font-medium text-green-600">{intern.approved_drafts_count || 0}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-md">
          <XCircle className="h-4 w-4 text-red-600" />
          <div>
            <p className="text-xs text-muted-foreground">Rejected</p>
            <p className="font-medium text-red-600">{intern.rejected_drafts_count || 0}</p>
          </div>
        </div>
      </div>
      
      {/* Last Activity */}
      {intern.last_activity_at && (
        <div className="col-span-2 md:col-span-4 text-xs text-muted-foreground">
          Last activity: {formatDistanceToNow(new Date(intern.last_activity_at), { addSuffix: true })}
        </div>
      )}
    </div>
  );
}

/**
 * Cases tab - assigned cases list
 */
function InternCasesTab({ internAccountId }: { internAccountId: string }) {
  const { data: assignments = [], isLoading } = useInternAssignments(internAccountId);
  
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading cases...</p>;
  }
  
  if (assignments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No cases assigned
      </p>
    );
  }
  
  return (
    <ScrollArea className="max-h-48">
      <div className="space-y-2">
        {assignments.map(assignment => (
          <div 
            key={assignment.id} 
            className="p-2 bg-muted/30 rounded-md flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-mono">{assignment.docket?.case_number || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">
                {assignment.docket?.date && format(new Date(assignment.docket.date), 'dd MMM yyyy')}
                {assignment.docket?.court_room_no && ` • Court ${assignment.docket.court_room_no}`}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Assigned {formatDistanceToNow(new Date(assignment.assigned_at), { addSuffix: true })}
            </p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/**
 * Activity tab - access log timeline
 */
function InternActivityTab({ internAccountId }: { internAccountId: string }) {
  const { data: timeline = [], isLoading } = useInternTimeline(internAccountId);
  const [filter, setFilter] = useState<'7d' | '30d' | 'all'>('7d');
  
  // Filter by time range
  const now = new Date();
  const filteredTimeline = timeline.filter(entry => {
    if (filter === 'all') return true;
    const entryDate = new Date(entry.logged_at);
    const cutoff = filter === '7d' ? subDays(now, 7) : subDays(now, 30);
    return entryDate >= cutoff;
  });
  
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading activity...</p>;
  }
  
  return (
    <div className="space-y-3">
      {/* Time filter */}
      <div className="flex gap-2">
        {(['7d', '30d', 'all'] as const).map(option => (
          <Badge 
            key={option}
            variant={filter === option ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setFilter(option)}
          >
            {option === '7d' ? 'Last 7 days' : option === '30d' ? 'Last 30 days' : 'All'}
          </Badge>
        ))}
      </div>
      
      {filteredTimeline.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No activity in selected period
        </p>
      ) : (
        <ScrollArea className="max-h-60">
          <div className="space-y-0">
            {filteredTimeline.map((entry, index) => (
              <ActivityLogEntry 
                key={entry.id} 
                entry={entry} 
                isLast={index === filteredTimeline.length - 1}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

/**
 * Single activity log entry
 */
function ActivityLogEntry({ 
  entry, 
  isLast 
}: { 
  entry: InternAccessLogEntry;
  isLast: boolean;
}) {
  const actionConfig: Record<string, { label: string; icon: typeof Eye; color: string }> = {
    'case_view': { label: 'Viewed case', icon: Eye, color: 'text-blue-500' },
    'document_view': { label: 'Viewed document', icon: Eye, color: 'text-blue-500' },
    'draft_created': { label: 'Created draft', icon: FileText, color: 'text-primary' },
    'draft_updated': { label: 'Updated draft', icon: FileText, color: 'text-primary' },
    'draft_submitted': { label: 'Submitted for review', icon: FileText, color: 'text-amber-500' },
    'draft_reviewed': { label: 'Draft reviewed', icon: CheckCircle, color: 'text-green-500' },
    'access_denied': { label: 'Access blocked', icon: AlertTriangle, color: 'text-destructive' },
  };
  
  const config = actionConfig[entry.action_type] || { 
    label: entry.action_type, 
    icon: Activity, 
    color: 'text-muted-foreground' 
  };
  const Icon = config.icon;
  
  return (
    <div className="flex gap-3">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={`w-2 h-2 rounded-full mt-2 ${config.color.replace('text-', 'bg-')}`} />
        {!isLast && <div className="w-px flex-1 bg-border" />}
      </div>
      
      {/* Content */}
      <div className="pb-3 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <Icon className={`h-3 w-3 ${config.color}`} />
          <span className="font-medium">{config.label}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {format(new Date(entry.logged_at), 'dd MMM yyyy, HH:mm')}
        </div>
      </div>
    </div>
  );
}
