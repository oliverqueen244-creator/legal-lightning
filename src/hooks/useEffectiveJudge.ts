import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCourtOverrides, findOverrideForItem } from './useCourtOverrides';

export interface EffectiveJudgeResult {
  judgeName: string | null;
  source: 'override' | 'metadata' | 'docket' | null;
  isOverride: boolean;
  overrideType?: string;
  lastUpdated: string | null;
  isLoading: boolean;
}

interface UseEffectiveJudgeParams {
  courtLocation?: string | null;
  courtNo?: string | null;
  itemNo?: number | null;
  fallbackJudgeName?: string | null;
}

/**
 * Dynamically resolves the effective judge for a court/item combination.
 * Priority: court_overrides > court_metadata > fallbackJudgeName (from docket)
 * Auto-refreshes every 5 minutes.
 */
export function useEffectiveJudge({
  courtLocation,
  courtNo,
  itemNo,
  fallbackJudgeName
}: UseEffectiveJudgeParams): EffectiveJudgeResult {
  // Query 1: Check for active court overrides
  const { data: overrides = [], isLoading: overridesLoading } = useCourtOverrides(
    courtLocation || undefined, 
    courtNo || undefined
  );
  
  // Query 2: Fetch court metadata as fallback
  const { data: courtMetadata, isLoading: metadataLoading } = useQuery({
    queryKey: ['court-metadata-judge', courtLocation, courtNo],
    queryFn: async () => {
      if (!courtLocation || !courtNo) return null;
      
      const { data, error } = await supabase
        .from('court_metadata')
        .select('sitting_judges, last_updated')
        .eq('bench', courtLocation)
        .eq('court_no', courtNo)
        .maybeSingle();
      
      if (error) {
        console.error('[useEffectiveJudge] Error fetching court metadata:', error);
        return null;
      }
      
      return data;
    },
    staleTime: 60 * 1000,           // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes auto-refresh
    enabled: !!courtLocation && !!courtNo
  });

  const isLoading = overridesLoading || metadataLoading;

  // Priority 1: Check if there's an override for this item number
  if (itemNo && overrides.length > 0) {
    const activeOverride = findOverrideForItem(overrides, courtNo || '', itemNo);
    
    if (activeOverride?.new_judge) {
      return {
        judgeName: activeOverride.new_judge,
        source: 'override',
        isOverride: true,
        overrideType: activeOverride.override_type,
        lastUpdated: activeOverride.created_at,
        isLoading
      };
    }
  }

  // Priority 2: Use court metadata
  if (courtMetadata?.sitting_judges) {
    return {
      judgeName: courtMetadata.sitting_judges,
      source: 'metadata',
      isOverride: false,
      lastUpdated: courtMetadata.last_updated,
      isLoading
    };
  }

  // Priority 3: Use fallback (docket.judge_names)
  return {
    judgeName: fallbackJudgeName || null,
    source: fallbackJudgeName ? 'docket' : null,
    isOverride: false,
    lastUpdated: null,
    isLoading
  };
}

/**
 * Batch hook for resolving judges for multiple courts at once.
 * Useful for Dashboard/DocketCard lists to avoid N+1 queries.
 */
export function useEffectiveJudgesForCourts(
  courts: Array<{ courtLocation: string; courtNo: string; itemNo?: number; fallbackJudgeName?: string | null }>
): { judges: Map<string, EffectiveJudgeResult>; isLoading: boolean } {
  // Get unique court locations for metadata query
  const uniqueLocations = [...new Set(courts.map(c => c.courtLocation))];
  
  // Fetch all court metadata for the locations
  const { data: allMetadata, isLoading: metadataLoading } = useQuery({
    queryKey: ['court-metadata-batch', uniqueLocations.join(',')],
    queryFn: async () => {
      if (uniqueLocations.length === 0) return [];
      
      const { data, error } = await supabase
        .from('court_metadata')
        .select('bench, court_no, sitting_judges, last_updated')
        .in('bench', uniqueLocations);
      
      if (error) {
        console.error('[useEffectiveJudgesForCourts] Error:', error);
        return [];
      }
      
      return data || [];
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: uniqueLocations.length > 0
  });

  // Fetch all overrides for the locations
  const { data: allOverrides, isLoading: overridesLoading } = useCourtOverrides(
    uniqueLocations[0] // Note: useCourtOverrides only supports single location currently
  );

  const isLoading = metadataLoading || overridesLoading;

  // Build the map
  const judges = new Map<string, EffectiveJudgeResult>();
  
  for (const court of courts) {
    const key = `${court.courtLocation}-${court.courtNo}`;
    
    // Check for override
    if (court.itemNo && allOverrides && allOverrides.length > 0) {
      const override = findOverrideForItem(allOverrides, court.courtNo, court.itemNo);
      if (override?.new_judge) {
        judges.set(key, {
          judgeName: override.new_judge,
          source: 'override',
          isOverride: true,
          overrideType: override.override_type,
          lastUpdated: override.created_at,
          isLoading
        });
        continue;
      }
    }
    
    // Check metadata
    const metadata = allMetadata?.find(
      m => m.bench === court.courtLocation && m.court_no === court.courtNo
    );
    
    if (metadata?.sitting_judges) {
      judges.set(key, {
        judgeName: metadata.sitting_judges,
        source: 'metadata',
        isOverride: false,
        lastUpdated: metadata.last_updated,
        isLoading
      });
      continue;
    }
    
    // Fallback
    judges.set(key, {
      judgeName: court.fallbackJudgeName || null,
      source: court.fallbackJudgeName ? 'docket' : null,
      isOverride: false,
      lastUpdated: null,
      isLoading
    });
  }

  return { judges, isLoading };
}
