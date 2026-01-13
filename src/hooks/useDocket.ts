import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DocketItem, CaseContext } from '@/types/database';
import { useAuth } from './useAuth';

// PHASE 0.3: Stale time to reduce refetch noise on mount/focus
const DOCKET_STALE_TIME = 30_000; // 30 seconds

/**
 * Legacy docket hook - fetches all cases for the user (personal + chamber visible)
 * 
 * CP-4 Note: This hook now respects RLS policies which handle:
 * - Personal cases where matched_profile_id = user
 * - Chamber cases where user is a member/owner
 */
export function useDocket(date?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const query = useQuery({
    queryKey: ['docket', user?.id, targetDate],
    queryFn: async () => {
      if (!user?.id) return [] as DocketItem[];
      
      // Explicitly filter by matched_profile_id to prevent seeing unmatched cases
      // RLS provides secondary protection, but frontend filter is primary defense
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*, hearing_likelihood, likelihood_reason, likelihood_derived_at, judge_names, petitioner, respondent, petitioner_lawyer, respondent_lawyer, case_context, chamber_id')
        .eq('date', targetDate)
        .eq('matched_profile_id', user.id)
        .order('case_context', { ascending: true }) // personal first
        .order('list_type', { ascending: false })
        .order('item_no', { ascending: true });

      if (error) {
        console.error('[useDocket] Query error:', error);
        return [] as DocketItem[];
      }
      
      return (data || []) as DocketItem[];
    },
    // PHASE 0.3: Don't refetch immediately on mount/focus
    staleTime: DOCKET_STALE_TIME,
    // PHASE 3.1: Add timeout for slow networks
    gcTime: 5 * 60 * 1000, // Keep in garbage collection for 5 min
    enabled: !!user?.id,
  });

  // Subscribe to realtime changes - PHASE 1.2: Granular invalidation
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel(`docket-changes-${targetDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_court_docket',
          filter: `date=eq.${targetDate}`,
        },
        (payload) => {
          // PHASE 1.2: Only invalidate if the change affects user's cases
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          // Invalidate if user's case or any visible case changed
          if (
            newRecord?.matched_profile_id === user.id ||
            oldRecord?.matched_profile_id === user.id ||
            newRecord?.case_context === 'chamber' ||
            oldRecord?.case_context === 'chamber'
          ) {
            queryClient.invalidateQueries({ 
              queryKey: ['docket', user.id, targetDate] 
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, targetDate, user?.id]);

  return query;
}

export function useDocketItem(id: string) {
  return useQuery({
    queryKey: ['docket-item', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*, case_context, chamber_id')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as DocketItem | null;
    },
    enabled: !!id,
    staleTime: DOCKET_STALE_TIME,
  });
}

/**
 * CP-4: Filter docket items by case context
 */
export function filterByContext(items: DocketItem[], context: CaseContext): DocketItem[] {
  return items.filter(item => item.case_context === context);
}
