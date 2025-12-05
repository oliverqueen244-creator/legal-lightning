export interface Profile {
  id: string;
  role: 'SENIOR' | 'JUNIOR' | 'CLERK';
  full_name: string | null;
  whatsapp_number: string | null;
  bar_registration_number: string | null;
  bench: 'JAIPUR' | 'JODHPUR' | null;
  is_verified: boolean;
  onboarding_completed: boolean;
  created_at: string;
}

export interface LawyerAlias {
  id: string;
  profile_id: string;
  alias_name: string;
  is_primary: boolean;
  created_at: string;
}

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
  created_at: string;
}

export type BoardStatus = 'hearing' | 'passover' | 'lunch' | 'adjourned';

export interface LiveBoardCache {
  court_location: string;
  court_no: string;
  current_item: number;
  status: BoardStatus;
  is_supplementary_running: boolean;
  last_updated: string;
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
  judge_names: string | null;
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
