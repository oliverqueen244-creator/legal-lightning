import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DocketItem } from '@/types/database';
import { useAuth } from './useAuth';

export function useDocket() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['docket', user?.id],
    queryFn: async () => {
      // First try to get items matched to the current user
      if (user?.id) {
        const { data: matchedData, error: matchedError } = await supabase
          .from('daily_court_docket')
          .select('*')
          .eq('date', new Date().toISOString().split('T')[0])
          .eq('matched_profile_id', user.id)
          .order('list_type', { ascending: false })
          .order('item_no', { ascending: true });

        if (!matchedError && matchedData && matchedData.length > 0) {
          return matchedData as DocketItem[];
        }
      }

      // Fallback: get all items for today (demo mode)
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('date', new Date().toISOString().split('T')[0])
        .order('list_type', { ascending: false })
        .order('item_no', { ascending: true });

      if (error) throw error;
      return data as DocketItem[];
    },
  });
}

export function useDocketItem(id: string) {
  return useQuery({
    queryKey: ['docket', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as DocketItem;
    },
    enabled: !!id,
  });
}
