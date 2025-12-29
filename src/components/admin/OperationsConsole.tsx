import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  X, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2,
  Zap,
  Database,
  Activity,
  HardDrive,
  CreditCard,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

interface OperationsConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SystemHealth {
  aiJobsPending: number;
  aiJobsStuck: number;
  parseQueuePending: number;
  recentFailures: number;
  lastSyncTime: string | null;
}

interface AIJobSummary {
  id: string;
  job_type: string;
  status: string;
  created_at: string;
  started_at: string | null;
  error_message: string | null;
  retries: number;
}

/**
 * Operations Console - Hidden 7-click admin interface
 * Contains ALL operational internals - never expose to regular users
 */
export function OperationsConsole({ isOpen, onClose }: OperationsConsoleProps) {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('health');

  // System Health Query
  const { data: health, refetch: refetchHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['ops-health'],
    queryFn: async (): Promise<SystemHealth> => {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [aiJobs, parseQueue, syncStatus] = await Promise.all([
        supabase
          .from('ai_jobs')
          .select('status, started_at')
          .in('status', ['pending', 'processing']),
        supabase
          .from('case_parse_queue')
          .select('status')
          .eq('status', 'pending'),
        supabase
          .from('sync_status')
          .select('last_sync_at')
          .order('last_sync_at', { ascending: false })
          .limit(1)
      ]);

      const stuckJobs = aiJobs.data?.filter(job => 
        job.status === 'processing' && 
        job.started_at && 
        new Date(job.started_at) < new Date(thirtyMinsAgo)
      ).length || 0;

      const recentFailures = await supabase
        .from('ai_jobs')
        .select('id')
        .eq('status', 'failed')
        .gte('created_at', oneDayAgo);

      return {
        aiJobsPending: aiJobs.data?.filter(j => j.status === 'pending').length || 0,
        aiJobsStuck: stuckJobs,
        parseQueuePending: parseQueue.data?.length || 0,
        recentFailures: recentFailures.data?.length || 0,
        lastSyncTime: syncStatus.data?.[0]?.last_sync_at || null
      };
    },
    enabled: isOpen && isAdmin,
    refetchInterval: 30000
  });

  // AI Jobs Query
  const { data: aiJobs, refetch: refetchAIJobs } = useQuery({
    queryKey: ['ops-ai-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_jobs')
        .select('id, job_type, status, created_at, started_at, error_message, retries')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as AIJobSummary[];
    },
    enabled: isOpen && isAdmin && activeTab === 'parsing'
  });

  // Storage Stats Query
  const { data: storageStats } = useQuery({
    queryKey: ['ops-storage'],
    queryFn: async () => {
      const [causelists, docket, parseQueue] = await Promise.all([
        supabase.from('raw_causelists').select('id', { count: 'exact', head: true }),
        supabase.from('daily_court_docket').select('id', { count: 'exact', head: true }),
        supabase.from('case_parse_queue').select('id', { count: 'exact', head: true })
      ]);

      return {
        causelistCount: causelists.count || 0,
        docketCount: docket.count || 0,
        parseQueueCount: parseQueue.count || 0
      };
    },
    enabled: isOpen && isAdmin && activeTab === 'storage'
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Done</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleUnstickJobs = async () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('ai_jobs')
      .update({ status: 'pending', started_at: null, retries: 0 })
      .eq('status', 'processing')
      .lt('started_at', thirtyMinsAgo);

    if (error) {
      toast.error('Failed to unstick jobs');
    } else {
      toast.success('Stuck jobs reset to pending');
      refetchHealth();
      refetchAIJobs();
    }
  };

  if (!isOpen) return null;

  // Security check - server-side admin verification
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-background/95 border-destructive/50">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Access Denied</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You do not have permission to access the Operations Console.
            </p>
            <Button onClick={onClose} variant="outline">Close</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-background/95 border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Operations Console</CardTitle>
              <p className="text-xs text-muted-foreground">System internals - Admin only</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full rounded-none border-b border-border bg-muted/30 h-12">
              <TabsTrigger value="health" className="flex-1">
                <Activity className="h-4 w-4 mr-2" />
                System Health
              </TabsTrigger>
              <TabsTrigger value="parsing" className="flex-1">
                <Zap className="h-4 w-4 mr-2" />
                Parsing & AI
              </TabsTrigger>
              <TabsTrigger value="storage" className="flex-1">
                <HardDrive className="h-4 w-4 mr-2" />
                Data & Storage
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="flex-1">
                <CreditCard className="h-4 w-4 mr-2" />
                Subscriptions
              </TabsTrigger>
            </TabsList>

            {/* System Health Tab */}
            <TabsContent value="health" className="p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Current Status</h3>
                <Button variant="outline" size="sm" onClick={() => refetchHealth()} disabled={healthLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${healthLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="text-sm text-muted-foreground">AI Jobs Pending</div>
                  <div className="text-2xl font-bold">{health?.aiJobsPending ?? '-'}</div>
                </div>
                <div className={`p-4 rounded-lg border ${(health?.aiJobsStuck ?? 0) > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-muted/30 border-border'}`}>
                  <div className="text-sm text-muted-foreground">Stuck Jobs (30m+)</div>
                  <div className="text-2xl font-bold">{health?.aiJobsStuck ?? '-'}</div>
                  {(health?.aiJobsStuck ?? 0) > 0 && (
                    <Button size="sm" variant="destructive" className="mt-2 w-full" onClick={handleUnstickJobs}>
                      Unstick All
                    </Button>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="text-sm text-muted-foreground">Parse Queue</div>
                  <div className="text-2xl font-bold">{health?.parseQueuePending ?? '-'}</div>
                </div>
                <div className={`p-4 rounded-lg border ${(health?.recentFailures ?? 0) > 5 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-muted/30 border-border'}`}>
                  <div className="text-sm text-muted-foreground">Failures (24h)</div>
                  <div className="text-2xl font-bold">{health?.recentFailures ?? '-'}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/20 border border-border">
                <div className="text-sm text-muted-foreground">Last Sync</div>
                <div className="font-mono text-sm">
                  {health?.lastSyncTime ? new Date(health.lastSyncTime).toLocaleString() : 'No sync recorded'}
                </div>
              </div>
            </TabsContent>

            {/* Parsing & AI Tab */}
            <TabsContent value="parsing" className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">AI Jobs Queue</h3>
                <Button variant="outline" size="sm" onClick={() => refetchAIJobs()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
              
              <ScrollArea className="h-[400px] border rounded-lg border-border">
                <div className="divide-y divide-border">
                  {aiJobs?.map((job) => (
                    <div key={job.id} className="p-3 hover:bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{job.id.slice(0, 8)}</span>
                          <Badge variant="outline">{job.job_type}</Badge>
                          {getStatusBadge(job.status)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(job.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      {job.error_message && (
                        <p className="text-xs text-red-400 mt-1 truncate">{job.error_message}</p>
                      )}
                      {job.retries > 0 && (
                        <span className="text-xs text-yellow-400">Retries: {job.retries}</span>
                      )}
                    </div>
                  ))}
                  {(!aiJobs || aiJobs.length === 0) && (
                    <div className="p-8 text-center text-muted-foreground">No jobs found</div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Storage Tab */}
            <TabsContent value="storage" className="p-4 space-y-4">
              <h3 className="font-medium">Data Volume</h3>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="h-4 w-4" />
                    Causelists
                  </div>
                  <div className="text-2xl font-bold">{storageStats?.causelistCount ?? '-'}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="h-4 w-4" />
                    Docket Items
                  </div>
                  <div className="text-2xl font-bold">{storageStats?.docketCount ?? '-'}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="h-4 w-4" />
                    Parse Queue
                  </div>
                  <div className="text-2xl font-bold">{storageStats?.parseQueueCount ?? '-'}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <h4 className="font-medium text-yellow-400 mb-2">Retention Note</h4>
                <p className="text-sm text-muted-foreground">
                  Data retention policies should be configured to archive old causelist text content and cleanup old logs.
                  Consider implementing scheduled cleanup jobs.
                </p>
              </div>
            </TabsContent>

            {/* Subscriptions Tab */}
            <TabsContent value="subscriptions" className="p-4 space-y-4">
              <h3 className="font-medium">Subscription Management</h3>
              
              <div className="p-8 text-center border rounded-lg border-dashed border-border">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="font-medium mb-2">Subscription System Not Implemented</h4>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Subscription enforcement, Stripe integration, and payment webhook handling 
                  need to be implemented before paid launch.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
