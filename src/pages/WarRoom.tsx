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
import { PostCourtNoteCard } from '@/components/post-court/PostCourtNoteCard';
import { ClientUpdateButton } from '@/components/client-update/ClientUpdateButton';
import { WhisperNotification } from '@/components/war-room/WhisperNotification';
import { WhisperDrawer } from '@/components/war-room/WhisperDrawer';
import { WarRoomUploadPanel } from '@/components/war-room/WarRoomUploadPanel';
import { AuthGuard } from '@/components/layout/AuthGuard';
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
  const [leftPanelTab, setLeftPanelTab] = useState<'arguments' | 'documents' | 'history'>('arguments');

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

        {/* Header */}
        <header
          className={cn(
            'border-b border-border glass-card rounded-none sticky top-0 z-40 transition-colors',
            isPanic && 'bg-court-danger/20 border-court-danger-light',
            isRunning && 'bg-primary/10 border-primary gold-glow'
          )}
          role="banner"
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/')}
                  aria-label="Go back to dashboard"
                  className="min-h-touch min-w-touch"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="font-display text-xl font-bold text-foreground tracking-wide">
                      {docketItem.case_number}
                    </h1>
                    
                    {isPanic && (
                      <Badge variant="danger" className="flex items-center gap-1" role="status" aria-live="polite">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        {distance} ITEMS AWAY
                      </Badge>
                    )}
                    
                    {/* CORRECTNESS PLAN 2: Use MARKED RUNNING instead of RUNNING NOW */}
                    {isRunning && (
                      <Badge variant="running" role="status" aria-live="assertive">MARKED RUNNING</Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Court {docketItem.court_room_no} • {docketItem.court_location} • Item #{docketItem.item_no}
                    {effectiveJudge.judgeName && (
                      <span className="ml-2">• {effectiveJudge.judgeName.replace(/^(MR\. JUSTICE |MRS\. JUSTICE |MS\. JUSTICE )/gi, 'J. ')}</span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* COURT-SAFETY: Data freshness always visible */}
                <FreshnessIndicator
                  lastUpdated={new Date(Math.min(docketUpdatedAt || Date.now(), docsUpdatedAt || Date.now()))}
                  onRefresh={() => { refetchDocket(); refetchDocs(); }}
                  isRefetching={docketFetching || docsFetching}
                  size="sm"
                />
                <NetworkStatusPill />
                {effectiveJudge.isOverride && (
                  <Badge variant="outline" className="text-amber-400 border-amber-400/50 flex items-center gap-1">
                    <UserCheck className="h-3 w-3" />
                    Substitute Judge
                  </Badge>
                )}
                <Badge variant="secondary" className="text-sm">
                  PREPARE
                </Badge>
              </div>
            </div>
          </div>
        </header>

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
              onValueChange={(v) => setLeftPanelTab(v as 'arguments' | 'documents' | 'history')}
              className="flex flex-col h-full"
            >
              <TabsList className="grid w-full grid-cols-3 m-2">
                <TabsTrigger value="arguments" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Arguments
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2 relative">
                  <FileText className="h-4 w-4" />
                  Documents
                  {pendingCount > 0 && (
                    <Badge variant="danger" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {pendingCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2 relative">
                  <History className="h-4 w-4" />
                  Listings
                  {hasListingsData?.hasListings && (
                    <Badge variant="outline" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs text-muted-foreground">
                      {hasListingsData.previousCount}
                    </Badge>
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
              
              <TabsContent value="history" className="flex-1 m-0 overflow-hidden p-2 space-y-3">
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
