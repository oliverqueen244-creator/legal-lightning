import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CauseListEntry {
  item_no: number;
  case_number: string;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
  petitioner: string | null;
  respondent: string | null;
  court_room_no: string;
  court_location: string;
  list_type: string;
  date: string;
  status: string;
}

interface CourtMetadata {
  court_no: string;
  judge_names: string;
  list_type: string;
  bench: string;
}

interface ScrapeRequest {
  action: 'scrape' | 'preview' | 'scrape_url';
  bench?: 'JAIPUR' | 'JODHPUR';
  date?: string;
  court_no?: string;
  url?: string;
  list_type?: 'DAILY' | 'SUPPLEMENTARY';
}

interface ScraperLog {
  bench: string;
  status: 'success' | 'partial' | 'failed' | 'warning';
  cases_found: number;
  error_message: string | null;
  list_type: string;
  court_no: string | null;
}

// Smart date logic: If current IST time < 6 PM, target today, else target tomorrow
function getSmartTargetDate(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  const istHour = istTime.getUTCHours();
  
  if (istHour >= 18) {
    const tomorrow = new Date(istTime);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  return istTime.toISOString().split('T')[0];
}

// ============================================================
// PHASE 1: Parse court table to extract court metadata
// ============================================================
function parseCourtTable(markdown: string, bench: string): CourtMetadata[] {
  const courts: CourtMetadata[] = [];
  
  console.log(`[scrape-causelist] Parsing court table from markdown (${markdown.length} chars)...`);
  console.log(`[scrape-causelist] First 500 chars: ${markdown.substring(0, 500)}`);
  
  // The markdown can be either:
  // 1. Multi-line: | Court No. | Judges | Type |\n| 1 | JUSTICE... | DS |
  // 2. Single-line: | Court No. | Judges | Type | | --- | --- | --- | | 1 | JUSTICE... | DS |
  
  // Strategy: Normalize the markdown by inserting line breaks before row patterns
  let normalizedMarkdown = markdown
    .replace(/\|\s*\|\s*(?=\d)/g, '|\n|')  // Split before court numbers like "| | 1"
    .replace(/\|\s*\|\s*(?=---)/g, '|\n|') // Split before separator row
    .replace(/\|\s*\|\s*(?=Court)/gi, '|\n|') // Split before header
    .replace(/\|\s+\|/g, '|\n|'); // General: split consecutive pipes with spaces
  
  const lines = normalizedMarkdown.split('\n');
  console.log(`[scrape-causelist] Split into ${lines.length} lines after normalization`);
  
  let inTable = false;
  let headerFound = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and separator rows
    if (!trimmed || trimmed.match(/^\|[\s\-:]+\|$/)) continue;
    if (trimmed.includes('---') && !trimmed.match(/\d/)) continue;
    
    // Detect table header
    if (trimmed.toLowerCase().includes('court no') || trimmed.toLowerCase().includes('hon\'ble')) {
      inTable = true;
      headerFound = true;
      console.log(`[scrape-causelist] Found table header: ${trimmed.substring(0, 80)}...`);
      continue;
    }
    
    if (!inTable) continue;
    
    // Parse table rows: | 1 | JUSTICE NAME | DS |
    const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
    
    console.log(`[scrape-causelist] Row cells (${cells.length}): ${JSON.stringify(cells.slice(0, 3))}`);
    
    if (cells.length >= 3) {
      const courtNo = cells[0];
      const judges = cells[1];
      const listType = cells[2];
      
      // Skip if court number is not numeric
      if (!/^\d+$/.test(courtNo)) {
        console.log(`[scrape-causelist] Skipping non-numeric court: ${courtNo}`);
        continue;
      }
      
      // Normalize list type: D = DAILY, DS = DAILY_SUPPLEMENTARY, S = SUPPLEMENTARY
      let normalizedType = 'DAILY';
      if (listType === 'DS' || listType === 'D') normalizedType = 'DAILY';
      else if (listType === 'S') normalizedType = 'SUPPLEMENTARY';
      
      courts.push({
        court_no: courtNo,
        judge_names: judges,
        list_type: normalizedType,
        bench: bench,
      });
      
      console.log(`[scrape-causelist] ✅ Parsed court ${courtNo}: ${judges.substring(0, 40)}... (${listType})`);
    }
  }
  
  // Fallback: Try to parse from the raw markdown if no courts found
  if (courts.length === 0 && markdown.includes('|')) {
    console.log(`[scrape-causelist] Fallback: Trying regex extraction...`);
    
    // Match pattern: | number | text | DS/D/S |
    const rowPattern = /\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*(DS?|S)\s*\|/g;
    let match;
    
    while ((match = rowPattern.exec(markdown)) !== null) {
      const courtNo = match[1];
      const judges = match[2].trim();
      const listType = match[3];
      
      let normalizedType = 'DAILY';
      if (listType === 'S') normalizedType = 'SUPPLEMENTARY';
      
      courts.push({
        court_no: courtNo,
        judge_names: judges,
        list_type: normalizedType,
        bench: bench,
      });
      
      console.log(`[scrape-causelist] ✅ Regex found court ${courtNo}: ${judges.substring(0, 40)}...`);
    }
  }
  
  console.log(`[scrape-causelist] ✅ Total parsed: ${courts.length} courts from table`);
  return courts;
}

