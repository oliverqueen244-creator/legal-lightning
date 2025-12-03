export interface Profile {
  id: string;
  role: 'SENIOR' | 'JUNIOR' | 'CLERK';
  full_name: string | null;
  whatsapp_number: string | null;
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
  matched_profile_id: string | null;
  created_at: string;
}

export interface LiveBoardCache {
  court_location: string;
  court_no: string;
  current_item: number;
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
