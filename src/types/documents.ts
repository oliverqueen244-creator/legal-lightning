// Document management types for Nyay-Hub

export type DocumentType = 
  | 'CAUSELIST_PDF'
  | 'PETITION'
  | 'REPLY'
  | 'REJOINDER'
  | 'ORDER'
  | 'ANNEXURES'
  | 'NOTES';

export type DocumentLanguage = 'EN' | 'HI' | 'MIXED' | 'UNKNOWN';

export type DocumentFormat = 'TYPED' | 'SCANNED' | 'HANDWRITTEN';

export type DocumentLegibility = 'CLEAR' | 'AVERAGE' | 'POOR';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface CaseDocumentExtended {
  id: string;
  docket_id: string;
  file_url: string;
  doc_type: string | null;
  uploaded_at: string;
  document_type: DocumentType | null;
  version: number;
  is_primary: boolean;
  pending_review: boolean;
  language: DocumentLanguage;
  format: DocumentFormat;
  legibility: DocumentLegibility;
  uploaded_by: string | null;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface DocumentUploadMetadata {
  document_type: DocumentType;
  language: DocumentLanguage;
  format: DocumentFormat;
  legibility: DocumentLegibility;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CAUSELIST_PDF: 'Cause List PDF',
  PETITION: 'Petition',
  REPLY: 'Reply',
  REJOINDER: 'Rejoinder',
  ORDER: 'Court Order',
  ANNEXURES: 'Annexures',
  NOTES: 'Notes',
};

export const DOCUMENT_LANGUAGE_LABELS: Record<DocumentLanguage, string> = {
  EN: 'English',
  HI: 'Hindi',
  MIXED: 'Mixed',
  UNKNOWN: 'Unknown',
};

export const DOCUMENT_FORMAT_LABELS: Record<DocumentFormat, string> = {
  TYPED: 'Typed',
  SCANNED: 'Scanned',
  HANDWRITTEN: 'Handwritten',
};

export const DOCUMENT_LEGIBILITY_LABELS: Record<DocumentLegibility, string> = {
  CLEAR: 'Clear',
  AVERAGE: 'Average',
  POOR: 'Poor',
};
