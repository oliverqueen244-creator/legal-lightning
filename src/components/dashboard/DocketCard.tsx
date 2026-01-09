import { useState, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Scale, Clock, AlertTriangle, ChevronRight, SkipForward, Coffee, Ban, Zap, Play, Calendar, FileText, Upload, Database, User, Users } from 'lucide-react';
import type { DocketItem, LiveBoardCache, BoardStatus, HearingLikelihood } from '@/types/database';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CaseTimeEstimatorCompact } from './CaseTimeEstimator';
import { HearingLikelihoodBadge } from './HearingLikelihoodBadge';
import { useAliases } from '@/hooks/useAliases';

// Helper function to format party names with smart truncation
const formatPartyName = (name: string | null | undefined, maxLength = 28) => {
  if (!name) return '';
  const cleaned = name
    .replace(/\s+AND\s+(ORS\.?|ANR\.?|OTHERS?)$/i, ' & Ors.')
    .replace(/STATE OF RAJASTHAN/gi, 'State of Raj.')
    .replace(/UNION OF INDIA/gi, 'UOI')
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength - 3) + '...';
};
interface DocketCardProps {
  item: DocketItem & { 
    status?: string; 
    force_active?: boolean; 
    created_at?: string;
    hearing_likelihood?: HearingLikelihood | null;
    likelihood_reason?: string | null;
    judge_names?: string | null;
  };
  liveBoard?: LiveBoardCache;
  userRole?: AppRole | null;
  onForceActive?: (itemId: string) => void;
  showDate?: boolean;
  pendingDocCount?: number;
  /** P1 FIX: If provided, shows "Cached at" timestamp for offline data */
  cachedAt?: number;
}

