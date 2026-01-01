import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SensitiveViewGuard, SensitiveContentNotice } from '@/components/ui/SensitiveViewGuard';
import { ChamberSharingPanel } from './ChamberSharingPanel';
import {
  Brain, 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  User, 
  Users, 
  Clock,
  AlertCircle,
  Loader2,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  useJudgeObservations, 
  useAddObservation,
  useProceduralPatterns,
  type JudgeObservation 
} from '@/hooks/useJudgeIntelligence';
import { toast } from 'sonner';

// ========================================
// DISCLAIMER - MANDATORY
// ========================================

function JudgeIntelligenceDisclaimer() {
  return (
    <div 
      className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/50 text-muted-foreground text-xs"
      role="note"
      aria-label="Judicial memory disclaimer"
    >
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        This module records observations and recent outcomes for reference only. 
        It does not predict or advise on judicial decisions.
      </span>
    </div>
  );
}

// ========================================
// OBSERVATION CARD
// ========================================

interface ObservationCardProps {
  observation: JudgeObservation;
}

function ObservationCard({ observation }: ObservationCardProps) {
  // Chamber-shared observations should be visually muted
  const isChamberShared = observation.is_chamber_shared && !observation.is_own;
  
  return (
    <div className={`p-3 rounded border space-y-2 ${
      isChamberShared 
        ? 'border-border/20 bg-muted/30 opacity-80' 
        : 'border-border/30 bg-background/50'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-xs ${isChamberShared ? 'text-muted-foreground' : 'text-foreground'}`}>
            {observation.observation_text}
          </p>
        </div>
        
        {/* Source indicator - always show clearly */}
        <div className="shrink-0">
          {observation.is_own ? (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/30">
              <User className="h-2.5 w-2.5 mr-0.5" />
              Your observation
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-muted">
              <Users className="h-2.5 w-2.5 mr-0.5" />
              Chamber shared
            </Badge>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {/* Type badge */}
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 capitalize">
          {observation.observation_type}
        </Badge>
        
        {/* Date */}
        <span>
          Recorded {format(new Date(observation.created_at), 'dd MMM yyyy')}
        </span>
        
        {/* Source case */}
        {observation.source_case_number && (
          <span className="text-muted-foreground/60">
            • From {observation.source_case_number}
          </span>
        )}
      </div>
    </div>
  );
}

// ========================================
// ADD OBSERVATION FORM
// ========================================

interface AddObservationFormProps {
  judgeName: string;
  bench: string;
  courtNo?: string | null;
  sourceDocketId?: string;
  sourceCaseNumber?: string | null;
  onSuccess?: () => void;
}

function AddObservationForm({
  judgeName,
  bench,
  courtNo,
  sourceDocketId,
  sourceCaseNumber,
  onSuccess
}: AddObservationFormProps) {
  const [text, setText] = useState('');
  const [type, setType] = useState<'general' | 'procedural' | 'timing' | 'preference'>('general');
  const { mutate: addObservation, isPending } = useAddObservation();

  const handleSubmit = () => {
    if (!text.trim()) return;

    addObservation({
      judge_name: judgeName,
      bench,
      court_no: courtNo || undefined,
      observation_text: text.trim(),
      observation_type: type,
      source_docket_id: sourceDocketId,
      source_case_number: sourceCaseNumber || undefined,
      hearing_date: new Date().toISOString().split('T')[0]
    }, {
      onSuccess: () => {
        setText('');
        setType('general');
        toast.success('Observation recorded');
        onSuccess?.();
      },
      onError: () => {
        toast.error('Failed to record observation');
      }
    });
  };

  return (
    <div className="space-y-3 p-3 rounded border border-border/30 bg-muted/10">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Record Observation
        </span>
      </div>
      
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What did you observe? (e.g., 'Historically noted: requested written submissions before oral arguments')"
        className="text-xs min-h-[60px] resize-none"
        maxLength={500}
      />
      
      <div className="flex items-center justify-between gap-2">
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="procedural">Procedural</SelectItem>
            <SelectItem value="timing">Timing</SelectItem>
            <SelectItem value="preference">Preference</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!text.trim() || isPending}
          className="h-8 text-xs"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            'Record'
          )}
        </Button>
      </div>
      
      <p className="text-[10px] text-muted-foreground/50">
        Use factual language: "Observed", "Recorded", "Historically noted"
      </p>
    </div>
  );
}

// ========================================
// PROCEDURAL PATTERNS (PUBLIC)
// ========================================

interface ProceduralPatternsViewProps {
  bench: string;
  courtNo?: string | null;
}

