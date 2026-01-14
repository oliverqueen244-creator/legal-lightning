/**
 * Case Export Types
 * 
 * Types for lawyer-initiated case export feature.
 * Supports PDF (A4/Legal), CSV, and Excel formats.
 */

export type ExportFormat = 'pdf-a4' | 'pdf-legal' | 'csv' | 'excel';
export type ExportType = 'profile' | 'cv' | 'empanelment';

export type AdvocateRole = 'Petitioner' | 'Respondent';

export interface ExportCase {
  id: string;
  caseNo: string;
  caseType: string;
  year: number;
  advocateRole: AdvocateRole;
  outcome: string | null;
  dateRange: string; // "DD Mon YYYY → DD Mon YYYY"
  lawyerNotes: string; // User-entered, empty by default
  // Grouping keys (not exported as columns)
  courtNo: string;
  judgeName: string;
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
}

export interface ExportOptions {
  format: ExportFormat;
  type: ExportType;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
}

// Column order is LOCKED per specification
export const EXPORT_COLUMNS = [
  'Case No.',
  'Case Type',
  'Year',
  'Advocate Role',
  'Outcome',
  'Date Range',
  'Lawyer Notes',
] as const;

export const EXPORT_FOOTER = 
  'Generated from NyayHub. Reflects publicly available court records. Final authority rests with the court.';

export const NOTES_DISCLAIMER = 
  'Notes are added by the lawyer and are not generated or verified by NyayHub.';

export const MAX_NOTES_LENGTH = 1000;

// PDF margins in mm
export const PDF_MARGINS = {
  top: 20,
  bottom: 20,
  left: 18,
  right: 18,
} as const;
