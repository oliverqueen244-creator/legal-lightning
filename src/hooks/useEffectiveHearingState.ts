import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { DocketItem } from '@/types/database';

/**
 * STEP 4: EFFECTIVE HEARING STATE
 * 
 * This hook computes an EFFECTIVE HEARING STATE at read-time by:
 * 1. Loading Daily Cause List data
 * 2. Loading Supplementary Cause List data  
 * 3. Applying court_overrides in deterministic order
 * 4. Resolving judge, bench, court, timing, and serial applicability
 * 5. Producing a resolved "what actually happens today" view
 * 
 * This is a VIRTUAL VIEW - it does NOT mutate stored data.
 * Every resolved state is EXPLAINABLE.
 */

export interface EffectiveHearingItem {
  // Original docket data
  id: string;
  case_number: string;
  item_no: number | null;
  court_room_no: string;
  court_location: string;
  date: string;
  petitioner: string | null;
  respondent: string | null;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
  status: string;
  
  // Source tracking (STEP 1: Source Integrity)
  list_type: 'DAILY' | 'SUPPLEMENTARY';
  raw_causelist_id: string | null;
  
  // Derived/Effective state
  effective_judge: string | null;
  judge_source: 'override' | 'supplementary' | 'daily' | 'metadata' | null;
  
  // Override context
  has_override: boolean;
  override_type: string | null;
  override_explanation: string | null;
  
  // Hearing likelihood
  hearing_likelihood: string | null;
  likelihood_reason: string | null;
  
  // Explainability (STEP 7)
  provenance_explanation: string;
}

export interface CourtOverride {
  id: string;
  court_no: string;
  override_type: string;
  from_serial: number | null;
  to_serial: number | null;
  new_judge: string | null;
  is_active: boolean;
}

interface UseEffectiveHearingStateParams {
  courtLocation: string;
  date?: string; // Defaults to today
  courtNo?: string; // Optional filter by court
}

/**
 * Computes the effective hearing state for a court on a given date.
 * This is the single source of truth for "what is actually happening in court today".
 */
export function useEffectiveHearingState({
  courtLocation,
  date,
  courtNo
}: UseEffectiveHearingStateParams) {
  const targetDate = date || format(new Date(), 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['effective-hearing-state', courtLocation, targetDate, courtNo],
    queryFn: async (): Promise<EffectiveHearingItem[]> => {
      // STEP 4.1: Load ALL docket items for the date (DAILY + SUPPLEMENTARY)
      let docketQuery = supabase
        .from('daily_court_docket')
        .select('*')
        .eq('court_location', courtLocation)
        .eq('date', targetDate)
        .order('court_room_no')
        .order('item_no');
      
      if (courtNo) {
        docketQuery = docketQuery.eq('court_room_no', courtNo);
      }
      
      const { data: allDocketItems, error: docketError } = await docketQuery;
      
      if (docketError) {
        console.error('[useEffectiveHearingState] Docket fetch error:', docketError);
        throw docketError;
      }
      
      // STEP 4.3: Load court_overrides for the date
      let overridesQuery = supabase
        .from('court_overrides')
        .select('*')
        .eq('court_location', courtLocation)
        .eq('override_date', targetDate)
        .eq('is_active', true);
      
      if (courtNo) {
        overridesQuery = overridesQuery.eq('court_no', courtNo);
      }
      
      const { data: overrides, error: overridesError } = await overridesQuery;
      
      if (overridesError) {
        console.error('[useEffectiveHearingState] Overrides fetch error:', overridesError);
        // Continue without overrides - don't fail entirely
      }
      
      // STEP 4.4: Load court_metadata for base judge names
      const { data: courtMetadata } = await supabase
        .from('court_metadata')
        .select('court_no, sitting_judges')
        .eq('bench', courtLocation);
      
      const metadataByCourtNo = new Map<string, string>();
      if (courtMetadata) {
        for (const cm of courtMetadata) {
          if (cm.sitting_judges) {
            metadataByCourtNo.set(cm.court_no, cm.sitting_judges);
          }
        }
      }
      
      // STEP 2: Separate DAILY (base) and SUPPLEMENTARY (override) items
      const dailyItems = (allDocketItems || []).filter(d => d.list_type === 'DAILY');
      const suppItems = (allDocketItems || []).filter(d => d.list_type === 'SUPPLEMENTARY');
      
      console.log(`[useEffectiveHearingState] ${dailyItems.length} DAILY + ${suppItems.length} SUPPLEMENTARY items`);
      
      // STEP 4.4: Build effective state for each item
      const effectiveItems: EffectiveHearingItem[] = [];
      
      // Process all items (both DAILY and SUPPLEMENTARY)
      for (const item of allDocketItems || []) {
        const isSupplementary = item.list_type === 'SUPPLEMENTARY';
        const itemNo = item.item_no || 0;
        const courtRoomNo = item.court_room_no || '';
        
        // Find applicable override for this item
        const applicableOverride = findApplicableOverride(
          overrides || [],
          courtRoomNo,
          itemNo
        );
        
        // STEP 4.4: Determine effective judge (priority order)
        let effectiveJudge: string | null = null;
        let judgeSource: 'override' | 'supplementary' | 'daily' | 'metadata' | null = null;
        
        // Priority 1: Court override (from SUPPLEMENTARY notice)
        if (applicableOverride?.new_judge) {
          effectiveJudge = applicableOverride.new_judge;
          judgeSource = 'override';
        }
        // Priority 2: Judge from item record
        else if (item.judge_names) {
          effectiveJudge = item.judge_names;
          judgeSource = isSupplementary ? 'supplementary' : 'daily';
        }
        // Priority 3: Court metadata
        else if (metadataByCourtNo.has(courtRoomNo)) {
          effectiveJudge = metadataByCourtNo.get(courtRoomNo) || null;
          judgeSource = 'metadata';
        }
        
        // STEP 7: Build provenance explanation
        const provenance = buildProvenanceExplanation(
          item,
          isSupplementary,
          applicableOverride,
          judgeSource
        );
        
        effectiveItems.push({
          id: item.id,
          case_number: item.case_number || '',
          item_no: item.item_no,
          court_room_no: courtRoomNo,
          court_location: item.court_location || courtLocation,
          date: item.date,
          petitioner: item.petitioner,
          respondent: item.respondent,
          petitioner_lawyer: item.petitioner_lawyer,
          respondent_lawyer: item.respondent_lawyer,
          status: item.status || 'pending',
          
          // Source tracking
          list_type: isSupplementary ? 'SUPPLEMENTARY' : 'DAILY',
          raw_causelist_id: item.raw_causelist_id,
          
          // Effective state
          effective_judge: effectiveJudge,
          judge_source: judgeSource,
          
          // Override context
          has_override: !!applicableOverride,
          override_type: applicableOverride?.override_type || null,
          override_explanation: applicableOverride 
            ? `Override: ${applicableOverride.override_type} applied to items ${applicableOverride.from_serial || '*'} to ${applicableOverride.to_serial || '*'}`
            : null,
          
          // Hearing likelihood
          hearing_likelihood: item.hearing_likelihood,
          likelihood_reason: item.likelihood_reason,
          
          // Explainability
          provenance_explanation: provenance,
        });
      }
      
      // Sort by court, then by item number
      effectiveItems.sort((a, b) => {
        const courtCompare = (a.court_room_no || '').localeCompare(b.court_room_no || '');
        if (courtCompare !== 0) return courtCompare;
        return (a.item_no || 0) - (b.item_no || 0);
      });
      
      return effectiveItems;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes
    enabled: !!courtLocation
  });
}

