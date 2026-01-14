/**
 * Export Generators
 * 
 * Generates PDF, CSV, and Excel exports for case data.
 * Follows strict schema and layout rules from specification.
 */

import { format } from 'date-fns';
import type { ExportData, ExportCase, ExportGroup, ExportFormat } from '@/types/export';
import { 
  EXPORT_COLUMNS, 
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

// Generate CSV content
export function generateCSV(data: ExportData): string {
  const lines: string[] = [];
  
  // Header row
  lines.push(EXPORT_COLUMNS.join(','));
  
  // Data rows - flatten all groups
  for (const group of data.groups) {
    for (const caseItem of group.cases) {
      const row = [
        escapeCSV(caseItem.caseNo),
        escapeCSV(caseItem.caseType),
        caseItem.year.toString(),
        caseItem.advocateRole,
        escapeCSV(caseItem.outcome || ''),
        escapeCSV(caseItem.dateRange),
        escapeCSV(caseItem.lawyerNotes),
      ];
      lines.push(row.join(','));
    }
  }
  
  // Add disclaimer at end
  lines.push('');
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
export function generateExcel(data: ExportData): Blob {
  // Using TSV format which Excel handles well
  const lines: string[] = [];
  
  // Header row
  lines.push(EXPORT_COLUMNS.join('\t'));
  
  // Data rows - flatten all groups
  for (const group of data.groups) {
    for (const caseItem of group.cases) {
      const row = [
        caseItem.caseNo,
        caseItem.caseType,
        caseItem.year.toString(),
        caseItem.advocateRole,
        caseItem.outcome || '',
        caseItem.dateRange,
        caseItem.lawyerNotes.replace(/\t/g, ' ').replace(/\n/g, ' | '),
      ];
      lines.push(row.join('\t'));
    }
  }
  
  // Add disclaimer at end
  lines.push('');
  lines.push(NOTES_DISCLAIMER);
  lines.push(EXPORT_FOOTER);
  
  const content = lines.join('\n');
  return new Blob([content], { type: 'application/vnd.ms-excel' });
}

// PDF Generator - returns HTML that will be converted to PDF
export function generatePDFContent(data: ExportData, pageSize: 'a4' | 'legal'): string {
  const pageWidth = pageSize === 'a4' ? '210mm' : '215.9mm';
  const pageHeight = pageSize === 'a4' ? '297mm' : '355.6mm';
  
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
    
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #000;
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
      color: #444;
    }
    
    .group-header {
      margin-top: 15px;
      margin-bottom: 10px;
      padding: 8px;
      background-color: #f5f5f5;
      border-left: 3px solid #333;
      page-break-inside: avoid;
    }
    
    .group-header .court {
      font-weight: bold;
      font-size: 11pt;
    }
    
    .group-header .judge {
      font-size: 10pt;
      color: #444;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    
    thead {
      display: table-header-group;
    }
    
    th {
      background-color: #333;
      color: #fff;
      padding: 6px 4px;
      text-align: left;
      font-size: 9pt;
      font-weight: bold;
      border: 1px solid #333;
    }
    
    td {
      padding: 5px 4px;
      border: 1px solid #ccc;
      vertical-align: top;
      font-size: 9pt;
      word-wrap: break-word;
    }
    
    tr {
      page-break-inside: avoid;
    }
    
    tr:nth-child(even) {
      background-color: #fafafa;
    }
    
    .col-caseno { width: 20%; }
    .col-type { width: 10%; }
    .col-year { width: 6%; }
    .col-role { width: 10%; }
    .col-outcome { width: 10%; }
    .col-dates { width: 20%; }
    .col-notes { width: 24%; }
    
    .notes-cell {
      white-space: pre-wrap;
      max-height: none;
    }
    
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 8pt;
      color: #666;
      padding: 10px;
      border-top: 1px solid #ccc;
    }
    
    .disclaimer {
      margin-top: 20px;
      padding: 10px;
      background-color: #fff9e6;
      border: 1px solid #e6d279;
      font-size: 8pt;
      font-style: italic;
    }
    
    .page-footer {
      text-align: center;
      font-size: 8pt;
      color: #666;
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #ccc;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Case Record - ${escapeHTML(data.lawyerName)}</h1>
    <div class="subtitle">Generated on ${data.exportDate} | Total Cases: ${data.totalCases}</div>
  </div>
`;

  // Generate each group
  for (const group of data.groups) {
    html += `
  <div class="group-header">
    <div class="court">Court No.: ${escapeHTML(group.courtNo)}</div>
    <div class="judge">Presiding Judge: ${escapeHTML(group.judgeName)}</div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th class="col-caseno">Case No.</th>
        <th class="col-type">Case Type</th>
        <th class="col-year">Year</th>
        <th class="col-role">Advocate Role</th>
        <th class="col-outcome">Outcome</th>
        <th class="col-dates">Date Range</th>
        <th class="col-notes">Lawyer Notes</th>
      </tr>
    </thead>
    <tbody>
`;
    
    for (const caseItem of group.cases) {
      html += `
      <tr>
        <td class="col-caseno">${escapeHTML(caseItem.caseNo)}</td>
        <td class="col-type">${escapeHTML(caseItem.caseType)}</td>
        <td class="col-year">${caseItem.year}</td>
        <td class="col-role">${caseItem.advocateRole}</td>
        <td class="col-outcome">${escapeHTML(caseItem.outcome || '—')}</td>
        <td class="col-dates">${escapeHTML(caseItem.dateRange)}</td>
        <td class="col-notes notes-cell">${escapeHTML(caseItem.lawyerNotes) || '—'}</td>
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
