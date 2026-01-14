/**
 * Morning Brief PDF Export
 * 
 * Generates a legal-size PDF of the morning brief.
 * 
 * EXPORT CONTRACT:
 * This export is intentionally black & white.
 * Do NOT add color, badges, or visual emphasis.
 * Court-print safe by design.
 */

import { format } from 'date-fns';
import type { MorningBrief, MorningBriefCase } from '@/hooks/useMorningBrief';

// Legal size page dimensions
const PAGE_WIDTH = '215.9mm';
const PAGE_HEIGHT = '355.6mm';
const MARGINS = { top: 15, right: 12, bottom: 15, left: 12 };

/**
 * Generate and print a legal-size PDF of the morning brief
 */
export function generateBriefPDF(brief: MorningBrief, lawyerName: string): void {
  const today = format(new Date(), 'dd MMM yyyy');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Morning Brief - ${lawyerName} - ${today}</title>
  <style>
    @page {
      size: ${PAGE_WIDTH} ${PAGE_HEIGHT};
      margin: ${MARGINS.top}mm ${MARGINS.right}mm ${MARGINS.bottom}mm ${MARGINS.left}mm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 8pt;
      margin-bottom: 12pt;
    }
    
    .header h1 {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1pt;
      margin-bottom: 4pt;
    }
    
    .header .subtitle {
      font-size: 10pt;
      color: #333;
    }
    
    .summary {
      display: flex;
      justify-content: space-between;
      border: 1px solid #000;
      padding: 8pt;
      margin-bottom: 12pt;
    }
    
    .summary-item {
      text-align: center;
    }
    
    .summary-item .number {
      font-size: 18pt;
      font-weight: bold;
    }
    
    .summary-item .label {
      font-size: 8pt;
      text-transform: uppercase;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8pt;
    }
    
    th, td {
      border: 1px solid #000;
      padding: 6pt 4pt;
      text-align: left;
      vertical-align: top;
      font-size: 10pt;
    }
    
    th {
      background: #f0f0f0;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 8pt;
    }
    
    tr {
      page-break-inside: avoid;
    }
    
    .col-item { width: 6%; text-align: center; }
    .col-case { width: 18%; font-family: 'Courier New', monospace; font-size: 9pt; }
    .col-court { width: 10%; }
    .col-parties { width: 22%; }
    .col-readiness { width: 8%; text-align: center; }
    .col-suggestion { width: 10%; }
    .col-notes { 
      width: 26%; 
      min-height: 48px;
      background-image: repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 15px,
        #ccc 15px,
        #ccc 16px
      );
    }
    
    .footer {
      margin-top: 16pt;
      padding-top: 8pt;
      border-top: 1px solid #000;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }
    
    .disclaimer {
      font-style: italic;
      margin-bottom: 4pt;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Morning Brief</h1>
    <div class="subtitle">${lawyerName} • Date: ${today} • Generated at ${format(new Date(brief.generated_at), 'HH:mm')}</div>
  </div>
  
  <div class="summary">
    <div class="summary-item">
      <div class="number">${brief.total_cases}</div>
      <div class="label">Total Cases</div>
    </div>
    <div class="summary-item">
      <div class="number">${brief.summary.attend_count}</div>
      <div class="label">Attend</div>
    </div>
    <div class="summary-item">
      <div class="number">${brief.summary.delegate_count}</div>
      <div class="label">Delegate</div>
    </div>
    <div class="summary-item">
      <div class="number">${brief.summary.monitor_count}</div>
      <div class="label">Monitor</div>
    </div>
    <div class="summary-item">
      <div class="number">${brief.summary.high_risk_count}</div>
      <div class="label">High Risk</div>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th class="col-item">#</th>
        <th class="col-case">Case No.</th>
        <th class="col-court">Court</th>
        <th class="col-parties">Parties</th>
        <th class="col-readiness">Ready</th>
        <th class="col-suggestion">Action</th>
        <th class="col-notes">Notes</th>
      </tr>
    </thead>
    <tbody>
      ${brief.cases.map((c) => generateCaseRow(c)).join('')}
    </tbody>
  </table>
  
  <div class="footer">
    <div class="disclaimer">System-generated assistance. Verify against official court records.</div>
    <div>Exported from NyayHub • ${today}</div>
  </div>
</body>
</html>
`;

  // Open print dialog for PDF generation
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  } else {
    console.error('Could not open print window. Please allow popups.');
  }
}

function generateCaseRow(c: MorningBriefCase): string {
  const petitioner = c.petitioner || '—';
  const respondent = c.respondent || '—';
  const parties = `${truncate(petitioner, 30)} v. ${truncate(respondent, 30)}`;
  
  const risks: string[] = [];
  if (c.risks.missing_documents) risks.push('No docs');
  if (c.risks.pending_review) risks.push('Pending');
  if (c.risks.low_readiness) risks.push('Low prep');
  if (c.risks.late_listed) risks.push('Late');
  
  const riskText = risks.length > 0 ? ` [${risks.join(', ')}]` : '';
  
  return `
    <tr>
      <td class="col-item">${c.item_no}</td>
      <td class="col-case">${escapeHtml(c.case_number)}</td>
      <td class="col-court">${c.court_room_no}<br/>${c.court_location}</td>
      <td class="col-parties">${escapeHtml(parties)}${riskText}</td>
      <td class="col-readiness">${c.readiness.total}%</td>
      <td class="col-suggestion">${capitalize(c.suggestion)}</td>
      <td class="col-notes"></td>
    </tr>
  `;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '…';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
