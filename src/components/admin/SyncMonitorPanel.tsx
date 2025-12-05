import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useSyncLiveBoard } from '@/hooks/useDataValidation';
import { useSyncStatusHistory } from '@/hooks/useSyncHealth';
import { SyncStatusBadge } from '@/components/dashboard/SyncStatusBadge';
import { cn } from '@/lib/utils';

export function SyncMonitorPanel() {
  const { getHealth, syncBoard, isSyncing } = useSyncLiveBoard();
  const { data: syncHistory, isLoading: historyLoading } = useSyncStatusHistory();
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);

  const handleForceSync = async (courtLocation: string, courtNo: string) => {
    await syncBoard.mutateAsync({
      action: 'force_sync',
      court_location: courtLocation,
      court_no: courtNo
    });
  };

  const healthData = getHealth.data;
  const courts = healthData?.courts || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Sync Monitor
            </CardTitle>
            <CardDescription>
              Real-time sync status with High Court display boards (10-second interval)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => getHealth.refetch()}
            disabled={getHealth.isRefetching}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", getHealth.isRefetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Status */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
          <div className="flex-1">
            <p className="text-sm font-medium">Overall Sync Status</p>
            <p className="text-xs text-muted-foreground">
              Last checked: {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : 'N/A'}
            </p>
          </div>
          {courts.length > 0 ? (
            <SyncStatusBadge 
              status={courts.every(c => c.status === 'live') ? 'live' : 
                     courts.some(c => c.status === 'stale') ? 'stale' : 'delayed'} 
              size="lg"
            />
          ) : (
            <Badge variant="outline">No Data</Badge>
          )}
        </div>

        {/* Per-Court Status */}
        <div>
          <h4 className="text-sm font-medium mb-3">Court Status</h4>
          <div className="grid gap-3">
            {courts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courts configured</p>
            ) : (
              courts.map((court) => (
                <div 
                  key={`${court.court_location}_${court.court_no}`}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                    selectedCourt === `${court.court_location}_${court.court_no}` && "border-primary bg-primary/5",
                    court.status === 'stale' && "border-destructive/50 bg-destructive/5"
                  )}
                  onClick={() => setSelectedCourt(`${court.court_location}_${court.court_no}`)}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{court.court_location} Court {court.court_no}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {court.stale_seconds}s ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SyncStatusBadge status={court.status} staleSeconds={court.stale_seconds} size="sm" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleForceSync(court.court_location, court.court_no);
                      }}
                      disabled={isSyncing}
                    >
                      <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sync History */}
        <div>
          <h4 className="text-sm font-medium mb-3">Recent Sync History</h4>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {historyLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : syncHistory && syncHistory.length > 0 ? (
              syncHistory.slice(0, 10).map((entry) => (
                <div 
                  key={entry.id}
                  className="flex items-center justify-between text-sm p-2 rounded bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    {entry.status === 'healthy' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : entry.status === 'degraded' ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <span>{entry.source_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{entry.sync_latency_ms}ms</span>
                    <span>{new Date(entry.last_sync_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No sync history available</p>
            )}
          </div>
        </div>

        {/* Latency Info */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm font-medium text-blue-400">Sync Configuration</p>
          <ul className="text-xs text-muted-foreground mt-1 space-y-1">
            <li>• Polling interval: 10 seconds</li>
            <li>• Live threshold: ≤30 seconds</li>
            <li>• Delayed threshold: 30-60 seconds</li>
            <li>• Stale threshold: &gt;60 seconds</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