// PHASE 2.2: Memoized DocketCard to prevent re-renders on unrelated live board changes
function DocketCardInner({ item, liveBoard, userRole, onForceActive, showDate, pendingDocCount = 0, cachedAt }: DocketCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isForcing, setIsForcing] = useState(false);
  const { aliases } = useAliases();
  
  const currentItem = liveBoard?.current_item ?? 0;
  const boardStatus: BoardStatus = liveBoard?.status ?? 'hearing';
  const distance = item.item_no - currentItem;
  
  // Enhanced panic logic: Different thresholds for daily vs supplementary
  const isSupplementary = item.list_type === 'SUPPLEMENTARY';
  const panicThreshold = isSupplementary ? 10 : 5;
  
  const isPanic = distance > 0 && distance <= panicThreshold && boardStatus === 'hearing';
  const isRunning = (distance <= 0 && boardStatus === 'hearing') || item.force_active;
  const isPassover = boardStatus === 'passover' || item.status === 'passover';
  const isLunch = boardStatus === 'lunch';
  const isAdjourned = boardStatus === 'adjourned';
  const isDone = item.status === 'done';

  // Determine which side the lawyer represents
  const matchedAs = useMemo(() => {
    if (!aliases || aliases.length === 0) return null;
    const aliasNames = aliases.map(a => a.alias_name.toUpperCase());
    if (aliasNames.some(alias => item.petitioner_lawyer?.toUpperCase().includes(alias))) {
      return 'petitioner';
    }
    if (aliasNames.some(alias => item.respondent_lawyer?.toUpperCase().includes(alias))) {
      return 'respondent';
    }
    return null;
  }, [aliases, item.petitioner_lawyer, item.respondent_lawyer]);

  const getStatusText = () => {
    if (item.force_active) return t('forced_active');
    if (isDone) return t('completed');
    if (isPassover) return t('skipped');
    if (isLunch) return t('lunch_break');
    if (isAdjourned) return t('adjourned');
    if (isRunning) return t('running_now');
    if (isPanic) return t('items_away', { count: distance });
    return t('item_no', { number: item.item_no });
  };

  const getStatusIcon = () => {
    if (item.force_active) return Zap;
    if (isPassover) return SkipForward;
    if (isLunch) return Coffee;
    if (isAdjourned) return Ban;
    return Clock;
  };

  const StatusIcon = getStatusIcon();

  const handleClick = () => {
    if (userRole === 'SENIOR' || userRole === 'ADMIN') {
      navigate(`/war-room/${item.id}`);
    } else {
      navigate(`/control-deck/${item.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  // Force Active handler - allows manual override of scraper status
  const handleForceActive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // P0 FIX: Block Force Active when offline - must be server-confirmed
    if (!navigator.onLine) {
      toast.error(t('connection_required'), {
        description: t('must_be_online'),
        duration: 4000,
      });
      return;
    }
    
    if (isForcing) return;
    setIsForcing(true);
    
    try {
      const { error } = await supabase
        .from('daily_court_docket')
        .update({ 
          force_active: true,
          status: 'active'
        })
        .eq('id', item.id);
      
      if (error) throw error;
      
      toast.success(t('case_marked_active'), {
        description: t('status_override_applied'),
      });
      
      onForceActive?.(item.id);
    } catch (err) {
      console.error('Failed to force active:', err);
      toast.error(t('failed_update_status'));
    } finally {
      setIsForcing(false);
    }
  };

  const canForceActive = (userRole === 'SENIOR' || userRole === 'ADMIN') && 
    !isRunning && 
    !isDone && 
    !item.force_active;

  return (
    <Card
      className={cn(
        'court-card cursor-pointer border-2 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
        isPanic && 'panic-pulse border-court-danger-light',
        isRunning && 'border-primary gold-glow',
        item.force_active && 'border-primary/80 bg-primary/5',
        isPassover && 'card-passover border-muted',
        isLunch && 'border-court-warning/50 bg-court-warning/5',
        isAdjourned && 'border-muted/50 bg-muted/10 opacity-60',
        isDone && 'border-court-success/50 bg-court-success/5 opacity-70',
        isSupplementary && !isPanic && !isRunning && !isPassover && !isLunch && !isAdjourned && !isDone && 'border-court-warning/50',
        !isPanic && !isRunning && !isSupplementary && !isPassover && !isLunch && !isAdjourned && !isDone && 'border-border hover:border-primary/50'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Case ${item.case_number}, ${getStatusText()}, Court ${item.court_room_no}`}
    >
      <CardContent className={cn('p-4 touch-spacing', isPassover && 'card-content')}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* P1 FIX: Show cached timestamp when data is from offline cache */}
              {cachedAt && (
                <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground border-muted">
                  <Database className="h-3 w-3" />
                  {t('cached')} {formatDistanceToNow(cachedAt, { addSuffix: true })}
                </Badge>
              )}
              {showDate && item.date && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(item.date), 'EEE, MMM d')}
                </Badge>
              )}
              {isSupplementary && (
                <Badge variant="supplementary">{t('supplementary')}</Badge>
              )}
              {/* Role Indicator Badge */}
              {matchedAs && (
                <Badge variant="outline" className="flex items-center gap-1 text-xs border-primary/50 text-primary">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {matchedAs === 'petitioner' ? t('petitioner_counsel') : t('respondent_counsel')}
                </Badge>
              )}
              {item.force_active && (
                <Badge className="flex items-center gap-1 bg-primary/20 text-primary border-primary/30">
                  <Zap className="h-3 w-3" aria-hidden="true" />
                  {t('forced')}
                </Badge>
              )}
              {isPassover && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-muted text-muted-foreground">
                  <SkipForward className="h-3 w-3" aria-hidden="true" />
                  {t('skipped')}
                </Badge>
              )}
              {isLunch && (
                <Badge className="flex items-center gap-1 bg-court-warning/20 text-court-warning border-court-warning/30">
                  <Coffee className="h-3 w-3" aria-hidden="true" />
                  {t('lunch_break')}
                </Badge>
              )}
              {isAdjourned && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-muted text-muted-foreground">
                  <Ban className="h-3 w-3" aria-hidden="true" />
                  {t('adjourned')}
                </Badge>
              )}
              {isDone && (
                <Badge className="flex items-center gap-1 bg-court-success/20 text-court-success border-court-success/30">
                  {t('completed')}
                </Badge>
              )}
              {isPanic && !item.force_active && (
                <Badge variant="danger" className="flex items-center gap-1" role="status" aria-live="polite">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  {isSupplementary ? t('urgent_supp') : t('urgent')}
                </Badge>
              )}
              {isRunning && !item.force_active && (
                <Badge variant="running" role="status" aria-live="assertive">{t('running_now')}</Badge>
              )}
            </div>
            
            <h3 className={cn(
              'font-display text-lg font-semibold text-foreground truncate mb-1 tracking-wide',
              (isPassover || isDone) && 'line-through opacity-60'
            )}>
              {item.case_number}
            </h3>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Scale className="h-4 w-4" aria-hidden="true" />
                {t('court')} {item.court_room_no}
              </span>
              <span className="flex items-center gap-1">
                <StatusIcon className="h-4 w-4" aria-hidden="true" />
                {getStatusText()}
              </span>
              {/* Judge Name Display */}
              {item.judge_names && (
                <span className="flex items-center gap-1 text-primary/80">
                  <User className="h-4 w-4" aria-hidden="true" />
                  {item.judge_names}
                </span>
              )}
              {/* Time Estimator */}
              {!isRunning && !isDone && !isPassover && liveBoard && (
                <CaseTimeEstimatorCompact docketItem={item} liveBoard={liveBoard} />
              )}
              {/* Hearing Likelihood - Non-promissory indicator */}
              {item.hearing_likelihood && item.hearing_likelihood !== 'UNKNOWN' && !isRunning && !isDone && (
                <HearingLikelihoodBadge 
                  likelihood={item.hearing_likelihood} 
                  reason={item.likelihood_reason || null}
                />
              )}
            </div>

            {/* Party Names - Petitioner v. Respondent */}
            {(item.petitioner || item.respondent) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm text-muted-foreground mt-1.5 truncate cursor-help">
                      <span className={cn(
                        "font-medium",
                        matchedAs === 'petitioner' ? "text-primary" : "text-foreground/80"
                      )}>
                        {formatPartyName(item.petitioner) || '—'}
                      </span>
                      <span className="mx-1.5 opacity-50">{t('vs')}</span>
                      <span className={cn(
                        matchedAs === 'respondent' ? "text-primary font-medium" : "text-foreground/70"
                      )}>
                        {formatPartyName(item.respondent) || '—'}
                      </span>
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm">
                    <div className="text-xs space-y-1">
                      <p><strong>Petitioner:</strong> {item.petitioner || 'Not available'}</p>
                      <p><strong>Respondent:</strong> {item.respondent || 'Not available'}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Show opposing counsel */}
            {!isPassover && (
              <div className="mt-1.5 text-sm">
                <span className="text-muted-foreground">{t('opposing')}: </span>
                <span className="text-foreground">
                  {matchedAs === 'petitioner' 
                    ? (item.respondent_lawyer || '—')
                    : matchedAs === 'respondent'
                    ? (item.petitioner_lawyer || '—')
                    : (item.respondent_lawyer || item.petitioner_lawyer || '—')}
                </span>
              </div>
            )}

            {/* Document Status Indicator */}
            {pendingDocCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="mt-2 inline-flex items-center gap-1">
                      <Badge variant="outline" className="text-xs flex items-center gap-1 border-court-warning/50 text-court-warning">
                        <FileText className="h-3 w-3" />
                        {pendingDocCount} {t('pending_review')}
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">
                      {userRole === 'SENIOR' || userRole === 'ADMIN' 
                        ? t('open_war_room_review')
                        : t('documents_awaiting_review')}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Upload Location Hint - Show for JUNIOR/CLERK */}
            {(userRole === 'JUNIOR' || userRole === 'CLERK') && !isPassover && !isDone && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                      <Upload className="h-3 w-3" />
                      <span>{t('upload_in_control_deck')}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">
                      {t('click_upload_control_deck')}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {/* Force Active Button - Only for SENIOR/ADMIN */}
            {canForceActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleForceActive}
                disabled={isForcing}
                className="text-xs border-primary/50 text-primary hover:bg-primary/10"
                aria-label="Force this case to active status"
              >
                <Play className="h-3 w-3 mr-1" />
                {isForcing ? t('activating') : t('force_active')}
              </Button>
            )}
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="shrink-0 min-h-touch min-w-touch" 
              aria-hidden="true" 
              tabIndex={-1}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// PHASE 2.2: Export memoized component to prevent unnecessary re-renders
