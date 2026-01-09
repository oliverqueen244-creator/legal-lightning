import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DocketItem } from '@/types/database';
import { useAuth } from './useAuth';

// PHASE 0.3: Stale time to reduce refetch noise on mount/focus
const DOCKET_STALE_TIME = 30_000; // 30 seconds

export function useDocket(date?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const query = useQuery({
    queryKey: ['docket', user?.id, targetDate],
    queryFn: async () => {
      // First try to get items matched to the current user
      if (user?.id) {
        const { data: matchedData, error: matchedError } = await supabase
          .from('daily_court_docket')
          .select('*, hearing_likelihood, likelihood_reason, likelihood_derived_at, judge_names, petitioner, respondent, petitioner_lawyer, respondent_lawyer')
          .eq('date', targetDate)
          .eq('matched_profile_id', user.id)
          .order('list_type', { ascending: false })
          .order('item_no', { ascending: true });

        if (!matchedError && matchedData && matchedData.length > 0) {
          return matchedData as DocketItem[];
        }
      }

      // No demo mode - only show user's own matched cases
      // Return empty array if no matches found
      return [] as DocketItem[];
    },
    // PHASE 0.3: Don't refetch immediately on mount/focus
    staleTime: DOCKET_STALE_TIME,
    // PHASE 3.1: Add timeout for slow networks
    gcTime: 5 * 60 * 1000, // Keep in garbage collection for 5 min
  });

  // Subscribe to realtime changes - PHASE 1.2: Granular invalidation
  useEffect(() => {
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
          
          if (user?.id) {
            // Only invalidate if the change is for user's matched cases
            if (
              newRecord?.matched_profile_id === user.id ||
              oldRecord?.matched_profile_id === user.id
            ) {
              queryClient.invalidateQueries({ 
                queryKey: ['docket', user.id, targetDate] 
              });
            }
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
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as DocketItem | null;
    },
    enabled: !!id,
    staleTime: DOCKET_STALE_TIME,
  });
}
