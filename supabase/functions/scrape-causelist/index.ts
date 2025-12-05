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

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// BROWSERLESS.IO SCRAPER - Full headless Chrome browser
// ============================================================

interface BrowserlessResult {
  html: string;
  pdfLinks: string[];
  courts: CourtMetadata[];
  pdfContents: Map<string, string>;
}

async function scrapeWithBrowserless(
  baseUrl: string,
  targetDate: string,
  bench: string,
  browserlessApiKey: string
): Promise<BrowserlessResult> {
  const dateParts = targetDate.split('-');
  const year = dateParts[0];
  const month = String(parseInt(dateParts[1], 10));
  const day = String(parseInt(dateParts[2], 10));
  
  console.log(`[scrape-causelist] 🚀 Starting Browserless scrape for ${bench}`);
  console.log(`[scrape-causelist] Target date: ${day}/${month}/${year}`);
  console.log(`[scrape-causelist] URL: ${baseUrl}`);
  
  const result: BrowserlessResult = {
    html: '',
    pdfLinks: [],
    courts: [],
    pdfContents: new Map(),
  };
  
  // Browserless.io /content endpoint - returns rendered HTML after JS execution
  const browserlessUrl = `https://chrome.browserless.io/content?token=${browserlessApiKey}`;
  
  // Script to fill form and submit
  const script = `
    (async () => {
      // Wait for page to load
      await new Promise(r => setTimeout(r, 2000));
      
      // Fill date fields
      const daySelect = document.querySelector('select[name="day"], #day');
      const monthSelect = document.querySelector('select[name="month"], #month');
      const yearSelect = document.querySelector('select[name="year"], #year');
      
      if (daySelect) daySelect.value = '${day}';
      if (monthSelect) monthSelect.value = '${month}';
      if (yearSelect) yearSelect.value = '${year}';
      
      // Find and click submit button
      const submitBtn = document.querySelector('input[type="submit"], button[type="submit"], .submit-btn, #submit');
      if (submitBtn) {
        submitBtn.click();
      }
      
      // Wait for results
      await new Promise(r => setTimeout(r, 5000));
    })();
  `;
  
  try {
    // Step 1: Get the page with form filled and submitted
    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: baseUrl,
        gotoOptions: {
          waitUntil: 'networkidle2',
          timeout: 30000,
        },
        waitForSelector: {
          selector: 'table',
          timeout: 10000,
        },
        addScriptTag: [{
          content: script,
        }],
        waitForTimeout: 8000, // Wait for script to execute
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[scrape-causelist] ❌ Browserless error: ${response.status} - ${errorText}`);
      throw new Error(`Browserless request failed: ${response.status}`);
    }
    
    result.html = await response.text();
    console.log(`[scrape-causelist] ✅ Got HTML content: ${result.html.length} chars`);
    
    // Parse court metadata from HTML table
    result.courts = parseCourtTableFromHtml(result.html, bench);
    console.log(`[scrape-causelist] Found ${result.courts.length} courts`);
    
    // Extract PDF links from the HTML
    result.pdfLinks = extractPdfLinksFromHtml(result.html, baseUrl);
    console.log(`[scrape-causelist] Found ${result.pdfLinks.length} PDF links`);
    
    // Step 2: For each court, try to get the PDF content
    if (result.courts.length > 0 && result.pdfLinks.length === 0) {
      console.log(`[scrape-causelist] No direct PDF links, trying to click court rows...`);
      
      // Try scraping with click actions for first 3 courts
      for (let i = 0; i < Math.min(3, result.courts.length); i++) {
        const court = result.courts[i];
        const pdfResult = await scrapeCourtPdfWithBrowserless(
          baseUrl,
          court.court_no,
          targetDate,
          browserlessApiKey
        );
        
        if (pdfResult.pdfUrl) {
          result.pdfLinks.push(pdfResult.pdfUrl);
        }
        if (pdfResult.content) {
          result.pdfContents.set(court.court_no, pdfResult.content);
        }
        
        // Small delay between requests
        await sleep(2000);
      }
    }
    
  } catch (err) {
    console.error(`[scrape-causelist] ❌ Browserless scrape failed: ${err}`);
    throw err;
  }
  
  return result;
}

// Click on a specific court row and capture the PDF
async function scrapeCourtPdfWithBrowserless(
  baseUrl: string,
  courtNo: string,
  targetDate: string,
  browserlessApiKey: string
): Promise<{ pdfUrl: string | null; content: string | null }> {
  const dateParts = targetDate.split('-');
  const year = dateParts[0];
  const month = String(parseInt(dateParts[1], 10));
  const day = String(parseInt(dateParts[2], 10));
  
  console.log(`[scrape-causelist] Clicking court ${courtNo} row...`);
  
  const clickScript = `
    (async () => {
      await new Promise(r => setTimeout(r, 2000));
      
      // Fill date
      const daySelect = document.querySelector('select[name="day"], #day');
      const monthSelect = document.querySelector('select[name="month"], #month');
      const yearSelect = document.querySelector('select[name="year"], #year');
      
      if (daySelect) daySelect.value = '${day}';
      if (monthSelect) monthSelect.value = '${month}';
      if (yearSelect) yearSelect.value = '${year}';
      
      // Submit form
      const submitBtn = document.querySelector('input[type="submit"], button[type="submit"]');
      if (submitBtn) submitBtn.click();
      
      await new Promise(r => setTimeout(r, 5000));
      
      // Find and click the court row
      const rows = document.querySelectorAll('table tbody tr, table tr');
      for (const row of rows) {
        const firstCell = row.querySelector('td:first-child');
        if (firstCell && firstCell.textContent.trim() === '${courtNo}') {
          // Try clicking the row or a link within it
          const link = row.querySelector('a');
          if (link) {
            link.click();
          } else {
            row.click();
          }
          break;
        }
      }
      
      await new Promise(r => setTimeout(r, 3000));
    })();
  `;
  
  try {
    const browserlessUrl = `https://chrome.browserless.io/content?token=${browserlessApiKey}`;
    
    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: baseUrl,
        gotoOptions: {
          waitUntil: 'networkidle2',
          timeout: 30000,
        },
        addScriptTag: [{
          content: clickScript,
        }],
        waitForTimeout: 10000,
      }),
    });
    
    if (response.ok) {
      const html = await response.text();
      
      // Check if we got PDF content or a PDF viewer
      if (html.includes('application/pdf') || html.includes('%PDF')) {
        console.log(`[scrape-causelist] Got PDF content for court ${courtNo}`);
        return { pdfUrl: null, content: html };
      }
      
      // Try to extract PDF link from the response
      const pdfLinks = extractPdfLinksFromHtml(html, baseUrl);
      if (pdfLinks.length > 0) {
        console.log(`[scrape-causelist] Found PDF link for court ${courtNo}: ${pdfLinks[0]}`);
        return { pdfUrl: pdfLinks[0], content: null };
      }
    }
  } catch (err) {
    console.log(`[scrape-causelist] Error clicking court ${courtNo}: ${err}`);
  }
  
  return { pdfUrl: null, content: null };
}

