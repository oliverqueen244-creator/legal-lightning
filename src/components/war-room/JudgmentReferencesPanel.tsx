import { useState } from 'react';
import { useJudgmentReferences, useAdvocateAliases } from '@/hooks/useJudgmentReferences';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Scale, ExternalLink, ChevronDown, ChevronRight, User, AlertCircle } from 'lucide-react';
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
    <Card className="border-border/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">
                  Relevant Prior Judgments
                </CardTitle>
                {references && references.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {references.length}
                  </Badge>
                )}
                {matchedCount > 0 && (
                  <Badge className="bg-primary/20 text-primary text-xs">
                    {matchedCount} with advocate
                  </Badge>
                )}
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {judgeName && (
              <CardDescription className="text-xs mt-1">
                Same Judge: {judgeName}
              </CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Scale className="h-5 w-5 text-primary animate-pulse" />
              </div>
            ) : !references || references.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No references available
              </p>
            ) : (
              <>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2">
                    {references.map((ref) => (
                      <div
                        key={ref.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          ref.advocateMatched 
                            ? 'bg-primary/5 border-primary/30' 
                            : 'bg-muted/30 border-border/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-foreground">
                                {format(new Date(ref.judgment_date), 'dd MMM yyyy')}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {ref.case_type}
                              </Badge>
                              {ref.advocateMatched && (
                                <Badge 
                                  className="bg-primary text-primary-foreground text-xs flex items-center gap-1"
                                  title="This judgment involved the same advocate"
                                >
                                  <User className="h-3 w-3" />
                                  Advocate Appeared
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {ref.court}
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              Source: Indian Kanoon
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 h-7 w-7 p-0"
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

                {/* Disclaimer */}
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground/70 flex items-start gap-1.5">
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                    Provided for reference only. Past judgments do not indicate outcomes in current matters.
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