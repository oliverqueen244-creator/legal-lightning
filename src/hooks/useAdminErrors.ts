import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ErrorSeverity, ErrorDomain } from '@/lib/errorReporting';

export interface AdminErrorEvent {
  id: string;
  created_at: string;
  user_id: string | null;
  role: string | null;
  route: string | null;
  severity: ErrorSeverity;
  domain: ErrorDomain;
  error_code: string;
  message: string;
  environment: string;
  is_online: boolean | null;
  app_version: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  batch_id: string | null;
  bench_code: string | null;
  resolved: boolean;
  admin_note: string | null;
}

export interface ErrorSummary {
  error_code: string;
  severity: ErrorSeverity;
  domain: ErrorDomain;
  count: number;
  last_seen: string;
  affected_benches: string[];
  environments: string[];
  unresolved_count: number;
}

export interface ParsingHealthStats {
  total_events: number;
  p0_count: number;
  p1_count: number;
  p2_count: number;
  resolved_count: number;
  parsing_errors: number;
  matching_errors: number;
  ingestion_errors: number;
  top_error_codes: { error_code: string; count: number }[];
  top_benches: { bench_code: string; count: number }[];
  zero_match_days: number;
}

interface UseAdminErrorsFilters {
  severity?: ErrorSeverity;
  domain?: ErrorDomain;
  unresolvedOnly?: boolean;
  startDate?: string;
  endDate?: string;
}

export function useAdminErrors(filters: UseAdminErrorsFilters = {}) {
  return useQuery({
    queryKey: ['admin-errors', filters],
    queryFn: async () => {
      let query = supabase
        .from('admin_error_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (filters.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters.domain) {
        query = query.eq('domain', filters.domain);
      }
      if (filters.unresolvedOnly) {
        query = query.eq('resolved', false);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as AdminErrorEvent[];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Auto-refresh every minute
  });
}

export function useErrorSummary(filters: UseAdminErrorsFilters = {}) {
  return useQuery({
    queryKey: ['admin-error-summary', filters],
    queryFn: async () => {
      let query = supabase
        .from('admin_error_events')
        .select('error_code, severity, domain, environment, bench_code, resolved, created_at');
      
      if (filters.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters.domain) {
        query = query.eq('domain', filters.domain);
      }
      if (filters.unresolvedOnly) {
        query = query.eq('resolved', false);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Group by error_code
      const grouped = (data || []).reduce((acc, event) => {
        const key = event.error_code;
        if (!acc[key]) {
          acc[key] = {
            error_code: event.error_code,
            severity: event.severity,
            domain: event.domain,
            count: 0,
            last_seen: event.created_at,
            affected_benches: new Set<string>(),
            environments: new Set<string>(),
            unresolved_count: 0,
          };
        }
        acc[key].count++;
        if (!event.resolved) acc[key].unresolved_count++;
        if (event.bench_code) acc[key].affected_benches.add(event.bench_code);
        if (event.environment) acc[key].environments.add(event.environment);
        if (event.created_at > acc[key].last_seen) {
          acc[key].last_seen = event.created_at;
        }
        return acc;
      }, {} as Record<string, any>);
      
      // Convert sets to arrays and sort by count
      const summaries: ErrorSummary[] = Object.values(grouped)
        .map((g: any) => ({
          ...g,
          affected_benches: Array.from(g.affected_benches),
          environments: Array.from(g.environments),
        }))
        .sort((a, b) => b.count - a.count);
      
      return summaries;
    },
    staleTime: 30000,
  });
}

export function useParsingHealth() {
  return useQuery({
    queryKey: ['parsing-health'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from('admin_error_events')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString());
      
      if (error) throw error;
      
      const events = data || [];
      
      // Calculate stats
      const stats: ParsingHealthStats = {
        total_events: events.length,
        p0_count: events.filter(e => e.severity === 'P0').length,
        p1_count: events.filter(e => e.severity === 'P1').length,
        p2_count: events.filter(e => e.severity === 'P2').length,
        resolved_count: events.filter(e => e.resolved).length,
        parsing_errors: events.filter(e => e.domain === 'CAUSELIST_PARSING').length,
        matching_errors: events.filter(e => e.domain === 'CASE_MATCHING').length,
        ingestion_errors: events.filter(e => e.domain === 'INGESTION').length,
        top_error_codes: [],
        top_benches: [],
        zero_match_days: events.filter(e => e.error_code === 'ZERO_MATCH_DAY').length,
      };
      
      // Top error codes
      const codeCounts = events.reduce((acc, e) => {
        acc[e.error_code] = (acc[e.error_code] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      stats.top_error_codes = Object.entries(codeCounts)
        .map(([error_code, count]) => ({ error_code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      // Top benches
      const benchCounts = events.reduce((acc, e) => {
        if (e.bench_code) {
          acc[e.bench_code] = (acc[e.bench_code] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      stats.top_benches = Object.entries(benchCounts)
        .map(([bench_code, count]) => ({ bench_code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      return stats;
    },
    staleTime: 60000,
  });
}

export function useResolveError() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ errorId, adminNote }: { errorId: string; adminNote?: string }) => {
      const { error } = await supabase
        .from('admin_error_events')
        .update({ 
          resolved: true, 
          admin_note: adminNote || null 
        })
        .eq('id', errorId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-errors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-error-summary'] });
      queryClient.invalidateQueries({ queryKey: ['parsing-health'] });
    },
  });
}

export function useBulkResolve() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ errorCode, adminNote }: { errorCode: string; adminNote?: string }) => {
      const { error } = await supabase
        .from('admin_error_events')
        .update({ 
          resolved: true, 
          admin_note: adminNote || null 
        })
        .eq('error_code', errorCode)
        .eq('resolved', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-errors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-error-summary'] });
      queryClient.invalidateQueries({ queryKey: ['parsing-health'] });
    },
  });
}