// Scrape PDF content using Browserless.io /pdf endpoint
async function scrapePdfContentWithBrowserless(
  pdfUrl: string,
  browserlessApiKey: string
): Promise<string> {
  console.log(`[scrape-causelist] Scraping PDF with Browserless: ${pdfUrl}`);
  
  try {
    // Use the /content endpoint to get the rendered PDF content
    const browserlessUrl = `https://chrome.browserless.io/content?token=${browserlessApiKey}`;
    
    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: pdfUrl,
        gotoOptions: {
          waitUntil: 'networkidle2',
          timeout: 30000,
        },
        waitForTimeout: 5000,
      }),
    });
    
    if (response.ok) {
      const content = await response.text();
      console.log(`[scrape-causelist] Browserless PDF content: ${content.length} chars`);
      
      // If it's an HTML page (PDF viewer), extract text
      if (content.includes('<html') || content.includes('<table')) {
        return extractTextFromHtml(content);
      }
      
      return content;
    }
  } catch (err) {
    console.log(`[scrape-causelist] Browserless PDF scrape error: ${err}`);
  }
  
  return '';
}

// Extract text content from HTML (strip tags)
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// PHASE 1: Parse court table from HTML
// ============================================================
function parseCourtTableFromHtml(html: string, bench: string): CourtMetadata[] {
  const courts: CourtMetadata[] = [];
  
  // Match table rows with court data
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  
  while ((match = trPattern.exec(html)) !== null) {
    const rowHtml = match[1];
    
    // Extract cells
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tdMatch;
    
    while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
      // Strip HTML tags from cell content
      const cellText = tdMatch[1].replace(/<[^>]+>/g, '').trim();
      cells.push(cellText);
    }
    
    // Check if this is a valid court row (first cell should be a number)
    if (cells.length >= 3 && /^\d+$/.test(cells[0])) {
      const courtNo = cells[0];
      const judges = cells[1];
      const listType = cells[2];
      
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
  
  console.log(`[scrape-causelist] ✅ Total parsed: ${courts.length} courts from HTML`);
  return courts;
}

// Parse court table from markdown (fallback)
function parseCourtTable(markdown: string, bench: string): CourtMetadata[] {
  const courts: CourtMetadata[] = [];
  
  console.log(`[scrape-causelist] Parsing court table from markdown (${markdown.length} chars)...`);
  
  let normalizedMarkdown = markdown
    .replace(/\|\s*\|\s*(?=\d)/g, '|\n|')
    .replace(/\|\s*\|\s*(?=---)/g, '|\n|')
    .replace(/\|\s*\|\s*(?=Court)/gi, '|\n|')
    .replace(/\|\s+\|/g, '|\n|');
  
  const lines = normalizedMarkdown.split('\n');
  console.log(`[scrape-causelist] Split into ${lines.length} lines after normalization`);
  
  let inTable = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed || trimmed.match(/^\|[\s\-:]+\|$/)) continue;
    if (trimmed.includes('---') && !trimmed.match(/\d/)) continue;
    
    if (trimmed.toLowerCase().includes('court no') || trimmed.toLowerCase().includes('hon\'ble')) {
      inTable = true;
      continue;
    }
    
    if (!inTable) continue;
    
    const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
    
    if (cells.length >= 3) {
      const courtNo = cells[0];
      const judges = cells[1];
      const listType = cells[2];
      
      if (!/^\d+$/.test(courtNo)) continue;
      
      let normalizedType = 'DAILY';
      if (listType === 'DS' || listType === 'D') normalizedType = 'DAILY';
      else if (listType === 'S') normalizedType = 'SUPPLEMENTARY';
      
      courts.push({
        court_no: courtNo,
        judge_names: judges,
        list_type: normalizedType,
        bench: bench,
      });
    }
  }
  
  // Fallback regex
  if (courts.length === 0 && markdown.includes('|')) {
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
    }
  }
  
  console.log(`[scrape-causelist] ✅ Total parsed: ${courts.length} courts from markdown`);
  return courts;
}

