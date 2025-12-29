import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Zap,
  Brain
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface AiJob {
  id: string;
  job_type: string;
  provider: string | null;
  payload: {
    causelist_id?: string;
    profile_id?: string;
    alias?: string;
    court_no?: string;
    bench?: string;
    list_date?: string;
    list_type?: string;
  };
  status: string;
  retries: number;
  max_retries: number;
  priority: number;
  tokens_used: number | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  next_retry_at: string | null;
}

interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retry: number;
  total: number;
  tokensUsedToday: number;
}

export function AiJobsMonitor() {
  const queryClient = useQueryClient();

  // Fetch job statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['ai-jobs-stats'],
    queryFn: async (): Promise<JobStats> => {
      const today = new Date().toISOString().split('T')[0];
      
      const [pendingRes, processingRes, completedRes, failedRes, retryRes, tokensRes] = await Promise.all([
        supabase.from('ai_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('ai_jobs').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
        supabase.from('ai_jobs').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('ai_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('ai_jobs').select('id', { count: 'exact', head: true }).eq('status', 'retry'),
        supabase.from('ai_jobs').select('tokens_used').eq('status', 'completed').gte('completed_at', today)
      ]);

      const tokensUsedToday = (tokensRes.data || []).reduce((sum, j) => sum + (j.tokens_used || 0), 0);

      return {
        pending: pendingRes.count || 0,
        processing: processingRes.count || 0,
        completed: completedRes.count || 0,
        failed: failedRes.count || 0,
        retry: retryRes.count || 0,
        total: (pendingRes.count || 0) + (processingRes.count || 0) + (completedRes.count || 0) + (failedRes.count || 0) + (retryRes.count || 0),
        tokensUsedToday
      };
    },
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Fetch recent jobs
  const { data: jobs, isLoading: jobsLoading, refetch } = useQuery({
    queryKey: ['ai-jobs-recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AiJob[];
    },
    refetchInterval: 10000
  });

  // Retry failed job mutation
  const retryJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('ai_jobs')
        .update({ 
          status: 'pending', 
          retries: 0, 
          error_message: null,
          next_retry_at: null 
        })
        .eq('id', jobId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Job queued for retry');
      queryClient.invalidateQueries({ queryKey: ['ai-jobs-recent'] });
      queryClient.invalidateQueries({ queryKey: ['ai-jobs-stats'] });
    },
    onError: (error) => {
      toast.error(`Failed to retry job: ${error.message}`);
    }
  });

  // Delete job mutation
  const deleteJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('ai_jobs')
        .delete()
        .eq('id', jobId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Job deleted');
      queryClient.invalidateQueries({ queryKey: ['ai-jobs-recent'] });
      queryClient.invalidateQueries({ queryKey: ['ai-jobs-stats'] });
    },
    onError: (error) => {
      toast.error(`Failed to delete job: ${error.message}`);
    }
  });

  // Trigger worker manually
  const triggerWorker = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('ai-worker', {
        body: {}
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('AI worker triggered');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['ai-jobs-recent'] });
        queryClient.invalidateQueries({ queryKey: ['ai-jobs-stats'] });
      }, 2000);
    },
    onError: (error) => {
      toast.error(`Failed to trigger worker: ${error.message}`);
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'processing':
        return <Badge className="gap-1 bg-blue-500/20 text-blue-400"><RefreshCw className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case 'completed':
        return <Badge className="gap-1 bg-green-500/20 text-green-400"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
      case 'retry':
        return <Badge className="gap-1 bg-yellow-500/20 text-yellow-400"><AlertTriangle className="h-3 w-3" /> Retry</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              AI Jobs Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{stats?.pending || 0}</span>
                <span className="text-muted-foreground text-sm">pending</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-blue-400">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{stats?.processing || 0}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-green-400">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{stats?.completed || 0}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-red-400">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{stats?.failed || 0}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">
              <Zap className="h-3 w-3" /> Tokens Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{((stats?.tokensUsedToday || 0) / 1000).toFixed(1)}k</span>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
        <Button 
          variant="gold" 
          size="sm" 
          onClick={() => triggerWorker.mutate()}
          disabled={triggerWorker.isPending}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          Trigger Worker Now
        </Button>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
          <CardDescription>Last 50 AI parsing jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {jobsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : jobs?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No AI jobs found
              </div>
            ) : (
              <div className="space-y-2">
                {jobs?.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(job.status)}
                          <Badge variant="outline" className="text-xs">
                            {job.job_type}
                          </Badge>
                          {job.payload.list_type && (
                            <Badge variant="outline" className="text-xs">
                              {job.payload.list_type}
                            </Badge>
                          )}
                          {job.provider && (
                            <Badge variant="secondary" className="text-xs">
                              {job.provider}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="mt-1 text-sm text-muted-foreground">
                          {job.payload.bench && <span>📍 {job.payload.bench}</span>}
                          {job.payload.court_no && <span> • Court {job.payload.court_no}</span>}
                          {job.payload.alias && <span> • "{job.payload.alias}"</span>}
                        </div>

                        {job.error_message && (
                          <div className="mt-1 text-xs text-destructive truncate">
                            ❌ {job.error_message}
                          </div>
                        )}

                        <div className="mt-1 text-xs text-muted-foreground">
                          Created {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                          {job.retries > 0 && <span> • Retries: {job.retries}/{job.max_retries}</span>}
                          {job.tokens_used && <span> • {job.tokens_used.toLocaleString()} tokens</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {(job.status === 'failed' || job.status === 'retry') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => retryJob.mutate(job.id)}
                            disabled={retryJob.isPending}
                            title="Retry job"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {(job.status === 'failed' || job.status === 'completed') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteJob.mutate(job.id)}
                            disabled={deleteJob.isPending}
                            title="Delete job"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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
