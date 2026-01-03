import { useParsingHealth } from '@/hooks/useAdminErrors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, FileWarning, Layers, Link2, Server, TrendingDown, TrendingUp } from 'lucide-react';

export function ParsingHealthDashboard() {
  const { data: stats, isLoading } = useParsingHealth();
  
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
  
  if (!stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No health data available
        </CardContent>
      </Card>
    );
  }
  
  const resolutionRate = stats.total_events > 0 
    ? Math.round((stats.resolved_count / stats.total_events) * 100) 
    : 100;
  
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Events (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.total_events}</span>
              {stats.total_events === 0 ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resolution Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{resolutionRate}%</span>
                {resolutionRate >= 80 ? (
                  <TrendingUp className="w-8 h-8 text-green-500" />
                ) : (
                  <TrendingDown className="w-8 h-8 text-red-500" />
                )}
              </div>
              <Progress value={resolutionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical (P0)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.p0_count}</span>
              {stats.p0_count > 0 ? (
                <Badge className="bg-destructive">URGENT</Badge>
              ) : (
                <CheckCircle className="w-8 h-8 text-green-500" />
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Zero Match Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.zero_match_days}</span>
              {stats.zero_match_days > 0 ? (
                <FileWarning className="w-8 h-8 text-orange-500" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Parsing Pipeline Health */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-base">Ingestion</CardTitle>
            </div>
            <CardDescription>Causelist download & storage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.ingestion_errors}</span>
              <span className="text-sm text-muted-foreground">errors</span>
            </div>
            {stats.ingestion_errors === 0 ? (
              <Badge variant="outline" className="mt-2 bg-green-500/10 text-green-600">
                Healthy
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-2 bg-orange-500/10 text-orange-600">
                {stats.ingestion_errors} issues
              </Badge>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-500" />
              <CardTitle className="text-base">Parsing</CardTitle>
            </div>
            <CardDescription>Text extraction & structuring</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.parsing_errors}</span>
              <span className="text-sm text-muted-foreground">errors</span>
            </div>
            {stats.parsing_errors === 0 ? (
              <Badge variant="outline" className="mt-2 bg-green-500/10 text-green-600">
                Healthy
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-2 bg-orange-500/10 text-orange-600">
                {stats.parsing_errors} issues
              </Badge>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-green-500" />
              <CardTitle className="text-base">Matching</CardTitle>
            </div>
            <CardDescription>Lawyer alias matching</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.matching_errors}</span>
              <span className="text-sm text-muted-foreground">errors</span>
            </div>
            {stats.matching_errors === 0 ? (
              <Badge variant="outline" className="mt-2 bg-green-500/10 text-green-600">
                Healthy
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-2 bg-orange-500/10 text-orange-600">
                {stats.matching_errors} issues
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Top Issues */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Error Codes (7d)</CardTitle>
            <CardDescription>Most frequent error patterns</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.top_error_codes.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                No errors recorded
              </div>
            ) : (
              <div className="space-y-3">
                {stats.top_error_codes.map((item, i) => (
                  <div key={item.error_code} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-4">{i + 1}.</span>
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {item.error_code}
                      </code>
                    </div>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Benches by Failures (7d)</CardTitle>
            <CardDescription>Benches with most errors</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.top_benches.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                No bench-specific errors
              </div>
            ) : (
              <div className="space-y-3">
                {stats.top_benches.map((item, i) => (
                  <div key={item.bench_code} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-4">{i + 1}.</span>
                      <span className="text-sm font-medium">{item.bench_code}</span>
                    </div>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Severity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Severity Breakdown (7d)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span className="text-sm">P0 Critical: {stats.p0_count}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-sm">P1 High: {stats.p1_count}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm">P2 Warning: {stats.p2_count}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">Resolved: {stats.resolved_count}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
