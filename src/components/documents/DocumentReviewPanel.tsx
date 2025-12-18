import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  CheckCircle,
  XCircle,
  Star,
  AlertTriangle,
  Clock,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CaseDocumentExtended,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_LANGUAGE_LABELS,
  DOCUMENT_FORMAT_LABELS,
  DOCUMENT_LEGIBILITY_LABELS,
  DocumentType,
} from '@/types/documents';

interface DocumentReviewPanelProps {
  documents: CaseDocumentExtended[];
  onApprove: (docId: string) => Promise<void>;
  onReject: (docId: string) => Promise<void>;
  onSetPrimary: (docId: string, docType: DocumentType) => Promise<void>;
  onViewDocument: (docId: string) => void;
  selectedDocId?: string | null;
  isLoading?: boolean;
}

export function DocumentReviewPanel({
  documents,
  onApprove,
  onReject,
  onSetPrimary,
  onViewDocument,
  selectedDocId,
  isLoading,
}: DocumentReviewPanelProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingDocs = documents.filter((d) => d.review_status === 'pending');
  const approvedDocs = documents.filter((d) => d.review_status === 'approved');
  const rejectedDocs = documents.filter((d) => d.review_status === 'rejected');

  const handleApprove = async (docId: string) => {
    setProcessingId(docId);
    try {
      await onApprove(docId);
      toast.success('Document approved');
    } catch {
      toast.error('Failed to approve document');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (docId: string) => {
    setProcessingId(docId);
    try {
      await onReject(docId);
      toast.warning('Document rejected');
    } catch {
      toast.error('Failed to reject document');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSetPrimary = async (docId: string, docType: DocumentType) => {
    setProcessingId(docId);
    try {
      await onSetPrimary(docId, docType);
      toast.success('Document set as primary');
    } catch {
      toast.error('Failed to set as primary');
    } finally {
      setProcessingId(null);
    }
  };

  const DocumentCard = ({ doc, showActions = false }: { doc: CaseDocumentExtended; showActions?: boolean }) => {
    const hasWarnings =
      doc.format === 'HANDWRITTEN' ||
      doc.legibility === 'POOR' ||
      doc.language === 'UNKNOWN';

    return (
      <div
        className={cn(
          'p-3 rounded-lg glass-card transition-all cursor-pointer',
          selectedDocId === doc.id && 'ring-2 ring-primary',
          doc.is_primary && 'border-l-4 border-l-primary'
        )}
        onClick={() => onViewDocument(doc.id)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground truncate">
                  {doc.document_type
                    ? DOCUMENT_TYPE_LABELS[doc.document_type]
                    : 'Unknown Type'}
                </span>
                {doc.is_primary && (
                  <Badge variant="gold" className="text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    PRIMARY
                  </Badge>
                )}
                {doc.review_status === 'pending' && (
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    PENDING
                  </Badge>
                )}
                {doc.review_status === 'approved' && (
                  <Badge variant="success" className="text-xs bg-court-success/20 text-court-success border-court-success/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    APPROVED
                  </Badge>
                )}
                {doc.review_status === 'rejected' && (
                  <Badge variant="destructive" className="text-xs">
                    <XCircle className="h-3 w-3 mr-1" />
                    REJECTED
                  </Badge>
                )}
              </div>

              {/* Metadata tags */}
              <div className="flex flex-wrap gap-1 mt-2">
                <Badge variant="outline" className="text-xs">
                  {DOCUMENT_LANGUAGE_LABELS[doc.language]}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {DOCUMENT_FORMAT_LABELS[doc.format]}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    doc.legibility === 'POOR' && 'border-court-warning text-court-warning'
                  )}
                >
                  {DOCUMENT_LEGIBILITY_LABELS[doc.legibility]}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  v{doc.version}
                </Badge>
              </div>

              {/* Warnings */}
              {hasWarnings && (
                <div className="flex items-center gap-1 mt-2 text-court-warning">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-xs">
                    {doc.legibility === 'POOR'
                      ? 'Poor legibility'
                      : doc.format === 'HANDWRITTEN'
                      ? 'Handwritten'
                      : 'Language unknown'}
                  </span>
                </div>
              )}

              {/* Upload info */}
              <p className="text-xs text-muted-foreground mt-2">
                Uploaded{' '}
                {new Date(doc.uploaded_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onViewDocument(doc.id);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>

        {/* Action buttons for pending docs */}
        {showActions && doc.review_status === 'pending' && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-court-success hover:bg-court-success/10"
              onClick={(e) => {
                e.stopPropagation();
                handleApprove(doc.id);
              }}
              disabled={processingId === doc.id}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                handleReject(doc.id);
              }}
              disabled={processingId === doc.id}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        )}

        {/* Set as primary for approved docs */}
        {doc.review_status === 'approved' && !doc.is_primary && doc.document_type && (
          <div className="mt-3 pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                handleSetPrimary(doc.id, doc.document_type!);
              }}
              disabled={processingId === doc.id}
            >
              <Star className="h-4 w-4 mr-1" />
              Set as Primary {DOCUMENT_TYPE_LABELS[doc.document_type]}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="glass-card h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-display tracking-wide">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Documents Review
          </div>
          <Badge variant="secondary">
            {pendingDocs.length} pending
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full legal-scroll pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <FileText className="h-8 w-8 text-primary animate-pulse" />
            </div>
          ) : documents.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No documents uploaded yet
            </p>
          ) : (
            <div className="space-y-6">
              {/* Pending Review Section */}
              {pendingDocs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-court-warning" />
                    Pending Review ({pendingDocs.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingDocs.map((doc) => (
                      <DocumentCard key={doc.id} doc={doc} showActions />
                    ))}
                  </div>
                </div>
              )}

              {/* Approved Section */}
              {approvedDocs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-court-success" />
                    Approved ({approvedDocs.length})
                  </h3>
                  <div className="space-y-2">
                    {approvedDocs.map((doc) => (
                      <DocumentCard key={doc.id} doc={doc} />
                    ))}
                  </div>
                </div>
              )}

              {/* Rejected Section */}
              {rejectedDocs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Rejected ({rejectedDocs.length})
                  </h3>
                  <div className="space-y-2 opacity-60">
                    {rejectedDocs.map((doc) => (
                      <DocumentCard key={doc.id} doc={doc} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
