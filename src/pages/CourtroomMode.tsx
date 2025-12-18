import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Scale,
  AlertTriangle,
  FileText,
  List,
  Clock,
  WifiOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { useCourtroomSnapshot, CourtroomCase } from '@/hooks/useCourtroomSnapshot';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_LANGUAGE_LABELS, DOCUMENT_FORMAT_LABELS } from '@/types/documents';

export default function CourtroomMode() {
  const navigate = useNavigate();
  const { snapshot, isLoading, isOnline, regenerate, isRegenerating } = useCourtroomSnapshot();
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  // Loading state - minimal, no spinner animation
  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Scale className="h-16 w-16 text-primary" />
        </div>
      </AuthGuard>
    );
  }

  // No snapshot available
  if (!snapshot || snapshot.total_cases === 0) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 p-8">
          <Scale className="h-20 w-20 text-muted-foreground" />
          <h1 className="text-2xl font-display text-foreground text-center">
            No Cases for Today
          </h1>
          <p className="text-muted-foreground text-center max-w-md">
            No scheduled cases found. Return to dashboard to check your docket.
          </p>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/')}
            className="mt-4"
          >
            Return to Dashboard
          </Button>
        </div>
      </AuthGuard>
    );
  }

  const CaseCard = ({ caseItem }: { caseItem: CourtroomCase }) => {
    const isExpanded = expandedCase === caseItem.id;
    const hasWarnings = caseItem.warnings.length > 0;
    const primaryDocs = caseItem.documents.filter((d) => d.is_primary);

    return (
      <div
        className={cn(
          'border-b border-border/50 py-6',
          hasWarnings && 'bg-court-danger/5'
        )}
      >
        {/* Main case info - always visible */}
        <div
          className="cursor-pointer"
          onClick={() => setExpandedCase(isExpanded ? null : caseItem.id)}
        >
          {/* Item number - GIANT */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-baseline gap-4">
              <span className="text-6xl md:text-7xl font-display font-bold text-primary">
                {caseItem.item_no}
              </span>
              <div>
                <h2 className="text-xl md:text-2xl font-display font-semibold text-foreground">
                  {caseItem.case_number}
                </h2>
                <p className="text-lg text-muted-foreground">
                  Court {caseItem.court_room_no}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {hasWarnings && (
                <Badge variant="danger" className="text-sm">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {caseItem.warnings.length}
                </Badge>
              )}
              {isExpanded ? (
                <ChevronUp className="h-6 w-6 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
            <div className={cn(caseItem.matched_as === 'petitioner' && 'text-primary font-medium')}>
              <span className="text-muted-foreground text-sm block">Petitioner</span>
              {caseItem.petitioner || 'Not specified'}
              {caseItem.petitioner_lawyer && (
                <span className="text-muted-foreground text-base block">
                  Adv. {caseItem.petitioner_lawyer}
                </span>
              )}
            </div>
            <div className={cn(caseItem.matched_as === 'respondent' && 'text-primary font-medium')}>
              <span className="text-muted-foreground text-sm block">Respondent</span>
              {caseItem.respondent || 'Not specified'}
              {caseItem.respondent_lawyer && (
                <span className="text-muted-foreground text-base block">
                  Adv. {caseItem.respondent_lawyer}
                </span>
              )}
            </div>
          </div>

          {/* Judge */}
          {caseItem.judge_names && (
            <p className="mt-3 text-base text-muted-foreground">
              <strong>Before:</strong> {caseItem.judge_names}
            </p>
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-border/30 space-y-6">
            {/* Warnings */}
            {hasWarnings && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-court-danger-light flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </h3>
                <ul className="space-y-1">
                  {caseItem.warnings.map((warning, i) => (
                    <li key={i} className="text-base text-court-danger-light pl-6">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Documents */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Documents ({caseItem.documents.length})
              </h3>
              {caseItem.documents.length === 0 ? (
                <p className="text-base text-muted-foreground pl-6">
                  No approved documents
                </p>
              ) : (
                <div className="space-y-2 pl-6">
                  {caseItem.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg bg-white/5',
                        doc.is_primary && 'border-l-4 border-l-primary'
                      )}
                    >
                      <div>
                        <span className="text-base text-foreground">
                          {DOCUMENT_TYPE_LABELS[doc.document_type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.document_type}
                        </span>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {DOCUMENT_LANGUAGE_LABELS[doc.language as keyof typeof DOCUMENT_LANGUAGE_LABELS] || doc.language}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {DOCUMENT_FORMAT_LABELS[doc.format as keyof typeof DOCUMENT_FORMAT_LABELS] || doc.format}
                          </Badge>
                          {doc.legibility === 'POOR' && (
                            <Badge variant="danger" className="text-xs">
                              Poor Legibility
                            </Badge>
                          )}
                        </div>
                      </div>
                      {doc.is_primary && (
                        <Badge variant="gold" className="text-xs">PRIMARY</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Arguments */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <List className="h-4 w-4 text-primary" />
                Arguments ({caseItem.arguments.length})
              </h3>
              {caseItem.arguments.length === 0 ? (
                <p className="text-base text-muted-foreground pl-6">
                  No arguments prepared
                </p>
              ) : (
                <ol className="space-y-2 pl-6">
                  {caseItem.arguments.map((arg, index) => (
                    <li key={arg.id} className="text-lg text-foreground">
                      <span className="text-primary font-medium">{index + 1}.</span>{' '}
                      {arg.title}
                      <span className="text-sm text-muted-foreground ml-2">
                        (p. {arg.linked_page_number})
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-black text-foreground">
        {/* Snapshot status banner */}
        <div
          className={cn(
            'sticky top-0 z-50 px-4 py-3 flex items-center justify-between',
            snapshot.is_stale
              ? 'bg-court-warning/20 border-b border-court-warning/30'
              : 'bg-card border-b border-border'
          )}
        >
          <div className="flex items-center gap-3">
            <Scale className="h-6 w-6 text-primary" />
            <div>
              <h1 className="font-display font-bold text-lg">COURTROOM MODE</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Snapshot: {format(new Date(snapshot.generated_at), 'HH:mm')}
                {snapshot.is_stale && (
                  <Badge variant="secondary" className="text-xs bg-court-warning/20 text-court-warning">
                    STALE
                  </Badge>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isOnline && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                OFFLINE
              </Badge>
            )}
            {isOnline && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => regenerate()}
                disabled={isRegenerating}
              >
                <RefreshCw className={cn('h-4 w-4 mr-1', isRegenerating && 'animate-spin')} />
                Refresh
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
            >
              Exit
            </Button>
          </div>
        </div>

        {/* Case count summary */}
        <div className="px-4 py-4 border-b border-border/30 bg-card/50">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <span className="text-2xl font-display">
              <span className="text-primary font-bold">{snapshot.total_cases}</span>{' '}
              <span className="text-muted-foreground">
                case{snapshot.total_cases !== 1 ? 's' : ''} today
              </span>
            </span>
            <span className="text-muted-foreground">
              {format(new Date(), 'EEEE, d MMMM yyyy')}
            </span>
          </div>
        </div>

        {/* Cases list - vertical scroll */}
        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="max-w-4xl mx-auto px-4">
            {snapshot.cases.map((caseItem) => (
              <CaseCard key={caseItem.id} caseItem={caseItem} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </AuthGuard>
  );
}
