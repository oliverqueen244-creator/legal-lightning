import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DocketItem } from '@/types/database';
import { useAuth } from './useAuth';

// PHASE 0.3: Stale time for upcoming cases
const UPCOMING_STALE_TIME = 60_000; // 60 seconds

export function useUpcomingCases() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['upcoming-cases', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as DocketItem[];
      
      // Only get user's matched cases - no demo mode fallback
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .gt('date', today)
        .eq('matched_profile_id', user.id)
        .order('date', { ascending: true })
        .order('item_no', { ascending: true });

      if (error) throw error;
      return (data || []) as DocketItem[];
    },
    staleTime: UPCOMING_STALE_TIME,
    enabled: !!user?.id,
  });
}
