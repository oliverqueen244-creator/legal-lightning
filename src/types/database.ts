export interface Profile {
  id: string;
  role: 'SENIOR' | 'JUNIOR' | 'CLERK' | 'ADMIN' | 'INTERN' | string | null;
  full_name: string | null;
  whatsapp_number: string | null;
  bar_registration_number: string | null;
  bench: string | null;
  is_verified: boolean | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
}

export interface LawyerAlias {
  id: string;
  profile_id: string;
  alias_name: string;
  is_primary: boolean;
  created_at: string;
}
export type HearingLikelihood = 'LIKELY' | 'CONDITIONAL' | 'LOW_PROBABILITY' | 'UNKNOWN';

// CP-4: Case context for office/chamber semantics
export type CaseContext = 'personal' | 'chamber';

export interface DocketItem {
  id: string;
  date: string;
  court_location: 'JODHPUR' | 'JAIPUR';
  list_type: 'DAILY' | 'SUPPLEMENTARY';
  court_room_no: string;
  item_no: number;
  case_number: string;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
  petitioner: string | null;
  respondent: string | null;
  matched_profile_id: string | null;
  status: 'pending' | 'active' | 'done' | 'passover';
  force_active: boolean;
  judge_names: string | null;
  source_url: string | null;
  created_at: string;
  // Execution Policy / Hearing Likelihood fields
  hearing_likelihood: HearingLikelihood | null;
  likelihood_reason: string | null;
  likelihood_derived_at: string | null;
  // CP-4: Case context for office/chamber semantics
  case_context: CaseContext;
  chamber_id: string | null;
}

export interface ExecutionPolicy {
  id: string;
  raw_causelist_id: string;
  policy_text: string;
  policy_scope: 'GLOBAL' | 'COURT' | 'BENCH' | 'UNKNOWN';
  priority_rule: 'SUPPLEMENTARY_FIRST' | 'MAIN_ONLY' | 'TIME_BOUND' | 'UNSPECIFIED';
  time_condition: 'IF_TIME_PERMITS' | 'FIXED_ORDER' | 'UNKNOWN';
  authority_level: string;
  confidence: number;
  court_no: string | null;
  bench: string | null;
  source_page_number: number | null;
  derived_at: string;
  created_at: string;
}

export type BoardStatus = 'hearing' | 'passover' | 'lunch' | 'adjourned' | 'not_sitting';

export interface LiveBoardCache {
  court_location: string;
  court_no: string;
  current_item: number;
  status: BoardStatus;
  is_supplementary_running: boolean;
  last_updated: string;
  is_active: boolean;
}

export interface CaseDocument {
  id: string;
  docket_id: string;
  file_url: string;
  doc_type: string;
  uploaded_at: string;
}

export interface CaseArgument {
  id: string;
  docket_id: string;
  title: string;
  linked_page_number: number;
  highlight_coords: unknown;
  created_at: string;
}

export interface WhisperMessage {
  id: string;
  docket_id: string;
  sender_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface MatchedCase {
  id: string;
  case_number: string;
  court_location: string;
  court_room_no: string;
  item_no: number;
  date: string;
  matched_as: 'petitioner' | 'respondent';
  alias_matched: string;
}

export interface CourtMetadata {
  id: string;
  bench: 'JAIPUR' | 'JODHPUR';
  court_no: string;
  sitting_judges: string | null;
  last_updated: string;
}

export interface ScraperLog {
  id: string;
  bench: string;
  run_at: string;
  status: 'success' | 'partial' | 'failed' | 'warning';
  cases_found: number;
  error_message: string | null;
  list_type: string;
  court_no: string | null;
}
