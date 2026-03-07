import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Scale, AlertTriangle, FileText, List, History, UserCheck } from 'lucide-react';
import { ArgumentsPanel } from '@/components/war-room/ArgumentsPanel';
import { SmartPdfViewer } from '@/components/war-room/SmartPdfViewer';
import { DocumentSelector } from '@/components/war-room/DocumentSelector';
import { DocumentReviewPanel } from '@/components/documents/DocumentReviewPanel';
import { ListingHistoryPanel } from '@/components/case-history/ListingHistoryPanel';
import { JudgmentReferencesPanel } from '@/components/war-room/JudgmentReferencesPanel';
import { JudgeIntelligencePanel } from '@/components/judge-intelligence';
import { Brain } from 'lucide-react';
import { PostCourtNoteCard } from '@/components/post-court/PostCourtNoteCard';
import { ClientUpdateButton } from '@/components/client-update/ClientUpdateButton';
import { WhisperNotification } from '@/components/war-room/WhisperNotification';
import { WhisperDrawer } from '@/components/war-room/WhisperDrawer';
import { WarRoomUploadPanel } from '@/components/war-room/WarRoomUploadPanel';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { AIInsightPanel } from '@/components/war-room/AIInsightPanel';
import { NetworkStatusPill } from '@/components/layout/NetworkStatusPill';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { useDocketItem } from '@/hooks/useDocket';
import { useArguments } from '@/hooks/useArguments';
import { useExtendedDocuments, useDocumentReview } from '@/hooks/useDocumentManagement';
import { useLiveBoardForCourt } from '@/hooks/useLiveBoard';
import { useListingHistory, useCaseHasListings } from '@/hooks/useListingHistory';
import { usePostCourtNotes } from '@/hooks/usePostCourtCapture';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveJudge } from '@/hooks/useEffectiveJudge';
import { useCourtSessionState, getCurrentItem, isRunningState } from '@/hooks/useCourtSessionState';
import type { CaseArgument } from '@/types/database';
import { cn } from '@/lib/utils';

// Fallback PDF URL for testing when no documents uploaded
const FALLBACK_PDF_URL = 'https://pdfobject.com/pdf/sample.pdf';

