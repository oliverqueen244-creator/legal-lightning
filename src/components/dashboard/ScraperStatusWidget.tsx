import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Bot, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ScraperStatusWidgetProps {
  bench?: string;
  selectedDate?: string;
  onRefreshComplete?: () => void;
}

export function ScraperStatusWidget({ bench, selectedDate }: ScraperStatusWidgetProps) {
  // Fetch latest scraper log for user's bench
  const { data: lastLog } = useQuery({
    queryKey: ['scraper-status', bench],
    queryFn: async () => {
      let query = supabase
        .from('scraper_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(1);

      if (bench) {
        // Handle both single bench and comma-separated benches
        const benches = bench.split(',').map(b => b.trim().toUpperCase());
        if (benches.length === 1) {
          query = query.eq('bench', benches[0]);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.[0] || null;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-court-success" />;
      case 'warning':
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-court-warning" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-court-danger-light" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-court-success/20 text-court-success border-court-success/30 text-xs">Synced</Badge>;
      case 'warning':
        return <Badge className="bg-court-warning/20 text-court-warning border-court-warning/30 text-xs">Warning</Badge>;
      case 'partial':
        return <Badge className="bg-court-warning/20 text-court-warning border-court-warning/30 text-xs">Partial</Badge>;
      case 'failed':
      case 'error':
        return <Badge variant="danger" className="text-xs">Failed</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Waiting</Badge>;
    }
  };

  const lastSyncTime = lastLog?.run_at 
    ? formatDistanceToNow(new Date(lastLog.run_at), { addSuffix: true })
    : 'No data yet';

  return (
    <Card className="glass-card border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {lastLog ? getStatusIcon(lastLog.status) : <Bot className="h-4 w-4 text-muted-foreground" />}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Telegram:</span>
                {getStatusBadge(lastLog?.status)}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {lastSyncTime}
                {lastLog?.cases_found ? ` • ${lastLog.cases_found} cases` : ''}
              </p>
            </div>
          </div>
          <Bot className="h-4 w-4 text-primary shrink-0" />
        </div>
        {lastLog?.error_message && lastLog.status !== 'success' && (
          <p className="text-xs text-court-warning mt-2 truncate" title={lastLog.error_message}>
            {lastLog.error_message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
