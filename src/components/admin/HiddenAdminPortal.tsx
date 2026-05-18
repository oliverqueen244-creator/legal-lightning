import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Lock, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2,
  Zap,
  Database,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface QueueItem {
  id: string;
  matched_alias: string;
  batch_start: number | null;
  status: string | null;
  cases_parsed: number | null;
  error_message: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  provider_used: string | null;
  retry_count: number | null;
}

interface RawCauselist {
  id: string;
  bench: string;
  list_date: string;
  status: string | null;
  page_count: number | null;
  file_name: string | null;
}

interface HiddenAdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HiddenAdminPortal({ isOpen, onClose }: HiddenAdminPortalProps) {
  const { isAdmin } = useAuth();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [causelists, setCauselists] = useState<RawCauselist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Server-side admin verification - no client-side passwords
  const isAuthenticated = isAdmin;

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [queueResult, causelistResult] = await Promise.all([
        supabase
          .from('case_parse_queue')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('raw_causelists')
          .select('id, bench, list_date, status, page_count, file_name')
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      if (queueResult.data) setQueueItems(queueResult.data);
      if (causelistResult.data) setCauselists(causelistResult.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Set up realtime subscriptions
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchData();

    // Subscribe to queue changes
    const queueChannel = supabase
      .channel('admin-queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'case_parse_queue'
        },
        (payload) => {
          if (import.meta.env.DEV) console.log('Queue change:', payload);
          if (payload.eventType === 'INSERT') {
            setQueueItems(prev => [payload.new as QueueItem, ...prev.slice(0, 49)]);
          } else if (payload.eventType === 'UPDATE') {
            setQueueItems(prev => 
              prev.map(item => item.id === payload.new.id ? payload.new as QueueItem : item)
            );
          } else if (payload.eventType === 'DELETE') {
            setQueueItems(prev => prev.filter(item => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Subscribe to causelist changes
    const causelistChannel = supabase
      .channel('admin-causelist-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'raw_causelists'
        },
        (payload) => {
          if (import.meta.env.DEV) console.log('Causelist change:', payload);
          if (payload.eventType === 'INSERT') {
            setCauselists(prev => [payload.new as RawCauselist, ...prev.slice(0, 19)]);
          } else if (payload.eventType === 'UPDATE') {
            setCauselists(prev => 
              prev.map(item => item.id === payload.new.id ? payload.new as RawCauselist : item)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(causelistChannel);
    };
  }, [isAuthenticated]);

  // No client-side password authentication - uses server-side isAdmin check

  const triggerParseCase = async () => {
    try {
      const { error } = await supabase.functions.invoke('parse-case', {
        body: {}
      });
      if (error) throw error;
      toast.success('Parse triggered successfully');
    } catch (error) {
      console.error('Error triggering parse:', error);
      toast.error('Failed to trigger parse');
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'done':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Done</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  // Calculate stats
  const processingCount = queueItems.filter(i => i.status === 'processing').length;
  const pendingCount = queueItems.filter(i => i.status === 'pending').length;
  const doneCount = queueItems.filter(i => i.status === 'done').length;
  const failedCount = queueItems.filter(i => i.status === 'failed').length;
  const totalCasesParsed = queueItems.reduce((acc, item) => acc + (item.cases_parsed || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-background/95 border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Admin Portal</CardTitle>
              <p className="text-xs text-muted-foreground">Real-time Parse Queue Monitor</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-4">
          {!isAuthenticated ? (
            <div className="space-y-4 max-w-xs mx-auto py-8">
              <div className="text-center mb-6">
                <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-3" />
                <h3 className="font-semibold">Access Denied</h3>
                <p className="text-sm text-muted-foreground">
                  Admin privileges required. Your access level does not permit viewing this console.
                </p>
              </div>
              <Button onClick={onClose} className="w-full" variant="outline">
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                    <span className="text-xs text-blue-400">Processing</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-400 mt-1">{processingCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs text-yellow-400">Pending</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400 mt-1">{pendingCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span className="text-xs text-green-400">Done</span>
                  </div>
                  <p className="text-2xl font-bold text-green-400 mt-1">{doneCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <span className="text-xs text-red-400">Failed</span>
                  </div>
                  <p className="text-2xl font-bold text-red-400 mt-1">{failedCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    <span className="text-xs text-primary">Cases Parsed</span>
                  </div>
                  <p className="text-2xl font-bold text-primary mt-1">{totalCasesParsed}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchData}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button 
                  variant="gold" 
                  size="sm" 
                  onClick={triggerParseCase}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Trigger Parse
                </Button>
              </div>

              {/* Queue Items */}
              <div className="border rounded-lg border-border">
                <div className="p-3 border-b border-border bg-muted/30">
                  <h4 className="font-medium text-sm">Parse Queue (Real-time)</h4>
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="divide-y divide-border">
                    {queueItems.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        No queue items found
                      </div>
                    ) : (
                      queueItems.map((item) => (
                        <div key={item.id} className="p-3 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">
                                  {item.matched_alias}
                                </span>
                                {getStatusBadge(item.status)}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>Batch: {item.batch_start || 0}</span>
                                <span>Parsed: {item.cases_parsed || 0} cases</span>
                                {item.provider_used && <span>Provider: {item.provider_used}</span>}
                                {item.retry_count && item.retry_count > 0 && (
                                  <span className="text-yellow-400">Retries: {item.retry_count}</span>
                                )}
                              </div>
                              {item.error_message && (
                                <p className="text-xs text-red-400 mt-1 truncate">
                                  Error: {item.error_message}
                                </p>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {item.created_at && new Date(item.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                          {item.status === 'processing' && (
                            <Progress value={undefined} className="h-1 mt-2" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Causelists Status */}
              <div className="border rounded-lg border-border">
                <div className="p-3 border-b border-border bg-muted/30">
                  <h4 className="font-medium text-sm">Recent Causelists</h4>
                </div>
                <ScrollArea className="h-[150px]">
                  <div className="divide-y divide-border">
                    {causelists.map((cl) => (
                      <div key={cl.id} className="p-3 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-sm">{cl.bench}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {cl.list_date} • {cl.page_count || '?'} pages
                          </span>
                        </div>
                        {getStatusBadge(cl.status)}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
