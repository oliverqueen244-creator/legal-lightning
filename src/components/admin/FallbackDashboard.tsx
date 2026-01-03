import { 
  useFallbackLogs, 
  useFallbackSummary, 
  useDisabledBenches,
  useDisableFallback,
  useEnableFallback,
  FallbackLogEntry 
} from '@/hooks/useFallbackLogs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  ShieldOff,
  ShieldCheck,
  Layers,
  ArrowRight,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Admin-only dashboard for viewing parser fallback system
 * 
 * Displays:
 * - Fallback activation summary
 * - Per-bench fallback history
 * - Confidence deltas
 * - One-click disable/enable per bench
 */
export function FallbackDashboard() {
  const { data: logs, isLoading: logsLoading } = useFallbackLogs({ limit: 50, daysBack: 7 });
  const { data: summary, isLoading: summaryLoading } = useFallbackSummary();
  const { data: disabledBenches, isLoading: disabledLoading } = useDisabledBenches();
  
  const disableFallback = useDisableFallback();
  const enableFallback = useEnableFallback();
  
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const isLoading = logsLoading || summaryLoading || disabledLoading;

  // Calculate aggregate stats
  const stats = {
    totalAttempts: logs?.length || 0,
    successfulRecoveries: logs?.filter(l => l.cases_after > l.cases_before).length || 0,
    avgConfidenceDelta: logs && logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + (l.confidence_after - l.confidence_before), 0) / logs.length)
      : 0,
    totalCasesRecovered: logs?.reduce((sum, l) => sum + Math.max(0, l.cases_after - l.cases_before), 0) || 0,
    disabledCount: disabledBenches?.length || 0,
  };

  const handleToggleFallback = async (benchCode: string, isCurrentlyDisabled: boolean) => {
    try {
      if (isCurrentlyDisabled) {
        await enableFallback.mutateAsync(benchCode);
        toast.success(`Fallback enabled for ${benchCode}`);
      } else {
        await disableFallback.mutateAsync({ benchCode, reason: 'Admin disabled' });
        toast.success(`Fallback disabled for ${benchCode}`);
      }
    } catch (error) {
      toast.error('Failed to update fallback setting');
    }
  };

  const getFallbackLevelColor = (level: string): string => {
    switch (level) {
      case 'primary':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'fallback_1_lenient':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'fallback_2_section':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'fallback_3_historical':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getFallbackLevelLabel = (level: string): string => {
    switch (level) {
      case 'primary':
        return 'Primary';
      case 'fallback_1_lenient':
        return 'Level 1: Lenient';
      case 'fallback_2_section':
        return 'Level 2: Section';
      case 'fallback_3_historical':
        return 'Level 3: Historical';
      default:
        return level;
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-32 bg-muted/50" />
          </Card>
        ))}
      </div>
    );
  }

  // Group logs by bench for bench view
  const logsByBench = (logs || []).reduce((acc, log) => {
    if (!acc[log.bench_code]) {
      acc[log.bench_code] = [];
    }
    acc[log.bench_code].push(log);
    return acc;
  }, {} as Record<string, FallbackLogEntry[]>);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fallback Attempts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.totalAttempts}</span>
              <Layers className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Successful Recoveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-green-600">{stats.successfulRecoveries}</span>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalAttempts > 0 
                ? `${Math.round((stats.successfulRecoveries / stats.totalAttempts) * 100)}% success rate`
                : 'No attempts'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cases Recovered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.totalCasesRecovered}</span>
              <RefreshCw className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total recovered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Confidence Delta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className={`text-3xl font-bold ${stats.avgConfidenceDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.avgConfidenceDelta >= 0 ? '+' : ''}{stats.avgConfidenceDelta}
              </span>
              {stats.avgConfidenceDelta >= 0 
                ? <TrendingUp className="w-8 h-8 text-green-500" />
                : <TrendingDown className="w-8 h-8 text-red-500" />
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per fallback attempt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Disabled Benches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.disabledCount}</span>
              <ShieldOff className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Fallback disabled</p>
          </CardContent>
        </Card>
      </div>

      {/* Disabled Benches Management */}
      {disabledBenches && disabledBenches.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <ShieldOff className="w-4 h-4" />
              Fallback Disabled for These Benches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {disabledBenches.map((bench) => (
                <Badge 
                  key={bench.bench_code} 
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {bench.bench_code}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => handleToggleFallback(bench.bench_code, true)}
                  >
                    ✕
                  </Button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Bench Fallback History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fallback History by Bench</CardTitle>
          <CardDescription>View fallback traces and toggle per-bench settings</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-80">
            {Object.keys(logsByBench).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(logsByBench).map(([benchCode, benchLogs]) => {
                  const isDisabled = disabledBenches?.some(b => b.bench_code === benchCode);
                  const latestLog = benchLogs[0];
                  const avgDelta = Math.round(
                    benchLogs.reduce((sum, l) => sum + (l.confidence_after - l.confidence_before), 0) / benchLogs.length
                  );

                  return (
                    <div 
                      key={benchCode} 
                      className="border rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-medium">{benchCode}</span>
                          <Badge variant="outline" className="text-xs">
                            {benchLogs.length} attempts
                          </Badge>
                          <div className={`flex items-center gap-1 ${avgDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {avgDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span className="text-xs">{avgDelta >= 0 ? '+' : ''}{avgDelta} avg</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {isDisabled ? 'Disabled' : 'Enabled'}
                          </span>
                          <Switch
                            checked={!isDisabled}
                            onCheckedChange={() => handleToggleFallback(benchCode, isDisabled || false)}
                          />
                        </div>
                      </div>

                      {/* Latest attempt preview */}
                      <div 
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded p-1 -mx-1"
                        onClick={() => setExpandedBatch(expandedBatch === latestLog.batch_id ? null : latestLog.batch_id)}
                      >
                        <Badge className={getFallbackLevelColor(latestLog.fallback_level)}>
                          {getFallbackLevelLabel(latestLog.fallback_level)}
                        </Badge>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {latestLog.cases_before} → {latestLog.cases_after} cases
                        </span>
                        <span className="text-muted-foreground">|</span>
                        <span className={latestLog.confidence_after > latestLog.confidence_before ? 'text-green-600' : 'text-red-600'}>
                          {latestLog.confidence_before} → {latestLog.confidence_after}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(latestLog.applied_at), 'MMM d, HH:mm')}
                        </span>
                      </div>

                      {/* Expanded details */}
                      {expandedBatch === latestLog.batch_id && (
                        <div className="mt-2 pl-2 border-l-2 border-muted space-y-1 text-xs">
                          <div className="text-muted-foreground">
                            Reason: <span className="font-mono">{latestLog.triggered_reason}</span>
                          </div>
                          {latestLog.parse_duration_ms && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {latestLog.parse_duration_ms}ms
                            </div>
                          )}
                          <div className="text-muted-foreground">
                            Batch: <span className="font-mono text-xs">{latestLog.batch_id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-green-500" />
                No fallback attempts in the last 7 days
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent Fallback Logs Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Fallback Attempts</CardTitle>
          <CardDescription>Chronological view of all fallback activations</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            {logs && logs.length > 0 ? (
              <div className="space-y-2">
                {logs.slice(0, 20).map((log) => (
                  <div 
                    key={log.id}
                    className={`flex items-center gap-3 p-2 rounded border text-sm ${
                      log.confidence_after < 40 ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' : ''
                    }`}
                  >
                    <span className="font-mono text-xs w-20">{log.bench_code}</span>
                    <Badge className={`${getFallbackLevelColor(log.fallback_level)} text-xs`}>
                      {getFallbackLevelLabel(log.fallback_level)}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">{log.cases_before}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className={log.cases_after > log.cases_before ? 'text-green-600 font-medium' : ''}>
                        {log.cases_after}
                      </span>
                    </div>
                    <div className="w-24">
                      <Progress 
                        value={log.confidence_after} 
                        className={`h-2 ${log.confidence_after < 40 ? 'bg-red-100' : ''}`}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(log.applied_at), 'MMM d, HH:mm')}
                    </span>
                    {log.confidence_after < 40 && (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No fallback logs recorded
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
