import { useState } from 'react';
import { useJudgmentReferences, useAdvocateAliases } from '@/hooks/useJudgmentReferences';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ExternalLink, ChevronDown, ChevronRight, BookOpen, Info } from 'lucide-react';
import { format } from 'date-fns';

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
  const { user } = useAuth();
  
  // Get user's aliases for matching
  const { data: aliases = [] } = useAdvocateAliases(user?.id);
  
  // Build advocate names list from case + user aliases
  const advocateNames = [
    ...(petitionerLawyer ? [petitionerLawyer] : []),
    ...(respondentLawyer ? [respondentLawyer] : []),
    ...aliases
  ].filter(Boolean);

  const { data: references, isLoading } = useJudgmentReferences({
    judgeName,
    court,
    caseType,
    advocateNames
  });

  const matchedCount = references?.filter(r => r.advocateMatched).length || 0;

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
                {references && references.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({references.length})
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
                Same judge reference
              </CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <BookOpen className="h-5 w-5 text-muted-foreground/50" />
              </div>
            ) : !references || references.length === 0 ? (
              <p className="text-sm text-muted-foreground/70 text-center py-4">
                No references available
              </p>
            ) : (
              <>
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

                {/* Disclaimer - muted and calm */}
                <div className="mt-3 pt-3 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground/50 flex items-start gap-1.5">
                    <Info className="h-3 w-3 shrink-0 mt-0.5" />
                    Reference only. Past judgments do not indicate outcomes.
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 mt-1 pl-4">
                    Source: Indian Kanoon
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}