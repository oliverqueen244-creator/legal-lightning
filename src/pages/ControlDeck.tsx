import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Scale, Upload, FileText, Clock } from 'lucide-react';
import { WhisperInput } from '@/components/control-deck/WhisperInput';
import { useDocketItem } from '@/hooks/useDocket';
import { useWhisperFeed } from '@/hooks/useWhisper';
import { useLiveBoardForCourt } from '@/hooks/useLiveBoard';
import { cn } from '@/lib/utils';

export default function ControlDeck() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);

  const { data: docketItem, isLoading: docketLoading } = useDocketItem(caseId!);
  const { data: whispers } = useWhisperFeed(caseId!);
  const liveBoard = useLiveBoardForCourt(
    docketItem?.court_location ?? '',
    docketItem?.court_room_no ?? ''
  );

  const currentItem = liveBoard?.current_item ?? 0;
  const distance = docketItem ? docketItem.item_no - currentItem : 0;
  const isPanic = distance > 0 && distance <= 5;
  const isRunning = distance <= 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Handle file upload logic here
    const files = e.dataTransfer.files;
    console.log('Files dropped:', files);
  };

  if (docketLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Scale className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  if (!docketItem) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Case not found</p>
        <Button variant="gold" onClick={() => navigate('/')}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header
        className={cn(
          'border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-40',
          isPanic && 'bg-court-danger border-court-danger-light',
          isRunning && 'bg-court-danger border-court-danger-light'
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
                    <Badge variant="danger">{distance} ITEMS AWAY</Badge>
                  )}
                  
                  {isRunning && (
                    <Badge variant="running">RUNNING NOW</Badge>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Court {docketItem.court_room_no} • {docketItem.court_location}
                </p>
              </div>
            </div>
            
            <Badge variant="secondary" className="text-sm">
              JUNIOR MODE
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evidence Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Upload className="h-5 w-5 text-primary" />
                Evidence Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-foreground font-medium mb-2">
                  Drag & drop files here
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse
                </p>
                <Button variant="court">
                  Select Files
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Message History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Clock className="h-5 w-5 text-primary" />
                Message History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 legal-scroll">
                {!whispers || whispers.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No messages yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {whispers.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-3 rounded-lg bg-secondary/50 border border-border"
                      >
                        <p className="text-sm text-foreground">{msg.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Whisper Input Bar */}
      <WhisperInput docketId={caseId!} />
    </div>
  );
}
