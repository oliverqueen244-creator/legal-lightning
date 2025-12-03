import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Scale, AlertTriangle } from 'lucide-react';
import { ArgumentsPanel } from '@/components/war-room/ArgumentsPanel';
import { PdfViewer } from '@/components/war-room/PdfViewer';
import { WhisperNotification } from '@/components/war-room/WhisperNotification';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { useDocketItem } from '@/hooks/useDocket';
import { useArguments } from '@/hooks/useArguments';
import { useLiveBoardForCourt } from '@/hooks/useLiveBoard';
import type { CaseArgument } from '@/types/database';
import { cn } from '@/lib/utils';

// Demo PDF URL for testing
const DEMO_PDF_URL = 'https://pdfobject.com/pdf/sample.pdf';

export default function WarRoom() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [selectedArg, setSelectedArg] = useState<CaseArgument | null>(null);

  const { data: docketItem, isLoading: docketLoading } = useDocketItem(caseId!);
  const { data: args, isLoading: argsLoading } = useArguments(caseId!);
  const liveBoard = useLiveBoardForCourt(
    docketItem?.court_location ?? '',
    docketItem?.court_room_no ?? ''
  );

  const currentItem = liveBoard?.current_item ?? 0;
  const distance = docketItem ? docketItem.item_no - currentItem : 0;
  const isPanic = distance > 0 && distance <= 5;
  const isRunning = distance <= 0;

  const handleSelectArg = (arg: CaseArgument) => {
    setSelectedArg(arg);
  };

  if (docketLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Scale className="h-12 w-12 text-primary animate-pulse" />
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
        {/* Whisper Listener */}
        <WhisperNotification docketId={caseId!} />

        {/* Header */}
        <header
          className={cn(
            'border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-40 transition-colors',
            isPanic && 'bg-court-danger border-court-danger-light',
            isRunning && 'bg-court-danger border-court-danger-light gold-glow'
          )}
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="font-display text-xl font-bold text-foreground">
                      {docketItem.case_number}
                    </h1>
                    
                    {isPanic && (
                      <Badge variant="danger" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {distance} ITEMS AWAY
                      </Badge>
                    )}
                    
                    {isRunning && (
                      <Badge variant="running">RUNNING NOW</Badge>
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

        {/* Main Content - Split View */}
        <main className="flex-1 flex overflow-hidden">
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
              pdfUrl={DEMO_PDF_URL}
              targetPage={selectedArg?.linked_page_number ?? 1}
            />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