// ============================================================
// PHASE 2: Click on court row to capture PDF URL
// ============================================================
async function clickCourtRowAndGetPdf(
  baseUrl: string,
  courtNo: string,
  targetDate: string,
  firecrawlApiKey: string
): Promise<string | null> {
  const dateParts = targetDate.split('-');
  const year = dateParts[0];
  const month = String(parseInt(dateParts[1], 10));
  const day = String(parseInt(dateParts[2], 10));
  
  console.log(`[scrape-causelist] Clicking court ${courtNo} row...`);
  
  try {
    // Use Firecrawl to click on the specific court row
    // The table rows are clickable and trigger PDF download
    const clickScript = `
      // First set the date
      if (document.getElementById('day')) document.getElementById('day').value = '${day}';
      if (document.getElementById('month')) document.getElementById('month').value = '${month}';
      if (document.getElementById('year')) document.getElementById('year').value = '${year}';
      
      // Submit form if needed
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
      
      // Wait for table to load
      await new Promise(r => setTimeout(r, 3000));
      
      // Find and click the row for court ${courtNo}
      const rows = document.querySelectorAll('table tbody tr');
      for (const row of rows) {
        const firstCell = row.querySelector('td:first-child');
        if (firstCell && firstCell.textContent.trim() === '${courtNo}') {
          row.click();
          break;
        }
      }
    `;
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: baseUrl,
        formats: ['links', 'html'],
        waitFor: 5000,
        actions: [
          { type: 'executeJavascript', script: clickScript },
          { type: 'wait', milliseconds: 5000 },
        ],
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const links = data.data?.links || [];
      const html = data.data?.html || '';
      
      // Look for PDF links
      const pdfLinks = links.filter((link: string) => 
        link.toLowerCase().includes('.pdf') && 
        (link.includes(courtNo) || link.includes(`court${courtNo}`))
      );
      
      if (pdfLinks.length > 0) {
        console.log(`[scrape-causelist] Found PDF for court ${courtNo}: ${pdfLinks[0]}`);
        return pdfLinks[0];
      }
      
      // Try extracting from HTML
      const pdfMatch = html.match(/href=["']([^"']*court[_-]?${courtNo}[^"']*\.pdf)/i);
      if (pdfMatch) {
        const pdfUrl = new URL(pdfMatch[1], baseUrl).toString();
        console.log(`[scrape-causelist] Extracted PDF from HTML: ${pdfUrl}`);
        return pdfUrl;
      }
    }
  } catch (err) {
    console.log(`[scrape-causelist] Error clicking court ${courtNo}: ${err}`);
  }
  
  return null;
}

