import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Scale, Clock, FileText, CheckCircle } from 'lucide-react';
import { WhisperInput } from '@/components/control-deck/WhisperInput';
import { WhisperDrawer } from '@/components/war-room/WhisperDrawer';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { NetworkStatusPill } from '@/components/layout/NetworkStatusPill';
import { DocumentUploadForm } from '@/components/documents/DocumentUploadForm';
import { useDocketItem } from '@/hooks/useDocket';
import { useWhisperFeed } from '@/hooks/useWhisper';
import { useLiveBoardForCourt } from '@/hooks/useLiveBoard';
import { useDocumentUpload, useExtendedDocuments } from '@/hooks/useDocumentManagement';
import { cn } from '@/lib/utils';
import { DOCUMENT_TYPE_LABELS } from '@/types/documents';

export default function ControlDeck() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const { data: docketItem, isLoading: docketLoading } = useDocketItem(caseId!);
  const { data: whispers } = useWhisperFeed(caseId!);
  const { data: documents } = useExtendedDocuments(caseId!);
  const liveBoard = useLiveBoardForCourt(
    docketItem?.court_location ?? '',
    docketItem?.court_room_no ?? ''
  );
  const { uploadDocument, uploading } = useDocumentUpload(caseId!);

  const currentItem = liveBoard?.current_item ?? 0;
  const distance = docketItem ? docketItem.item_no - currentItem : 0;
  const isPanic = distance > 0 && distance <= 5;
  const isRunning = distance <= 0;

  // Get document stats
  const pendingDocs = documents?.filter((d) => d.review_status === 'pending') || [];
  const approvedDocs = documents?.filter((d) => d.review_status === 'approved') || [];

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
          <Button variant="gold" onClick={() => navigate('/')} className="min-h-touch">
            Return to Dashboard
          </Button>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        {/* Whisper Chat Drawer */}
        <WhisperDrawer docketId={caseId!} />

        {/* Header */}
        <header
          className={cn(
            'border-b border-border glass-card rounded-none sticky top-0 z-40',
            isPanic && 'bg-court-danger/20 border-court-danger-light',
            isRunning && 'bg-primary/10 border-primary gold-glow'
          )}
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
              
              <div className="flex items-center gap-3">
                <NetworkStatusPill />
                <Badge variant="secondary" className="text-sm">
                  PREPARATION MODE
                </Badge>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Document Upload Form */}
            <DocumentUploadForm
              docketId={caseId!}
              onUpload={uploadDocument}
              uploading={uploading}
            />

            {/* Right Column */}
            <div className="space-y-6">
              {/* Document Status Summary */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display tracking-wide">
                    <FileText className="h-5 w-5 text-primary" />
                    Document Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-court-warning/10 border border-court-warning/30">
                      <p className="text-2xl font-bold text-court-warning">{pendingDocs.length}</p>
                      <p className="text-sm text-muted-foreground">Pending Review</p>
                    </div>
                    <div className="p-4 rounded-lg bg-court-success/10 border border-court-success/30">
                      <p className="text-2xl font-bold text-court-success">{approvedDocs.length}</p>
                      <p className="text-sm text-muted-foreground">Approved</p>
                    </div>
                  </div>

                  {/* Recent uploads */}
                  {documents && documents.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-foreground mb-2">Recent Uploads</h4>
                      <div className="space-y-2">
                        {documents.slice(0, 3).map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2 rounded-lg glass-card"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-foreground">
                                {doc.document_type
                                  ? DOCUMENT_TYPE_LABELS[doc.document_type]
                                  : 'Document'}
                              </span>
                            </div>
                            <Badge
                              variant={
                                doc.review_status === 'approved'
                                  ? 'secondary'
                                  : doc.review_status === 'rejected'
                                  ? 'destructive'
                                  : 'outline'
                              }
                              className="text-xs"
                            >
                              {doc.review_status === 'approved' && (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              )}
                              {doc.review_status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Message History */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display tracking-wide">
                    <Clock className="h-5 w-5 text-primary" />
                    Recent Messages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48 legal-scroll">
                    {!whispers || whispers.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-8">
                        No messages yet. Send a note to the Senior.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {whispers.map((msg) => (
                          <div
                            key={msg.id}
                            className="p-3 rounded-lg glass-card"
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
          </div>
        </main>

        {/* Whisper Input Bar */}
        <WhisperInput docketId={caseId!} />
      </div>
    </AuthGuard>
  );
}