function ProceduralPatternsView({ bench, courtNo }: ProceduralPatternsViewProps) {
  const { data: patterns = [], isLoading } = useProceduralPatterns(bench, courtNo || undefined);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/70 text-center py-4">
        No procedural patterns recorded yet
      </p>
    );
  }

  // Aggregate recent patterns
  const recentPatterns = patterns.slice(0, 7);
  const avgStartTimes = recentPatterns
    .filter(p => p.avg_start_time)
    .map(p => p.avg_start_time);
  
  const avgItemsPerHour = recentPatterns
    .filter(p => p.typical_items_per_hour)
    .reduce((sum, p) => sum + (p.typical_items_per_hour || 0), 0) / 
    (recentPatterns.filter(p => p.typical_items_per_hour).length || 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>General procedural patterns — not specific to you</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {avgStartTimes.length > 0 && (
          <div className="p-2 rounded bg-muted/20 border border-border/20">
            <p className="text-[10px] text-muted-foreground">Typical Start</p>
            <p className="text-sm font-medium">{avgStartTimes[0]}</p>
          </div>
        )}
        
        {avgItemsPerHour > 0 && (
          <div className="p-2 rounded bg-muted/20 border border-border/20">
            <p className="text-[10px] text-muted-foreground">Avg Items/Hour</p>
            <p className="text-sm font-medium">{avgItemsPerHour.toFixed(1)}</p>
          </div>
        )}
      </div>
      
      <p className="text-[10px] text-muted-foreground/40">
        Based on {recentPatterns.reduce((sum, p) => sum + p.observations_count, 0)} observations
      </p>
    </div>
  );
}

// ========================================
// MAIN PANEL
// ========================================

interface JudgeIntelligencePanelProps {
  judgeName?: string | null;
  bench?: string | null;
  courtNo?: string | null;
  docketId?: string;
  caseNumber?: string | null;
}

export function JudgeIntelligencePanel({
  judgeName,
  bench,
  courtNo,
  docketId,
  caseNumber
}: JudgeIntelligencePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'patterns' | 'sharing'>('personal');

  const { 
    data: observations = [], 
    isLoading,
    refetch 
  } = useJudgeObservations({ 
    judgeName, 
    bench,
    limit: 50 
  });

  // Filter to current judge
  const judgeObservations = judgeName 
    ? observations.filter(o => o.judge_name.toLowerCase().includes(judgeName.toLowerCase()))
    : observations;

  const ownCount = judgeObservations.filter(o => o.is_own).length;
  const chamberCount = judgeObservations.filter(o => o.is_chamber_shared).length;

  if (!judgeName) {
    return null;
  }

  return (
    <Card className="border-border/30 bg-muted/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Judicial Memory
                </CardTitle>
                {ownCount > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {ownCount} recorded
                  </Badge>
                )}
                {chamberCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {chamberCount} shared
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
              {judgeName}
              {courtNo && <span> • Court {courtNo}</span>}
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 space-y-3">
            {/* Sensitive content notice */}
            <SensitiveContentNotice />
            
            {/* Mandatory disclaimer */}
            <JudgeIntelligenceDisclaimer />

            {/* Wrap sensitive observations in guard */}
            <SensitiveViewGuard 
              contentType="judge-intelligence"
              showWatermark={true}
              disableSelection={true}
              disableContextMenu={true}
            >
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'personal' | 'patterns' | 'sharing')}>
                <TabsList className="w-full">
                  <TabsTrigger value="personal" className="flex-1 text-xs">
                    <User className="h-3 w-3 mr-1" />
                    Observations
                  </TabsTrigger>
                  <TabsTrigger value="patterns" className="flex-1 text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    Patterns
                  </TabsTrigger>
                  <TabsTrigger value="sharing" className="flex-1 text-xs">
                    <Settings className="h-3 w-3 mr-1" />
                    Sharing
                  </TabsTrigger>
                </TabsList>

                {/* Personal/Chamber Observations */}
                <TabsContent value="personal" className="mt-3 space-y-3">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : judgeObservations.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 text-center py-4">
                      No observations recorded for this judge
                    </p>
                  ) : (
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {/* Show own observations first, then chamber shared (muted) */}
                        {judgeObservations
                          .sort((a, b) => {
                            // Own observations first
                            if (a.is_own && !b.is_own) return -1;
                            if (!a.is_own && b.is_own) return 1;
                            // Then by date
                            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                          })
                          .map((obs) => (
                            <ObservationCard key={obs.id} observation={obs} />
                          ))}
                      </div>
                    </ScrollArea>
                  )}

                  {/* Add observation form - outside guard for usability */}
                </TabsContent>

                {/* Procedural Patterns */}
                <TabsContent value="patterns" className="mt-3">
                  <ProceduralPatternsView 
                    bench={bench || 'JAIPUR'} 
                    courtNo={courtNo} 
                  />
                </TabsContent>

                {/* Chamber Sharing Settings */}
                <TabsContent value="sharing" className="mt-3">
                  <ChamberSharingPanel 
                    onSharingChange={() => refetch()}
                  />
                </TabsContent>
              </Tabs>
            </SensitiveViewGuard>
            
            {/* Add observation form - outside sensitive guard for usability */}
            {activeTab === 'personal' && (
              <AddObservationForm
                judgeName={judgeName}
                bench={bench || 'JAIPUR'}
                courtNo={courtNo}
                sourceDocketId={docketId}
                sourceCaseNumber={caseNumber}
                onSuccess={() => refetch()}
              />
            )}

            {/* Source attribution */}
            <p className="text-[10px] text-muted-foreground/40 pt-2 border-t border-border/30">
              Lawyer-scoped memory • Append-only • Never predictive • Not legal advice
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
