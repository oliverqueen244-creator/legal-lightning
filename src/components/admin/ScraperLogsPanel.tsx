import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import type { ScraperLog } from '@/types/database';

export function ScraperLogsPanel() {
  const [benchFilter, setBenchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['scraper-logs', benchFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('scraper_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(100);

      if (benchFilter !== 'all') {
        query = query.eq('bench', benchFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ScraperLog[];
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-court-success" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-court-warning" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-court-warning" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-court-danger-light" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-court-success/20 text-court-success border-court-success/30">Success</Badge>;
      case 'warning':
        return <Badge className="bg-court-warning/20 text-court-warning border-court-warning/30">Warning</Badge>;
      case 'partial':
        return <Badge className="bg-court-warning/20 text-court-warning border-court-warning/30">Partial</Badge>;
      case 'failed':
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const successCount = logs?.filter(l => l.status === 'success').length || 0;
  const warningCount = logs?.filter(l => l.status === 'warning').length || 0;
  const failedCount = logs?.filter(l => l.status === 'failed').length || 0;

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Scraper Logs
              </CardTitle>
              <CardDescription>
                Monitor cause list scraper runs and errors
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-court-success/10 border border-court-success/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-court-success" />
                <span className="text-2xl font-bold text-court-success">{successCount}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Successful Scrapes</p>
            </div>
            <div className="p-4 rounded-lg bg-court-warning/10 border border-court-warning/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-court-warning" />
                <span className="text-2xl font-bold text-court-warning">{warningCount}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Warnings</p>
            </div>
            <div className="p-4 rounded-lg bg-court-danger/10 border border-court-danger-light/30">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-court-danger-light" />
                <span className="text-2xl font-bold text-court-danger-light">{failedCount}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Failed Scrapes</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <Select value={benchFilter} onValueChange={setBenchFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Benches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Benches</SelectItem>
                <SelectItem value="JAIPUR">Jaipur</SelectItem>
                <SelectItem value="JODHPUR">Jodhpur</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Logs Table */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading logs...
              </div>
            ) : logs?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No scraper logs found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs?.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border ${
                      log.status === 'failed' ? 'border-court-danger-light/30 bg-court-danger/5' :
                      log.status === 'warning' ? 'border-court-warning/30 bg-court-warning/5' :
                      'border-border bg-card/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(log.status)}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusBadge(log.status)}
                            <Badge variant="outline">{log.bench}</Badge>
                            {log.court_no && (
                              <Badge variant="secondary">Court {log.court_no}</Badge>
                            )}
                            <Badge variant="secondary">{log.list_type}</Badge>
                          </div>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Cases found: </span>
                            <span className="font-medium">{log.cases_found}</span>
                          </p>
                          {log.error_message && (
                            <p className="text-xs text-court-danger-light mt-1 font-mono bg-court-danger/10 p-2 rounded">
                              {log.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.run_at).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
