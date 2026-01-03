import { useState } from 'react';
import { useAdminErrors, useErrorSummary, useResolveError, useBulkResolve } from '@/hooks/useAdminErrors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Clock, Filter, RefreshCw, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import type { ErrorSeverity, ErrorDomain } from '@/lib/errorReporting';
import type { ErrorSummary, AdminErrorEvent } from '@/hooks/useAdminErrors';
import { ParsingHealthDashboard } from './ParsingHealthDashboard';

const SEVERITY_COLORS: Record<ErrorSeverity, string> = {
  P0: 'bg-destructive text-destructive-foreground',
  P1: 'bg-orange-500 text-white',
  P2: 'bg-yellow-500 text-black',
};

const DOMAIN_LABELS: Record<ErrorDomain, string> = {
  AUTH: 'Authentication',
  NETWORK: 'Network',
  OFFLINE_BLOCK: 'Offline Block',
  SYNC: 'Sync',
  UPLOAD: 'Upload',
  PWA: 'PWA',
  REALTIME: 'Realtime',
  CAUSELIST_PARSING: 'Causelist Parsing',
  CASE_MATCHING: 'Case Matching',
  INGESTION: 'Ingestion',
  UNKNOWN: 'Unknown',
};

export function AdminErrorConsole() {
  const [filters, setFilters] = useState({
    severity: undefined as ErrorSeverity | undefined,
    domain: undefined as ErrorDomain | undefined,
    unresolvedOnly: true,
    startDate: undefined as string | undefined,
    endDate: undefined as string | undefined,
  });
  
  const [selectedError, setSelectedError] = useState<ErrorSummary | null>(null);
  const [detailError, setDetailError] = useState<AdminErrorEvent | null>(null);
  const [adminNote, setAdminNote] = useState('');
  
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useErrorSummary(filters);
  const { data: errors, isLoading: errorsLoading, refetch: refetchErrors } = useAdminErrors({
    ...filters,
    ...(selectedError ? { domain: undefined, severity: undefined } : {}),
  });
  
  const resolveError = useResolveError();
  const bulkResolve = useBulkResolve();
  
  const handleResolve = async (errorId: string) => {
    try {
      await resolveError.mutateAsync({ errorId, adminNote });
      toast.success('Error marked as resolved');
      setDetailError(null);
      setAdminNote('');
    } catch {
      toast.error('Failed to resolve error');
    }
  };
  
  const handleBulkResolve = async (errorCode: string) => {
    try {
      await bulkResolve.mutateAsync({ errorCode, adminNote });
      toast.success(`All ${errorCode} errors marked as resolved`);
      setSelectedError(null);
      setAdminNote('');
    } catch {
      toast.error('Failed to resolve errors');
    }
  };
  
  const filteredErrors = selectedError
    ? errors?.filter(e => e.error_code === selectedError.error_code) || []
    : errors || [];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Error Console</h2>
          <p className="text-muted-foreground text-sm">
            Court-critical error monitoring. No sensitive data stored.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            refetchSummary();
            refetchErrors();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary View</TabsTrigger>
          <TabsTrigger value="health">Parsing Health</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 items-center">
                <Filter className="w-4 h-4 text-muted-foreground" />
                
                <Select
                  value={filters.severity || 'all'}
                  onValueChange={(v) => setFilters(f => ({ ...f, severity: v === 'all' ? undefined : v as ErrorSeverity }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="P0">P0 - Critical</SelectItem>
                    <SelectItem value="P1">P1 - High</SelectItem>
                    <SelectItem value="P2">P2 - Warning</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select
                  value={filters.domain || 'all'}
                  onValueChange={(v) => setFilters(f => ({ ...f, domain: v === 'all' ? undefined : v as ErrorDomain }))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Domain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Domains</SelectItem>
                    {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  variant={filters.unresolvedOnly ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilters(f => ({ ...f, unresolvedOnly: !f.unresolvedOnly }))}
                >
                  Unresolved Only
                </Button>
                
                {selectedError && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedError(null)}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear Selection
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>Error Summary</CardTitle>
              <CardDescription>
                Grouped by error code. Click to drill down.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : summary?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  No errors found. System healthy.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Error Code</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead>Benches</TableHead>
                      <TableHead>Environment</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary?.map((item) => (
                      <TableRow 
                        key={item.error_code}
                        className={selectedError?.error_code === item.error_code ? 'bg-accent' : 'cursor-pointer hover:bg-muted/50'}
                        onClick={() => setSelectedError(item)}
                      >
                        <TableCell>
                          <Badge className={SEVERITY_COLORS[item.severity]}>
                            {item.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {DOMAIN_LABELS[item.domain] || item.domain}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.error_code}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.count}
                          {item.unresolved_count > 0 && (
                            <span className="text-muted-foreground ml-1">
                              ({item.unresolved_count} open)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(item.last_seen), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          {item.affected_benches.length > 0 ? (
                            <span className="text-sm">{item.affected_benches.slice(0, 3).join(', ')}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {item.environments.map(env => (
                              <Badge key={env} variant="outline" className="text-xs">
                                {env}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.unresolved_count > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBulkResolve(item.error_code);
                              }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          
          {/* Detail List when error selected */}
          {selectedError && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-mono">{selectedError.error_code}</CardTitle>
                    <CardDescription>
                      {selectedError.count} occurrences • {DOMAIN_LABELS[selectedError.domain]}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleBulkResolve(selectedError.error_code)}
                  >
                    Resolve All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {errorsLoading ? (
                  <div className="text-center py-4">Loading...</div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredErrors.map((error) => (
                      <div
                        key={error.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          error.resolved 
                            ? 'bg-muted/30 border-muted' 
                            : 'bg-background hover:bg-muted/50'
                        }`}
                        onClick={() => setDetailError(error)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge className={SEVERITY_COLORS[error.severity]} variant="secondary">
                                {error.severity}
                              </Badge>
                              {error.resolved && (
                                <Badge variant="outline" className="bg-green-500/10 text-green-600">
                                  Resolved
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(error.created_at), 'MMM d, HH:mm')}
                              </span>
                            </div>
                            <p className="text-sm text-foreground">{error.message}</p>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              {error.bench_code && <span>Bench: {error.bench_code}</span>}
                              {error.environment && <span>Env: {error.environment}</span>}
                              {error.is_online !== null && (
                                <span>{error.is_online ? 'Online' : 'Offline'}</span>
                              )}
                            </div>
                          </div>
                          {!error.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResolve(error.id);
                              }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="health">
          <ParsingHealthDashboard />
        </TabsContent>
        
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors Timeline</CardTitle>
              <CardDescription>
                Chronological view of all error events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorsLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : errors?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No errors in selected period
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {errors?.map((error) => (
                    <div
                      key={error.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        error.resolved 
                          ? 'bg-muted/30 border-muted' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setDetailError(error)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          error.severity === 'P0' ? 'bg-destructive/20' :
                          error.severity === 'P1' ? 'bg-orange-500/20' : 'bg-yellow-500/20'
                        }`}>
                          <AlertTriangle className={`w-4 h-4 ${
                            error.severity === 'P0' ? 'text-destructive' :
                            error.severity === 'P1' ? 'text-orange-500' : 'text-yellow-500'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-medium">{error.error_code}</span>
                            <Badge variant="outline" className="text-xs">
                              {DOMAIN_LABELS[error.domain as ErrorDomain] || error.domain}
                            </Badge>
                            {error.resolved && (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 text-xs">
                                Resolved
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {error.message}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(error.created_at), 'MMM d, HH:mm:ss')}
                            </span>
                            {error.bench_code && <span>• {error.bench_code}</span>}
                            {error.route && <span>• {error.route}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Error Detail Dialog */}
      <Dialog open={!!detailError} onOpenChange={() => setDetailError(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">{detailError?.error_code}</DialogTitle>
            <DialogDescription>
              Error details • No sensitive court data shown
            </DialogDescription>
          </DialogHeader>
          
          {detailError && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Severity</span>
                  <div><Badge className={SEVERITY_COLORS[detailError.severity]}>{detailError.severity}</Badge></div>
                </div>
                <div>
                  <span className="text-muted-foreground">Domain</span>
                  <div>{DOMAIN_LABELS[detailError.domain as ErrorDomain] || detailError.domain}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Time</span>
                  <div>{format(new Date(detailError.created_at), 'MMM d, yyyy HH:mm:ss')}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <div>{detailError.resolved ? 'Resolved' : 'Open'}</div>
                </div>
                {detailError.batch_id && (
                  <div>
                    <span className="text-muted-foreground">Batch ID</span>
                    <div className="font-mono text-xs truncate">{detailError.batch_id}</div>
                  </div>
                )}
                {detailError.bench_code && (
                  <div>
                    <span className="text-muted-foreground">Bench</span>
                    <div>{detailError.bench_code}</div>
                  </div>
                )}
                {detailError.environment && (
                  <div>
                    <span className="text-muted-foreground">Environment</span>
                    <div>{detailError.environment}</div>
                  </div>
                )}
                {detailError.is_online !== null && (
                  <div>
                    <span className="text-muted-foreground">Network</span>
                    <div>{detailError.is_online ? 'Online' : 'Offline'}</div>
                  </div>
                )}
              </div>
              
              <div>
                <span className="text-muted-foreground text-sm">Message (sanitized)</span>
                <p className="mt-1 p-3 bg-muted rounded text-sm">{detailError.message}</p>
              </div>
              
              {detailError.admin_note && (
                <div>
                  <span className="text-muted-foreground text-sm">Admin Note</span>
                  <p className="mt-1 p-3 bg-muted rounded text-sm">{detailError.admin_note}</p>
                </div>
              )}
              
              {!detailError.resolved && (
                <div>
                  <label className="text-sm text-muted-foreground">Add Note (optional)</label>
                  <Textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Add resolution notes..."
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailError(null)}>
              Close
            </Button>
            {detailError && !detailError.resolved && (
              <Button onClick={() => handleResolve(detailError.id)}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Resolved
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
