import { useState } from 'react';
import { useJudgmentReferences, useAdvocateAliases } from '@/hooks/useJudgmentReferences';
import { useIndianKanoonSearch } from '@/hooks/useIndianKanoonSearch';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink, ChevronDown, ChevronRight, BookOpen, Info, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { AiDisclaimer } from '@/components/ui/AiDisclaimer';

interface JudgmentReferencesPanelProps {
  judgeName?: string | null;
  court?: string | null;
  caseType?: string | null;
  petitionerLawyer?: string | null;
  respondentLawyer?: string | null;
}

export function JudgmentReferencesPanel({
  judgeName,
  court,
  caseType,
  petitionerLawyer,
  respondentLawyer
}: JudgmentReferencesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'saved' | 'search'>('saved');
  const { user } = useAuth();
  
  // Get user's aliases for matching
  const { data: aliases = [] } = useAdvocateAliases(user?.id);
  
  // Build advocate names list from case + user aliases
  const advocateNames = [
    ...(petitionerLawyer ? [petitionerLawyer] : []),
    ...(respondentLawyer ? [respondentLawyer] : []),
    ...aliases
  ].filter(Boolean);

  // Fetch saved references from database
  const { data: references, isLoading: isLoadingSaved } = useJudgmentReferences({
    judgeName,
    court,
    caseType,
    advocateNames
  });

  // Live search from Indian Kanoon (only when search tab is active and panel is open)
  const { results: liveResults, isLoading: isSearching } = useIndianKanoonSearch({
    judgeName: isOpen && activeTab === 'search' ? judgeName : null,
    court: isOpen && activeTab === 'search' ? court : null,
    maxResults: 10
  });

  const matchedCount = references?.filter(r => r.advocateMatched).length || 0;
  const savedCount = references?.length || 0;
  const liveCount = liveResults?.length || 0;

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
                  Prior Judgments
                </CardTitle>
                {(savedCount > 0 || liveCount > 0) && (
                  <span className="text-xs text-muted-foreground">
                    ({savedCount} saved{liveCount > 0 ? `, ${liveCount} found` : ''})
                  </span>
                )}
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {judgeName && (
              <CardDescription className="text-xs mt-1 text-muted-foreground/70">
                {judgeName} • Indian Kanoon references
              </CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'saved' | 'search')}>
              <TabsList className="w-full mb-3">
                <TabsTrigger value="saved" className="flex-1 text-xs">
                  <BookOpen className="h-3 w-3 mr-1" />
                  Saved ({savedCount})
                </TabsTrigger>
                <TabsTrigger value="search" className="flex-1 text-xs">
                  <Search className="h-3 w-3 mr-1" />
                  Live Search
                  {isSearching && <Loader2 className="h-3 w-3 ml-1 animate-spin" />}
                </TabsTrigger>
              </TabsList>

              {/* Saved References Tab */}
              <TabsContent value="saved" className="mt-0">
                {isLoadingSaved ? (
                  <div className="flex items-center justify-center py-4">
                    <BookOpen className="h-5 w-5 text-muted-foreground/50 animate-pulse" />
                  </div>
                ) : !references || references.length === 0 ? (
                  <p className="text-sm text-muted-foreground/70 text-center py-4">
                    No saved references. Try Live Search.
                  </p>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {references.map((ref) => (
                        <div
                          key={ref.id}
                          className="p-3 rounded border border-border/30 bg-background/50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(ref.judgment_date), 'dd MMM yyyy')}
                                </span>
                                <span className="text-xs text-muted-foreground/70">
                                  • {ref.case_type}
                                </span>
                                {ref.advocateMatched && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-[10px] text-muted-foreground border-muted-foreground/30 font-normal"
                                    title="This judgment involved the same advocate"
                                  >
                                    Advocate Appeared
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground/60 mt-1">
                                {ref.court}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => window.open(ref.indian_kanoon_url, '_blank')}
                              aria-label="View on Indian Kanoon"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              {/* Live Search Tab */}
              <TabsContent value="search" className="mt-0">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    <p className="text-xs text-muted-foreground">
                      Searching Indian Kanoon...
                    </p>
                  </div>
                ) : liveResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground/70 text-center py-4">
                    No judgments found for {judgeName || court}
                  </p>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {liveResults.map((result, index) => (
                        <div
                          key={`${result.url}-${index}`}
                          className="p-3 rounded border border-border/30 bg-background/50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground line-clamp-2">
                                {result.title}
                              </p>
                              {result.date && (
                                <span className="text-[10px] text-muted-foreground">
                                  {result.date}
                                </span>
                              )}
                              {result.court && (
                                <span className="text-[10px] text-muted-foreground ml-2">
                                  • {result.court}
                                </span>
                              )}
                              {result.snippet && (
                                <p className="text-[10px] text-muted-foreground/60 mt-1 line-clamp-2">
                                  {result.snippet}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => window.open(result.url, '_blank')}
                              aria-label="View on Indian Kanoon"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>

            {/* Disclaimer */}
            <div className="mt-3 pt-3 border-t border-border/30">
              <AiDisclaimer />
              <p className="text-[10px] text-muted-foreground/40 mt-1">
                Source: Indian Kanoon • Reference only
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
