/**
 * INTERN INTEGRATION PHASE 2B: Activity Digest & Timeline
 * 
 * Read-only views for supervisor visibility.
 * No actions inside these views. Just information.
 * 
 * SCOPE CONSTRAINTS:
 * - Strictly read-only
 * - No export, delete, or edit
 * - Supervisor-only via data filtering
 * - Feature-flagged
 * - Fully removable
 * 
 * SECURITY REVIEW: 2026-01-14
 */

import { useState } from 'react';
import { Activity, FileText, CheckCircle, XCircle, Eye, Clock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  usePhase2BEnabled,
  useInternActivityDigest,
  useInternTimeline,
  type InternActivityDigest,
  type InternAccessLogEntry
} from '@/hooks/useInternSupervision';
import { format, formatDistanceToNow } from 'date-fns';

/**
 * Weekly activity digest - read-only summary
 */
export function InternActivityDigestPanel() {
  const { data: isEnabled } = usePhase2BEnabled();
  const { data: digest = [], isLoading } = useInternActivityDigest();
  const [selectedIntern, setSelectedIntern] = useState<InternActivityDigest | null>(null);
  
  if (!isEnabled) {
    return null;
  }
  
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading digest...</p>;
  }
  
  if (digest.length === 0) {
    return null;
  }
  
  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium">Intern Activity</h4>
        </div>
        
        <div className="space-y-2">
          {digest.map(intern => (
            <DigestCard 
              key={intern.intern_account_id} 
              intern={intern}
              onViewTimeline={() => setSelectedIntern(intern)}
            />
          ))}
        </div>
      </div>
      
      {/* Timeline Dialog */}
      {selectedIntern && (
        <InternTimelineDialog 
          intern={selectedIntern}
          open={!!selectedIntern}
          onOpenChange={(open) => !open && setSelectedIntern(null)}
        />
      )}
    </>
  );
}

/**
 * Individual digest card for one intern
 */
function DigestCard({ 
  intern,
  onViewTimeline
}: { 
  intern: InternActivityDigest;
  onViewTimeline: () => void;
}) {
  const lastActivityText = intern.last_activity_at 
    ? formatDistanceToNow(new Date(intern.last_activity_at), { addSuffix: true })
    : 'No activity';
  
  return (
    <Card 
      className="cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={onViewTimeline}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-medium text-sm">{intern.intern_name}</span>
            
            {/* Draft stats */}
            <div className="flex items-center gap-2 text-xs">
              {(intern.pending_drafts_count || 0) > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {intern.pending_drafts_count} pending
                </Badge>
              )}
              {(intern.approved_drafts_count || 0) > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  {intern.approved_drafts_count}
                </span>
              )}
              {(intern.rejected_drafts_count || 0) > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-3 w-3" />
                  {intern.rejected_drafts_count}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{lastActivityText}</span>
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Immutable timeline dialog - read-only
 */
function InternTimelineDialog({ 
  intern,
  open,
  onOpenChange
}: { 
  intern: InternActivityDigest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: timeline = [], isLoading } = useInternTimeline(intern.intern_account_id);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {intern.intern_name} — Activity Timeline
          </DialogTitle>
          <DialogDescription>
            Read-only record of all logged actions. Cannot be edited or exported.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[50vh]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading timeline...</p>
          ) : timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded</p>
          ) : (
            <div className="space-y-0">
              {timeline.map((entry, index) => (
                <TimelineEntry 
                  key={entry.id} 
                  entry={entry} 
                  isLast={index === timeline.length - 1}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Single timeline entry
 */
function TimelineEntry({ 
  entry, 
  isLast 
}: { 
  entry: InternAccessLogEntry;
  isLast: boolean;
}) {
  const actionLabels: Record<string, { label: string; icon: typeof Eye }> = {
    'case_view': { label: 'Viewed case', icon: Eye },
    'draft_created': { label: 'Created draft', icon: FileText },
    'draft_updated': { label: 'Updated draft', icon: FileText },
    'draft_submitted': { label: 'Submitted for review', icon: FileText },
    'draft_reviewed': { label: 'Draft reviewed', icon: CheckCircle },
    'access_denied': { label: 'Access denied', icon: XCircle },
  };
  
  const action = actionLabels[entry.action_type] || { label: entry.action_type, icon: Activity };
  const Icon = action.icon;
  const loggedAt = new Date(entry.logged_at);
  
  return (
    <div className="flex gap-3">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className="w-2 h-2 rounded-full bg-primary mt-2" />
        {!isLast && <div className="w-px flex-1 bg-border" />}
      </div>
      
      {/* Content */}
      <div className="pb-4 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{action.label}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {format(loggedAt, 'dd MMM yyyy, HH:mm')}
        </div>
        {entry.details && Object.keys(entry.details).length > 0 && (
          <div className="text-xs text-muted-foreground mt-1 font-mono bg-muted/30 px-2 py-1 rounded">
            {JSON.stringify(entry.details)}
          </div>
        )}
      </div>
    </div>
  );
}
