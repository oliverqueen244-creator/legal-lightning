import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio, Activity } from 'lucide-react';
import type { LiveBoardCache } from '@/types/database';

interface LiveTickerProps {
  liveBoards: LiveBoardCache[];
}

export function LiveTicker({ liveBoards }: LiveTickerProps) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <Activity className="h-5 w-5 text-court-success animate-pulse" />
          Live Court Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {liveBoards.length === 0 ? (
          <p className="text-muted-foreground text-sm">No live data available</p>
        ) : (
          liveBoards.map((board) => (
            <div
              key={`${board.court_location}-${board.court_no}`}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Radio className="h-4 w-4 text-court-success" />
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-court-success rounded-full animate-ping" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {board.court_location} - Court {board.court_no}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(board.last_updated).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <Badge variant={board.is_supplementary_running ? 'supplementary' : 'gold'}>
                  Item #{board.current_item}
                </Badge>
                {board.is_supplementary_running && (
                  <p className="text-xs text-orange-400 mt-1">Supplementary</p>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
