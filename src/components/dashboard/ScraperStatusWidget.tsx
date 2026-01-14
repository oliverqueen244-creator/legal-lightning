import { useQuery } from '@tanstack/react-query';
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
 * Shows status based on causelist data for the selected date
 */
export function ScraperStatusWidget({ bench, selectedDate }: ScraperStatusWidgetProps) {
  const { data: status } = useQuery({
    queryKey: ['sync-status-abstracted', bench, selectedDate],
    queryFn: async () => {
      // Use selected date or today
      const targetDate = selectedDate || new Date().toISOString().split('T')[0];
      
      // Check causelist status for the selected date
      let causelistQuery = supabase
        .from('raw_causelists')
        .select('status, created_at, list_date')
        .eq('list_date', targetDate);

      if (bench) {
        const benches = bench.split(',').map(b => b.trim().toUpperCase());
        if (benches.length === 1) {
          causelistQuery = causelistQuery.eq('bench', benches[0]);
        } else {
          causelistQuery = causelistQuery.in('bench', benches);
        }
      }

      const { data: causelists, error } = await causelistQuery;
      if (error) throw error;
      
      // No causelist for this date
      if (!causelists || causelists.length === 0) {
        return { state: 'waiting', lastUpdate: null, hasData: false };
      }
      
      // Check causelist statuses
      const allComplete = causelists.every(cl => 
        cl.status === 'parsed' || cl.status === 'parsed_complete' || cl.status === 'done'
      );
      const anyProcessing = causelists.some(cl => 
        cl.status === 'processing' || cl.status === 'extracting' || cl.status === 'pending'
      );
      
      const latestUpdate = causelists.reduce((latest, cl) => {
        const clTime = new Date(cl.created_at).getTime();
        return clTime > latest ? clTime : latest;
      }, 0);
      
      if (allComplete) {
        return { state: 'ready', lastUpdate: new Date(latestUpdate).toISOString(), hasData: true };
      } else if (anyProcessing) {
        return { state: 'partial', lastUpdate: new Date(latestUpdate).toISOString(), hasData: true };
      }
      
      return { state: 'waiting', lastUpdate: new Date(latestUpdate).toISOString(), hasData: true };
    },
    refetchInterval: 30000,
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
          icon: Loader2,
          iconClass: 'text-primary animate-spin',
          badge: <Badge className="bg-primary/20 text-primary border-primary/30 text-xs animate-pulse">Processing</Badge>,
          text: 'Cases being processed'
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
          icon: Clock,
          iconClass: 'text-muted-foreground',
          badge: <Badge variant="secondary" className="text-xs">No Data</Badge>,
          text: 'No causelist for this date'
        };
    }
  };

  const display = getDisplay();
  const Icon = display.icon;
  
  // Abstracted time display
  const timeText = status?.lastUpdate 
    ? formatDistanceToNow(new Date(status.lastUpdate), { addSuffix: true })
    : '';

  // DECLUTTER: Removed card wrapper, simpler inline display
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className={`h-3.5 w-3.5 ${display.iconClass}`} />
      {display.badge}
      {timeText && (
        <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
          {timeText}
        </span>
      )}
    </div>
  );
}
