import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Loader2, Clock } from 'lucide-react';

interface CaselistStatusWidgetProps {
  bench?: string;
}

/**
 * User-facing abstracted status widget
 * Shows outcome-only information - no internal mechanics exposed
 */
export function CaselistStatusWidget({ bench }: CaselistStatusWidgetProps) {
  // Fetch today's causelist processing status (abstracted)
  const { data: status } = useQuery({
    queryKey: ['causelist-status', bench],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('raw_causelists')
        .select('status')
        .eq('list_date', today);

      if (bench) {
        const benches = bench.split(',').map(b => b.trim().toUpperCase());
        if (benches.length === 1) {
          query = query.eq('bench', benches[0]);
        } else {
          query = query.in('bench', benches);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return 'waiting';
      }
      
      const allDone = data.every(cl => cl.status === 'parsed' || cl.status === 'done');
      const anyProcessing = data.some(cl => cl.status === 'processing' || cl.status === 'extracting');
      
      if (allDone) return 'ready';
      if (anyProcessing) return 'updating';
      return 'waiting';
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusDisplay = () => {
    switch (status) {
      case 'ready':
        return {
          icon: CheckCircle2,
          text: 'Cases up to date',
          badge: <Badge className="bg-court-success/20 text-court-success border-court-success/30 text-xs">Ready</Badge>,
          description: "Today's cases are available"
        };
      case 'updating':
        return {
          icon: Loader2,
          text: 'Updating cases',
          badge: <Badge className="bg-primary/20 text-primary border-primary/30 text-xs animate-pulse">Updating</Badge>,
          description: 'Your cases are being refreshed'
        };
      default:
        return {
          icon: Clock,
          text: 'Waiting for data',
          badge: <Badge variant="secondary" className="text-xs">Waiting</Badge>,
          description: 'Causelist not yet available'
        };
    }
  };

  const { icon: Icon, text, badge, description } = getStatusDisplay();

  return (
    <Card className="glass-card border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={`h-4 w-4 ${status === 'updating' ? 'animate-spin text-primary' : status === 'ready' ? 'text-court-success' : 'text-muted-foreground'}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                {badge}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {description}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