/**
 * Find the applicable override for a specific court/item combination.
 * STEP 5: Serial number semantics - supports non-contiguous ranges.
 */
function findApplicableOverride(
  overrides: CourtOverride[],
  courtNo: string,
  itemNo: number
): CourtOverride | null {
  // Filter to matching court
  const courtOverrides = overrides.filter(o => o.court_no === courtNo && o.is_active);
  
  // Check each override's serial range
  for (const override of courtOverrides) {
    const fromSerial = override.from_serial;
    const toSerial = override.to_serial;
    
    // If both are null, applies to entire court
    if (fromSerial === null && toSerial === null) {
      return override;
    }
    
    // Check if item falls within range
    const inRange = (
      (fromSerial === null || itemNo >= fromSerial) &&
      (toSerial === null || itemNo <= toSerial)
    );
    
    if (inRange) {
      return override;
    }
  }
  
  return null;
}

/**
 * STEP 7: Build a plain-English explanation of data provenance.
 */
function buildProvenanceExplanation(
  item: { list_type?: string | null; hearing_likelihood?: string | null },
  isSupplementary: boolean,
  override: CourtOverride | null,
  judgeSource: string | null
): string {
  const parts: string[] = [];
  
  // Source
  if (isSupplementary) {
    parts.push('Listed in SUPPLEMENTARY cause list (runtime override).');
  } else {
    parts.push('Listed in DAILY cause list (base plan).');
  }
  
  // Override
  if (override) {
    parts.push(`Judge override applied: ${override.override_type}.`);
  }
  
  // Judge source
  if (judgeSource === 'override') {
    parts.push('Effective judge from supplementary notice override.');
  } else if (judgeSource === 'metadata') {
    parts.push('Judge from court metadata (no override in effect).');
  } else if (judgeSource === 'supplementary') {
    parts.push('Judge from supplementary cause list record.');
  } else if (judgeSource === 'daily') {
    parts.push('Judge from daily cause list record.');
  }
  
  // Likelihood
  if (item.hearing_likelihood) {
    parts.push(`Hearing likelihood: ${item.hearing_likelihood}.`);
  }
  
  return parts.join(' ');
}

/**
 * Get summary statistics for the effective hearing state.
 * Useful for dashboard widgets.
 */
export function useEffectiveHearingStats({
  courtLocation,
  date
}: { courtLocation: string; date?: string }) {
  const { data: items, isLoading } = useEffectiveHearingState({
    courtLocation,
    date
  });
  
  const stats = {
    total: items?.length || 0,
    dailyCount: items?.filter(i => i.list_type === 'DAILY').length || 0,
    supplementaryCount: items?.filter(i => i.list_type === 'SUPPLEMENTARY').length || 0,
    overrideCount: items?.filter(i => i.has_override).length || 0,
    likelyCount: items?.filter(i => i.hearing_likelihood === 'LIKELY').length || 0,
    conditionalCount: items?.filter(i => i.hearing_likelihood === 'CONDITIONAL').length || 0,
    lowProbabilityCount: items?.filter(i => i.hearing_likelihood === 'LOW_PROBABILITY').length || 0,
    unknownCount: items?.filter(i => i.hearing_likelihood === 'UNKNOWN' || !i.hearing_likelihood).length || 0,
  };
  
  return { stats, isLoading };
}
