import { useEffectiveHearingState } from './index';
import { SessionType } from './types';

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
        suspendedCount: items?.filter(i => i.is_suspended).length || 0,
        benchInactiveCount: items?.filter(i => i.is_bench_inactive).length || 0,
        currentSessionCount: items?.filter(i => i.is_current_session).length || 0,
        collapsedCount: items?.filter(i => i.is_collapsed).length || 0,
        likelyCount: items?.filter(i => i.adjusted_likelihood === 'LIKELY').length || 0,
        conditionalCount: items?.filter(i => i.adjusted_likelihood === 'CONDITIONAL').length || 0,
        lowProbabilityCount: items?.filter(i => i.adjusted_likelihood === 'LOW_PROBABILITY').length || 0,
        unknownCount: items?.filter(i => i.adjusted_likelihood === 'UNKNOWN' || !i.adjusted_likelihood).length || 0,
    };

    return { stats, isLoading };
}
