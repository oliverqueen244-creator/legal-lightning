import { EffectiveHearingItem, CourtOverride, SessionType } from './types';

const OVERRIDE_PRECEDENCE: Record<string, number> = {
    'bench_conversion': 1,
    'judge_substitution': 2,
    'timing_override': 3,
    'court_reassignment': 4,
    'serial_range_reassignment': 5,
};

export function findAllApplicableOverrides(
    overrides: CourtOverride[],
    courtNo: string,
    itemNo: number
): CourtOverride[] {
    const courtOverrides = overrides.filter(o => o.court_no === courtNo && o.is_active);
    const applicable: CourtOverride[] = [];

    for (const override of courtOverrides) {
        const fromSerial = override.from_serial;
        const toSerial = override.to_serial;

        if (fromSerial === null && toSerial === null) {
            applicable.push(override);
            continue;
        }

        const inRange = (
            (fromSerial === null || itemNo >= fromSerial) &&
            (toSerial === null || itemNo <= toSerial)
        );

        if (inRange) {
            applicable.push(override);
        }
    }

    return applicable.sort((a, b) => {
        const aPrecedence = OVERRIDE_PRECEDENCE[a.override_type] || 99;
        const bPrecedence = OVERRIDE_PRECEDENCE[b.override_type] || 99;
        return aPrecedence - bPrecedence;
    });
}

export function computeSuspensionState(
    item: { list_type?: string | null; item_no?: number | null },
    overrides: CourtOverride[],
    metadata?: { judges: string; bench: string }
) {
    let isSuspended = false;
    let suspensionReason: string | null = null;
    let resumeAfter: string | null = null;
    let isBenchInactive = false;
    let originalBenchType: 'SINGLE' | 'DIVISION' | 'UNKNOWN' = 'UNKNOWN';

    if (metadata?.judges) {
        const judgeCount = (metadata.judges.match(/,/g) || []).length + 1;
        originalBenchType = judgeCount >= 2 ? 'DIVISION' : 'SINGLE';
    }

    const benchConversion = overrides.find(o => o.override_type === 'bench_conversion');
    if (benchConversion) {
        if (item.list_type === 'DAILY' && originalBenchType === 'SINGLE') {
            isBenchInactive = true;
            isSuspended = true;
            suspensionReason = 'Single Bench matters deferred during Division Bench hearing.';
            resumeAfter = 'Division Bench';
        }
    }

    const serialReassignment = overrides.find(o => o.override_type === 'serial_range_reassignment');
    if (serialReassignment && item.list_type === 'DAILY') {
        isSuspended = true;
        suspensionReason = 'Serial range reassigned per supplementary notice.';
        resumeAfter = 'reassignment complete';
    }

    return { isSuspended, suspensionReason, resumeAfter, isBenchInactive, originalBenchType };
}

export function determineItemSession(
    item: { item_no?: number | null },
    timingOverrides: CourtOverride[]
): SessionType {
    const itemNo = item.item_no || 0;

    for (const override of timingOverrides) {
        const fromSerial = override.from_serial ?? 0;
        const toSerial = override.to_serial ?? 9999;

        if (itemNo >= fromSerial && itemNo <= toSerial) {
            if (toSerial <= 20) return 'MORNING';
            if (fromSerial > 20 && toSerial <= 40) return 'POST_LUNCH';
            if (fromSerial > 40) return 'AFTERNOON';
        }
    }

    if (itemNo <= 25) return 'MORNING';
    if (itemNo <= 50) return 'POST_LUNCH';
    return 'AFTERNOON';
}

export function computeAdjustedLikelihood(
    baseLikelihood: string | null,
    isSuspended: boolean,
    isBenchInactive: boolean,
    isCurrentSession: boolean,
    overrides: CourtOverride[]
) {
    const adjustments: string[] = [];
    let likelihood = baseLikelihood || 'UNKNOWN';

    if (isSuspended) {
        likelihood = 'LOW_PROBABILITY';
        adjustments.push('Downgraded: Item suspended per supplementary notice.');
    }

    if (isBenchInactive && !isSuspended) {
        likelihood = 'LOW_PROBABILITY';
        adjustments.push('Downgraded: Single Bench matters inactive during Division Bench.');
    }

    if (!isCurrentSession && likelihood !== 'LOW_PROBABILITY') {
        if (likelihood === 'LIKELY') {
            likelihood = 'CONDITIONAL';
            adjustments.push('Downgraded: Item not in current session.');
        } else if (likelihood === 'CONDITIONAL') {
            likelihood = 'LOW_PROBABILITY';
            adjustments.push('Downgraded: Item not in current session.');
        }
    }

    const timingOverride = overrides.find(o => o.override_type === 'timing_override');
    if (timingOverride) {
        adjustments.push('Session boundary active: Item-distance logic constrained to session.');
    }

    return { adjustedLikelihood: likelihood, adjustments };
}

export function buildProvenanceExplanation(
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

    if (isCollapsed && isSupplementary) {
        parts.push('SUPPLEMENTARY record preferred (DAILY record collapsed).');
    } else if (isSupplementary) {
        parts.push('Listed in SUPPLEMENTARY cause list (runtime override).');
    } else {
        parts.push('Listed in DAILY cause list (base plan).');
    }

    if (isSuspended) {
        parts.push('SUSPENDED: Item temporarily deferred.');
    }
    if (isBenchInactive) {
        parts.push('INACTIVE: Single Bench matters paused for Division Bench.');
    }

    if (override) {
        parts.push(`Override applied: ${override.override_type}.`);
    }

    if (judgeSource === 'override') {
        parts.push('Effective judge from supplementary notice override.');
    } else if (judgeSource === 'metadata') {
        parts.push('Judge from court metadata (no override in effect).');
    } else if (judgeSource === 'supplementary') {
        parts.push('Judge from supplementary cause list record.');
    } else if (judgeSource === 'daily') {
        parts.push('Judge from daily cause list record.');
    }

    if (adjustments.length > 0) {
        parts.push(`Adjustments: ${adjustments.join(' ')}`);
    }

    if (item.hearing_likelihood) {
        parts.push(`Base likelihood: ${item.hearing_likelihood}.`);
    }

    return parts.join(' ');
}
