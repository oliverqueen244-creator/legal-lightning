import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ScraperStatusWidgetProps {
  bench?: string;
  selectedDate?: string;
  onRefreshComplete?: () => void;
}

/**
 * User-facing status widget - ABSTRACTED
 * Shows only outcomes, never internal mechanics
 * 
 * ✅ Allowed: "Cases up to date", "Updating", "Delayed"
 * ❌ Forbidden: Job counts, error messages, provider names, retries
 */
export function ScraperStatusWidget({ bench }: ScraperStatusWidgetProps) {
  // Fetch status in abstracted form - no internal details exposed
  const { data: status } = useQuery({
    queryKey: ['sync-status-abstracted', bench],
    queryFn: async () => {
      // Get latest scraper log without exposing internals
      let query = supabase
        .from('scraper_logs')
        .select('status, run_at')
        .order('run_at', { ascending: false })
        .limit(1);

      if (bench) {
        const benches = bench.split(',').map(b => b.trim().toUpperCase());
        if (benches.length === 1) {
          query = query.eq('bench', benches[0]);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const log = data?.[0];
      if (!log) return { state: 'waiting', lastUpdate: null };
      
      // Abstract the status - never expose raw status or counts
      const isRecent = log.run_at && 
        (Date.now() - new Date(log.run_at).getTime()) < 30 * 60 * 1000; // Within 30 mins
      
      if (log.status === 'success') {
        return { state: 'ready', lastUpdate: log.run_at };
      } else if (log.status === 'partial' || log.status === 'warning') {
        return { state: 'partial', lastUpdate: log.run_at };
      } else if (log.status === 'failed' || log.status === 'error') {
        return { state: 'delayed', lastUpdate: log.run_at };
      }
      
      return { state: 'waiting', lastUpdate: log.run_at };
    },
    refetchInterval: 60000,
  });

  // Abstracted display - outcome language only
  const getDisplay = () => {
    switch (status?.state) {
      case 'ready':
        return {
          icon: CheckCircle2,
          iconClass: 'text-court-success',
          badge: <Badge className="bg-court-success/20 text-court-success border-court-success/30 text-xs">Ready</Badge>,
          text: 'Cases up to date'
        };
      case 'partial':
        return {
          icon: AlertTriangle,
          iconClass: 'text-court-warning',
          badge: <Badge className="bg-court-warning/20 text-court-warning border-court-warning/30 text-xs">Updating</Badge>,
          text: 'Some data still updating'
        };
      case 'delayed':
        return {
          icon: Clock,
          iconClass: 'text-muted-foreground',
          badge: <Badge variant="secondary" className="text-xs">Delayed</Badge>,
          text: 'Data may be delayed'
        };
      default:
        return {
          icon: Loader2,
          iconClass: 'text-muted-foreground animate-spin',
          badge: <Badge variant="secondary" className="text-xs">Waiting</Badge>,
          text: 'Waiting for data'
        };
    }
  };

  const display = getDisplay();
  const Icon = display.icon;
  
  // Abstracted time display - no raw timestamps
  const timeText = status?.lastUpdate 
    ? formatDistanceToNow(new Date(status.lastUpdate), { addSuffix: true })
    : 'Not yet synced';

  return (
    <Card className="glass-card border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={`h-4 w-4 ${display.iconClass}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                {display.badge}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {display.text} • {timeText}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