// ============================================================
// PHASE 3: Try direct PDF URL construction
// ============================================================
async function tryDirectPdfUrl(
  bench: string,
  courtNo: string,
  targetDate: string,
  listType: string,
  firecrawlApiKey: string
): Promise<string | null> {
  const dateParts = targetDate.split('-');
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];
  
  // Known URL patterns for Rajasthan HC
  const benchCode = bench === 'JAIPUR' ? 'jp' : 'jdp';
  const patterns = [
    `https://hcraj.nic.in/quick-causelist-${benchCode}/pdfs/${year}${month}${day}/court${courtNo}.pdf`,
    `https://hcraj.nic.in/quick-causelist-${benchCode}/pdf/${day}${month}${year}/court${courtNo}.pdf`,
    `https://hcraj.nic.in/quick-causelist-${benchCode}/court${courtNo}_${day}${month}${year}.pdf`,
  ];
  
  for (const pdfUrl of patterns) {
    try {
      console.log(`[scrape-causelist] Trying direct URL: ${pdfUrl}`);
      const response = await fetch(pdfUrl, { method: 'HEAD' });
      if (response.ok && response.headers.get('content-type')?.includes('pdf')) {
        console.log(`[scrape-causelist] Direct URL works: ${pdfUrl}`);
        return pdfUrl;
      }
    } catch {
      // URL doesn't work, try next
    }
  }
  
  return null;
}

// ============================================================
// PHASE 4: eCourts fallback scraper
// ============================================================
async function scrapeEcourts(
  bench: string,
  targetDate: string,
  firecrawlApiKey: string
): Promise<CauseListEntry[]> {
  const entries: CauseListEntry[] = [];
  
  console.log(`[scrape-causelist] Trying eCourts fallback for ${bench}...`);
  
  // eCourts portal URL
  const stateCode = 'RJHC'; // Rajasthan High Court
  const benchCode = bench === 'JAIPUR' ? '1' : '2';
  const ecourtUrl = `https://hcservices.ecourts.gov.in/hcservices/`;
  
  try {
    // Scrape eCourts cause list page
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: ecourtUrl,
        formats: ['markdown', 'html'],
        waitFor: 10000,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const markdown = data.data?.markdown || '';
      
      console.log(`[scrape-causelist] eCourts markdown length: ${markdown.length}`);
      
      // Parse eCourts format (typically different from HC website)
      // This is a placeholder - actual parsing depends on eCourts structure
      if (markdown.includes('cause list') || markdown.includes('causelist')) {
        console.log(`[scrape-causelist] eCourts has cause list data`);
        // Parse entries...
      }
    }
  } catch (err) {
    console.log(`[scrape-causelist] eCourts scrape failed: ${err}`);
  }
  
  return entries;
}

// Extract PDF links from HTML response
function extractPdfLinksFromHtml(html: string, baseUrl: string): string[] {
  const pdfPattern = /href=["']([^"']*\.pdf[^"']*)["']/gi;
  const links: string[] = [];
  let match;
  
  while ((match = pdfPattern.exec(html)) !== null) {
    let url = match[1];
    if (!url.startsWith('http')) {
      try {
        url = new URL(url, baseUrl).toString();
      } catch {
        continue;
      }
    }
    if (!links.includes(url)) {
      links.push(url);
    }
  }
  
  console.log(`[scrape-causelist] Extracted ${links.length} PDF links from HTML`);
  return links;
}

