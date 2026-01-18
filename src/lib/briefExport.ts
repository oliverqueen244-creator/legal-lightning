/**
 * Morning Brief PDF Export
 * 
 * Generates a legal-size PDF of the morning brief.
 * Uses the SAME format as Case Export for consistency.
 * 
 * EXPORT CONTRACT:
 * This export is intentionally black & white.
 * Do NOT add color, badges, or visual emphasis.
 * Court-print safe by design.
 * No Virtual Court links or meeting IDs are included.
 */

import { format, parse } from 'date-fns';
import type { MorningBrief, MorningBriefCase } from '@/hooks/useMorningBrief';
import { 
  EXPORT_FOOTER, 
  NOTES_DISCLAIMER,
  PDF_MARGINS 
} from '@/types/export';

// Legal size page dimensions
const PAGE_WIDTH = '215.9mm';
const PAGE_HEIGHT = '355.6mm';

// Normalize opposing counsel value
// If petitioner → opposing is respondent_lawyer
// If respondent → opposing is petitioner_lawyer
// Gov cases → "State Counsel / PP"
// Empty → "—"
function normalizeOpposingCounsel(
  matchedAs: 'petitioner' | 'respondent' | null,
  petitionerLawyer: string | null,
  respondentLawyer: string | null,
  respondent: string | null
): string {
  // If matched as petitioner, opposing counsel is respondent's lawyer
  // If matched as respondent, opposing counsel is petitioner's lawyer
  const opposingRaw = matchedAs === 'petitioner' 
    ? respondentLawyer 
    : matchedAs === 'respondent'
      ? petitionerLawyer
      : null;
  
  if (opposingRaw?.trim()) {
    return opposingRaw.trim();
  }
  
  // Check if government case (common respondents)
  const govPatterns = [
    /state\s+of/i,
    /union\s+of\s+india/i,
    /government/i,
    /municipal/i,
    /nagar\s*(palika|nigam)/i,
  ];
  
  const isGovCase = respondent && govPatterns.some(p => p.test(respondent));
  if (isGovCase) {
    return 'State Counsel / PP';
  }
  
  return '—';
}

// Derive listing status from brief case data
function deriveListingStatus(briefCase: MorningBriefCase): 'Normal' | 'Late Listed' {
  return briefCase.risks.late_listed ? 'Late Listed' : 'Normal';
}

// Group cases by court/judge
interface BriefGroup {
  courtNo: string;
  judgeName: string;
  cases: MorningBriefCase[];
}

function groupCasesByCourtJudge(cases: MorningBriefCase[]): BriefGroup[] {
  const groupMap = new Map<string, BriefGroup>();
  
  for (const c of cases) {
    const key = `${c.court_room_no}::${c.judge_names || 'Unknown'}`;
    
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        courtNo: c.court_room_no || 'Unknown',
        judgeName: c.judge_names || 'Unknown',
        cases: [],
      });
    }
    
    groupMap.get(key)!.cases.push(c);
  }
  
  // Sort groups by court number
  return Array.from(groupMap.values()).sort((a, b) => 
    a.courtNo.localeCompare(b.courtNo, undefined, { numeric: true })
  );
}

/**
 * Generate and print a legal-size PDF of the morning brief
 * Matches Case Export format exactly
 */
export function generateBriefPDF(brief: MorningBrief, lawyerName: string): void {
  // Use the brief's date if available, otherwise fall back to today
  const briefDate = brief.briefDate 
    ? parse(brief.briefDate, 'yyyy-MM-dd', new Date())
    : new Date();
  const dateStr = format(briefDate, 'dd MMM yyyy');
  const groups = groupCasesByCourtJudge(brief.cases);
  
  // EXPORT CONTRACT:
  // This export is intentionally black & white.
  // Do NOT add color, badges, or visual emphasis.
  // Court-print safe by design.
  
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Morning Brief - ${escapeHtml(lawyerName)} - ${dateStr}</title>
  <style>
    @page {
      size: ${PAGE_WIDTH} ${PAGE_HEIGHT};
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
    
    /* Column widths - matching Case Export layout with Sr. No. */
    .col-srno { width: 5%; text-align: center; }
    .col-caseno { width: 14%; font-family: 'Courier New', monospace; }
    .col-petitioner { width: 12%; }
    .col-respondent { width: 12%; }
    .col-opposing { width: 11%; }
    .col-role { width: 6%; }
    .col-listing { width: 6%; }
    .col-outcome { width: 6%; }
    .col-notes { width: 24%; }
    
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
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Morning Brief — ${escapeHtml(lawyerName)}</h1>
    <div class="subtitle">Generated on ${format(new Date(), 'dd MMM yyyy')} | Total Cases: ${brief.total_cases}</div>
    <div class="date-scope">Date: ${dateStr}</div>
  </div>
`;

  // Generate each group
  for (const group of groups) {
    html += `
  <div class="group-header">
    <div class="court">Court No.: ${escapeHtml(group.courtNo)}</div>
    <div class="judge">Presiding Judge: ${escapeHtml(group.judgeName)}</div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th class="col-srno">Sr.</th>
        <th class="col-caseno">Case No.</th>
        <th class="col-petitioner">Petitioner</th>
        <th class="col-respondent">Respondent</th>
        <th class="col-opposing">Opp. Counsel</th>
        <th class="col-role">Role</th>
        <th class="col-listing">Listing</th>
        <th class="col-outcome">Outcome</th>
        <th class="col-notes">Lawyer Notes</th>
      </tr>
    </thead>
    <tbody>
`;

    for (const c of group.cases) {
      html += generateCaseRow(c);
    }

    html += `
    </tbody>
  </table>
`;
  }

  // Add disclaimer and footer (matching Case Export)
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
  const petitionerDisplay = c.petitioner?.trim() || '—';
  const respondentDisplay = c.respondent?.trim() || '—';
  
  // Derive opposing counsel from the brief case data
  const opposingCounsel = normalizeOpposingCounsel(
    c.matched_as,
    c.petitioner_lawyer,
    c.respondent_lawyer,
    c.respondent
  );
  
  // Role from matched_as
  const role = c.matched_as === 'petitioner' 
    ? 'Petitioner' 
    : c.matched_as === 'respondent' 
      ? 'Respondent' 
      : '—';
  
  // Listing status
  const listingStatus = deriveListingStatus(c);
  
  // Outcome - not available in morning brief (it's for today), show "—"
  const outcome = '—';
  
  const itemNoDisplay = c.item_no != null ? String(c.item_no) : '—';
  
  return `
      <tr>
        <td class="col-srno">${itemNoDisplay}</td>
        <td class="col-caseno caseno-cell">${escapeHtml(c.case_number)}</td>
        <td class="col-petitioner party-cell">${escapeHtml(petitionerDisplay)}</td>
        <td class="col-respondent party-cell">${escapeHtml(respondentDisplay)}</td>
        <td class="col-opposing party-cell">${escapeHtml(opposingCounsel)}</td>
        <td class="col-role">${role}</td>
        <td class="col-listing">${listingStatus}</td>
        <td class="col-outcome">${outcome}</td>
        <td class="col-notes notes-cell"> </td>
      </tr>
`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
