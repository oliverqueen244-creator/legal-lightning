import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DocketItem } from '@/types/database';
import { useAuth } from './useAuth';

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
          .select('*, hearing_likelihood, likelihood_reason, likelihood_derived_at')
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
  });
  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('docket-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_court_docket',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['docket'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useDocketItem(id: string) {
  return useQuery({
    queryKey: ['docket', id],
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
  });
}
