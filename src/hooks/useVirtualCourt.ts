import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInternPermissions } from '@/hooks/useInternPermissions';
import { format } from 'date-fns';

interface VCData {
  vc_provider: 'webex' | null;
  vc_meeting_id: string | null;
  vc_join_url: string | null;
  vc_confidence: number | null;
  vc_extracted_at: string | null;
}

export interface VCResult {
  data: VCData | null;
  isValid: boolean;
  reason: string | null;
  /** True if VC data exists but is stale (from previous date) */
  isStale: boolean;
}

const CONFIDENCE_THRESHOLD = 50;

/**
 * Hook to get Virtual Court data for a specific court on today's date.
 * 
 * CANONICAL RULE: VC link is identified by (court_id + listing_date)
 * All cases in the same court on the same date use the same VC link.
 * 
 * Only returns valid data if:
 * 1. docket.date = today (date-bound freshness)
 * 2. vc_confidence >= threshold
 * 3. vc_join_url exists
 * 
 * NEVER falls back to previous dates or cached values without date match.
 */
export function useVirtualCourt(
  courtLocation: string | undefined,
  courtRoomNo: string | undefined
): {
  vcData: VCResult;
  isLoading: boolean;
  logClick: () => void;
} {
  const { user, role } = useAuth();
  const internPermissions = useInternPermissions();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['virtual-court', courtLocation, courtRoomNo, today],
    queryFn: async (): Promise<VCData | null> => {
      if (!courtLocation || !courtRoomNo) return null;

      // SAFETY: Block intern access to VC data entirely
      if (internPermissions.isIntern && !internPermissions.canAccessVirtualCourt) {
        return null;
      }

      // Fetch VC data from any docket entry for this court/date
      // CANONICAL: All entries for a court on the same date share the same VC link
      const { data: docketEntry, error } = await supabase
        .from('daily_court_docket')
        .select('vc_provider, vc_meeting_id, vc_join_url, vc_confidence, vc_extracted_at')
        .eq('court_location', courtLocation)
        .eq('court_room_no', courtRoomNo)
        .eq('date', today) // FRESHNESS: Only today's date
        .not('vc_meeting_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[useVirtualCourt] Error fetching VC data:', error);
        return null;
      }

      return docketEntry as VCData | null;
    },
    enabled: !!courtLocation && !!courtRoomNo && !(internPermissions.isIntern && !internPermissions.canAccessVirtualCourt),
    staleTime: 5 * 60 * 1000, // 5 minutes - cache within session only
    refetchOnWindowFocus: false,
    // SAFETY: Don't cache beyond session (gcTime handles cleanup)
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Validate VC data with explicit stale detection
  const vcData: VCResult = (() => {
    // SAFETY: Block intern access
    if (internPermissions.isIntern && !internPermissions.canAccessVirtualCourt) {
      return { data: null, isValid: false, reason: 'Access restricted', isStale: false };
    }

    if (!data) {
      return { data: null, isValid: false, reason: 'Virtual court link not verified for today', isStale: false };
    }

    if (!data.vc_join_url || !data.vc_meeting_id) {
      return { data: null, isValid: false, reason: 'Virtual court link not verified for today', isStale: false };
    }

    // FRESHNESS: The query already filters by date = today, so if we have data it's fresh
    // No silent fallbacks - data is either today's or nothing

    // Check confidence threshold
    if (data.vc_confidence !== null && data.vc_confidence < CONFIDENCE_THRESHOLD) {
      return { data: null, isValid: false, reason: 'VC data confidence too low', isStale: false };
    }

    return { data, isValid: true, reason: null, isStale: false };
  })();

  // Mutation to log VC clicks for beta monitoring
  const logClickMutation = useMutation({
    mutationFn: async () => {
      // SAFETY: Block intern click logging
      if (!user?.id || !data?.vc_meeting_id || !courtLocation || !courtRoomNo || internPermissions.isIntern) {
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
 * Hook to get VC data for a specific docket item.
 * 
 * CANONICAL RULE: Resolves VC via court + date binding.
 * Shows button only if VC link is valid for today.
 */
export function useDocketVC(docketId: string | undefined): {
  vcData: VCResult;
  isLoading: boolean;
} {
  const internPermissions = useInternPermissions();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['docket-vc', docketId],
    queryFn: async (): Promise<(VCData & { date: string }) | null> => {
      if (!docketId) return null;

      // SAFETY: Block intern access
      if (internPermissions.isIntern && !internPermissions.canAccessVirtualCourt) {
        return null;
      }

      const { data: docketEntry, error } = await supabase
        .from('daily_court_docket')
        .select('vc_provider, vc_meeting_id, vc_join_url, vc_confidence, vc_extracted_at, date')
        .eq('id', docketId)
        .single();

      if (error || !docketEntry) {
        return null;
      }

      // FRESHNESS: Only return if it's today's docket
      // NO SILENT FALLBACK to previous dates
      if (docketEntry.date !== today) {
        return null;
      }

      return docketEntry as VCData & { date: string };
    },
    enabled: !!docketId && !(internPermissions.isIntern && !internPermissions.canAccessVirtualCourt),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const vcData: VCResult = (() => {
    // SAFETY: Block intern access
    if (internPermissions.isIntern && !internPermissions.canAccessVirtualCourt) {
      return { data: null, isValid: false, reason: 'Access restricted', isStale: false };
    }

    if (!data) {
      return { data: null, isValid: false, reason: 'Virtual court link not verified for today', isStale: false };
    }

    if (!data.vc_join_url || !data.vc_meeting_id) {
      return { data: null, isValid: false, reason: 'Virtual court link not verified for today', isStale: false };
    }

    // FRESHNESS: Already verified date = today in query

    if (data.vc_confidence !== null && data.vc_confidence < CONFIDENCE_THRESHOLD) {
      return { data: null, isValid: false, reason: 'VC data confidence too low', isStale: false };
    }

    return { data, isValid: true, reason: null, isStale: false };
  })();

  return { vcData, isLoading };
}
