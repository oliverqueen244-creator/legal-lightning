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
 * 3. Applying court_overrides in deterministic order (FIX 5)
 * 4. Resolving judge, bench, court, timing, and serial applicability
 * 5. Producing a resolved "what actually happens today" view
 * 
 * OVERRIDE PRECEDENCE ORDER (FIX 5):
 * 1. bench_conversion (highest priority)
 * 2. judge_substitution
 * 3. timing_override
 * 4. court_reassignment
 * 5. serial_range_reassignment (lowest priority)
 * 
 * This is a VIRTUAL VIEW - it does NOT mutate stored data.
 * Every resolved state is EXPLAINABLE.
 */

// Override precedence order (FIX 5 - deterministic)
const OVERRIDE_PRECEDENCE: Record<string, number> = {
  'bench_conversion': 1,      // Highest priority
  'judge_substitution': 2,
  'timing_override': 3,
  'court_reassignment': 4,
  'serial_range_reassignment': 5,  // Lowest priority
};

// Session identifiers (FIX 3 - timing-aware likelihood)
type SessionType = 'MORNING' | 'POST_LUNCH' | 'AFTERNOON' | 'EVENING' | 'UNKNOWN';

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
  applied_overrides: string[]; // FIX 5: All applied overrides in precedence order
  
  // FIX 1 & 2: Suspension state
  is_suspended: boolean;
  suspension_reason: string | null;
  resume_after: string | null; // e.g., "Division Bench", "lunch"
  
  // FIX 2: Bench conversion state
  is_bench_inactive: boolean;
  bench_conversion_active: boolean;
  original_bench_type: 'SINGLE' | 'DIVISION' | 'UNKNOWN';
  
  // FIX 3: Session state
  session: SessionType;
  is_current_session: boolean;
  
  // Hearing likelihood (FIX 3: adjusted for timing)
  hearing_likelihood: string | null;
  adjusted_likelihood: string | null; // After timing/suspension adjustments
  likelihood_reason: string | null;
  likelihood_adjustments: string[]; // Explain all adjustments
  
  // FIX 4: Collapse indicator
  is_collapsed: boolean;
  collapsed_from: 'DAILY' | 'SUPPLEMENTARY' | null; // Which list was hidden
  
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
  expires_at: string | null;
}

interface UseEffectiveHearingStateParams {
  courtLocation: string;
  date?: string; // Defaults to today
  courtNo?: string; // Optional filter by court
  currentSession?: SessionType; // FIX 3: Current court session
}

/**
 * Computes the effective hearing state for a court on a given date.
 * This is the single source of truth for "what is actually happening in court today".
 */
