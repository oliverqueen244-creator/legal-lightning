import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, SkipForward, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { LiveBoardCache } from '@/types/database';

interface LiveBoardSimulatorProps {
  liveBoards: LiveBoardCache[];
}

export function LiveBoardSimulator({ liveBoards }: LiveBoardSimulatorProps) {
  const [selectedCourt, setSelectedCourt] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const incrementItem = async (amount: number = 1) => {
    if (!selectedCourt) {
      toast.error('Please select a court');
      return;
    }

    const [court_location, court_no] = selectedCourt.split('-');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('simulate-live-board', {
        body: {
          action: 'increment',
          court_location,
          court_no,
          increment: amount,
        },
      });

      if (error) throw error;

      toast.success(`Court ${court_no} now at Item #${data.current_item}`);
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSupplementary = async () => {
    if (!selectedCourt) {
      toast.error('Please select a court');
      return;
    }

    const [court_location, court_no] = selectedCourt.split('-');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('simulate-live-board', {
        body: {
          action: 'toggle_supplementary',
          court_location,
          court_no,
        },
      });

      if (error) throw error;

      toast.success(
        data.is_supplementary_running 
          ? 'Supplementary list started' 
          : 'Daily list resumed'
      );
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-dashed border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Play className="h-4 w-4" />
          Live Board Simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={selectedCourt} onValueChange={setSelectedCourt}>
          <SelectTrigger>
            <SelectValue placeholder="Select Court" />
          </SelectTrigger>
          <SelectContent>
            {liveBoards.map((board) => (
              <SelectItem
                key={`${board.court_location}-${board.court_no}`}
                value={`${board.court_location}-${board.court_no}`}
              >
                {board.court_location} - Court {board.court_no} (Item #{board.current_item})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            variant="court"
            size="sm"
            onClick={() => incrementItem(1)}
            disabled={loading || !selectedCourt}
            className="flex-1"
          >
            <SkipForward className="h-4 w-4 mr-1" />
            +1
          </Button>
          <Button
            variant="court"
            size="sm"
            onClick={() => incrementItem(5)}
            disabled={loading || !selectedCourt}
            className="flex-1"
          >
            <SkipForward className="h-4 w-4 mr-1" />
            +5
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleSupplementary}
          disabled={loading || !selectedCourt}
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Toggle Supplementary
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Use this to test panic alerts
        </p>
      </CardContent>
    </Card>
  );
}
