import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Scale, AlertTriangle } from 'lucide-react';
import { ArgumentsPanel } from '@/components/war-room/ArgumentsPanel';
import { PdfViewer } from '@/components/war-room/PdfViewer';
import { DocumentSelector } from '@/components/war-room/DocumentSelector';
import { WhisperNotification } from '@/components/war-room/WhisperNotification';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { useDocketItem } from '@/hooks/useDocket';
import { useArguments } from '@/hooks/useArguments';
import { useCaseDocuments } from '@/hooks/useCaseDocuments';
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

  const { data: docketItem, isLoading: docketLoading } = useDocketItem(caseId!);
  const { data: args } = useArguments(caseId!);
  const { data: documents } = useCaseDocuments(caseId!);
  const liveBoard = useLiveBoardForCourt(
    docketItem?.court_location ?? '',
    docketItem?.court_room_no ?? ''
  );

  // Auto-select first document when loaded
  useEffect(() => {
    if (documents && documents.length > 0 && !selectedDocId) {
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

  // Get the PDF URL from selected document or fallback
  const selectedDoc = documents?.find(d => d.id === selectedDocId);
  const pdfUrl = selectedDoc?.file_url || FALLBACK_PDF_URL;

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
          <Button variant="gold" onClick={() => navigate('/')}>
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

        {/* Whisper Listener */}
        <WhisperNotification docketId={caseId!} />

        {/* Header */}
        <header
          className={cn(
            'border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-40 transition-colors',
            isPanic && 'bg-court-danger border-court-danger-light',
            isRunning && 'bg-court-danger border-court-danger-light gold-glow'
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
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="font-display text-xl font-bold text-foreground">
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
              
              <div className="flex items-center gap-2">
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
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectDoc={setSelectedDocId}
          />
        )}

        {/* Main Content - Split View */}
        <main id="main-content" className="flex-1 flex overflow-hidden" role="main">
          {/* Left Panel: Arguments (30%) */}
          <div className="w-[30%] border-r border-border">
            <ArgumentsPanel
              arguments={args ?? []}
              selectedArg={selectedArg}
              onSelectArg={handleSelectArg}
            />
          </div>

          {/* Right Panel: PDF Viewer (70%) */}
          <div className="w-[70%]">
            <PdfViewer
              pdfUrl={pdfUrl}
              targetPage={selectedArg?.linked_page_number ?? 1}
            />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
