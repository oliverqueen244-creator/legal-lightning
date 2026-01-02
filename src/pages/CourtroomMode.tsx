import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Scale,
  AlertTriangle,
  FileText,
  List,
  Clock,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { useCourtroomSnapshot, CourtroomCase } from '@/hooks/useCourtroomSnapshot';

export default function CourtroomMode() {
  const navigate = useNavigate();
  const { snapshot, isLoading, isOnline, regenerate, isRegenerating } = useCourtroomSnapshot();

  // Loading state - minimal, no animation
  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Scale className="h-16 w-16 text-muted-foreground" />
        </div>
      </AuthGuard>
    );
  }

  // No snapshot available
  if (!snapshot || snapshot.total_cases === 0) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8">
          <Scale className="h-20 w-20 text-muted-foreground/50" />
          <h1 className="text-2xl font-display text-foreground text-center">
            No Cases Today
          </h1>
          <p className="text-muted-foreground text-center max-w-md">
            No cases found in last sync
          </p>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/')}
            className="mt-4"
          >
            Return
          </Button>
        </div>
      </AuthGuard>
    );
  }

  // Calm, flat case card - no expansion, no interaction
  const CaseCard = ({ caseItem }: { caseItem: CourtroomCase }) => {
    const hasWarnings = caseItem.warnings.length > 0;

    return (
      <div className="border-b border-border/20 py-8">
        {/* Item number - large and clear */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-baseline gap-6">
            <span className="text-7xl md:text-8xl font-display font-bold text-foreground/80 tabular-nums">
              {caseItem.item_no}
            </span>
            <div>
              <h2 className="text-xl md:text-2xl font-display text-foreground">
                {caseItem.case_number}
              </h2>
              <p className="text-base text-muted-foreground mt-1">
                Court {caseItem.court_room_no}
              </p>
            </div>
          </div>
        </div>

        {/* Parties - clear, readable */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className={caseItem.matched_as === 'petitioner' ? 'text-foreground' : 'text-muted-foreground'}>
            <span className="text-xs uppercase tracking-wide text-muted-foreground/70 block mb-1">
              Petitioner
            </span>
            <p className="text-lg">{caseItem.petitioner || '—'}</p>
            {caseItem.petitioner_lawyer && (
              <p className="text-sm text-muted-foreground mt-1">
                Adv. {caseItem.petitioner_lawyer}
              </p>
            )}
          </div>
          <div className={caseItem.matched_as === 'respondent' ? 'text-foreground' : 'text-muted-foreground'}>
            <span className="text-xs uppercase tracking-wide text-muted-foreground/70 block mb-1">
              Respondent
            </span>
            <p className="text-lg">{caseItem.respondent || '—'}</p>
            {caseItem.respondent_lawyer && (
              <p className="text-sm text-muted-foreground mt-1">
                Adv. {caseItem.respondent_lawyer}
              </p>
            )}
          </div>
        </div>

        {/* Judge */}
        {caseItem.judge_names && (
          <p className="text-base text-muted-foreground mb-4">
            Before: {caseItem.judge_names}
          </p>
        )}

        {/* Warnings - inline, muted */}
        {hasWarnings && (
          <div className="mb-4">
            {caseItem.warnings.map((warning, i) => (
              <p key={i} className="text-sm text-muted-foreground/80 flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                {warning}
              </p>
            ))}
          </div>
        )}

        {/* Document/argument counts - subtle */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            {caseItem.documents.length}
          </span>
          <span className="flex items-center gap-1.5">
            <List className="h-4 w-4" />
            {caseItem.arguments.length}
          </span>
        </div>
      </div>
    );
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background text-foreground">
        {/* Minimal header - no navigation, no exploration */}
        <div
          className={cn(
            'sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b',
            snapshot.is_stale
              ? 'border-muted-foreground/30'
              : 'border-border/50'
          )}
        >
          <div className="flex items-center gap-4">
            <Scale className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="font-display text-lg text-foreground">Court</h1>
              {/* COURT-SAFETY: Data freshness always visible */}
              <FreshnessIndicator
                lastUpdated={snapshot.generated_at}
                onRefresh={isOnline ? () => regenerate() : undefined}
                isRefetching={isRegenerating}
                size="sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isOnline && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}
            {isOnline && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => regenerate()}
                disabled={isRegenerating}
                className="text-muted-foreground"
              >
                <RefreshCw className={cn('h-4 w-4', isRegenerating && 'animate-spin')} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-muted-foreground"
            >
              Exit
            </Button>
          </div>
        </div>

        {/* Case count - simple */}
        <div className="px-6 py-6 border-b border-border/20">
          <div className="max-w-3xl mx-auto flex items-baseline justify-between">
            <div>
              <span className="text-4xl font-display font-bold text-foreground">
                {snapshot.total_cases}
              </span>
              <span className="text-xl text-muted-foreground ml-2">
                case{snapshot.total_cases !== 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, d MMMM')}
            </span>
          </div>
        </div>

        {/* Cases list - single vertical scroll, no interaction */}
        <ScrollArea className="h-[calc(100vh-160px)]">
          <div className="max-w-3xl mx-auto px-6">
            {snapshot.cases.map((caseItem) => (
              <CaseCard key={caseItem.id} caseItem={caseItem} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </AuthGuard>
  );
}