/**
 * Export Generators
 * 
 * Generates PDF, CSV, and Excel exports for case data.
 * Follows strict schema and layout rules from specification.
 * 
 * EXPORT CONTRACT:
 * This export is intentionally black & white.
 * Do NOT add color, badges, or visual emphasis.
 * Court-print safe by design.
 * No Virtual Court links or meeting IDs are included.
 */

import { format } from 'date-fns';
import type { ExportData, ExportCase, ExportFormat } from '@/types/export';
import { 
  EXPORT_COLUMNS_SINGLE_DATE,
  EXPORT_COLUMNS_MULTI_DATE,
  EXPORT_FOOTER, 
  NOTES_DISCLAIMER, 
  MAX_NOTES_LENGTH,
  PDF_MARGINS 
} from '@/types/export';

// Validate notes before export
export function validateNotes(cases: ExportCase[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const caseItem of cases) {
    if (caseItem.lawyerNotes.length > MAX_NOTES_LENGTH) {
      errors.push(`Notes for ${caseItem.caseNo} exceed ${MAX_NOTES_LENGTH} characters`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Format date scope for display - strict header rule
// Single date: "Date: 14 Jan 2026"
// Multi-date: "From 12 Jan 2026 to 14 Jan 2026"
function formatDateScope(data: ExportData): string {
  if (!data.dateScope) return '';
  
  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day} ${getMonthName(parseInt(month))} ${year}`;
    } catch {
      return dateStr;
    }
  };
  
  // Single date export - no range wording
  if (data.dateScope.mode === 'today') {
    return `Date: ${data.exportDate}`;
  }
  
  // Multi-date range
  if (data.dateScope.start && data.dateScope.end) {
    if (data.dateScope.start === data.dateScope.end) {
      // Same start and end = single date
      return `Date: ${formatDate(data.dateScope.start)}`;
    }
    return `From ${formatDate(data.dateScope.start)} to ${formatDate(data.dateScope.end)}`;
  }
  
  return '';
}

function getMonthName(month: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month - 1] || '';
}

// Format party name with null-safe fallback
function formatPartyName(name: string | null): string {
  return name?.trim() || '—';
}

// Generate CSV content
// Multiline notes are preserved with newlines for proper CSV handling
export function generateCSV(data: ExportData): string {
  const lines: string[] = [];
  const columns = data.isMultiDate ? EXPORT_COLUMNS_MULTI_DATE : EXPORT_COLUMNS_SINGLE_DATE;
  
  // Header row
  lines.push(columns.join(','));
  
  // Data rows - flatten all groups (include court/judge context per case)
  for (const group of data.groups) {
    for (const caseItem of group.cases) {
      // Lawyer notes: preserve multiline, add empty lines for handwriting space
      const notesWithSpace = caseItem.lawyerNotes 
        ? caseItem.lawyerNotes 
        : '\n\n'; // 2-3 lines of blank space for manual notes
      
      const itemNoDisplay = caseItem.itemNo != null ? String(caseItem.itemNo) : '—';
      
      const row = data.isMultiDate ? [
        itemNoDisplay,
        escapeCSV(caseItem.caseNo),
        escapeCSV(formatPartyName(caseItem.petitioner)),
        escapeCSV(formatPartyName(caseItem.respondent)),
        escapeCSV(caseItem.opposingCounsel), // Already normalized, never null
        caseItem.advocateRole,
        caseItem.listingStatus,
        escapeCSV(caseItem.outcome || '—'),
        escapeCSV(caseItem.dateRange),
        escapeCSV(notesWithSpace),
      ] : [
        itemNoDisplay,
        escapeCSV(caseItem.caseNo),
        escapeCSV(formatPartyName(caseItem.petitioner)),
        escapeCSV(formatPartyName(caseItem.respondent)),
        escapeCSV(caseItem.opposingCounsel), // Already normalized, never null
        caseItem.advocateRole,
        caseItem.listingStatus,
        escapeCSV(caseItem.outcome || '—'),
        escapeCSV(notesWithSpace),
      ];
      lines.push(row.join(','));
    }
  }
  
  // Add date scope and disclaimers at end
  lines.push('');
  lines.push(`"${formatDateScope(data)}"`);
  lines.push(`"${NOTES_DISCLAIMER}"`);
  lines.push(`"${EXPORT_FOOTER}"`);
  
  return lines.join('\n');
}

function escapeCSV(value: string): string {
  if (!value) return '';
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Generate Excel-compatible TSV (for simple Excel import)
// Row heights are pre-expanded for notes column, text wrapping enabled
export function generateExcel(data: ExportData): Blob {
  // Using TSV format which Excel handles well
  const lines: string[] = [];
  const columns = data.isMultiDate ? EXPORT_COLUMNS_MULTI_DATE : EXPORT_COLUMNS_SINGLE_DATE;
  
  // Header row
  lines.push(columns.join('\t'));
  
  // Data rows - flatten all groups
  for (const group of data.groups) {
    for (const caseItem of group.cases) {
      // Lawyer notes: replace tabs, preserve newlines as pipe separators for Excel
      // Add blank lines if empty for writing space indication
      const notesForExcel = caseItem.lawyerNotes 
        ? caseItem.lawyerNotes.replace(/\t/g, ' ').replace(/\n/g, ' | ')
        : '   |   |   '; // Visual space indicator for 2-3 lines
      
      const itemNoDisplay = caseItem.itemNo != null ? String(caseItem.itemNo) : '—';
      
      const row = data.isMultiDate ? [
        itemNoDisplay,
        caseItem.caseNo,
        formatPartyName(caseItem.petitioner),
        formatPartyName(caseItem.respondent),
        caseItem.opposingCounsel, // Already normalized
        caseItem.advocateRole,
        caseItem.listingStatus,
        caseItem.outcome || '—',
        caseItem.dateRange,
        notesForExcel,
      ] : [
        itemNoDisplay,
        caseItem.caseNo,
        formatPartyName(caseItem.petitioner),
        formatPartyName(caseItem.respondent),
        caseItem.opposingCounsel, // Already normalized
        caseItem.advocateRole,
        caseItem.listingStatus,
        caseItem.outcome || '—',
        notesForExcel,
      ];
      lines.push(row.join('\t'));
    }
  }
  
  // Add date scope and disclaimers at end
  lines.push('');
  lines.push(formatDateScope(data));
  lines.push(NOTES_DISCLAIMER);
  lines.push(EXPORT_FOOTER);
  
  const content = lines.join('\n');
  return new Blob([content], { type: 'application/vnd.ms-excel' });
}

// PDF Generator - returns HTML that will be converted to PDF
// EXPORT CONTRACT: Black & white only, no colors, court-print safe
export function generatePDFContent(data: ExportData, pageSize: 'a4' | 'legal'): string {
  const pageWidth = pageSize === 'a4' ? '210mm' : '215.9mm';
  const pageHeight = pageSize === 'a4' ? '297mm' : '355.6mm';
  const dateScopeText = formatDateScope(data);
  
  // EXPORT CONTRACT:
  // This export is intentionally black & white.
  // Do NOT add color, badges, or visual emphasis.
  // Court-print safe by design.
  
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Case Export - ${data.lawyerName}</title>
  <style>
    @page {
      size: ${pageWidth} ${pageHeight};
      margin: ${PDF_MARGINS.top}mm ${PDF_MARGINS.right}mm ${PDF_MARGINS.bottom}mm ${PDF_MARGINS.left}mm;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    /* BLACK & WHITE ONLY - No colors, gradients, or colored elements */
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
    }
    
    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .header .subtitle {
      font-size: 10pt;
    }
    
    .header .date-scope {
      font-size: 10pt;
      font-weight: bold;
      margin-top: 5px;
    }
    
    .group-header {
      margin-top: 15px;
      margin-bottom: 10px;
      padding: 8px;
      border: 1px solid #000;
      border-left: 3px solid #000;
      page-break-inside: avoid;
    }
    
    .group-header .court {
      font-weight: bold;
      font-size: 11pt;
    }
    
    .group-header .judge {
      font-size: 10pt;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    
    thead {
      display: table-header-group;
    }
    
    /* BLACK & WHITE: Header uses bold text on white, not colored background */
    th {
      background-color: #fff;
      color: #000;
      padding: 6px 4px;
      text-align: left;
      font-size: 9pt;
      font-weight: bold;
      border: 1px solid #000;
      border-bottom: 2px solid #000;
    }
    
    td {
      padding: 5px 4px;
      border: 1px solid #000;
      vertical-align: top;
      font-size: 9pt;
      word-wrap: break-word;
    }
    
    tr {
      page-break-inside: avoid;
    }
    
    /* No alternating colors - all white */
    
    /* Column widths - revised layout with Sr. No. and Listing Status */
    .col-srno { width: 5%; text-align: center; }
    .col-caseno { width: 14%; font-family: 'Courier New', monospace; }
    .col-petitioner { width: 11%; }
    .col-respondent { width: 11%; }
    .col-opposing { width: 11%; }
    .col-role { width: 6%; }
    .col-listing { width: 6%; }
    .col-outcome { width: 6%; }
    .col-dates { width: 8%; }
    .col-notes { width: 18%; }
    
    /* Lawyer Notes: 2-3 lines of writable space with dotted ruling */
    .notes-cell {
      white-space: pre-wrap;
      min-height: 48px; /* ~3 lines at 16px line-height */
      height: 48px;
      background-image: repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 15px,
        #ccc 15px,
        #ccc 16px
      );
      background-size: 100% 16px;
    }
    
    .party-cell {
      font-size: 8pt;
      word-wrap: break-word;
    }
    
    .caseno-cell {
      font-family: 'Courier New', monospace;
      font-size: 8pt;
    }
    
    .disclaimer {
      margin-top: 20px;
      padding: 10px;
      border: 1px solid #000;
      font-size: 8pt;
      font-style: italic;
    }
    
    .page-footer {
      text-align: center;
      font-size: 8pt;
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #000;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Case Record — ${escapeHTML(data.lawyerName)}</h1>
    <div class="subtitle">Generated on ${data.exportDate} | Total Cases: ${data.totalCases}</div>
    ${dateScopeText ? `<div class="date-scope">${escapeHTML(dateScopeText)}</div>` : ''}
  </div>
`;

  // Generate each group
  for (const group of data.groups) {
    // Build table header based on single-date vs multi-date
    // Includes Listing Status column for Late Listed indicator
    const tableHeaders = data.isMultiDate
      ? `<th class="col-srno">Sr.</th>
         <th class="col-caseno">Case No.</th>
         <th class="col-petitioner">Petitioner</th>
         <th class="col-respondent">Respondent</th>
         <th class="col-opposing">Opp. Counsel</th>
         <th class="col-role">Role</th>
         <th class="col-listing">Listing</th>
         <th class="col-outcome">Outcome</th>
         <th class="col-dates">Date Range</th>
         <th class="col-notes">Lawyer Notes</th>`
      : `<th class="col-srno">Sr.</th>
         <th class="col-caseno">Case No.</th>
         <th class="col-petitioner">Petitioner</th>
         <th class="col-respondent">Respondent</th>
         <th class="col-opposing">Opp. Counsel</th>
         <th class="col-role">Role</th>
         <th class="col-listing">Listing</th>
         <th class="col-outcome">Outcome</th>
         <th class="col-notes">Lawyer Notes</th>`;
    
    html += `
  <div class="group-header">
    <div class="court">Court No.: ${escapeHTML(group.courtNo)}</div>
    <div class="judge">Presiding Judge: ${escapeHTML(group.judgeName)}</div>
  </div>
  
  <table>
    <thead>
      <tr>
        ${tableHeaders}
      </tr>
    </thead>
    <tbody>
`;
    
    for (const caseItem of group.cases) {
      const petitionerDisplay = caseItem.petitioner?.trim() || '—';
      const respondentDisplay = caseItem.respondent?.trim() || '—';
      // Opposing counsel is already normalized (never null/blank)
      const opposingCounselDisplay = caseItem.opposingCounsel;
      const itemNoDisplay = caseItem.itemNo != null ? String(caseItem.itemNo) : '—';
      
      // Build table row based on single-date vs multi-date
      // Notes cell left intentionally sparse for handwriting
      const tableRow = data.isMultiDate
        ? `<td class="col-srno">${itemNoDisplay}</td>
           <td class="col-caseno caseno-cell">${escapeHTML(caseItem.caseNo)}</td>
           <td class="col-petitioner party-cell">${escapeHTML(petitionerDisplay)}</td>
           <td class="col-respondent party-cell">${escapeHTML(respondentDisplay)}</td>
           <td class="col-opposing party-cell">${escapeHTML(opposingCounselDisplay)}</td>
           <td class="col-role">${caseItem.advocateRole}</td>
           <td class="col-listing">${caseItem.listingStatus}</td>
           <td class="col-outcome">${escapeHTML(caseItem.outcome || '—')}</td>
           <td class="col-dates">${escapeHTML(caseItem.dateRange)}</td>
           <td class="col-notes notes-cell">${escapeHTML(caseItem.lawyerNotes) || ' '}</td>`
        : `<td class="col-srno">${itemNoDisplay}</td>
           <td class="col-caseno caseno-cell">${escapeHTML(caseItem.caseNo)}</td>
           <td class="col-petitioner party-cell">${escapeHTML(petitionerDisplay)}</td>
           <td class="col-respondent party-cell">${escapeHTML(respondentDisplay)}</td>
           <td class="col-opposing party-cell">${escapeHTML(opposingCounselDisplay)}</td>
           <td class="col-role">${caseItem.advocateRole}</td>
           <td class="col-listing">${caseItem.listingStatus}</td>
           <td class="col-outcome">${escapeHTML(caseItem.outcome || '—')}</td>
           <td class="col-notes notes-cell">${escapeHTML(caseItem.lawyerNotes) || ' '}</td>`;
      
      html += `
      <tr>
        ${tableRow}
      </tr>
`;
    }
    
    html += `
    </tbody>
  </table>
`;
  }
  
  // Add disclaimer and footer
  html += `
  <div class="disclaimer">
    ${NOTES_DISCLAIMER}
  </div>
  
  <div class="page-footer">
    ${EXPORT_FOOTER}
  </div>
</body>
</html>
`;
  
  return html;
}

function escapeHTML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Download helper
export function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Main export function
export async function exportCases(
  data: ExportData, 
  exportFormat: ExportFormat,
  onProgress?: (stage: string) => void
): Promise<void> {
  const dateStr = format(new Date(), 'yyyyMMdd');
  const baseName = `CaseExport_${data.lawyerName.replace(/\s+/g, '_')}_${dateStr}`;
  
  onProgress?.('Validating data...');
  
  // Flatten all cases for validation
  const allCases = data.groups.flatMap(g => g.cases);
  const validation = validateNotes(allCases);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
  }
  
  onProgress?.('Generating export...');
  
  switch (exportFormat) {
    case 'csv': {
      const csv = generateCSV(data);
      downloadFile(csv, `${baseName}.csv`, 'text/csv');
      break;
    }
    
    case 'excel': {
      const excel = generateExcel(data);
      downloadFile(excel, `${baseName}.xls`, 'application/vnd.ms-excel');
      break;
    }
    
    case 'pdf-a4':
    case 'pdf-legal': {
      const pageSize = exportFormat === 'pdf-a4' ? 'a4' : 'legal';
      const html = generatePDFContent(data, pageSize);
      
      // Open print dialog for PDF generation
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        throw new Error('Could not open print window. Please allow popups.');
      }
      break;
    }
    
    default:
      throw new Error(`Unknown format: ${exportFormat}`);
  }
}
