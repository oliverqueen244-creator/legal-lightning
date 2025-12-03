import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DocketItem } from '@/types/database';

export function useDocket() {
  return useQuery({
    queryKey: ['docket'],
    queryFn: async () => {
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
