import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Scale, Clock, AlertTriangle, ChevronRight, SkipForward, Coffee, Ban } from 'lucide-react';
import type { DocketItem, LiveBoardCache, BoardStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/hooks/useAuth';

interface DocketCardProps {
  item: DocketItem;
  liveBoard?: LiveBoardCache;
  userRole?: AppRole | null;
}

export function DocketCard({ item, liveBoard, userRole }: DocketCardProps) {
  const navigate = useNavigate();
  
  const currentItem = liveBoard?.current_item ?? 0;
  const status: BoardStatus = liveBoard?.status ?? 'hearing';
  const distance = item.item_no - currentItem;
  const isPanic = distance > 0 && distance <= 5 && status === 'hearing';
  const isRunning = distance <= 0 && status === 'hearing';
  const isPassover = status === 'passover';
  const isLunch = status === 'lunch';
  const isAdjourned = status === 'adjourned';
  const isSupplementary = item.list_type === 'SUPPLEMENTARY';

  const getStatusText = () => {
    if (isPassover) return 'SKIPPED';
    if (isLunch) return 'LUNCH BREAK';
    if (isAdjourned) return 'ADJOURNED';
    if (isRunning) return 'RUNNING NOW';
    if (isPanic) return `${distance} ITEMS AWAY`;
    return `Item #${item.item_no}`;
  };

  const getStatusIcon = () => {
    if (isPassover) return SkipForward;
    if (isLunch) return Coffee;
    if (isAdjourned) return Ban;
    return Clock;
  };

  const StatusIcon = getStatusIcon();

  const handleClick = () => {
    // Senior goes to War Room, Junior/Clerk goes to Control Deck
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

  return (
    <Card
      className={cn(
        'court-card cursor-pointer border-2 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
        isPanic && 'panic-pulse border-court-danger-light',
        isRunning && 'border-primary gold-glow',
        isPassover && 'card-passover border-muted',
        isLunch && 'border-court-warning/50 bg-court-warning/5',
        isAdjourned && 'border-muted/50 bg-muted/10 opacity-60',
        isSupplementary && !isPanic && !isRunning && !isPassover && !isLunch && !isAdjourned && 'border-court-warning/50',
        !isPanic && !isRunning && !isSupplementary && !isPassover && !isLunch && !isAdjourned && 'border-border hover:border-primary/50'
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
              {isSupplementary && (
                <Badge variant="supplementary">SUPPLEMENTARY</Badge>
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
              {isPanic && (
                <Badge variant="danger" className="flex items-center gap-1" role="status" aria-live="polite">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  URGENT
                </Badge>
              )}
              {isRunning && (
                <Badge variant="running" role="status" aria-live="assertive">RUNNING NOW</Badge>
              )}
            </div>
            
            <h3 className={cn(
              'font-display text-lg font-semibold text-foreground truncate mb-1 tracking-wide',
              isPassover && 'line-through opacity-60'
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
            </div>
            
            {item.respondent_lawyer && !isPassover && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">vs </span>
                <span className="text-foreground">{item.respondent_lawyer}</span>
              </div>
            )}
          </div>
          
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
      </CardContent>
    </Card>
  );
}