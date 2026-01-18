/**
 * Case Export Types
 * 
 * Types for lawyer-initiated case export feature.
 * Supports PDF (A4/Legal), CSV, and Excel formats.
 * 
 * EXPORT CONTRACT:
 * This export is intentionally black & white.
 * Do NOT add color, badges, or visual emphasis.
 * Court-print safe by design.
 */

export type ExportFormat = 'pdf-a4' | 'pdf-legal' | 'csv' | 'excel';
export type ExportType = 'profile' | 'cv' | 'empanelment';

// Export date mode: today (default) or custom range
export type ExportDateMode = 'today' | 'range';

export type AdvocateRole = 'Petitioner' | 'Respondent';

// Listing status for Late Listed indicator
export type ListingStatus = 'Normal' | 'Late Listed';

export interface ExportCase {
  id: string;
  caseNo: string;
  itemNo: number | null; // Serial number from the court list
  advocateRole: AdvocateRole;
  outcome: string | null;
  dateRange: string; // "DD Mon YYYY → DD Mon YYYY"
  // Party names (from daily_court_docket)
  petitioner: string | null;
  respondent: string | null;
  // Opposing counsel (respondent_lawyer if Petitioner, petitioner_lawyer if Respondent)
  // Normalized: name, "State Counsel / PP", or "—"
  opposingCounsel: string;
  // Listing status (Normal / Late Listed)
  listingStatus: ListingStatus;
  // Lawyer notes - blank by default, space for handwritten or NyayHub-entered notes
  lawyerNotes: string;
  // Grouping keys (not exported as columns)
  courtNo: string;
  judgeName: string;
  caseFingerprint: string; // For notes lookup
}

export interface ExportGroup {
  courtNo: string;
  judgeName: string;
  cases: ExportCase[];
}

export interface ExportData {
  lawyerName: string;
  exportDate: string;
  groups: ExportGroup[];
  totalCases: number;
  // Date scope for footer and conditional columns
  dateScope?: {
    mode: ExportDateMode;
    start?: string;
    end?: string;
  };
  // True if export covers multiple days (determines Date Range column visibility)
  isMultiDate: boolean;
}

export interface ExportOptions {
  format: ExportFormat;
  type: ExportType;
  dateMode: ExportDateMode;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
}

// Column order is LOCKED per specification (revised)
// Type and Year removed (already in Case No.)
// Date Range conditional (only for multi-date exports)
// Listing Status added for Late Listed indicator
export const EXPORT_COLUMNS_SINGLE_DATE = [
  'Sr. No.',
  'Case No.',
  'Petitioner',
  'Respondent',
  'Opposing Counsel',
  'Role',
  'Listing',
  'Outcome',
  'Lawyer Notes',
] as const;

export const EXPORT_COLUMNS_MULTI_DATE = [
  'Sr. No.',
  'Case No.',
  'Petitioner',
  'Respondent',
  'Opposing Counsel',
  'Role',
  'Listing',
  'Outcome',
  'Date Range',
  'Lawyer Notes',
] as const;

export const EXPORT_FOOTER = 
  'Generated from NyayHub. Reflects court listings for the selected date range. Final authority rests with the court.';

export const NOTES_DISCLAIMER = 
  'Notes may be added or modified by the lawyer after export. NyayHub does not author or verify these notes.';

export const MAX_NOTES_LENGTH = 1000;

// PDF margins in mm
export const PDF_MARGINS = {
  top: 20,
  bottom: 20,
  left: 18,
  right: 18,
} as const;