// Scrape PDF content using Firecrawl
async function scrapePdfWithFirecrawl(pdfUrl: string, firecrawlApiKey: string): Promise<string> {
  console.log(`[scrape-causelist] Scraping PDF: ${pdfUrl}`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: pdfUrl,
      formats: ['markdown'],
      timeout: 60000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[scrape-causelist] Firecrawl PDF error: ${errorText}`);
    throw new Error(`Failed to scrape PDF: ${response.statusText}`);
  }

  const data = await response.json();
  const markdown = data.data?.markdown || '';
  console.log(`[scrape-causelist] PDF scraped, got ${markdown.length} chars`);
  return markdown;
}

// Extract court number from PDF URL or filename
function extractCourtNoFromUrl(pdfUrl: string): string {
  const patterns = [
    /court[_\-\s]?no?[_\-\s]?(\d+)/i,
    /court[_\-\s]?(\d+)/i,
    /(\d+)\.pdf$/i,
  ];
  
  for (const pattern of patterns) {
    const match = pdfUrl.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return '1';
}

// Detect list type from URL or content
function detectListType(pdfUrl: string, content: string): string {
  const urlLower = pdfUrl.toLowerCase();
  const contentLower = content.toLowerCase().substring(0, 500);
  
  if (urlLower.includes('supp') || urlLower.includes('/s/') || contentLower.includes('supplementary')) {
    return 'SUPPLEMENTARY';
  }
  return 'DAILY';
}

// Enhanced PDF text parser for Rajasthan High Court cause lists
function parseCauseListPdf(
  pdfText: string, 
  courtLocation: string, 
  courtNo: string, 
  date: string, 
  listType: string
): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  const lines = pdfText.split('\n');
  
  console.log(`[scrape-causelist] Parsing PDF with ${lines.length} lines`);
  
  const tableRowPattern = /\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|/;
  const numberedPattern = /^\s*(\d+)[\.\)]\s+([A-Z][A-Z\s./\-]*(?:\/\d{4}|\d{4}\/\d+))/i;
  const caseNumberPattern = /([SDB]\.?[AB]?\.?(?:CWP|CIVIL|CRIMINAL|WP|SA|CA|MA|RA|SB|DB|REV|CMA)[\/\s]*(?:No\.?)?\s*\d+[\/\-]\d{4})/gi;
  const partyPattern = /([A-Za-z\s.&,]+)\s+(?:Vs\.?|vs\.?|V\/s\.?|versus|V\.)\s+([A-Za-z\s.&,]+)/i;
  const advocatePatterns = [
    /(?:Adv\.?|Advocate|Counsel)[:\s]*([A-Za-z\s.]+)/gi,
    /(?:Mr\.?|Ms\.?|Shri|Smt\.?)\s+([A-Za-z\s.]+?)(?:\s+(?:Adv|Advocate|for|$))/gi,
  ];
  
  let currentEntry: Partial<CauseListEntry> | null = null;
  let itemCounter = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.toLowerCase().includes('s.no') || 
        line.toLowerCase().includes('serial') ||
        line.toLowerCase().includes('case number') ||
        line.toLowerCase().includes('advocate')) {
      continue;
    }
    
    const tableMatch = line.match(tableRowPattern);
    if (tableMatch) {
      const [, itemNo, caseNum, parties, petAdv, respAdv] = tableMatch;
      const partyMatch = parties.match(partyPattern);
      
      entries.push({
        item_no: parseInt(itemNo),
        case_number: caseNum.trim(),
        petitioner: partyMatch ? partyMatch[1].trim() : null,
        respondent: partyMatch ? partyMatch[2].trim() : null,
        petitioner_lawyer: petAdv?.trim() || null,
        respondent_lawyer: respAdv?.trim() || null,
        court_room_no: courtNo,
        court_location: courtLocation,
        list_type: listType,
        date: date,
        status: 'pending',
      });
      continue;
    }
    
    const numberedMatch = line.match(numberedPattern);
    if (numberedMatch) {
      if (currentEntry && currentEntry.case_number) {
        entries.push({
          item_no: currentEntry.item_no || ++itemCounter,
          case_number: currentEntry.case_number,
          petitioner: currentEntry.petitioner || null,
          respondent: currentEntry.respondent || null,
          petitioner_lawyer: currentEntry.petitioner_lawyer || null,
          respondent_lawyer: currentEntry.respondent_lawyer || null,
          court_room_no: courtNo,
          court_location: courtLocation,
          list_type: listType,
          date: date,
          status: 'pending',
        });
      }
      
      currentEntry = {
        item_no: parseInt(numberedMatch[1]),
        case_number: numberedMatch[2].trim(),
      };
      
      const partyMatch = line.match(partyPattern);
      if (partyMatch) {
        currentEntry.petitioner = partyMatch[1].trim();
        currentEntry.respondent = partyMatch[2].trim();
      }
      
      for (const pattern of advocatePatterns) {
        pattern.lastIndex = 0;
        const advMatches = [...line.matchAll(pattern)];
        if (advMatches.length > 0 && !currentEntry.petitioner_lawyer) {
          currentEntry.petitioner_lawyer = advMatches[0][1].trim();
        }
        if (advMatches.length > 1 && !currentEntry.respondent_lawyer) {
          currentEntry.respondent_lawyer = advMatches[1][1].trim();
        }
      }
      
      continue;
    }
    
    if (currentEntry) {
      if (!currentEntry.case_number) {
        const caseMatch = line.match(caseNumberPattern);
        if (caseMatch) {
          currentEntry.case_number = caseMatch[0].trim();
        }
      }
      
      if (!currentEntry.petitioner) {
        const partyMatch = line.match(partyPattern);
        if (partyMatch) {
          currentEntry.petitioner = partyMatch[1].trim();
          currentEntry.respondent = partyMatch[2].trim();
        }
      }
      
      for (const pattern of advocatePatterns) {
        pattern.lastIndex = 0;
        const advMatches = [...line.matchAll(pattern)];
        if (advMatches.length > 0 && !currentEntry.petitioner_lawyer) {
          currentEntry.petitioner_lawyer = advMatches[0][1].trim();
        }
        if (advMatches.length > 1 && !currentEntry.respondent_lawyer) {
          currentEntry.respondent_lawyer = advMatches[1][1].trim();
        }
      }
    }
    
    if (!currentEntry || !currentEntry.case_number) {
      caseNumberPattern.lastIndex = 0;
      const caseMatches = [...line.matchAll(caseNumberPattern)];
      if (caseMatches.length > 0) {
        if (currentEntry && currentEntry.case_number) {
          entries.push({
            item_no: currentEntry.item_no || ++itemCounter,
            case_number: currentEntry.case_number,
            petitioner: currentEntry.petitioner || null,
            respondent: currentEntry.respondent || null,
            petitioner_lawyer: currentEntry.petitioner_lawyer || null,
            respondent_lawyer: currentEntry.respondent_lawyer || null,
            court_room_no: courtNo,
            court_location: courtLocation,
            list_type: listType,
            date: date,
            status: 'pending',
          });
        }
        
        currentEntry = {
          item_no: ++itemCounter,
          case_number: caseMatches[0][0].trim(),
        };
      }
    }
  }
  
  if (currentEntry && currentEntry.case_number) {
    entries.push({
      item_no: currentEntry.item_no || ++itemCounter,
      case_number: currentEntry.case_number,
      petitioner: currentEntry.petitioner || null,
      respondent: currentEntry.respondent || null,
      petitioner_lawyer: currentEntry.petitioner_lawyer || null,
      respondent_lawyer: currentEntry.respondent_lawyer || null,
      court_room_no: courtNo,
      court_location: courtLocation,
      list_type: listType,
      date: date,
      status: 'pending',
    });
  }
  
  console.log(`[scrape-causelist] Parsed ${entries.length} entries from PDF`);
  return entries;
}

// Log scraper run to database
async function logScraperRun(supabase: any, log: ScraperLog): Promise<void> {
  try {
    await supabase.from('scraper_logs').insert(log);
    console.log(`[scrape-causelist] Logged: ${log.status}, ${log.cases_found} cases`);
  } catch (err) {
    console.error('[scrape-causelist] Failed to log scraper run:', err);
  }
}

// Result type for scrape with HTML fallback
interface ScrapeResult {
  pdfLinks: string[];
  htmlContent?: string;
  markdownContent?: string;
  courts?: CourtMetadata[];
}

// Submit form to court website and get court list + PDF links
async function submitFormAndGetPdfLinks(
  baseUrl: string, 
  targetDate: string,
  bench: string,
  firecrawlApiKey: string
): Promise<ScrapeResult> {
  const dateParts = targetDate.split('-');
  const year = dateParts[0];
  const month = String(parseInt(dateParts[1], 10));
  const day = String(parseInt(dateParts[2], 10));
  
  console.log(`[scrape-causelist] ==========================================`);
  console.log(`[scrape-causelist] Form submission for date: ${day}/${month}/${year}`);
  console.log(`[scrape-causelist] Target URL: ${baseUrl}`);
  console.log(`[scrape-causelist] ==========================================`);
  
  let lastHtmlContent = '';
  let lastMarkdownContent = '';
  let courts: CourtMetadata[] = [];
  
  // Method 1: Use Firecrawl with executeJavascript to fill and submit form
  console.log(`[scrape-causelist] Method 1: Firecrawl with executeJavascript...`);
  
  try {
    const setFormScript = `
      if (document.getElementById('day')) document.getElementById('day').value = '${day}';
      if (document.getElementById('month')) document.getElementById('month').value = '${month}';
      if (document.getElementById('year')) document.getElementById('year').value = '${year}';
      const btn = document.querySelector('button[type="submit"]');
      if (btn) btn.click();
    `;
    
    const actions = [
      { type: 'executeJavascript', script: setFormScript },
      { type: 'wait', milliseconds: 10000 },
    ];
    
    console.log(`[scrape-causelist] Firecrawl JS script: Setting day=${day}, month=${month}, year=${year}`);
    
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: baseUrl,
        formats: ['markdown', 'links', 'html'],
        waitFor: 5000,
        actions: actions,
      }),
    });
    
    console.log(`[scrape-causelist] Firecrawl response status: ${firecrawlResponse.status}`);
    
    if (firecrawlResponse.ok) {
      const data = await firecrawlResponse.json();
      const html = data.data?.html || '';
      const markdown = data.data?.markdown || '';
      const links = data.data?.links || [];
      
      lastHtmlContent = html;
      lastMarkdownContent = markdown;
      
      console.log(`[scrape-causelist] Firecrawl HTML length: ${html.length} chars`);
      console.log(`[scrape-causelist] Firecrawl markdown length: ${markdown.length} chars`);
      
      // PHASE 1: Parse court table from markdown
      courts = parseCourtTable(markdown, bench);
      console.log(`[scrape-causelist] Found ${courts.length} courts in table`);
      
      // Extract PDF links
      let pdfLinks = extractPdfLinksFromHtml(html, baseUrl);
      const linksPdfs = links.filter((link: string) => 
        link.toLowerCase().endsWith('.pdf')
      );
      
      pdfLinks = [...new Set([...pdfLinks, ...linksPdfs])];
      
      if (pdfLinks.length > 0) {
        console.log(`[scrape-causelist] ✅ Got ${pdfLinks.length} PDF links from Firecrawl`);
        return { pdfLinks, htmlContent: html, markdownContent: markdown, courts };
      }
    }
  } catch (err) {
    console.log(`[scrape-causelist] ❌ Firecrawl actions failed: ${err}`);
  }
  
  // Method 2: Try direct POST
  try {
    console.log(`[scrape-causelist] Method 2: Direct POST...`);
    const formData = new URLSearchParams({ day, month, year });
    
    const postResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formData.toString(),
    });
    
    if (postResponse.ok) {
      const html = await postResponse.text();
      lastHtmlContent = html || lastHtmlContent;
      
      const pdfLinks = extractPdfLinksFromHtml(html, baseUrl);
      if (pdfLinks.length > 0) {
        return { pdfLinks, htmlContent: html, courts };
      }
    }
  } catch (err) {
    console.log(`[scrape-causelist] ❌ Direct POST failed: ${err}`);
  }
  
  console.log(`[scrape-causelist] ⚠️ No PDF links found, returning court metadata for UI display`);
  return { pdfLinks: [], htmlContent: lastHtmlContent, markdownContent: lastMarkdownContent, courts };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { 
      action, 
      bench = 'JAIPUR', 
      date, 
      court_no = '1', 
      url, 
      list_type = 'DAILY' 
    } = await req.json() as ScrapeRequest;
    
    const targetDate = date || getSmartTargetDate();
    
    console.log(`[scrape-causelist] ========================================`);
    console.log(`[scrape-causelist] Action: ${action}, Bench: ${bench}`);
    console.log(`[scrape-causelist] Date: ${targetDate}, Court: ${court_no}, List: ${list_type}`);
    console.log(`[scrape-causelist] ========================================`);
    
    const baseUrls: Record<string, string> = {
      'JAIPUR': 'https://hcraj.nic.in/quick-causelist-jp/',
      'JODHPUR': 'https://hcraj.nic.in/quick-causelist-jdp/',
    };
    
    const targetUrl = url || baseUrls[bench];
    
    if (!targetUrl) {
      await logScraperRun(supabase, {
        bench,
        status: 'failed',
        cases_found: 0,
        error_message: 'Invalid bench specified',
        list_type,
        court_no,
      });
      
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid bench specified' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!firecrawlApiKey) {
      await logScraperRun(supabase, {
        bench,
        status: 'failed',
        cases_found: 0,
        error_message: 'Firecrawl API key not configured',
        list_type,
        court_no,
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Firecrawl API key not configured.',
          needs_firecrawl: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // PHASE 1: Submit form to get court list and PDF links
    console.log(`[scrape-causelist] PHASE 1: Getting court table and PDF links from ${targetUrl}`);
    const scrapeResult = await submitFormAndGetPdfLinks(targetUrl, targetDate, bench, firecrawlApiKey);
    const pdfLinks = scrapeResult.pdfLinks;
    const courts = scrapeResult.courts || [];
    
    console.log(`[scrape-causelist] Found ${pdfLinks.length} PDF links, ${courts.length} courts`);
    
    // Store court metadata in database
    if (courts.length > 0) {
      console.log(`[scrape-causelist] Storing ${courts.length} court metadata entries...`);
      
      for (const court of courts) {
        try {
          const { error } = await supabase
            .from('court_metadata')
            .upsert({
              bench: court.bench,
              court_no: court.court_no,
              judge_names: court.judge_names,
              last_updated: new Date().toISOString(),
            }, {
              onConflict: 'bench,court_no',
            });
          
          if (error) {
            console.log(`[scrape-causelist] Court metadata upsert error: ${error.message}`);
          }
        } catch (err) {
          console.log(`[scrape-causelist] Court metadata error: ${err}`);
        }
      }
    }
    
    // PHASE 2: Try to get PDFs by clicking court rows if no direct links
    let allEntries: CauseListEntry[] = [];
    const pdfResults: { url: string; entries: number; error?: string }[] = [];
    
    if (pdfLinks.length === 0 && courts.length > 0) {
      console.log(`[scrape-causelist] PHASE 2: Trying to click court rows to get PDFs...`);
      
      // Try first 3 courts to avoid timeout
      const courtsToTry = courts.slice(0, 3);
      
      for (const court of courtsToTry) {
        // Try direct URL construction first (faster)
        let pdfUrl = await tryDirectPdfUrl(bench, court.court_no, targetDate, court.list_type, firecrawlApiKey);
        
        if (!pdfUrl) {
          // Try clicking the row
          pdfUrl = await clickCourtRowAndGetPdf(targetUrl, court.court_no, targetDate, firecrawlApiKey);
        }
        
        if (pdfUrl) {
          pdfLinks.push(pdfUrl);
        }
      }
    }
    
    // PHASE 3: Scrape and parse PDFs
    if (pdfLinks.length > 0) {
      console.log(`[scrape-causelist] PHASE 3: Scraping ${pdfLinks.length} PDFs...`);
      
      for (const pdfUrl of pdfLinks) {
        try {
          const pdfCourtNo = extractCourtNoFromUrl(pdfUrl);
          const pdfContent = await scrapePdfWithFirecrawl(pdfUrl, firecrawlApiKey);
          
          if (pdfContent.length < 100) {
            pdfResults.push({ url: pdfUrl, entries: 0, error: 'Empty content' });
            continue;
          }
          
          const detectedListType = detectListType(pdfUrl, pdfContent);
          const entries = parseCauseListPdf(pdfContent, bench, pdfCourtNo, targetDate, detectedListType);
          
          console.log(`[scrape-causelist] Parsed ${entries.length} entries from ${pdfUrl}`);
          pdfResults.push({ url: pdfUrl, entries: entries.length });
          
          allEntries = allEntries.concat(entries);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[scrape-causelist] Failed to process PDF ${pdfUrl}: ${errorMsg}`);
          pdfResults.push({ url: pdfUrl, entries: 0, error: errorMsg });
        }
      }
    }
    
    // PHASE 4: eCourts fallback if no cases found
    if (allEntries.length === 0) {
      console.log(`[scrape-causelist] PHASE 4: Trying eCourts fallback...`);
      const ecourtEntries = await scrapeEcourts(bench, targetDate, firecrawlApiKey);
      allEntries = ecourtEntries;
    }
    
    console.log(`[scrape-causelist] Total entries parsed: ${allEntries.length}`);
    
    // If preview mode, return the parsed data without inserting
    if (action === 'preview') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          entries: allEntries,
          pdf_links: pdfLinks,
          pdf_results: pdfResults,
          courts: courts,
          target_date: targetDate,
          message: `Found ${courts.length} courts, ${pdfLinks.length} PDFs, ${allEntries.length} cases`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // STEP 5: Insert entries into database
    if (allEntries.length > 0) {
      console.log(`[scrape-causelist] STEP 5: Inserting ${allEntries.length} entries into database...`);
      
      let inserted = 0;
      let updated = 0;
      let errors = 0;
      
      for (const entry of allEntries) {
        try {
          const { data: existing } = await supabase
            .from('daily_court_docket')
            .select('id')
            .eq('case_number', entry.case_number)
            .eq('date', entry.date)
            .eq('court_room_no', entry.court_room_no)
            .eq('list_type', entry.list_type)
            .single();
          
          if (existing) {
            const { error: updateError } = await supabase
              .from('daily_court_docket')
              .update({
                petitioner_lawyer: entry.petitioner_lawyer,
                respondent_lawyer: entry.respondent_lawyer,
                petitioner: entry.petitioner,
                respondent: entry.respondent,
                item_no: entry.item_no,
              })
              .eq('id', existing.id);
            
            if (updateError) {
              errors++;
            } else {
              updated++;
            }
          } else {
            const { error: insertError } = await supabase
              .from('daily_court_docket')
              .insert(entry);
            
            if (insertError) {
              errors++;
            } else {
              inserted++;
            }
          }
        } catch (err) {
          errors++;
        }
      }
      
      console.log(`[scrape-causelist] DB results: ${inserted} inserted, ${updated} updated, ${errors} errors`);
      
      const status = errors === 0 ? 'success' : (inserted + updated > 0 ? 'partial' : 'failed');
      
      await logScraperRun(supabase, {
        bench,
        status,
        cases_found: allEntries.length,
        error_message: errors > 0 ? `${errors} database errors` : null,
        list_type,
        court_no,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          entries_count: allEntries.length,
          inserted,
          updated,
          errors,
          courts_found: courts.length,
          pdf_links: pdfLinks,
          target_date: targetDate,
          message: `Processed ${allEntries.length} cases: ${inserted} new, ${updated} updated`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // No cases found - log as warning but still successful if courts found
    const status = courts.length > 0 ? 'warning' : 'failed';
    const message = courts.length > 0 
      ? `Found ${courts.length} courts but no case data (PDFs may not be available yet)`
      : 'No cause list data found';
    
    await logScraperRun(supabase, {
      bench,
      status,
      cases_found: 0,
      error_message: message,
      list_type,
      court_no,
    });
    
    return new Response(
      JSON.stringify({ 
        success: courts.length > 0, 
        entries_count: 0,
        courts_found: courts.length,
        courts: courts,
        pdf_links: pdfLinks,
        target_date: targetDate,
        message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[scrape-causelist] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
