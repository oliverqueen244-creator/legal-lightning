import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
    EffectiveHearingItem,
    CourtOverride,
    UseEffectiveHearingStateParams
} from './types';
import {
    findAllApplicableOverrides,
    computeSuspensionState,
    determineItemSession,
    computeAdjustedLikelihood,
    buildProvenanceExplanation
} from './utils';

const OVERRIDE_PRECEDENCE: Record<string, number> = {
    'bench_conversion': 1,
    'judge_substitution': 2,
    'timing_override': 3,
    'court_reassignment': 4,
    'serial_range_reassignment': 5,
};

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

            const sortedOverrides = (overrides as unknown as CourtOverride[] || []).sort((a, b) => {
                const aPrecedence = OVERRIDE_PRECEDENCE[a.override_type] || 99;
                const bPrecedence = OVERRIDE_PRECEDENCE[b.override_type] || 99;
                return aPrecedence - bPrecedence;
            });

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

            const dailyItems = (allDocketItems || []).filter(d => d.list_type === 'DAILY');
            const suppItems = (allDocketItems || []).filter(d => d.list_type === 'SUPPLEMENTARY');

            const caseIndex = new Map<string, { daily: any[], supp: any[] }>();
            for (const item of dailyItems) {
                const key = `${item.court_room_no}:${item.case_number}`;
                if (!caseIndex.has(key)) caseIndex.set(key, { daily: [], supp: [] });
                caseIndex.get(key)!.daily.push(item);
            }
            for (const item of suppItems) {
                const key = `${item.court_room_no}:${item.case_number}`;
                if (!caseIndex.has(key)) caseIndex.set(key, { daily: [], supp: [] });
                caseIndex.get(key)!.supp.push(item);
            }

            const timingOverrides = sortedOverrides.filter(o => o.override_type === 'timing_override');
            const effectiveItems: EffectiveHearingItem[] = [];
            const processedCases = new Set<string>();
            const allItemsSorted = [...suppItems, ...dailyItems];

            for (const item of allItemsSorted) {
                const isSupplementary = item.list_type === 'SUPPLEMENTARY';
                const itemNo = item.item_no || 0;
                const courtRoomNo = item.court_room_no || '';
                const caseKey = `${courtRoomNo}:${item.case_number}`;

                const caseData = caseIndex.get(caseKey);
                const hasBothLists = caseData && caseData.daily.length > 0 && caseData.supp.length > 0;

                if (processedCases.has(caseKey) && !isSupplementary) continue;
                if (isSupplementary) processedCases.add(caseKey);

                const applicableOverrides = findAllApplicableOverrides(sortedOverrides, courtRoomNo, itemNo);
                const primaryOverride = applicableOverrides[0] || null;
                const benchConversion = applicableOverrides.find(o => o.override_type === 'bench_conversion');

                const { isSuspended, suspensionReason, resumeAfter, isBenchInactive, originalBenchType } =
                    computeSuspensionState(item, applicableOverrides, metadataByCourtNo.get(courtRoomNo));

                const itemSession = determineItemSession(item, timingOverrides);
                const isCurrentSession = currentSession === 'UNKNOWN' || itemSession === currentSession;

                let effectiveJudge: string | null = null;
                let judgeSource: 'override' | 'supplementary' | 'daily' | 'metadata' | null = null;

                const judgeOverride = applicableOverrides.find(o => o.override_type === 'judge_substitution');
                if (judgeOverride?.new_judge) {
                    effectiveJudge = judgeOverride.new_judge;
                    judgeSource = 'override';
                } else if (benchConversion?.new_judge) {
                    effectiveJudge = benchConversion.new_judge;
                    judgeSource = 'override';
                } else if (item.judge_names) {
                    effectiveJudge = item.judge_names;
                    judgeSource = isSupplementary ? 'supplementary' : 'daily';
                } else if (metadataByCourtNo.has(courtRoomNo)) {
                    effectiveJudge = metadataByCourtNo.get(courtRoomNo)?.judges || null;
                    judgeSource = 'metadata';
                }

                const { adjustedLikelihood, adjustments } = computeAdjustedLikelihood(
                    item.hearing_likelihood,
                    isSuspended,
                    isBenchInactive,
                    isCurrentSession,
                    applicableOverrides
                );

                const provenance = buildProvenanceExplanation(
                    item,
                    isSupplementary,
                    primaryOverride,
                    judgeSource,
                    hasBothLists || false,
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
                    list_type: isSupplementary ? 'SUPPLEMENTARY' : 'DAILY',
                    raw_causelist_id: item.raw_causelist_id,
                    effective_judge: effectiveJudge,
                    judge_source: judgeSource,
                    has_override: applicableOverrides.length > 0,
                    override_type: primaryOverride?.override_type || null,
                    override_explanation: primaryOverride
                        ? `Override: ${primaryOverride.override_type} applied to items ${primaryOverride.from_serial || '*'} to ${primaryOverride.to_serial || '*'}`
                        : null,
                    applied_overrides: applicableOverrides.map(o => o.override_type),
                    is_suspended: isSuspended,
                    suspension_reason: suspensionReason,
                    resume_after: resumeAfter,
                    is_bench_inactive: isBenchInactive,
                    bench_conversion_active: !!benchConversion,
                    original_bench_type: originalBenchType,
                    session: itemSession,
                    is_current_session: isCurrentSession,
                    hearing_likelihood: item.hearing_likelihood,
                    adjusted_likelihood: adjustedLikelihood,
                    likelihood_reason: item.likelihood_reason,
                    likelihood_adjustments: adjustments,
                    is_collapsed: hasBothLists && !isSupplementary ? true : false,
                    collapsed_from: hasBothLists ? 'DAILY' : null,
                    provenance_explanation: provenance,
                });
            }

            effectiveItems.sort((a, b) => {
                const courtCompare = (a.court_room_no || '').localeCompare(b.court_room_no || '');
                if (courtCompare !== 0) return courtCompare;
                return (a.item_no || 0) - (b.item_no || 0);
            });

            return effectiveItems;
        },
        staleTime: 60 * 1000,
        refetchInterval: 2 * 60 * 1000,
        enabled: !!courtLocation
    });
}