export const DocketCard = memo(DocketCardInner, (prevProps, nextProps) => {
  // Only re-render if these props changed
  if (prevProps.item.id !== nextProps.item.id) return false;
  if (prevProps.item.status !== nextProps.item.status) return false;
  if (prevProps.item.force_active !== nextProps.item.force_active) return false;
  
  // Check if live board changes affect THIS card
  const prevCurrent = prevProps.liveBoard?.current_item;
  const nextCurrent = nextProps.liveBoard?.current_item;
  const prevStatus = prevProps.liveBoard?.status;
  const nextStatus = nextProps.liveBoard?.status;
  
  if (prevCurrent !== nextCurrent) {
    // Only re-render if distance-based status would change
    const prevDistance = prevProps.item.item_no - (prevCurrent ?? 0);
    const nextDistance = nextProps.item.item_no - (nextCurrent ?? 0);
    const threshold = prevProps.item.list_type === 'SUPPLEMENTARY' ? 10 : 5;
    
    // Re-render if crossing panic/running thresholds
    const prevIsPanic = prevDistance > 0 && prevDistance <= threshold;
    const nextIsPanic = nextDistance > 0 && nextDistance <= threshold;
    const prevIsRunning = prevDistance <= 0;
    const nextIsRunning = nextDistance <= 0;
    
    if (prevIsPanic !== nextIsPanic || prevIsRunning !== nextIsRunning) {
      return false; // Do re-render
    }
  }
  
  if (prevStatus !== nextStatus) return false;
  if (prevProps.userRole !== nextProps.userRole) return false;
  if (prevProps.showDate !== nextProps.showDate) return false;
  if (prevProps.pendingDocCount !== nextProps.pendingDocCount) return false;
  if (prevProps.cachedAt !== nextProps.cachedAt) return false;
  
  return true; // Skip re-render
});