export function useEffectiveHearingState({
  courtLocation,
  date,
  courtNo,
  currentSession = 'UNKNOWN'
}: UseEffectiveHearingStateParams) {
  const targetDate = date || format(new Date(), 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['effective-hearing-state', courtLocation, targetDate, courtNo, currentSession],
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
      }
      
      // FIX 5: Sort overrides by precedence order
      const sortedOverrides = (overrides || []).sort((a, b) => {
        const aPrecedence = OVERRIDE_PRECEDENCE[a.override_type] || 99;
        const bPrecedence = OVERRIDE_PRECEDENCE[b.override_type] || 99;
        return aPrecedence - bPrecedence;
      });
      
      // STEP 4.4: Load court_metadata for base judge names
      const { data: courtMetadata } = await supabase
        .from('court_metadata')
        .select('court_no, sitting_judges, bench')
        .eq('bench', courtLocation);
      
      const metadataByCourtNo = new Map<string, { judges: string; bench: string }>();
      if (courtMetadata) {
        for (const cm of courtMetadata) {
          metadataByCourtNo.set(cm.court_no, {
            judges: cm.sitting_judges || '',
            bench: cm.bench || ''
          });
        }
      }
      
      // STEP 2: Separate DAILY (base) and SUPPLEMENTARY (override) items
      const dailyItems = (allDocketItems || []).filter(d => d.list_type === 'DAILY');
      const suppItems = (allDocketItems || []).filter(d => d.list_type === 'SUPPLEMENTARY');
      
      console.log(`[useEffectiveHearingState] ${dailyItems.length} DAILY + ${suppItems.length} SUPPLEMENTARY items`);
      
      // FIX 4: Build case number index for collapse detection
      const caseIndex = new Map<string, { daily: typeof allDocketItems, supp: typeof allDocketItems }>();
      for (const item of dailyItems) {
        const key = `${item.court_room_no}:${item.case_number}`;
        if (!caseIndex.has(key)) {
          caseIndex.set(key, { daily: [], supp: [] });
        }
        caseIndex.get(key)!.daily.push(item);
      }
      for (const item of suppItems) {
        const key = `${item.court_room_no}:${item.case_number}`;
        if (!caseIndex.has(key)) {
          caseIndex.set(key, { daily: [], supp: [] });
        }
        caseIndex.get(key)!.supp.push(item);
      }
      
      // FIX 2: Identify active bench conversions
      const benchConversions = sortedOverrides.filter(o => o.override_type === 'bench_conversion');
      
      // FIX 3: Parse timing overrides to determine session boundaries
      const timingOverrides = sortedOverrides.filter(o => o.override_type === 'timing_override');
      
      // STEP 4.4: Build effective state for each item
      const effectiveItems: EffectiveHearingItem[] = [];
      const processedCases = new Set<string>(); // For FIX 4 collapse
      
      // Process SUPPLEMENTARY first (they take precedence per FIX 4)
      const allItemsSorted = [...suppItems, ...dailyItems];
      
      for (const item of allItemsSorted) {
        const isSupplementary = item.list_type === 'SUPPLEMENTARY';
        const itemNo = item.item_no || 0;
        const courtRoomNo = item.court_room_no || '';
        const caseKey = `${courtRoomNo}:${item.case_number}`;
        
        // FIX 4: Case collapse - if SUPPLEMENTARY already processed, skip DAILY
        const caseData = caseIndex.get(caseKey);
        const hasBothLists = caseData && caseData.daily.length > 0 && caseData.supp.length > 0;
        
        if (processedCases.has(caseKey) && !isSupplementary) {
          // This DAILY item is collapsed because SUPPLEMENTARY already exists
          continue; // Skip - don't add duplicate
        }
        
        if (isSupplementary) {
          processedCases.add(caseKey);
        }
        
        // FIX 5: Find ALL applicable overrides in precedence order
        const applicableOverrides = findAllApplicableOverrides(
          sortedOverrides,
          courtRoomNo,
          itemNo
        );
        
        // Primary override (highest precedence)
        const primaryOverride = applicableOverrides[0] || null;
        
        // FIX 2: Check for bench_conversion affecting this item
        const benchConversion = applicableOverrides.find(o => o.override_type === 'bench_conversion');
        const isBenchConversionActive = !!benchConversion;
        
        // FIX 1 & 2: Determine suspension state
        const { isSuspended, suspensionReason, resumeAfter, isBenchInactive, originalBenchType } = 
          computeSuspensionState(item, applicableOverrides, metadataByCourtNo.get(courtRoomNo));
        
        // FIX 3: Determine session for this item
        const itemSession = determineItemSession(item, timingOverrides);
        const isCurrentSession = currentSession === 'UNKNOWN' || itemSession === currentSession;
        
        // STEP 4.4: Determine effective judge (priority order)
        let effectiveJudge: string | null = null;
        let judgeSource: 'override' | 'supplementary' | 'daily' | 'metadata' | null = null;
        
        // Priority 1: judge_substitution override
        const judgeOverride = applicableOverrides.find(o => o.override_type === 'judge_substitution');
        if (judgeOverride?.new_judge) {
          effectiveJudge = judgeOverride.new_judge;
          judgeSource = 'override';
        }
        // Priority 2: bench_conversion may bring different judge
        else if (benchConversion?.new_judge) {
          effectiveJudge = benchConversion.new_judge;
          judgeSource = 'override';
        }
        // Priority 3: Judge from item record
        else if (item.judge_names) {
          effectiveJudge = item.judge_names;
          judgeSource = isSupplementary ? 'supplementary' : 'daily';
        }
        // Priority 4: Court metadata
        else if (metadataByCourtNo.has(courtRoomNo)) {
          effectiveJudge = metadataByCourtNo.get(courtRoomNo)?.judges || null;
          judgeSource = 'metadata';
        }
        
        // FIX 3: Compute adjusted likelihood based on session and suspension
        const { adjustedLikelihood, adjustments } = computeAdjustedLikelihood(
          item.hearing_likelihood,
          isSuspended,
          isBenchInactive,
          isCurrentSession,
          applicableOverrides
        );
        
        // STEP 7: Build provenance explanation (enhanced for FIX 4)
        const provenance = buildProvenanceExplanation(
          item,
          isSupplementary,
          primaryOverride,
          judgeSource,
          hasBothLists,
          isSuspended,
          isBenchInactive,
          adjustments
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
          status: isSuspended ? 'suspended' : (item.status || 'pending'),
          
          // Source tracking
          list_type: isSupplementary ? 'SUPPLEMENTARY' : 'DAILY',
          raw_causelist_id: item.raw_causelist_id,
          
          // Effective state
          effective_judge: effectiveJudge,
          judge_source: judgeSource,
          
          // Override context
          has_override: applicableOverrides.length > 0,
          override_type: primaryOverride?.override_type || null,
          override_explanation: primaryOverride 
            ? `Override: ${primaryOverride.override_type} applied to items ${primaryOverride.from_serial || '*'} to ${primaryOverride.to_serial || '*'}`
            : null,
          applied_overrides: applicableOverrides.map(o => o.override_type),
          
          // FIX 1 & 2: Suspension state
          is_suspended: isSuspended,
          suspension_reason: suspensionReason,
          resume_after: resumeAfter,
          
          // FIX 2: Bench conversion
          is_bench_inactive: isBenchInactive,
          bench_conversion_active: isBenchConversionActive,
          original_bench_type: originalBenchType,
          
          // FIX 3: Session
          session: itemSession,
          is_current_session: isCurrentSession,
          
          // Hearing likelihood
          hearing_likelihood: item.hearing_likelihood,
          adjusted_likelihood: adjustedLikelihood,
          likelihood_reason: item.likelihood_reason,
          likelihood_adjustments: adjustments,
          
          // FIX 4: Collapse
          is_collapsed: hasBothLists && !isSupplementary,
          collapsed_from: hasBothLists ? 'DAILY' : null,
          
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
 * FIX 5: Find ALL applicable overrides in precedence order.
 * Returns array sorted by OVERRIDE_PRECEDENCE (highest first).
 */
function findAllApplicableOverrides(
  overrides: CourtOverride[],
  courtNo: string,
  itemNo: number
): CourtOverride[] {
  // Filter to matching court
  const courtOverrides = overrides.filter(o => o.court_no === courtNo && o.is_active);
  
  const applicable: CourtOverride[] = [];
  
  for (const override of courtOverrides) {
    const fromSerial = override.from_serial;
    const toSerial = override.to_serial;
    
    // If both are null, applies to entire court
    if (fromSerial === null && toSerial === null) {
      applicable.push(override);
      continue;
    }
    
    // Check if item falls within range (non-contiguous support)
    const inRange = (
      (fromSerial === null || itemNo >= fromSerial) &&
      (toSerial === null || itemNo <= toSerial)
    );
    
    if (inRange) {
      applicable.push(override);
    }
  }
  
  // Sort by precedence (bench_conversion first, etc.)
  return applicable.sort((a, b) => {
    const aPrecedence = OVERRIDE_PRECEDENCE[a.override_type] || 99;
    const bPrecedence = OVERRIDE_PRECEDENCE[b.override_type] || 99;
    return aPrecedence - bPrecedence;
  });
}

/**
 * FIX 1 & 2: Compute suspension state for an item.
 * - Suspended items are temporarily deferred
 * - Bench-inactive items are Single Bench matters during Division Bench
 */
function computeSuspensionState(
  item: { list_type?: string | null; item_no?: number | null },
  overrides: CourtOverride[],
  metadata?: { judges: string; bench: string }
): {
  isSuspended: boolean;
  suspensionReason: string | null;
  resumeAfter: string | null;
  isBenchInactive: boolean;
  originalBenchType: 'SINGLE' | 'DIVISION' | 'UNKNOWN';
} {
  let isSuspended = false;
  let suspensionReason: string | null = null;
  let resumeAfter: string | null = null;
  let isBenchInactive = false;
  let originalBenchType: 'SINGLE' | 'DIVISION' | 'UNKNOWN' = 'UNKNOWN';
  
  // Detect original bench type from metadata or infer from judge count
  if (metadata?.judges) {
    const judgeCount = (metadata.judges.match(/,/g) || []).length + 1;
    originalBenchType = judgeCount >= 2 ? 'DIVISION' : 'SINGLE';
  }
  
  // FIX 2: Check bench_conversion
  const benchConversion = overrides.find(o => o.override_type === 'bench_conversion');
  if (benchConversion) {
    // If this is a DAILY Single Bench item and bench_conversion is active
    if (item.list_type === 'DAILY' && originalBenchType === 'SINGLE') {
      isBenchInactive = true;
      isSuspended = true;
      suspensionReason = 'Single Bench matters deferred during Division Bench hearing.';
      resumeAfter = 'Division Bench';
    }
  }
  
  // FIX 1: Check for serial_range_reassignment that defers items
  const serialReassignment = overrides.find(o => o.override_type === 'serial_range_reassignment');
  if (serialReassignment && item.list_type === 'DAILY') {
    // Item is deferred if it's in the reassigned range
    isSuspended = true;
    suspensionReason = 'Serial range reassigned per supplementary notice.';
    resumeAfter = 'reassignment complete';
  }
  
  // FIX 1: Check for timing_override that defers items
  const timingOverride = overrides.find(o => o.override_type === 'timing_override');
  if (timingOverride && item.list_type === 'DAILY') {
    // Items may be deferred to post-lunch or later session
    // This is a soft deferral - we downgrade likelihood, not suspend entirely
    // Unless the notice explicitly says to suspend
  }
  
  return { isSuspended, suspensionReason, resumeAfter, isBenchInactive, originalBenchType };
}

/**
 * FIX 3: Determine which session an item belongs to.
 */
function determineItemSession(
  item: { item_no?: number | null },
  timingOverrides: CourtOverride[]
): SessionType {
  const itemNo = item.item_no || 0;
  
  // Parse timing overrides to determine session boundaries
  // Common patterns:
  // - Items 1-20: Morning session
  // - Items 21-40: Post-lunch session
  // - Items 41+: Afternoon/Evening
  
  for (const override of timingOverrides) {
    const fromSerial = override.from_serial ?? 0;
    const toSerial = override.to_serial ?? 9999;
    
    if (itemNo >= fromSerial && itemNo <= toSerial) {
      // This override defines a session for this range
      // We'd parse the override type or notes, but for now use item number heuristics
      if (toSerial <= 20) return 'MORNING';
      if (fromSerial > 20 && toSerial <= 40) return 'POST_LUNCH';
      if (fromSerial > 40) return 'AFTERNOON';
    }
  }
  
  // Default session based on item number (no timing override)
  if (itemNo <= 25) return 'MORNING';
  if (itemNo <= 50) return 'POST_LUNCH';
  return 'AFTERNOON';
}

/**
 * FIX 3: Compute adjusted likelihood based on timing, suspension, and session.
 */
function computeAdjustedLikelihood(
  baseLikelihood: string | null,
  isSuspended: boolean,
  isBenchInactive: boolean,
  isCurrentSession: boolean,
  overrides: CourtOverride[]
): { adjustedLikelihood: string | null; adjustments: string[] } {
  const adjustments: string[] = [];
  let likelihood = baseLikelihood || 'UNKNOWN';
  
  // FIX 1: Suspended items get LOW_PROBABILITY
  if (isSuspended) {
    likelihood = 'LOW_PROBABILITY';
    adjustments.push('Downgraded: Item suspended per supplementary notice.');
  }
  
  // FIX 2: Bench-inactive items get LOW_PROBABILITY
  if (isBenchInactive && !isSuspended) {
    likelihood = 'LOW_PROBABILITY';
    adjustments.push('Downgraded: Single Bench matters inactive during Division Bench.');
  }
  
  // FIX 3: Not in current session - downgrade
  if (!isCurrentSession && likelihood !== 'LOW_PROBABILITY') {
    if (likelihood === 'LIKELY') {
      likelihood = 'CONDITIONAL';
      adjustments.push('Downgraded: Item not in current session.');
    } else if (likelihood === 'CONDITIONAL') {
      likelihood = 'LOW_PROBABILITY';
      adjustments.push('Downgraded: Item not in current session.');
    }
  }
  
  // FIX 3: Prevent "3 matters away" logic across sessions
  // This is handled at the consumer level, but we flag it here
  const timingOverride = overrides.find(o => o.override_type === 'timing_override');
  if (timingOverride) {
    adjustments.push('Session boundary active: Item-distance logic constrained to session.');
  }
  
  return { adjustedLikelihood: likelihood, adjustments };
}

/**
 * STEP 7: Build a plain-English explanation of data provenance.
 * Enhanced for FIX 4 (collapse) and FIX 1/2 (suspension).
 */
function buildProvenanceExplanation(
  item: { list_type?: string | null; hearing_likelihood?: string | null },
  isSupplementary: boolean,
  override: CourtOverride | null,
  judgeSource: string | null,
  isCollapsed: boolean,
  isSuspended: boolean,
  isBenchInactive: boolean,
  adjustments: string[]
): string {
  const parts: string[] = [];
  
  // FIX 4: Collapse explanation
  if (isCollapsed && isSupplementary) {
    parts.push('SUPPLEMENTARY record preferred (DAILY record collapsed).');
  } else if (isSupplementary) {
    parts.push('Listed in SUPPLEMENTARY cause list (runtime override).');
  } else {
    parts.push('Listed in DAILY cause list (base plan).');
  }
  
  // FIX 1 & 2: Suspension explanation
  if (isSuspended) {
    parts.push('SUSPENDED: Item temporarily deferred.');
  }
  if (isBenchInactive) {
    parts.push('INACTIVE: Single Bench matters paused for Division Bench.');
  }
  
  // Override
  if (override) {
    parts.push(`Override applied: ${override.override_type}.`);
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
  
  // Likelihood adjustments
  if (adjustments.length > 0) {
    parts.push(`Adjustments: ${adjustments.join(' ')}`);
  }
  
  // Base likelihood
  if (item.hearing_likelihood) {
    parts.push(`Base likelihood: ${item.hearing_likelihood}.`);
  }
  
  return parts.join(' ');
}

/**
 * Get summary statistics for the effective hearing state.
 * Enhanced for FIX 1-5.
 */
export function useEffectiveHearingStats({
  courtLocation,
  date,
  currentSession
}: { courtLocation: string; date?: string; currentSession?: SessionType }) {
  const { data: items, isLoading } = useEffectiveHearingState({
    courtLocation,
    date,
    currentSession
  });
  
  const stats = {
    total: items?.length || 0,
    dailyCount: items?.filter(i => i.list_type === 'DAILY').length || 0,
    supplementaryCount: items?.filter(i => i.list_type === 'SUPPLEMENTARY').length || 0,
    overrideCount: items?.filter(i => i.has_override).length || 0,
    
    // FIX 1 & 2: Suspension stats
    suspendedCount: items?.filter(i => i.is_suspended).length || 0,
    benchInactiveCount: items?.filter(i => i.is_bench_inactive).length || 0,
    
    // FIX 3: Session stats
    currentSessionCount: items?.filter(i => i.is_current_session).length || 0,
    
    // FIX 4: Collapse stats
    collapsedCount: items?.filter(i => i.is_collapsed).length || 0,
    
    // Adjusted likelihood
    likelyCount: items?.filter(i => i.adjusted_likelihood === 'LIKELY').length || 0,
    conditionalCount: items?.filter(i => i.adjusted_likelihood === 'CONDITIONAL').length || 0,
    lowProbabilityCount: items?.filter(i => i.adjusted_likelihood === 'LOW_PROBABILITY').length || 0,
    unknownCount: items?.filter(i => i.adjusted_likelihood === 'UNKNOWN' || !i.adjusted_likelihood).length || 0,
  };
  
  return { stats, isLoading };
}
