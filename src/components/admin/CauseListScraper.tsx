import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Play, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Calendar,
  Database,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ScraperLog {
  id: string;
  bench: string;
  run_at: string;
  status: 'success' | 'partial' | 'failed' | 'warning';
  cases_found: number;
  error_message: string | null;
  list_type: string;
  court_no: string | null;
}

interface ScrapeResult {
  success: boolean;
  bench: string;
  date: string;
  courts_found: number;
  cases_found: number;
  status: string;
  errors?: string[];
  duration_ms: number;
}

export function CauseListScraper() {
  const [selectedBench, setSelectedBench] = useState<'JAIPUR' | 'JODHPUR'>('JODHPUR');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const queryClient = useQueryClient();

  // Fetch recent scraper logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['scraper-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraper_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as ScraperLog[];
    },
    refetchInterval: 30000,
  });

  // Scrape mutation
  const scrapeMutation = useMutation({
    mutationFn: async ({ bench, date }: { bench: 'JAIPUR' | 'JODHPUR'; date: string }) => {
      const { data, error } = await supabase.functions.invoke('scrape-causelist', {
        body: { bench, date }
      });
      
      if (error) throw error;
      return data as ScrapeResult;
    },
    onSuccess: (data) => {
      if (data.status === 'success') {
        toast.success(`Scrape complete: ${data.cases_found} cases from ${data.courts_found} courts`);
      } else if (data.status === 'partial') {
        toast.warning(`Partial success: ${data.cases_found} cases (some errors occurred)`);
      } else {
        toast.error('Scrape failed - check logs for details');
      }
      
      queryClient.invalidateQueries({ queryKey: ['scraper-logs'] });
      queryClient.invalidateQueries({ queryKey: ['court-metadata'] });
      queryClient.invalidateQueries({ queryKey: ['docket'] });
    },
    onError: (error) => {
      toast.error(`Scrape failed: ${error.message}`);
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-rose-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      failed: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    };
    
    return (
      <Badge className={colors[status] || ''}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Scraper Control Panel */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Cause List Scraper
          </CardTitle>
          <CardDescription>
            Fetch cause lists from Rajasthan High Court Quick Download portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Bench</label>
              <Select 
                value={selectedBench} 
                onValueChange={(v) => setSelectedBench(v as 'JAIPUR' | 'JODHPUR')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JODHPUR">Jodhpur</SelectItem>
                  <SelectItem value="JAIPUR">Jaipur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Date</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
            
            <Button
              onClick={() => scrapeMutation.mutate({ bench: selectedBench, date: selectedDate })}
              disabled={scrapeMutation.isPending}
              className="gap-2"
            >
              {scrapeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Scraper
                </>
              )}
            </Button>
          </div>
          
          {/* Target URLs Info */}
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
            <p className="font-medium mb-1">Target URLs:</p>
            <ul className="space-y-1">
              <li>
                <span className="text-amber-400">Jodhpur:</span>{' '}
                <code className="bg-background/50 px-1 rounded">https://hcraj.nic.in/quick-causelist-jdp/</code>
              </li>
              <li>
                <span className="text-amber-400">Jaipur:</span>{' '}
                <code className="bg-background/50 px-1 rounded">https://hcraj.nic.in/quick-causelist-jp/</code>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Recent Scraper Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading logs...
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div 
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{log.bench}</span>
                        <Badge variant="outline" className="text-xs">
                          {log.list_type}
                        </Badge>
                        {log.court_no && (
                          <Badge variant="outline" className="text-xs">
                            Court {log.court_no}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.run_at), { addSuffix: true })}
                        {log.error_message && (
                          <span className="text-rose-400 ml-2">• {log.error_message.substring(0, 50)}...</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{log.cases_found} cases</span>
                    {getStatusBadge(log.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No scraper runs yet</p>
              <p className="text-xs">Run the scraper to fetch cause list data</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}