export default function WarRoom() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [selectedArg, setSelectedArg] = useState<CaseArgument | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [leftPanelTab, setLeftPanelTab] = useState<'arguments' | 'documents' | 'history' | 'ai'>('arguments');

  const { role } = useAuth();
  const { data: docketItem, isLoading: docketLoading, dataUpdatedAt: docketUpdatedAt, refetch: refetchDocket, isFetching: docketFetching } = useDocketItem(caseId!);
  const { data: args } = useArguments(caseId!);
  const { data: documents, isLoading: docsLoading, refetch: refetchDocs, dataUpdatedAt: docsUpdatedAt, isFetching: docsFetching } = useExtendedDocuments(caseId!);
  const { approveDocument, rejectDocument, setPrimaryDocument } = useDocumentReview(caseId!);
  const { data: listingHistory, isLoading: historyLoading } = useListingHistory(caseId!);
  const { data: hasListingsData } = useCaseHasListings(caseId!);
  const { data: postCourtNotes } = usePostCourtNotes(listingHistory?.fingerprint);
  const latestNote = postCourtNotes?.[0];
  const liveBoard = useLiveBoardForCourt(
    docketItem?.court_location ?? '',
    docketItem?.court_room_no ?? ''
  );

  // Dynamic judge resolution - updates when court/item changes
  const effectiveJudge = useEffectiveJudge({
    courtLocation: docketItem?.court_location,
    courtNo: docketItem?.court_room_no,
    itemNo: docketItem?.item_no,
    fallbackJudgeName: docketItem?.judge_names
  });

  // Auto-select first approved/primary document when loaded
  useEffect(() => {
    if (documents && documents.length > 0 && !selectedDocId) {
      // Prefer primary documents first
      const primaryDoc = documents.find((d) => d.is_primary && d.review_status === 'approved');
      if (primaryDoc) {
        setSelectedDocId(primaryDoc.id);
        return;
      }
      // Then any approved document
      const approvedDoc = documents.find((d) => d.review_status === 'approved');
      if (approvedDoc) {
        setSelectedDocId(approvedDoc.id);
        return;
      }
      // Finally, any document
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  // CORRECTNESS PLAN 2: Use canonical court session state
  const courtSession = useCourtSessionState(liveBoard);
  const currentItem = getCurrentItem(liveBoard);
  const distance = docketItem ? docketItem.item_no - currentItem : 0;

  // CORRECTNESS PLAN 2: Canonical RUNNING - requires inSession && distance <= 0
  const isPanic = courtSession.inSession && distance > 0 && distance <= 5;
  const isRunning = isRunningState(courtSession, docketItem?.item_no, liveBoard);

  const handleSelectArg = (arg: CaseArgument) => {
    setSelectedArg(arg);
  };

  const handleViewDocument = (docId: string) => {
    setSelectedDocId(docId);
    setLeftPanelTab('arguments'); // Switch back to arguments when viewing doc
  };

  // Get the PDF URL from selected document or fallback
  const selectedDoc = documents?.find((d) => d.id === selectedDocId);
  const pdfUrl = selectedDoc?.file_url || FALLBACK_PDF_URL;

  // Count pending documents
  const pendingCount = documents?.filter((d) => d.review_status === 'pending').length || 0;

  if (docketLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Scale className="h-12 w-12 text-primary animate-pulse" aria-label="Loading" />
        </div>
      </AuthGuard>
    );
  }

  if (!docketItem) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Case not found</p>
          <Button variant="gold" onClick={() => navigate('/')} className="min-h-touch">
            Return to Dashboard
          </Button>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Skip to main content link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
        >
          Skip to main content
        </a>

        {/* Whisper Listener for toast notifications */}
        <WhisperNotification docketId={caseId!} />

        {/* Whisper Chat Drawer */}
        <WhisperDrawer docketId={caseId!} />

        {/* War Room Specific Status Bar - Slimmer than a full header */}
        <div className={cn(
          "flex items-center justify-between px-6 py-2 border-b border-border/50 transition-colors",
          isPanic && 'bg-court-danger/10 border-court-danger-light',
          isRunning && 'bg-primary/5 border-primary shadow-[0_0_15px_rgba(251,191,36,0.1)]'
        )}>
          <div className="flex items-center gap-4">
            <h1 className="font-display font-bold text-foreground tracking-tight">
              {docketItem.case_number}
            </h1>
            {isPanic && (
              <Badge variant="danger" className="animate-pulse">
                {distance} ITEMS AWAY
              </Badge>
            )}
            {isRunning && (
              <Badge variant="running">MARKED RUNNING</Badge>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Court {docketItem.court_room_no}</span>
            <span>•</span>
            <span>Item #{docketItem.item_no}</span>
            {effectiveJudge.judgeName && (
              <>
                <span>•</span>
                <span className="font-medium text-foreground">{effectiveJudge.judgeName.replace(/^(MR\. JUSTICE |MRS\. JUSTICE |MS\. JUSTICE )/gi, 'J. ')}</span>
              </>
            )}
          </div>
        </div>


        {/* Document Selector */}
        {documents && documents.length > 1 && (
          <DocumentSelector
            documents={documents.filter((d) => d.review_status === 'approved' || d.is_primary)}
            selectedDocId={selectedDocId}
            onSelectDoc={setSelectedDocId}
          />
        )}

        {/* Main Content - Split View */}
        <main id="main-content" className="flex-1 flex overflow-hidden" role="main">
          {/* Left Panel: Tabs for Arguments & Document Review (30%) */}
          <div className="w-[30%] border-r border-border flex flex-col">
            <Tabs
              value={leftPanelTab}
              onValueChange={(v) => setLeftPanelTab(v as 'arguments' | 'documents' | 'history' | 'ai')}
              className="flex flex-col h-full"
            >
              <TabsList className="grid w-full grid-cols-4 h-11 bg-muted/30 p-1">
                <TabsTrigger value="arguments" className="text-xs flex items-center gap-1.5 focus:ring-0">
                  <List className="h-3.5 w-3.5" />
                  Args
                </TabsTrigger>
                <TabsTrigger value="documents" className="text-xs flex items-center gap-1.5 relative focus:ring-0">
                  <FileText className="h-3.5 w-3.5" />
                  Docs
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] items-center justify-center text-white font-bold">
                        {pendingCount}
                      </span>
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs flex items-center gap-1.5 focus:ring-0">
                  <Brain className="h-3.5 w-3.5 text-amber-500" />
                  AI
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs flex items-center gap-1.5 relative focus:ring-0">
                  <History className="h-3.5 w-3.5" />
                  Hits
                  {hasListingsData?.hasListings && (
                    <span className="ml-1 text-[10px] text-muted-foreground bg-muted-foreground/10 px-1 rounded-full">
                      {hasListingsData.previousCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="arguments" className="flex-1 m-0 overflow-hidden">
                <ArgumentsPanel
                  arguments={args ?? []}
                  selectedArg={selectedArg}
                  onSelectArg={handleSelectArg}
                  fontSize={fontSize}
                  onFontSizeChange={setFontSize}
                />
              </TabsContent>

              <TabsContent value="documents" className="flex-1 m-0 overflow-hidden p-2">
                {/* Upload Panel - SENIOR/ADMIN only */}
                {(role === 'SENIOR' || role === 'ADMIN') && (
                  <WarRoomUploadPanel docketId={caseId!} />
                )}
                <DocumentReviewPanel
                  documents={documents || []}
                  onApprove={approveDocument}
                  onReject={rejectDocument}
                  onSetPrimary={setPrimaryDocument}
                  onViewDocument={handleViewDocument}
                  selectedDocId={selectedDocId}
                  isLoading={docsLoading}
                />
              </TabsContent>

              <TabsContent value="ai" className="flex-1 overflow-hidden m-0">
                <AIInsightPanel docketId={caseId!} pdfUrl={pdfUrl} />
              </TabsContent>

              <TabsContent value="history" className="flex-1 overflow-hidden m-0">
                {/* Client Update Generator Button - SENIOR only */}
                <div className="flex justify-end">
                  <ClientUpdateButton
                    postCourtNote={latestNote || null}
                    caseNumber={docketItem.case_number || ''}
                  />
                </div>

                {/* Latest post-court note - what happened last time */}
                {latestNote && (
                  <PostCourtNoteCard note={latestNote} compact />
                )}
                <ListingHistoryPanel
                  history={listingHistory}
                  isLoading={historyLoading}
                  compact
                />
              </TabsContent>
            </Tabs>

            {/* Judge Intelligence Panel */}
            <div className="p-2 border-t border-border">
              <JudgeIntelligencePanel
                judgeName={effectiveJudge.judgeName}
                bench={docketItem.court_location}
                courtNo={docketItem.court_room_no}
                docketId={caseId}
                caseNumber={docketItem.case_number}
              />
            </div>

            {/* Judgment References Panel - Collapsed by Default */}
            <div className="p-2 border-t border-border">
              <JudgmentReferencesPanel
                docketId={caseId}
                caseNumber={docketItem.case_number}
                judgeName={effectiveJudge.judgeName}
                court={docketItem.court_location}
                petitionerLawyer={docketItem.petitioner_lawyer}
                respondentLawyer={docketItem.respondent_lawyer}
              />
            </div>
          </div>

          {/* Right Panel: Smart PDF Viewer (70%) */}
          <div className="w-[70%]">
            <SmartPdfViewer
              pdfUrl={pdfUrl}
              targetPage={selectedArg?.linked_page_number ?? 1}
              documentId={selectedDocId || undefined}
            />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
