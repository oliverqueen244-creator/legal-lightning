import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FallbackLogEntry {
  id: string;
  batch_id: string;
  bench_code: string;
  fallback_level: 'primary' | 'fallback_1_lenient' | 'fallback_2_section' | 'fallback_3_historical';
  triggered_reason: string;
  cases_before: number;
  cases_after: number;
  confidence_before: number;
  confidence_after: number;
  applied_at: string;
  parse_duration_ms: number | null;
  created_at: string;
}

export interface FallbackSummary {
  fallback_date: string;
  bench_code: string;
  fallback_level: string;
  attempt_count: number;
  avg_confidence_delta: number;
  improvement_count: number;
  total_cases_recovered: number;
  last_attempt: string;
}

export interface DisabledBench {
  bench_code: string;
  disabled_at: string;
  disabled_by: string | null;
  reason: string | null;
}

/**
 * Hook to fetch fallback logs (admin only)
 */
export function useFallbackLogs(options?: { 
  benchCode?: string; 
  limit?: number;
  daysBack?: number;
}) {
  return useQuery({
    queryKey: ['fallback-logs', options],
    queryFn: async () => {
      let query = supabase
        .from('parser_fallback_log')
        .select('*')
        .order('applied_at', { ascending: false })
        .limit(options?.limit || 100);

      if (options?.benchCode) {
        query = query.eq('bench_code', options.benchCode);
      }

      if (options?.daysBack) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - options.daysBack);
        query = query.gte('applied_at', cutoff.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FallbackLogEntry[];
    },
    staleTime: 30000,
  });
}

/**
 * Hook to fetch fallback summary stats (admin only)
 */
export function useFallbackSummary() {
  return useQuery({
    queryKey: ['fallback-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fallback_summary_view')
        .select('*')
        .order('fallback_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as FallbackSummary[];
    },
    staleTime: 60000,
  });
}

/**
 * Hook to fetch disabled benches (admin only)
 */
export function useDisabledBenches() {
  return useQuery({
    queryKey: ['disabled-benches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fallback_disabled_benches')
        .select('*')
        .order('disabled_at', { ascending: false });

      if (error) throw error;
      return data as DisabledBench[];
    },
    staleTime: 30000,
  });
}

/**
 * Hook to disable fallback for a bench (admin only)
 */
export function useDisableFallback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ benchCode, reason }: { benchCode: string; reason?: string }) => {
      const { error } = await supabase
        .from('fallback_disabled_benches')
        .insert({
          bench_code: benchCode,
          reason,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disabled-benches'] });
    },
  });
}

/**
 * Hook to enable fallback for a bench (admin only)
 */
export function useEnableFallback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (benchCode: string) => {
      const { error } = await supabase
        .from('fallback_disabled_benches')
        .delete()
        .eq('bench_code', benchCode);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disabled-benches'] });
    },
  });
}

/**
 * Get fallback stats for a specific batch
 */
export function useBatchFallbackStats(batchId?: string) {
  return useQuery({
    queryKey: ['batch-fallback-stats', batchId],
    queryFn: async () => {
      if (!batchId) return null;

      const { data, error } = await supabase
        .from('parser_fallback_log')
        .select('*')
        .eq('batch_id', batchId)
        .order('applied_at', { ascending: true });

      if (error) throw error;
      
      if (!data || data.length === 0) return null;

      // Calculate aggregate stats
      const logs = data as FallbackLogEntry[];
      const totalCasesRecovered = logs.reduce(
        (sum, log) => sum + (log.cases_after - log.cases_before),
        0
      );
      const avgConfidenceDelta = logs.reduce(
        (sum, log) => sum + (log.confidence_after - log.confidence_before),
        0
      ) / logs.length;
      const highestLevel = logs.reduce(
        (highest, log) => {
          const levelOrder = ['primary', 'fallback_1_lenient', 'fallback_2_section', 'fallback_3_historical'];
          const currentIndex = levelOrder.indexOf(log.fallback_level);
          const highestIndex = levelOrder.indexOf(highest);
          return currentIndex > highestIndex ? log.fallback_level : highest;
        },
        'primary' as FallbackLogEntry['fallback_level']
      );

      return {
        logs,
        totalCasesRecovered,
        avgConfidenceDelta,
        highestLevel,
        attemptCount: logs.length,
      };
    },
    enabled: !!batchId,
    staleTime: 60000,
  });
}
