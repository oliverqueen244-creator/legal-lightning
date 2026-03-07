import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AiDisclaimer } from '@/components/ui/AiDisclaimer';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CaseVirtualCourtButton } from '@/components/dashboard/CaseVirtualCourtButton';
import {
  Sun,
  AlertTriangle,
  CheckCircle,
  FileText,
  Users,
  History as HistoryIcon,
  ChevronRight,
  Clock,
  Scale,
  BookMarked,
  Download,
  ArrowUp,
  Sparkles,
} from 'lucide-react';

import { format, differenceInMinutes } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { MorningBrief, MorningBriefCase } from '@/hooks/useMorningBrief';
import type { LiveBoardCache } from '@/types/database';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { generateBriefPDF } from '@/lib/briefExport';
import { deriveCourtSessionState, getCurrentItem } from '@/hooks/useCourtSessionState';
import { AiStrategyPanel } from './AiStrategyPanel';
import { motion, AnimatePresence } from 'framer-motion';



interface MorningBriefPanelProps {
  brief: MorningBrief | null | undefined;
  isLoading?: boolean;
  onRefresh?: () => void;
  /** Live board data for determining Up Next case */
  liveBoards?: LiveBoardCache[];
}

export function MorningBriefPanel({ brief, isLoading, onRefresh, liveBoards }: MorningBriefPanelProps) {
  const navigate = useNavigate();
  const [minutesSinceGeneration, setMinutesSinceGeneration] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [analyzingCaseId, setAnalyzingCaseId] = useState<string | null>(null);


  // P1 FIX: Track freshness of the morning brief
  useEffect(() => {
    if (!brief?.generated_at) return;

    const updateFreshness = () => {
      const generatedTime = new Date(brief.generated_at);
      const now = new Date();
      setMinutesSinceGeneration(differenceInMinutes(now, generatedTime));
    };

    // Initial calculation
    updateFreshness();

    // Update every minute
    const interval = setInterval(updateFreshness, 60000);
    return () => clearInterval(interval);
  }, [brief?.generated_at]);

  const isStale = minutesSinceGeneration > 5;

  /**
   * UP NEXT Case Identification (per-court)
   * 
   * Definition: case.item_no > current_item_no AND smallest such number
   * Conditions for showing UP NEXT:
   * - Court must be in session (inSession = true)
   * - Live board data must be fresh (not stale)
   * - Case must not be MARKED (item_no > current_item_no)
   */
  const upNextCaseId = useMemo(() => {
    if (!brief?.cases || brief.cases.length === 0 || !liveBoards || liveBoards.length === 0) {
      return null;
    }

    // Group cases by court (court_location + court_room_no)
    // For each court, find the up next case
    const upNextCandidates: { caseId: string; courtKey: string; itemNo: number }[] = [];

    // Get all unique courts from cases
    const courtKeys = new Set(
      brief.cases.map(c => `${c.court_location}::${c.court_room_no}`)
    );

    for (const courtKey of courtKeys) {
      const [courtLocation, courtRoomNo] = courtKey.split('::');

      // Find matching live board
      const liveBoard = liveBoards.find(
        board => board.court_location === courtLocation && board.court_no === courtRoomNo
      );

      if (!liveBoard) continue;

      // Check if court is in session
      const sessionState = deriveCourtSessionState(liveBoard);
      if (!sessionState.inSession || !sessionState.isDataFresh) continue;

      const currentItem = getCurrentItem(liveBoard);

      // Find cases for this court that are UP NEXT (item_no > current_item_no)
      const futureCases = brief.cases
        .filter(c =>
          c.court_location === courtLocation &&
          c.court_room_no === courtRoomNo &&
          c.item_no > currentItem
        )
        .sort((a, b) => a.item_no - b.item_no);

      if (futureCases.length > 0) {
        upNextCandidates.push({
          caseId: futureCases[0].id,
          courtKey,
          itemNo: futureCases[0].item_no
        });
      }
    }

    // If we have multiple up next candidates (from different courts),
    // return the one with the smallest item number (most imminent)
    if (upNextCandidates.length === 0) return null;

    upNextCandidates.sort((a, b) => a.itemNo - b.itemNo);
    return upNextCandidates[0].caseId;
  }, [brief?.cases, liveBoards]);

  // Handle PDF export - legal size by default
  // Uses lawyerName from the brief itself (fetched with the brief data)
  const handleDownloadPDF = useCallback(() => {
    if (!brief || brief.total_cases === 0) return;

    setIsExporting(true);
    try {
      generateBriefPDF(brief, brief.lawyerName);
    } finally {
      setIsExporting(false);
    }
  }, [brief]);

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Sun className="h-12 w-12 text-primary animate-pulse" />
            <p className="text-muted-foreground">Generating your morning brief...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!brief || brief.total_cases === 0) {
    return (
      <Card className="glass-card border-none bg-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-display tracking-wide text-xl">
            <Sun className="h-5 w-5 text-primary" />
            Today's Brief
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              No cases found in last sync
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Pull down to refresh or check your alias settings
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CaseCard = ({ caseItem, isUpNext }: { caseItem: MorningBriefCase; isUpNext?: boolean }) => {
    const hasRisks = Object.values(caseItem.risks).some(Boolean);
    const isAnalyzing = analyzingCaseId === caseItem.id;

    return (
      <div className="space-y-2">
        <div
          className={cn(
            'p-4 rounded-lg glass-card cursor-pointer transition-all hover:bg-white/10',
            hasRisks && !isUpNext && 'border-l-4 border-l-court-danger-light',
            isUpNext && 'border-l-4 border-l-court-warning',
            isAnalyzing && 'ring-2 ring-primary/50'
          )}
          onClick={() => navigate(`/war-room/${caseItem.id}`)}
        >

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Case header */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {/* UP NEXT Badge - shown first when active */}
                {isUpNext && (
                  <Badge variant="upnext" className="text-xs flex items-center gap-1">
                    <ArrowUp className="h-3 w-3" />
                    UP NEXT
                  </Badge>
                )}
                <span className="font-display font-bold text-foreground">
                  #{caseItem.item_no}
                </span>
                <span className="text-foreground truncate">
                  {caseItem.case_number}
                </span>
                {caseItem.hasHistory && (
                  <Badge variant="outline" className="text-xs">
                    <HistoryIcon className="h-3 w-3 mr-1" />
                    {caseItem.previousAppearances} prior
                  </Badge>
                )}
                {caseItem.lastHearingCaptured && (
                  <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                    <BookMarked className="h-3 w-3 mr-1" />
                    Captured
                  </Badge>
                )}
              </div>

              {/* UP NEXT explanatory subtext */}
              {isUpNext && (
                <p className="text-xs text-muted-foreground/70 mb-2">
                  Based on current court sequence
                </p>
              )}

              {/* Party names */}
              {(caseItem.petitioner || caseItem.respondent) && (
                <p className="text-sm text-foreground/80 mb-1 truncate">
                  {caseItem.petitioner || 'Unknown'} <span className="text-muted-foreground">vs</span> {caseItem.respondent || 'Unknown'}
                </p>
              )}

              {/* Court info */}
              <p className="text-sm text-muted-foreground mb-3">
                Court {caseItem.court_room_no} • {caseItem.court_location}
                {caseItem.judge_names && ` • ${caseItem.judge_names}`}
              </p>

              {/* Risk flags */}
              {hasRisks && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {caseItem.risks.missing_documents && (
                    <Badge variant="danger" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      No Documents
                    </Badge>
                  )}
                  {caseItem.risks.pending_review && (
                    <Badge variant="secondary" className="text-xs bg-court-warning/20 text-court-warning border-court-warning/30">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending Review
                    </Badge>
                  )}
                  {caseItem.risks.low_readiness && !caseItem.risks.missing_documents && (
                    <Badge variant="danger" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Low Readiness
                    </Badge>
                  )}
                  {caseItem.risks.late_listed && (
                    <Badge variant="outline" className="text-xs">
                      Late Listed
                    </Badge>
                  )}
                </div>
              )}

              {/* Readiness bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Readiness</span>
                  <span
                    className={cn(
                      'font-medium',
                      caseItem.readiness.level === 'safe' && 'text-court-success',
                      caseItem.readiness.level === 'review' && 'text-court-warning',
                      caseItem.readiness.level === 'senior_required' && 'text-court-danger-light'
                    )}
                  >
                    {caseItem.readiness.total}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      caseItem.readiness.level === 'safe' && 'bg-court-success',
                      caseItem.readiness.level === 'review' && 'bg-court-warning',
                      caseItem.readiness.level === 'senior_required' && 'bg-court-danger-light'
                    )}
                    style={{ width: `${caseItem.readiness.total}%` }}
                  />
                </div>
              </div>

              {/* Virtual Court Button - Court-level, date-scoped */}
              <div className="mt-3">
                <CaseVirtualCourtButton
                  courtLocation={caseItem.court_location}
                  courtRoomNo={caseItem.court_room_no}
                  compact
                />
              </div>
            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              variant="ghost"
              size="sm"

              className="h-7 text-[10px] gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                setAnalyzingCaseId(isAnalyzing ? null : caseItem.id);
              }}
            >
              <Sparkles className="h-3 w-3" />
              {isAnalyzing ? 'Hide Strategy' : 'AI Strategy'}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2">
                <AiStrategyPanel
                  caseNumber={caseItem.case_number}
                  petitioner={caseItem.petitioner}
                  respondent={caseItem.respondent}
                  judgeName={caseItem.judge_names}
                  onClose={() => setAnalyzingCaseId(null)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };


  return (
    <TooltipProvider>
      {/* DECLUTTER: Today's Brief as section header, not boxed module - removed Card wrapper */}
      <div className="space-y-5">
        {/* Section header with subtle divider instead of box */}
        <div className="flex items-center justify-between pb-3 border-b border-border/30">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl tracking-wide text-foreground">Today's Brief</h2>
            {/* Small download button for legal-size PDF */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={handleDownloadPDF}
                  disabled={isExporting || !brief || brief.total_cases === 0}
                >
                  <Download className={cn("h-4 w-4", isExporting && "animate-pulse")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Download PDF (Legal Size)</p>
              </TooltipContent>
            </Tooltip>
          </div>
          {/* DECLUTTER: Freshness indicator - demoted, smaller, less prominent */}
          <FreshnessIndicator
            lastUpdated={brief.generated_at}
            onRefresh={onRefresh}
            size="sm"
            showLabel={false}
          />
        </div>

        {/* AI Disclaimer - MANDATORY, NOT DISMISSIBLE - now subtle */}
        <AiDisclaimer />

        {/* DECLUTTER: Summary stats - removed borders/backgrounds from cards, cleaner flow */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-foreground">{brief.total_cases}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Total</p>
          </div>
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-court-danger-light">{brief.summary.attend_count}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Attend</p>
          </div>
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-court-success">{brief.summary.delegate_count}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Delegate</p>
          </div>
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-muted-foreground">{brief.summary.monitor_count}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Monitor</p>
          </div>
        </div>

        {/* DECLUTTER: High risk alert - softened to status strip, reduced height/padding, no icon */}
        {brief.summary.high_risk_count > 0 && (
          <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-xs text-court-danger-light bg-court-danger/5">
            <span className="font-semibold">{brief.summary.high_risk_count}</span>
            <span className="opacity-80">case{brief.summary.high_risk_count !== 1 ? 's' : ''} need{brief.summary.high_risk_count === 1 ? 's' : ''} attention</span>
          </div>
        )}

        {/* DECLUTTER: Removed Separator, relying on whitespace for structure */}

        {/* Case list - Up Next case shown first (if exists), then remaining in original order */}
        <ScrollArea className="h-[400px] legal-scroll pr-4">
          <div className="space-y-3">
            {/* Render Up Next case first if it exists */}
            {upNextCaseId && (() => {
              const upNextCase = brief.cases.find(c => c.id === upNextCaseId);
              return upNextCase ? <CaseCard key={upNextCase.id} caseItem={upNextCase} isUpNext /> : null;
            })()}

            {/* Render remaining cases (excluding Up Next case if it exists) */}
            {brief.cases
              .filter(caseItem => caseItem.id !== upNextCaseId)
              .map((caseItem) => (
                <CaseCard key={caseItem.id} caseItem={caseItem} />
              ))}
          </div>
        </ScrollArea>

        {/* Refresh button */}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onRefresh}
          >
            Refresh Brief
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}
