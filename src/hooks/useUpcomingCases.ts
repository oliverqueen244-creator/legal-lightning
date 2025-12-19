import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DocketItem } from '@/types/database';
import { useAuth } from './useAuth';

export function useUpcomingCases() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['upcoming-cases', user?.id],
    queryFn: async () => {
      // Get cases with dates after today
      if (user?.id) {
        const { data: matchedData, error: matchedError } = await supabase
          .from('daily_court_docket')
          .select('*')
          .gt('date', today)
          .eq('matched_profile_id', user.id)
          .order('date', { ascending: true })
          .order('item_no', { ascending: true });

        if (!matchedError && matchedData && matchedData.length > 0) {
          return matchedData as DocketItem[];
        }
      }

      // Fallback: get all upcoming items (demo mode)
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .gt('date', today)
        .order('date', { ascending: true })
        .order('item_no', { ascending: true })
        .limit(50);

      if (error) throw error;
      return data as DocketItem[];
    },
  });
}
