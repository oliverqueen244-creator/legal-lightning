export type SessionType = 'MORNING' | 'POST_LUNCH' | 'AFTERNOON' | 'EVENING' | 'UNKNOWN';

export interface EffectiveHearingItem {
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

    list_type: 'DAILY' | 'SUPPLEMENTARY';
    raw_causelist_id: string | null;

    effective_judge: string | null;
    judge_source: 'override' | 'supplementary' | 'daily' | 'metadata' | null;

    has_override: boolean;
    override_type: string | null;
    override_explanation: string | null;
    applied_overrides: string[];

    is_suspended: boolean;
    suspension_reason: string | null;
    resume_after: string | null;

    is_bench_inactive: boolean;
    bench_conversion_active: boolean;
    original_bench_type: 'SINGLE' | 'DIVISION' | 'UNKNOWN';

    session: SessionType;
    is_current_session: boolean;

    hearing_likelihood: string | null;
    adjusted_likelihood: string | null;
    likelihood_reason: string | null;
    likelihood_adjustments: string[];

    is_collapsed: boolean;
    collapsed_from: 'DAILY' | 'SUPPLEMENTARY' | null;

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
    override_date: string; // Added this as I saw it used in the original file
}

export interface UseEffectiveHearingStateParams {
    courtLocation: string;
    date?: string;
    courtNo?: string;
    currentSession?: SessionType;
}