// ============================================================
// Extract PDF links from HTML
// ============================================================
function extractPdfLinksFromHtml(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  
  // Pattern 1: Extract base64-encoded PDF paths from data-pdfpath attributes
  const pdfPathPattern = /data-pdfpath=["']([^"']+)["']/gi;
  let match;
  
  while ((match = pdfPathPattern.exec(html)) !== null) {
    const base64Path = match[1];
    const decodedUrl = decodeBase64PdfPath(base64Path, baseUrl);
    if (decodedUrl && !links.includes(decodedUrl)) {
      links.push(decodedUrl);
    }
  }
  
  // Pattern 2: Direct href links to PDFs
  const hrefPattern = /href=["']([^"']*\.pdf[^"']*)["']/gi;
  while ((match = hrefPattern.exec(html)) !== null) {
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
  
  // Pattern 3: onclick handlers with PDF URLs
  const onclickPattern = /onclick=["'][^"']*(?:window\.open|location\.href|open)\s*\(\s*["']([^"']*\.pdf[^"']*)["']/gi;
  while ((match = onclickPattern.exec(html)) !== null) {
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
  
  // Pattern 4: JavaScript variables containing PDF paths
  const jsVarPattern = /["']([^"']*(?:pdfs?|causelist|court)[^"']*\.pdf)["']/gi;
  while ((match = jsVarPattern.exec(html)) !== null) {
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

// Decode base64 PDF path and construct full URL
function decodeBase64PdfPath(base64Path: string, baseUrl: string): string | null {
  try {
    const decoded = atob(base64Path);
    console.log(`[scrape-causelist] Decoded PDF path: ${decoded}`);
    
    const filename = decoded.split('/').pop() || '';
    const baseHost = new URL(baseUrl).origin;
    const benchCode = baseUrl.includes('jdp') ? 'jdp' : 'jp';
    const pathParts = decoded.split('/');
    const yearFolder = pathParts.find(p => /^\d{4}$/.test(p)) || '2025';
    
    const possibleUrls = [
      `${baseHost}/quick-causelist-${benchCode}/download_pdf.php?path=${encodeURIComponent(decoded)}`,
      `${baseHost}/quick-causelist-${benchCode}/viewpdf.php?path=${encodeURIComponent(base64Path)}`,
      `${baseHost}/causelist_report/${yearFolder}/${filename}`,
    ];
    
    return possibleUrls[0];
  } catch (err) {
    console.log(`[scrape-causelist] Failed to decode base64: ${err}`);
    return null;
  }
}

// ============================================================
// PDF parsing
// ============================================================
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

// Extract court number from PDF URL
function extractCourtNoFromUrl(pdfUrl: string): string {
  const filename = pdfUrl.split('/').pop() || pdfUrl;
  console.log(`[scrape-causelist] Extracting court no from: ${filename}`);
  
  const specialMatch = filename.match(/\d{8}_\d{4}_(\d+)\.pdf$/i);
  if (specialMatch) {
    const courtCode = specialMatch[1];
    if (courtCode.length >= 4) {
      const courtNo = courtCode.substring(0, courtCode.length - 3) || '1';
      console.log(`[scrape-causelist] Extracted court no from special format: ${courtNo}`);
      return courtNo;
    }
    return courtCode;
  }
  
  const patterns = [
    /_(\d{4})\.pdf$/i,
    /court[_\-\s]?no?[_\-\s]?(\d+)/i,
    /court[_\-\s]?(\d+)/i,
    /(\d+)\.pdf$/i,
  ];
  
  for (const pattern of patterns) {
    const match = pdfUrl.match(pattern);
    if (match) {
      return match[match.length - 1];
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

// Log scraper run to database
async function logScraperRun(supabase: any, log: ScraperLog): Promise<void> {
  try {
    await supabase.from('scraper_logs').insert(log);
    console.log(`[scrape-causelist] Logged: ${log.status}, ${log.cases_found} cases`);
  } catch (err) {
    console.error('[scrape-causelist] Failed to log scraper run:', err);
  }
}

// ============================================================
// FIRECRAWL FALLBACK - Use if Browserless fails
// ============================================================
async function scrapePdfWithFirecrawl(pdfUrl: string, firecrawlApiKey: string): Promise<string> {
  console.log(`[scrape-causelist] Scraping PDF with Firecrawl: ${pdfUrl}`);
  
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
  console.log(`[scrape-causelist] Firecrawl PDF scraped, got ${markdown.length} chars`);
  return markdown;
}

// Configuration
const MAX_PDFS_PER_RUN = 5;
const DELAY_BETWEEN_PDFS = 3000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');
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
    console.log(`[scrape-causelist] Browserless: ${browserlessApiKey ? 'configured' : 'NOT configured'}`);
    console.log(`[scrape-causelist] Firecrawl: ${firecrawlApiKey ? 'configured' : 'NOT configured'}`);
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

    // Check if we have any scraping API configured
    if (!browserlessApiKey && !firecrawlApiKey) {
      await logScraperRun(supabase, {
        bench,
        status: 'failed',
        cases_found: 0,
        error_message: 'No scraping API configured (Browserless or Firecrawl)',
        list_type,
        court_no,
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No scraping API configured. Please add BROWSERLESS_API_KEY or FIRECRAWL_API_KEY.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let courts: CourtMetadata[] = [];
    let pdfLinks: string[] = [];
    let allEntries: CauseListEntry[] = [];
    let scrapeMethod = 'unknown';

    // PHASE 1: Try Browserless.io first (better JS support)
    if (browserlessApiKey) {
      try {
        console.log(`[scrape-causelist] PHASE 1: Using Browserless.io...`);
        scrapeMethod = 'browserless';
        
        const browserlessResult = await scrapeWithBrowserless(
          targetUrl,
          targetDate,
          bench,
          browserlessApiKey
        );
        
        courts = browserlessResult.courts;
        pdfLinks = browserlessResult.pdfLinks;
        
        // Process any PDF content we got directly
        for (const [courtNo, content] of browserlessResult.pdfContents) {
          if (content.length > 100) {
            const entries = parseCauseListPdf(content, bench, courtNo, targetDate, list_type);
            allEntries = allEntries.concat(entries);
          }
        }
        
        console.log(`[scrape-causelist] Browserless result: ${courts.length} courts, ${pdfLinks.length} PDFs, ${allEntries.length} entries`);
        
      } catch (err) {
        console.error(`[scrape-causelist] Browserless failed: ${err}`);
        // Will fall back to Firecrawl
      }
    }

    // PHASE 2: Fallback to Firecrawl if Browserless didn't work
    if (courts.length === 0 && firecrawlApiKey) {
      try {
        console.log(`[scrape-causelist] PHASE 2: Falling back to Firecrawl...`);
        scrapeMethod = 'firecrawl';
        
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: targetUrl,
            formats: ['markdown', 'html', 'links'],
            waitFor: 10000,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const html = data.data?.html || '';
          const markdown = data.data?.markdown || '';
          
          courts = parseCourtTableFromHtml(html, bench);
          if (courts.length === 0) {
            courts = parseCourtTable(markdown, bench);
          }
          
          pdfLinks = extractPdfLinksFromHtml(html, targetUrl);
          
          console.log(`[scrape-causelist] Firecrawl result: ${courts.length} courts, ${pdfLinks.length} PDFs`);
        }
      } catch (err) {
        console.error(`[scrape-causelist] Firecrawl also failed: ${err}`);
      }
    }

    // Store court metadata
    if (courts.length > 0) {
      console.log(`[scrape-causelist] Storing ${courts.length} court metadata entries...`);
      
      for (const court of courts) {
        try {
          await supabase
            .from('court_metadata')
            .upsert({
              bench: court.bench,
              court_no: court.court_no,
              judge_names: court.judge_names,
              last_updated: new Date().toISOString(),
            }, {
              onConflict: 'bench,court_no',
            });
        } catch (err) {
          console.log(`[scrape-causelist] Court metadata error: ${err}`);
        }
      }
    }

    // PHASE 3: Scrape PDFs
    if (pdfLinks.length > 0 && allEntries.length === 0) {
      const pdfsToProcess = Math.min(pdfLinks.length, MAX_PDFS_PER_RUN);
      console.log(`[scrape-causelist] PHASE 3: Scraping ${pdfsToProcess}/${pdfLinks.length} PDFs...`);
      
      for (let i = 0; i < pdfsToProcess; i++) {
        const pdfUrl = pdfLinks[i];
        
        if (i > 0) {
          await sleep(DELAY_BETWEEN_PDFS);
        }
        
        try {
          let pdfContent = '';
          
          // Try Browserless for PDF first
          if (browserlessApiKey) {
            pdfContent = await scrapePdfContentWithBrowserless(pdfUrl, browserlessApiKey);
          }
          
          // Fall back to Firecrawl
          if (pdfContent.length < 100 && firecrawlApiKey) {
            pdfContent = await scrapePdfWithFirecrawl(pdfUrl, firecrawlApiKey);
          }
          
          if (pdfContent.length > 100) {
            const courtNo = extractCourtNoFromUrl(pdfUrl);
            const detectedListType = detectListType(pdfUrl, pdfContent);
            const entries = parseCauseListPdf(pdfContent, bench, courtNo, targetDate, detectedListType);
            
            console.log(`[scrape-causelist] ✅ Parsed ${entries.length} entries from ${pdfUrl}`);
            allEntries = allEntries.concat(entries);
          }
        } catch (err) {
          console.error(`[scrape-causelist] ❌ Failed to process PDF: ${err}`);
        }
      }
    }

    console.log(`[scrape-causelist] Total entries parsed: ${allEntries.length}`);

    // Preview mode - return data without inserting
    if (action === 'preview') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          entries: allEntries,
          pdf_links: pdfLinks,
          courts: courts,
          target_date: targetDate,
          scrape_method: scrapeMethod,
          message: `Found ${courts.length} courts, ${pdfLinks.length} PDFs, ${allEntries.length} cases`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert entries into database
    if (allEntries.length > 0) {
      console.log(`[scrape-causelist] Inserting ${allEntries.length} entries into database...`);
      
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
            
            if (updateError) errors++;
            else updated++;
          } else {
            const { error: insertError } = await supabase
              .from('daily_court_docket')
              .insert(entry);
            
            if (insertError) errors++;
            else inserted++;
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
          scrape_method: scrapeMethod,
          message: `Processed ${allEntries.length} cases: ${inserted} new, ${updated} updated`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // No cases found
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
        scrape_method: scrapeMethod,
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
