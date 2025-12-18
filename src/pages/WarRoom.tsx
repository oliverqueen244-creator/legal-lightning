import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Scale, AlertTriangle, FileText, List } from 'lucide-react';
import { ArgumentsPanel } from '@/components/war-room/ArgumentsPanel';
import { SmartPdfViewer } from '@/components/war-room/SmartPdfViewer';
import { DocumentSelector } from '@/components/war-room/DocumentSelector';
import { DocumentReviewPanel } from '@/components/documents/DocumentReviewPanel';
import { WhisperNotification } from '@/components/war-room/WhisperNotification';
import { WhisperDrawer } from '@/components/war-room/WhisperDrawer';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { NetworkStatusPill } from '@/components/layout/NetworkStatusPill';
import { useDocketItem } from '@/hooks/useDocket';
import { useArguments } from '@/hooks/useArguments';
import { useExtendedDocuments, useDocumentReview } from '@/hooks/useDocumentManagement';
import { useLiveBoardForCourt } from '@/hooks/useLiveBoard';
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
  const [leftPanelTab, setLeftPanelTab] = useState<'arguments' | 'documents'>('arguments');

  const { data: docketItem, isLoading: docketLoading } = useDocketItem(caseId!);
  const { data: args } = useArguments(caseId!);
  const { data: documents, isLoading: docsLoading } = useExtendedDocuments(caseId!);
  const { approveDocument, rejectDocument, setPrimaryDocument } = useDocumentReview(caseId!);
  const liveBoard = useLiveBoardForCourt(
    docketItem?.court_location ?? '',
    docketItem?.court_room_no ?? ''
  );

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

  const currentItem = liveBoard?.current_item ?? 0;
  const distance = docketItem ? docketItem.item_no - currentItem : 0;
  const isPanic = distance > 0 && distance <= 5;
  const isRunning = distance <= 0;

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
                    
                    {isRunning && (
                      <Badge variant="running" role="status" aria-live="assertive">RUNNING NOW</Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Court {docketItem.court_room_no} • {docketItem.court_location} • Item #{docketItem.item_no}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <NetworkStatusPill />
                <Badge variant="gold" className="text-sm">
                  SENIOR MODE
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
              onValueChange={(v) => setLeftPanelTab(v as 'arguments' | 'documents')}
              className="flex flex-col h-full"
            >
              <TabsList className="grid w-full grid-cols-2 m-2">
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
            </Tabs>
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
