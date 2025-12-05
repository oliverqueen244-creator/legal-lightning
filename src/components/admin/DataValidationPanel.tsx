import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  FileCheck, 
  Monitor, 
  Link2 
} from 'lucide-react';
import { useDataValidation, useValidationLogs, type ValidationResult } from '@/hooks/useDataValidation';
import { cn } from '@/lib/utils';

export function DataValidationPanel() {
  const { runValidation, isValidating } = useDataValidation();
  const { data: logs, isLoading: logsLoading } = useValidationLogs();
  const [lastResults, setLastResults] = useState<ValidationResult[] | null>(null);
  const [summary, setSummary] = useState<{ pass: number; warning: number; fail: number } | null>(null);

  const handleRunValidation = async (action: 'validate_all' | 'validate_causelist' | 'validate_live_board' | 'cross_validate') => {
    const result = await runValidation.mutateAsync(action);
    setLastResults(result.results);
    setSummary(result.summary);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Pass</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warning</Badge>;
      case 'fail':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Fail</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Data Validation
            </CardTitle>
            <CardDescription>
              Validate causelist and display board data integrity
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Validation Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="flex flex-col h-auto py-4 gap-2"
            onClick={() => handleRunValidation('validate_all')}
            disabled={isValidating}
          >
            <RefreshCw className={cn("h-5 w-5", isValidating && "animate-spin")} />
            <span className="text-xs">Run All</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col h-auto py-4 gap-2"
            onClick={() => handleRunValidation('validate_causelist')}
            disabled={isValidating}
          >
            <FileCheck className="h-5 w-5" />
            <span className="text-xs">Causelist</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col h-auto py-4 gap-2"
            onClick={() => handleRunValidation('validate_live_board')}
            disabled={isValidating}
          >
            <Monitor className="h-5 w-5" />
            <span className="text-xs">Live Board</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col h-auto py-4 gap-2"
            onClick={() => handleRunValidation('cross_validate')}
            disabled={isValidating}
          >
            <Link2 className="h-5 w-5" />
            <span className="text-xs">Cross-Validate</span>
          </Button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">{summary.pass} Pass</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">{summary.warning} Warnings</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm">{summary.fail} Failures</span>
            </div>
          </div>
        )}

        {/* Latest Results */}
        {lastResults && lastResults.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Latest Results</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lastResults.map((result, index) => (
                <div 
                  key={index}
                  className={cn(
                    "flex items-start justify-between p-3 rounded-lg border",
                    result.status === 'fail' && "border-red-500/30 bg-red-500/5",
                    result.status === 'warning' && "border-yellow-500/30 bg-yellow-500/5",
                    result.status === 'pass' && "border-green-500/30 bg-green-500/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="text-sm font-medium">{result.type}</p>
                      <p className="text-xs text-muted-foreground">{result.message}</p>
                    </div>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation Logs */}
        <div>
          <h4 className="text-sm font-medium mb-3">Recent Validation Logs</h4>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {logsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : logs && logs.length > 0 ? (
              logs.slice(0, 15).map((log) => (
                <div 
                  key={log.id}
                  className="flex items-center justify-between text-sm p-2 rounded bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(log.status)}
                    <span className="truncate max-w-[200px]">{log.validation_type}</span>
                    {log.court_location && (
                      <Badge variant="outline" className="text-xs">
                        {log.court_location} {log.court_no}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No validation logs available</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
