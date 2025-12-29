import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface CourtOverride {
  id: string;
  court_location: string;
  court_no: string;
  override_date: string;
  from_serial: number | null;
  to_serial: number | null;
  new_judge: string | null;
  override_type: string;
  is_active: boolean;
  created_at: string;
}

export function useCourtOverrides(courtLocation?: string, courtNo?: string) {
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['court-overrides', courtLocation, courtNo, today],
    queryFn: async () => {
      let query = supabase
        .from('court_overrides')
        .select('*')
        .eq('override_date', today)
        .eq('is_active', true);

      if (courtLocation) {
        query = query.eq('court_location', courtLocation);
      }

      if (courtNo) {
        query = query.eq('court_no', courtNo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useCourtOverrides] Error:', error);
        throw error;
      }

      return (data || []) as CourtOverride[];
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    enabled: !!courtLocation
  });
}

// Helper to find if a specific item number has a judge override
export function findOverrideForItem(
  overrides: CourtOverride[],
  courtNo: string,
  itemNo: number
): CourtOverride | undefined {
  return overrides.find(o => 
    o.court_no === courtNo && 
    (o.from_serial === null || itemNo >= o.from_serial) &&
    (o.to_serial === null || itemNo <= o.to_serial)
  );
}
