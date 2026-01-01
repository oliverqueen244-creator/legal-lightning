import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Scale, Clock, AlertTriangle, ChevronRight, SkipForward, Coffee, Ban, Zap, Play, Calendar, FileText, Upload } from 'lucide-react';
import type { DocketItem, LiveBoardCache, BoardStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CaseTimeEstimatorCompact } from './CaseTimeEstimator';

interface DocketCardProps {
  item: DocketItem & { status?: string; force_active?: boolean };
  liveBoard?: LiveBoardCache;
  userRole?: AppRole | null;
  onForceActive?: (itemId: string) => void;
  showDate?: boolean;
  pendingDocCount?: number;
}

export function DocketCard({ item, liveBoard, userRole, onForceActive, showDate, pendingDocCount = 0 }: DocketCardProps) {
  const navigate = useNavigate();
  const [isForcing, setIsForcing] = useState(false);
  
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

  const getStatusText = () => {
    if (item.force_active) return 'FORCED ACTIVE';
    if (isDone) return 'COMPLETED';
    if (isPassover) return 'SKIPPED';
    if (isLunch) return 'LUNCH BREAK';
    if (isAdjourned) return 'ADJOURNED';
    if (isRunning) return 'RUNNING NOW';
    if (isPanic) return `${distance} ITEMS AWAY`;
    return `Item #${item.item_no}`;
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
      
      toast.success('Case marked as active', {
        description: 'Status override applied. The case is now in "Running" mode.',
      });
      
      onForceActive?.(item.id);
    } catch (err) {
      console.error('Failed to force active:', err);
      toast.error('Failed to update status');
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
              {showDate && item.date && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(item.date), 'EEE, MMM d')}
                </Badge>
              )}
              {isSupplementary && (
                <Badge variant="supplementary">SUPPLEMENTARY</Badge>
              )}
              {item.force_active && (
                <Badge className="flex items-center gap-1 bg-primary/20 text-primary border-primary/30">
                  <Zap className="h-3 w-3" aria-hidden="true" />
                  FORCED
                </Badge>
              )}
              {isPassover && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-muted text-muted-foreground">
                  <SkipForward className="h-3 w-3" aria-hidden="true" />
                  SKIPPED
                </Badge>
              )}
              {isLunch && (
                <Badge className="flex items-center gap-1 bg-court-warning/20 text-court-warning border-court-warning/30">
                  <Coffee className="h-3 w-3" aria-hidden="true" />
                  LUNCH BREAK
                </Badge>
              )}
              {isAdjourned && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-muted text-muted-foreground">
                  <Ban className="h-3 w-3" aria-hidden="true" />
                  ADJOURNED
                </Badge>
              )}
              {isDone && (
                <Badge className="flex items-center gap-1 bg-court-success/20 text-court-success border-court-success/30">
                  COMPLETED
                </Badge>
              )}
              {isPanic && !item.force_active && (
                <Badge variant="danger" className="flex items-center gap-1" role="status" aria-live="polite">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  {isSupplementary ? 'URGENT (SUPP)' : 'URGENT'}
                </Badge>
              )}
              {isRunning && !item.force_active && (
                <Badge variant="running" role="status" aria-live="assertive">RUNNING NOW</Badge>
              )}
            </div>
            
            <h3 className={cn(
              'font-display text-lg font-semibold text-foreground truncate mb-1 tracking-wide',
              (isPassover || isDone) && 'line-through opacity-60'
            )}>
              {item.case_number}
            </h3>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Scale className="h-4 w-4" aria-hidden="true" />
                Court {item.court_room_no}
              </span>
              <span className="flex items-center gap-1">
                <StatusIcon className="h-4 w-4" aria-hidden="true" />
                {getStatusText()}
              </span>
              {/* Time Estimator */}
              {!isRunning && !isDone && !isPassover && liveBoard && (
                <CaseTimeEstimatorCompact docketItem={item} liveBoard={liveBoard} />
              )}
            </div>
            
            {/* Show opposing party - abstracted language */}
            {item.respondent_lawyer && !isPassover && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">Opposing: </span>
                <span className="text-foreground">{item.respondent_lawyer}</span>
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
                        {pendingDocCount} pending review
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">
                      {userRole === 'SENIOR' || userRole === 'ADMIN' 
                        ? 'Open War Room → Documents tab to review and approve'
                        : 'Documents uploaded, awaiting senior review'}
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
                      <span>Upload in Control Deck</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">
                      Click to open Control Deck where you can upload case documents
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
                {isForcing ? 'Activating...' : 'Force Active'}
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
