import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface VCData {
  vc_provider: 'webex' | null;
  vc_meeting_id: string | null;
  vc_join_url: string | null;
  vc_confidence: number | null;
  vc_extracted_at: string | null;
}

interface VCResult {
  data: VCData | null;
  isValid: boolean;
  reason: string | null;
}

const CONFIDENCE_THRESHOLD = 50;

/**
 * Hook to get Virtual Court data for a specific court on today's date.
 * Only returns valid data if:
 * 1. vc_extracted_at is today
 * 2. vc_confidence >= threshold
 * 3. vc_join_url exists
 */
export function useVirtualCourt(
  courtLocation: string | undefined,
  courtRoomNo: string | undefined
): {
  vcData: VCResult;
  isLoading: boolean;
  logClick: () => void;
} {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['virtual-court', courtLocation, courtRoomNo, today],
    queryFn: async (): Promise<VCData | null> => {
      if (!courtLocation || !courtRoomNo) return null;

      // Fetch VC data from any docket entry for this court/date
      // (all entries for a court should have same VC data)
      const { data: docketEntry, error } = await supabase
        .from('daily_court_docket')
        .select('vc_provider, vc_meeting_id, vc_join_url, vc_confidence, vc_extracted_at')
        .eq('court_location', courtLocation)
        .eq('court_room_no', courtRoomNo)
        .eq('date', today)
        .not('vc_meeting_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[useVirtualCourt] Error fetching VC data:', error);
        return null;
      }

      return docketEntry as VCData | null;
    },
    enabled: !!courtLocation && !!courtRoomNo,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Validate VC data
  const vcData: VCResult = (() => {
    if (!data) {
      return { data: null, isValid: false, reason: 'VC details not published' };
    }

    if (!data.vc_join_url || !data.vc_meeting_id) {
      return { data: null, isValid: false, reason: 'VC details not published' };
    }

    // Note: vc_extracted_at is NOT checked against today's date because
    // causelists are often published the evening before. The query already
    // filters by docket date = today, which is the correct freshness check.

    // Check confidence threshold
    if (data.vc_confidence !== null && data.vc_confidence < CONFIDENCE_THRESHOLD) {
      return { data: null, isValid: false, reason: 'VC data confidence too low' };
    }

    return { data, isValid: true, reason: null };
  })();

  // Mutation to log VC clicks for beta monitoring
  const logClickMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !data?.vc_meeting_id || !courtLocation || !courtRoomNo) {
        return;
      }

      // Get any docket ID for this court (for reference)
      const { data: docketEntry } = await supabase
        .from('daily_court_docket')
        .select('id')
        .eq('court_location', courtLocation)
        .eq('court_room_no', courtRoomNo)
        .eq('date', today)
        .limit(1)
        .maybeSingle();

      await supabase.from('vc_click_events').insert({
        user_id: user.id,
        docket_id: docketEntry?.id || null,
        vc_meeting_id: data.vc_meeting_id,
        court_location: courtLocation,
        court_room_no: courtRoomNo,
        click_date: today,
      });
    },
  });

  return {
    vcData,
    isLoading,
    logClick: logClickMutation.mutate,
  };
}

/**
 * Hook to get VC data for a specific docket item
 */
export function useDocketVC(docketId: string | undefined): {
  vcData: VCResult;
  isLoading: boolean;
} {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['docket-vc', docketId],
    queryFn: async (): Promise<VCData | null> => {
      if (!docketId) return null;

      const { data: docketEntry, error } = await supabase
        .from('daily_court_docket')
        .select('vc_provider, vc_meeting_id, vc_join_url, vc_confidence, vc_extracted_at, date')
        .eq('id', docketId)
        .single();

      if (error || !docketEntry) {
        return null;
      }

      // Only return if it's today's docket
      if (docketEntry.date !== today) {
        return null;
      }

      return docketEntry as VCData | null;
    },
    enabled: !!docketId,
    staleTime: 5 * 60 * 1000,
  });

  const vcData: VCResult = (() => {
    if (!data) {
      return { data: null, isValid: false, reason: 'VC details not published' };
    }

    if (!data.vc_join_url || !data.vc_meeting_id) {
      return { data: null, isValid: false, reason: 'VC details not published' };
    }

    // Note: vc_extracted_at is NOT checked - causelist published evening before is valid

    if (data.vc_confidence !== null && data.vc_confidence < CONFIDENCE_THRESHOLD) {
      return { data: null, isValid: false, reason: 'VC data confidence too low' };
    }

    return { data, isValid: true, reason: null };
  })();

  return { vcData, isLoading };
}
