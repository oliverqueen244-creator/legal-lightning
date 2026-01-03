import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Confidence reason codes
export const CONFIDENCE_REASONS = {
  FORMAT_CHANGE: 'Format change detected in causelist structure',
  ZERO_MATCH: 'No cases matched to any lawyer aliases',
  HIGH_PARSE_ERROR_RATE: 'Parsing errors exceeded threshold',
  UNUSUAL_DROP: 'Significant drop from historical average',
  HIGH_INGESTION_ERRORS: 'Multiple ingestion failures',
  HIGH_MATCHING_ERRORS: 'Matching reliability degraded',
  MISSING_BENCH: 'Expected bench data missing',
  PARTIAL_PARSE: 'Not all detected cases were parsed',
  NEW_PATTERN: 'Unrecognized causelist pattern encountered',
} as const;

export type ConfidenceReason = keyof typeof CONFIDENCE_REASONS;

export interface ConfidenceRun {
  id: string;
  created_at: string;
  batch_id: string | null;
  bench_code: string;
  run_date: string;
  total_cases_detected: number;
  total_cases_parsed: number;
  total_cases_matched: number;
  parsing_error_count: number;
  matching_error_count: number;
  ingestion_error_count: number;
  confidence_score: number;
  confidence_level: 'excellent' | 'good' | 'degraded' | 'risky' | 'unsafe';
  confidence_reasons: string[];
  warning_issued: boolean;
  ingestion_integrity_score: number | null;
  parsing_stability_score: number | null;
  matching_reliability_score: number | null;
  historical_consistency_score: number | null;
}

export interface ConfidenceWarning {
  bench_code: string;
  confidence_level: 'excellent' | 'good' | 'degraded' | 'risky' | 'unsafe';
  run_date: string;
}

/**
 * Hook to fetch active confidence warnings for today
 * Used by lawyer-facing components to show subtle warnings
 */
export function useActiveConfidenceWarnings() {
  return useQuery({
    queryKey: ['confidence-warnings-active'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_confidence_warnings');
      if (error) {
        // Fail silently - don't block user
        console.warn('Failed to fetch confidence warnings:', error);
        return [];
      }
      return (data || []) as ConfidenceWarning[];
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
    retry: false, // Don't retry on failure
  });
}

/**
 * Hook to fetch confidence runs (admin only)
 */
export function useConfidenceRuns(options?: { benchCode?: string; limit?: number }) {
  return useQuery({
    queryKey: ['confidence-runs', options],
    queryFn: async () => {
      let query = supabase
        .from('parser_confidence_runs')
        .select('*')
        .order('run_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(options?.limit || 100);

      if (options?.benchCode) {
        query = query.eq('bench_code', options.benchCode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConfidenceRun[];
    },
    staleTime: 30000,
  });
}

/**
 * Hook to fetch confidence trends per bench for the last 7 days (admin only)
 */
export function useConfidenceTrends() {
  return useQuery({
    queryKey: ['confidence-trends'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('parser_confidence_runs')
        .select('bench_code, run_date, confidence_score, confidence_level, warning_issued')
        .gte('run_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('run_date', { ascending: true });

      if (error) throw error;

      // Group by bench_code
      const grouped = (data || []).reduce((acc, run) => {
        if (!acc[run.bench_code]) {
          acc[run.bench_code] = [];
        }
        acc[run.bench_code].push(run);
        return acc;
      }, {} as Record<string, typeof data>);

      return grouped;
    },
    staleTime: 60000,
  });
}

/**
 * Hook to fetch the latest confidence summary stats (admin only)
 */
export function useConfidenceSummary() {
  return useQuery({
    queryKey: ['confidence-summary'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('parser_confidence_runs')
        .select('*')
        .eq('run_date', today);

      if (error) throw error;

      const runs = data || [];
      
      // Calculate summary stats
      const summary = {
        total_benches: runs.length,
        excellent_count: runs.filter(r => r.confidence_level === 'excellent').length,
        good_count: runs.filter(r => r.confidence_level === 'good').length,
        degraded_count: runs.filter(r => r.confidence_level === 'degraded').length,
        risky_count: runs.filter(r => r.confidence_level === 'risky').length,
        unsafe_count: runs.filter(r => r.confidence_level === 'unsafe').length,
        warnings_issued: runs.filter(r => r.warning_issued).length,
        average_score: runs.length > 0 
          ? Math.round(runs.reduce((sum, r) => sum + r.confidence_score, 0) / runs.length)
          : 0,
        lowest_score_bench: runs.length > 0
          ? runs.reduce((lowest, r) => r.confidence_score < lowest.confidence_score ? r : lowest, runs[0])
          : null,
      };

      return summary;
    },
    staleTime: 30000,
  });
}
