import { useConfidenceRuns, useConfidenceSummary, useConfidenceTrends, CONFIDENCE_REASONS } from '@/hooks/useParserConfidence';
import { getConfidenceLevelColor, getConfidenceLevelDescription } from '@/lib/confidenceScoring';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  CheckCircle, 
  TrendingDown, 
  TrendingUp, 
  ShieldAlert,
  ShieldCheck,
  Gauge,
  Calendar,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';

/**
 * Admin-only dashboard for viewing parser confidence metrics
 * 
 * Displays:
 * - Today's summary statistics
 * - Confidence trends per bench
 * - Recent runs with drill-down (reasons only, no raw data)
 */
export function ConfidenceDashboard() {
  const { data: summary, isLoading: summaryLoading } = useConfidenceSummary();
  const { data: trends, isLoading: trendsLoading } = useConfidenceTrends();
  const { data: runs, isLoading: runsLoading } = useConfidenceRuns({ limit: 20 });
  
  const isLoading = summaryLoading || trendsLoading || runsLoading;
  
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
  
  return (
    <div className="space-y-6">
      {/* Today's Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{summary?.average_score || 0}</span>
              <Gauge className={`w-8 h-8 ${(summary?.average_score || 0) >= 75 ? 'text-green-500' : 'text-orange-500'}`} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Benches Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{summary?.total_benches || 0}</span>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Excellent/Good
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-green-600">
                {(summary?.excellent_count || 0) + (summary?.good_count || 0)}
              </span>
              <ShieldCheck className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Risky/Unsafe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-red-600">
                {(summary?.risky_count || 0) + (summary?.unsafe_count || 0)}
              </span>
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Warnings Issued
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{summary?.warnings_issued || 0}</span>
              {(summary?.warnings_issued || 0) > 0 ? (
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Lowest Score Bench Alert */}
      {summary?.lowest_score_bench && summary.lowest_score_bench.confidence_score < 60 && (
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              Lowest Score Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-lg font-bold">{summary.lowest_score_bench.bench_code}</span>
                <p className="text-sm text-muted-foreground">
                  Score: {summary.lowest_score_bench.confidence_score} — {summary.lowest_score_bench.confidence_level}
                </p>
              </div>
              <Badge variant="destructive">{summary.lowest_score_bench.confidence_level}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Confidence Trends by Bench */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-500" />
            <CardTitle className="text-base">Confidence Trends (7 Days)</CardTitle>
          </div>
          <CardDescription>Score progression per bench</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            {trends && Object.keys(trends).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(trends).map(([benchCode, benchRuns]) => {
                  const latestRun = benchRuns[benchRuns.length - 1];
                  const avgScore = Math.round(
                    benchRuns.reduce((sum, r) => sum + r.confidence_score, 0) / benchRuns.length
                  );
                  const trend = benchRuns.length >= 2
                    ? benchRuns[benchRuns.length - 1].confidence_score - benchRuns[0].confidence_score
                    : 0;
                  
                  return (
                    <div key={benchCode} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium w-24">{benchCode}</span>
                        <div className="flex gap-1">
                          {benchRuns.map((run, i) => (
                            <div
                              key={i}
                              className={`w-3 h-6 rounded-sm ${getConfidenceLevelColor(run.confidence_level)}`}
                              title={`${run.run_date}: ${run.confidence_score}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Avg: {avgScore}</span>
                        {trend !== 0 && (
                          <div className={`flex items-center gap-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            <span className="text-xs">{Math.abs(trend)}</span>
                          </div>
                        )}
                        <Badge className={getConfidenceLevelColor(latestRun.confidence_level)}>
                          {latestRun.confidence_level}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                No confidence data available yet
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Confidence Runs</CardTitle>
          <CardDescription>Latest parsing confidence evaluations</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-80">
            {runs && runs.length > 0 ? (
              <div className="space-y-3">
                {runs.map((run) => (
                  <div 
                    key={run.id} 
                    className={`p-3 rounded-lg border ${
                      run.warning_issued ? 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{run.bench_code}</span>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(run.run_date), 'MMM d, yyyy')}
                        </span>
                        {run.warning_issued && (
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        )}
                      </div>
                      <Badge className={getConfidenceLevelColor(run.confidence_level)}>
                        {run.confidence_score} — {run.confidence_level}
                      </Badge>
                    </div>
                    
                    {/* Component Scores */}
                    <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Ingestion</span>
                        <Progress value={(run.ingestion_integrity_score || 0) / 40 * 100} className="h-1 mt-1" />
                        <span className="font-medium">{run.ingestion_integrity_score}/40</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Parsing</span>
                        <Progress value={(run.parsing_stability_score || 0) / 30 * 100} className="h-1 mt-1" />
                        <span className="font-medium">{run.parsing_stability_score}/30</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Matching</span>
                        <Progress value={(run.matching_reliability_score || 0) / 20 * 100} className="h-1 mt-1" />
                        <span className="font-medium">{run.matching_reliability_score}/20</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Historical</span>
                        <Progress value={(run.historical_consistency_score || 0) / 10 * 100} className="h-1 mt-1" />
                        <span className="font-medium">{run.historical_consistency_score}/10</span>
                      </div>
                    </div>
                    
                    {/* Reasons */}
                    {run.confidence_reasons && run.confidence_reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {run.confidence_reasons.map((reason, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {CONFIDENCE_REASONS[reason as keyof typeof CONFIDENCE_REASONS] || reason}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Metrics */}
                    <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                      <span>Detected: {run.total_cases_detected}</span>
                      <span>Parsed: {run.total_cases_parsed}</span>
                      <span>Matched: {run.total_cases_matched}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No confidence runs recorded yet
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
