/**
 * INTERN INTEGRATION PHASE 2A: Minimal Supervisor UI
 * 
 * NOT a dashboard. Just operational controls:
 * - View supervised interns
 * - Assign/unassign cases
 * - Review submitted drafts
 * 
 * SCOPE CONSTRAINTS:
 * - No stats, counts, or activity summaries
 * - No bulk actions
 * - No global intern list
 * - Feature-flagged (disabled by default)
 * 
 * SECURITY REVIEW: 2026-01-14
 */

import { useState } from 'react';
import { GraduationCap, FileText, CheckCircle, XCircle, ChevronDown, ChevronRight, Trash2, UserPlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { InternInviteDialog } from './InternInviteDialog';
import { CaseAssignmentDialog } from './CaseAssignmentDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useSupervisedInterns,
  useSubmittedDrafts,
  useInternAssignments,
  useRemoveCaseAssignment,
  useReviewDraft,
  useInternSupervisionEnabled,
  type SupervisedIntern,
  type InternDraft,
} from '@/hooks/useInternSupervision';
import { format, formatDistanceToNow } from 'date-fns';

/**
 * Main supervisor panel - shows interns and pending drafts
 */
export function InternSupervisionPanel() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data: isEnabled, isLoading: flagLoading } = useInternSupervisionEnabled();
  const { data: interns = [], isLoading: internsLoading } = useSupervisedInterns();
  const { data: drafts = [], isLoading: draftsLoading } = useSubmittedDrafts();
  
  // Feature flag check
  if (flagLoading) {
    return null; // Silent loading
  }
  
  if (!isEnabled) {
    return null; // Feature disabled - show nothing
  }
  
  const isLoading = internsLoading || draftsLoading;
  const hasInterns = interns.length > 0;
  const pendingDrafts = drafts.filter(d => !d.review_status);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Intern Work</h3>
          {pendingDrafts.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {pendingDrafts.length} pending
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1" />
          Add Intern
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-4">
          {/* Pending Drafts for Review */}
          {pendingDrafts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Submitted for Review</p>
              {pendingDrafts.map(draft => (
                <DraftReviewCard key={draft.id} draft={draft} />
              ))}
            </div>
          )}
          
          {/* Interns List */}
          {hasInterns && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Your Interns</p>
              {interns.map(intern => (
                <InternCard key={intern.id} intern={intern} />
              ))}
            </div>
          )}
          
          {/* Empty state when no interns yet */}
          {!hasInterns && pendingDrafts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No interns yet. Click "Add Intern" to create an account.
            </p>
          )}
        </div>
      )}
      
      {/* Invite Dialog */}
      <InternInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

/**
 * Card showing a single intern with their assignments
 */
function InternCard({ intern }: { intern: SupervisedIntern }) {
  const [isOpen, setIsOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const { data: assignments = [] } = useInternAssignments(intern.id);
  const removeAssignment = useRemoveCaseAssignment();
  
  const expiresIn = formatDistanceToNow(new Date(intern.expires_at), { addSuffix: true });
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-sm font-medium">{intern.intern_name}</CardTitle>
                {intern.institution && (
                  <Badge variant="outline" className="text-xs">{intern.institution}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {assignments.length} case{assignments.length !== 1 ? 's' : ''}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Expires {expiresIn}
                </span>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            <Separator className="mb-3" />
            {/* Assign case button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAssignDialogOpen(true)}
              className="w-full mb-3"
            >
              <Plus className="h-4 w-4 mr-1" />
              Assign Case
            </Button>
            
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No cases assigned yet
              </p>
            ) : (
              <ScrollArea className="max-h-40">
                <div className="space-y-2">
                  {assignments.map(assignment => (
                    <div 
                      key={assignment.id} 
                      className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                    >
                      <div className="text-sm">
                        <span className="font-mono">{assignment.docket?.case_number || 'Unknown'}</span>
                        <span className="text-muted-foreground ml-2">
                          {assignment.docket?.date && format(new Date(assignment.docket.date), 'dd MMM')}
                        </span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Assignment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will revoke the intern's access to this case.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => removeAssignment.mutate({ 
                                assignmentId: assignment.id, 
                                internAccountId: intern.id 
                              })}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
      
      {/* Case Assignment Dialog */}
      <CaseAssignmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        internAccountId={intern.id}
        internName={intern.intern_name}
      />
    </Collapsible>
  );
}

/**
 * Card for reviewing a submitted draft
 */
function DraftReviewCard({ draft }: { draft: InternDraft }) {
  const [notes, setNotes] = useState('');
  const [expanded, setExpanded] = useState(false);
  const reviewDraft = useReviewDraft();
  
  const handleReview = (status: 'approved' | 'rejected') => {
    reviewDraft.mutate({ 
      draftId: draft.id, 
      status, 
      notes: notes.trim() || undefined 
    });
  };
  
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">
              {draft.draft_type}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {draft.intern?.intern_name}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {draft.docket?.case_number}
          </div>
        </div>
        <CardDescription className="text-xs">
          Submitted {draft.submitted_at && formatDistanceToNow(new Date(draft.submitted_at), { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0 pb-3 space-y-3">
        {/* Draft content preview */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start">
              {expanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
              {expanded ? 'Hide content' : 'View content'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="max-h-60 mt-2">
              <div className="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                {draft.content}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
        
        {/* Review notes */}
        <Textarea
          placeholder="Add review notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[60px] text-sm"
        />
        
        {/* Action buttons */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleReview('rejected')}
            disabled={reviewDraft.isPending}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => handleReview('approved')}
            disabled={reviewDraft.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Approve
          </Button>
        </div>
        
        {/* Important notice */}
        <p className="text-xs text-muted-foreground text-center">
          Approval is symbolic only. Use content manually if needed.
        </p>
      </CardContent>
    </Card>
  );
}
