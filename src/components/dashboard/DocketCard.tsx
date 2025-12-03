import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Scale, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import type { DocketItem, LiveBoardCache } from '@/types/database';
import { cn } from '@/lib/utils';

interface DocketCardProps {
  item: DocketItem;
  liveBoard?: LiveBoardCache;
  userRole?: string | null;
}

export function DocketCard({ item, liveBoard, userRole }: DocketCardProps) {
  const navigate = useNavigate();
  
  const currentItem = liveBoard?.current_item ?? 0;
  const distance = item.item_no - currentItem;
  const isPanic = distance > 0 && distance <= 5;
  const isRunning = distance <= 0;
  const isSupplementary = item.list_type === 'SUPPLEMENTARY';

  const getStatusText = () => {
    if (isRunning) return 'RUNNING NOW';
    if (isPanic) return `${distance} ITEMS AWAY`;
    return `Item #${item.item_no}`;
  };

  const handleClick = () => {
    // Senior goes to War Room, Junior goes to Control Deck
    if (userRole === 'SENIOR') {
      navigate(`/war-room/${item.id}`);
    } else {
      navigate(`/control-deck/${item.id}`);
    }
  };

  return (
    <Card
      className={cn(
        'court-card cursor-pointer border-2 transition-all duration-300',
        isPanic && 'panic-pulse border-court-danger-light bg-court-danger',
        isRunning && 'border-court-danger-light bg-court-danger gold-glow',
        isSupplementary && !isPanic && !isRunning && 'border-orange-500/50',
        !isPanic && !isRunning && !isSupplementary && 'border-border hover:border-primary/50'
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {isSupplementary && (
                <Badge variant="supplementary">SUPPLEMENTARY</Badge>
              )}
              {isPanic && (
                <Badge variant="danger" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  URGENT
                </Badge>
              )}
              {isRunning && (
                <Badge variant="running">RUNNING NOW</Badge>
              )}
            </div>
            
            <h3 className="font-display text-lg font-semibold text-foreground truncate mb-1">
              {item.case_number}
            </h3>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Scale className="h-4 w-4" />
                Court {item.court_room_no}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {getStatusText()}
              </span>
            </div>
            
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">vs </span>
              <span className="text-foreground">{item.respondent_lawyer}</span>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" className="shrink-0">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
