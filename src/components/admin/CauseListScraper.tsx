import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bot, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  RefreshCw,
  MessageSquare,
  FileText,
  Wifi,
  WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface ScraperLog {
  id: string;
  bench: string;
  status: string;
  cases_found: number | null;
  list_type: string | null;
  court_no: string | null;
  run_at: string | null;
  error_message: string | null;
}

interface WebhookStatus {
  success: boolean;
  bot?: {
    id: number;
    first_name: string;
    username: string;
  };
  webhook?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  };
  error?: string;
}

export function CauseListScraper() {
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Fetch webhook status
  const { data: webhookStatus, refetch: refetchStatus, isLoading: statusLoading } = useQuery<WebhookStatus>({
    queryKey: ['telegram-webhook-status'],
    queryFn: async () => {
      // Try to get status via query param
      const response = await fetch(
        `https://pwpnnixoscppfzjogcgj.supabase.co/functions/v1/telegram-webhook?action=status`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch webhook status');
      }
      
      return response.json();
    },
    refetchInterval: 60000, // Check every minute
    retry: 1,
  });

  // Fetch recent scraper logs
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['scraper-logs-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraper_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as ScraperLog[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleCheckStatus = async () => {
    setIsCheckingStatus(true);
    try {
      await refetchStatus();
      await refetchLogs();
      toast.success('Status refreshed');
    } catch (error) {
      toast.error('Failed to check status');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-court-success" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-court-warning" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-court-danger-light" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-court-success/20 text-court-success border-court-success/30">Success</Badge>;
      case 'partial':
        return <Badge className="bg-court-warning/20 text-court-warning border-court-warning/30">Partial</Badge>;
      case 'error':
        return <Badge variant="danger">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const isWebhookConnected = webhookStatus?.success && webhookStatus?.webhook?.url;
  const pendingUpdates = webhookStatus?.webhook?.pending_update_count || 0;
  const lastError = webhookStatus?.webhook?.last_error_message;

  return (
    <div className="space-y-6">
      {/* Webhook Status Card */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Telegram Webhook Status
          </CardTitle>
          <CardDescription>
            Primary causelist data source via Telegram bot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3">
              {statusLoading ? (
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : isWebhookConnected ? (
                <Wifi className="h-5 w-5 text-court-success" />
              ) : (
                <WifiOff className="h-5 w-5 text-court-danger-light" />
              )}
              <div>
                {/* FIX 6: Scoped "Connected" label to clarify subsystem */}
                <p className="font-medium">
                  {statusLoading ? 'Checking...' : isWebhookConnected ? 'Connected (Notifications)' : 'Disconnected'}
                </p>
                {webhookStatus?.bot && (
                  <p className="text-sm text-muted-foreground">
                    @{webhookStatus.bot.username} · Telegram Integration
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckStatus}
              disabled={isCheckingStatus}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isCheckingStatus ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats */}
          {isWebhookConnected && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-border bg-card">
                <p className="text-xs text-muted-foreground">Pending Updates</p>
                <p className="text-2xl font-bold">{pendingUpdates}</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card">
                <p className="text-xs text-muted-foreground">Today's Cases</p>
                <p className="text-2xl font-bold">
                  {logs?.filter(l => l.status === 'success').reduce((sum, l) => sum + (l.cases_found || 0), 0) || 0}
                </p>
              </div>
            </div>
          )}

          {/* Last Error */}
          {lastError && (
            <div className="p-3 rounded-lg bg-court-danger-light/10 border border-court-danger-light/30">
              <p className="text-sm text-court-danger-light flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {lastError}
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4" />
              How to Add Causelists
            </h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Forward the causelist PDF to the Telegram bot</li>
              <li>The bot automatically extracts cases and saves to database</li>
              <li>Cases appear in the dashboard within seconds</li>
            </ol>
            {webhookStatus?.bot && (
              <p className="mt-3 text-sm">
                <span className="text-muted-foreground">Bot: </span>
                <code className="bg-background px-2 py-0.5 rounded">@{webhookStatus.bot.username}</code>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Processing Logs */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Processing Logs
          </CardTitle>
          <CardDescription>
            History of causelist PDFs processed via Telegram
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{log.bench}</span>
                        <Badge variant="outline" className="text-xs">
                          {log.list_type || 'DAILY'}
                        </Badge>
                        {getStatusBadge(log.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {log.run_at 
                          ? formatDistanceToNow(new Date(log.run_at), { addSuffix: true })
                          : 'Unknown time'}
                        {log.cases_found ? ` • ${log.cases_found} cases` : ''}
                        {log.court_no && log.court_no !== 'ALL' ? ` • Court ${log.court_no}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No processing logs yet</p>
              <p className="text-sm">Forward a causelist PDF to the bot to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
