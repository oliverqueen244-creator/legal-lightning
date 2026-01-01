import { useState } from 'react';
import { useReferenceJudgments, useSavedReferences } from '@/hooks/useReferenceJudgments';
import { useAdvocateAliases } from '@/hooks/useJudgmentReferences';
import { useJudgmentAttachments } from '@/hooks/useJudgmentAttachments';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SensitiveViewGuard } from '@/components/ui/SensitiveViewGuard';
import { ExternalLink, ChevronDown, ChevronRight, BookOpen, Search, Loader2, Info, RefreshCw, Paperclip, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { AiDisclaimer } from '@/components/ui/AiDisclaimer';
import { SIGNAL_DEFINITIONS, getSignalVariant, type RankedJudgment } from '@/lib/judgmentRanking';

interface JudgmentReferencesPanelProps {
  docketId?: string;
  caseNumber?: string | null;
  judgeName?: string | null;
  court?: string | null;
  caseType?: string | null;
  petitionerLawyer?: string | null;
  respondentLawyer?: string | null;
}

// Signal badge component with tooltip
function SignalBadge({ signal }: { signal: string }) {
  const def = SIGNAL_DEFINITIONS[signal];
  if (!def) return null;
  
  const variant = getSignalVariant(signal);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={variant}
            className="text-[9px] px-1.5 py-0 h-4 font-normal cursor-help"
          >
            {def.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-xs">
          {def.description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Judgment card component with attachment support
function JudgmentCard({ 
  judgment, 
  docketId,
  isAttached,
  onAttach,
  onDetach,
  isAttaching,
}: { 
  judgment: RankedJudgment;
  docketId?: string;
  isAttached: boolean;
  onAttach: () => void;
  onDetach: () => void;
  isAttaching: boolean;
}) {
  return (
    <div className="p-3 rounded border border-border/30 bg-background/50 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground line-clamp-2">
            {judgment.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {judgment.date && (
              <span className="text-[10px] text-muted-foreground">
                {judgment.date}
              </span>
            )}
            {judgment.court && (
              <span className="text-[10px] text-muted-foreground">
                • {judgment.court}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Attach/Detach button */}
          {docketId && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isAttached ? "secondary" : "ghost"}
                    size="sm"
                    className={`h-7 w-7 p-0 ${isAttached ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={isAttached ? onDetach : onAttach}
                    disabled={isAttaching}
                  >
                    {isAttaching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isAttached ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Paperclip className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isAttached ? 'Remove from case' : 'Attach to case'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => window.open(judgment.url, '_blank')}
            aria-label="View on Indian Kanoon"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      
      {/* Priority signal badges */}
      {judgment.matchedSignals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {judgment.matchedSignals.map((signal) => (
            <SignalBadge key={signal} signal={signal} />
          ))}
        </div>
      )}
      
      {/* Attached indicator */}
      {isAttached && (
        <div className="flex items-center gap-1 text-[10px] text-primary/70">
          <Paperclip className="h-3 w-3" />
          <span>User-attached reference judgment</span>
        </div>
      )}
      
      {/* AI-inferred warning */}
      {judgment.isAiInferred && judgment.matchedSignals.length === 0 && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
          <Info className="h-3 w-3" />
          <span>AI-inferred relevance</span>
        </div>
      )}
      
      {/* Snippet */}
      {judgment.snippet && (
        <p className="text-[10px] text-muted-foreground/60 line-clamp-2">
          {judgment.snippet}
        </p>
      )}
    </div>
  );
}

export function JudgmentReferencesPanel({
  docketId,
  caseNumber,
  judgeName,
  court,
  petitionerLawyer,
  respondentLawyer
}: JudgmentReferencesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'saved'>('live');
  const { user } = useAuth();
  
  // Get user's aliases
  const { data: aliases = [] } = useAdvocateAliases(user?.id);
  
  // Attachments hook
  const { 
    attachments, 
    attach, 
    detach, 
    isAttaching, 
    isDetaching,
    isAttached 
  } = useJudgmentAttachments(docketId);
  
  // Build advocate names list
  const advocateNames = [
    ...(petitionerLawyer ? [petitionerLawyer] : []),
    ...(respondentLawyer ? [respondentLawyer] : []),
    ...aliases
  ].filter(Boolean);

  // Live search with ranking
  const {
    judgments: liveJudgments,
    caseType,
    searchVectors,
    lastChecked,
    isLoading: isSearching,
    refetch,
  } = useReferenceJudgments({
    caseNumber,
    judgeName,
    court,
    petitionerLawyer,
    respondentLawyer,
    userAliases: aliases,
    enabled: isOpen && activeTab === 'live',
  });

  // Saved references
  const { data: savedJudgments = [], isLoading: isLoadingSaved } = useSavedReferences({
    judgeName,
    court,
    advocateNames,
    enabled: isOpen && activeTab === 'saved',
  });

  const liveCount = liveJudgments.length;
  const savedCount = savedJudgments.length;
  const attachedCount = attachments.length;

  // Helper to handle attachment
  const handleAttach = (judgment: RankedJudgment, source: 'live-search' | 'saved') => {
    // Build signal scores from the signals array for audit
    const rankingSignals: Record<string, number> = {};
    judgment.signals.forEach(s => {
      if (s.matched) {
        rankingSignals[s.signal] = s.weight;
      }
    });
    
    attach({
      docketId,
      judgmentUrl: judgment.url,
      judgmentTitle: judgment.title,
      judgmentCourt: judgment.court,
      judgmentDate: judgment.date,
      prioritySignals: judgment.matchedSignals,
      source,
      searchVector: judgment.searchVector,
      rankingScore: judgment.score,
      rankingSignals,
    });
  };

  // Helper to handle detachment
  const handleDetach = (url: string) => {
    const attachment = attachments.find(a => a.judgment_url === url);
    if (attachment) {
      detach(attachment.id);
    }
  };

  if (!judgeName && !court) {
    return null;
  }

  return (
    <Card className="border-border/30 bg-muted/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Reference Judgments (Contextual)
                </CardTitle>
                {attachedCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {attachedCount} attached
                  </Badge>
                )}
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <CardDescription className="text-xs mt-1 text-muted-foreground/70">
              {judgeName && <span>{judgeName}</span>}
              {caseType && !caseType.isUncertain && (
                <span className="ml-1">• {caseType.fullName}</span>
              )}
              {caseType?.isUncertain && (
                <span className="ml-1 text-amber-500/70">• {caseType.fullName} (Probable)</span>
              )}
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            <SensitiveViewGuard 
              contentType="judicial-outcomes"
              showWatermark={true}
              disableSelection={true}
              disableContextMenu={true}
            >
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'live' | 'saved')}>
                <div className="flex items-center justify-between mb-3">
                  <TabsList className="flex-1">
                    <TabsTrigger value="live" className="flex-1 text-xs">
                      <Search className="h-3 w-3 mr-1" />
                      Live Search
                      {isSearching && <Loader2 className="h-3 w-3 ml-1 animate-spin" />}
                    </TabsTrigger>
                    <TabsTrigger value="saved" className="flex-1 text-xs">
                      <BookOpen className="h-3 w-3 mr-1" />
                      Saved ({savedCount})
                    </TabsTrigger>
                  </TabsList>
                  
                  {activeTab === 'live' && !isSearching && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 ml-2"
                      onClick={() => refetch()}
                      title="Refresh search"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Live Search Tab */}
                <TabsContent value="live" className="mt-0">
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground">
                        Searching Indian Kanoon...
                      </p>
                    </div>
                  ) : liveCount === 0 ? (
                    <p className="text-sm text-muted-foreground/70 text-center py-4">
                      No judgments found for current criteria
                    </p>
                  ) : (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2">
                        {liveJudgments.map((judgment) => (
                          <JudgmentCard 
                            key={judgment.id} 
                            judgment={judgment}
                            docketId={docketId}
                            isAttached={isAttached(judgment.url)}
                            onAttach={() => handleAttach(judgment, 'live-search')}
                            onDetach={() => handleDetach(judgment.url)}
                            isAttaching={isAttaching || isDetaching}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  
                  {lastChecked && (
                    <p className="text-[10px] text-muted-foreground/40 mt-2">
                      Last checked: {format(new Date(lastChecked), 'dd MMM yyyy, HH:mm')}
                    </p>
                  )}
                </TabsContent>

                {/* Saved References Tab */}
                <TabsContent value="saved" className="mt-0">
                  {isLoadingSaved ? (
                    <div className="flex items-center justify-center py-4">
                      <BookOpen className="h-5 w-5 text-muted-foreground/50 animate-pulse" />
                    </div>
                  ) : savedCount === 0 ? (
                    <p className="text-sm text-muted-foreground/70 text-center py-4">
                      No saved references. Use Live Search to find judgments.
                    </p>
                  ) : (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2">
                        {savedJudgments.map((judgment) => (
                          <JudgmentCard 
                            key={judgment.id} 
                            judgment={judgment}
                            docketId={docketId}
                            isAttached={isAttached(judgment.url)}
                            onAttach={() => handleAttach(judgment, 'saved')}
                            onDetach={() => handleDetach(judgment.url)}
                            isAttaching={isAttaching || isDetaching}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </SensitiveViewGuard>

            {/* Disclaimer - Always visible */}
            <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
              <AiDisclaimer />
              <p className="text-[10px] text-muted-foreground/40">
                Source: Indian Kanoon • Reference only • Not legal advice
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
