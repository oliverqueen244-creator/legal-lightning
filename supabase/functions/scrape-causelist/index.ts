import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CIS Portal URLs
const CIS_URLS: Record<string, string> = {
  JAIPUR: 'https://hcraj.nic.in/cishcraj-jp/causelists/',
  JODHPUR: 'https://hcraj.nic.in/cishcraj-jdp/causelists/'
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

interface ScrapeRequest {
  action: 'scrape' | 'preview';
  bench?: 'JAIPUR' | 'JODHPUR';
  date?: string;
  list_type?: 'D' | 'S';
  format?: 'html' | 'pdf';
  lawyer_name?: string;
}

// Smart date logic - after 6PM IST, get tomorrow's date
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

// Format date as DD/MM/YYYY for the form
function formatDateForForm(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// Extract cookies from response headers
function extractCookies(response: Response): string {
  const cookies: string[] = [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const cookiePart = value.split(';')[0];
      cookies.push(cookiePart);
    }
  });
  return cookies.join('; ');
}

// Extract CAPTCHA base64 from HTML
function extractCaptchaFromHtml(html: string): string | null {
  // Look for: <img src="data:image/png;base64,..." ... id="captcha">
  const captchaMatch = html.match(/<img[^>]*src=["'](data:image\/[^"']+)["'][^>]*id=["']captcha["']/i) ||
                       html.match(/<img[^>]*id=["']captcha["'][^>]*src=["'](data:image\/[^"']+)["']/i);
  
  if (captchaMatch) {
    return captchaMatch[1];
  }
  return null;
}

// Call solve-captcha function
async function solveCaptcha(imageData: string, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  console.log(`[scrape-causelist] Solving CAPTCHA...`);
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/solve-captcha`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData }),
    });

    if (!response.ok) {
      console.error(`[scrape-causelist] CAPTCHA solve failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[scrape-causelist] CAPTCHA solution: ${data.solution}`);
    return data.solution;
  } catch (error) {
    console.error('[scrape-causelist] CAPTCHA solve error:', error);
    return null;
  }
}

// Step 1: GET the page to get cookies and CAPTCHA using Browserless (for JS rendering)
async function getInitialPage(cisUrl: string, browserlessKey?: string): Promise<{ 
  html: string; 
  cookies: string; 
  captchaBase64: string | null; 
  error?: string 
}> {
  console.log(`[scrape-causelist] Step 1: Fetching initial page from ${cisUrl}`);
  
  // Try Browserless first (handles JS-rendered CAPTCHA)
  if (browserlessKey) {
    try {
      console.log(`[scrape-causelist] Using Browserless for JS rendering...`);
      const response = await fetch(`https://chrome.browserless.io/content?token=${browserlessKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: cisUrl,
          waitForSelector: { selector: '#captcha', timeout: 15000 },
          gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
        }),
      });

      if (response.ok) {
        const html = await response.text();
        const captchaBase64 = extractCaptchaFromHtml(html);
        
        // Extract cookies from the HTML if available (Browserless includes them in meta or script)
        // For session continuity, we need to make a regular HTTP request too
        const httpResponse = await fetch(cisUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
        const cookies = extractCookies(httpResponse);
        
        console.log(`[scrape-causelist] Browserless got page: ${html.length} chars`);
        console.log(`[scrape-causelist] CAPTCHA found: ${captchaBase64 ? 'Yes' : 'No'}`);
        
        if (captchaBase64) {
          return { html, cookies, captchaBase64 };
        }
      }
    } catch (error) {
      console.log(`[scrape-causelist] Browserless failed, falling back to HTTP: ${error}`);
    }
  }
  
  // Fallback to direct HTTP (might not work if CAPTCHA needs JS)
  try {
    const response = await fetch(cisUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      return { html: '', cookies: '', captchaBase64: null, error: `Initial page fetch failed: ${response.status}` };
    }

    const html = await response.text();
    const cookies = extractCookies(response);
    const captchaBase64 = extractCaptchaFromHtml(html);

    console.log(`[scrape-causelist] HTTP got page: ${html.length} chars`);
    console.log(`[scrape-causelist] Cookies: ${cookies.substring(0, 50)}...`);
    console.log(`[scrape-causelist] CAPTCHA found: ${captchaBase64 ? 'Yes' : 'No'}`);

    return { html, cookies, captchaBase64 };
  } catch (error) {
    console.error('[scrape-causelist] Initial page error:', error);
    return { html: '', cookies: '', captchaBase64: null, error: String(error) };
  }
}

// Step 2: Submit form via HTTP POST
async function submitFormPost(
  cisUrl: string,
  cookies: string,
  formattedDate: string,
  listType: string,
  captchaSolution: string,
  format: 'html' | 'pdf',
  lawyerName?: string
): Promise<{ html: string; pdfUrl?: string; success: boolean; error?: string }> {
  console.log(`[scrape-causelist] Step 2: Submitting form via POST`);
  console.log(`[scrape-causelist] Date: ${formattedDate}, ListType: ${listType}, Format: ${format}, Lawyer: ${lawyerName || 'none'}`);
  
  // Build form data
  const formData = new URLSearchParams();
  formData.append('causelistradio', 'C'); // C = Cause List
  formData.append('causelstdt', formattedDate);
  formData.append('causelisttype', listType);
  formData.append('courtno', ''); // All courts
  formData.append('judgename', ''); // All judges
  formData.append('caseno', '');
  formData.append('lawyername', lawyerName || '');
  formData.append('petitionername', '');
  formData.append('respondentname', '');
  formData.append('deptname', '');
  formData.append('formatradio', format === 'pdf' ? '2' : '1'); // 1=HTML, 2=PDF
  formData.append('txtCaptcha', captchaSolution);
  
  // Add the button click indicator
  if (format === 'pdf') {
    formData.append('btnSearchCauseList', 'Download Cause List');
  } else {
    formData.append('btnViewCauseList', 'View Cause List');
  }

  try {
    const response = await fetch(cisUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'Referer': cisUrl,
        'Origin': new URL(cisUrl).origin,
      },
      body: formData.toString(),
    });

    console.log(`[scrape-causelist] POST response status: ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    console.log(`[scrape-causelist] Content-Type: ${contentType}`);

    // Check if response is PDF
    if (contentType.includes('application/pdf')) {
      console.log(`[scrape-causelist] Got PDF response directly`);
      // Return the response URL or handle the PDF
      return { html: '', success: true, pdfUrl: response.url };
    }

    const html = await response.text();
    console.log(`[scrape-causelist] Response HTML: ${html.length} chars`);

    // Check for CAPTCHA errors
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes('invalid captcha') || lowerHtml.includes('wrong captcha') || 
        lowerHtml.includes('invalid verification') || lowerHtml.includes('captcha mismatch')) {
      console.log(`[scrape-causelist] CAPTCHA validation failed`);
      return { html, success: false, error: 'Invalid CAPTCHA - wrong solution' };
    }

    // Check for no records
    if (lowerHtml.includes('no record found') || lowerHtml.includes('no data found') ||
        lowerHtml.includes('record not found')) {
      console.log(`[scrape-causelist] No records found for this date`);
      return { html, success: true }; // Success but no data
    }

    // Look for PDF download link in the response
    const pdfLinkMatch = html.match(/href=["']([^"']*\.pdf[^"']*)["']/i) ||
                         html.match(/id=["']downloadFile["'][^>]*href=["']([^"']+)["']/i);
    if (pdfLinkMatch && format === 'pdf') {
      const pdfUrl = pdfLinkMatch[1].startsWith('http') 
        ? pdfLinkMatch[1] 
        : new URL(pdfLinkMatch[1], cisUrl).toString();
      console.log(`[scrape-causelist] Found PDF link: ${pdfUrl}`);
      return { html, success: true, pdfUrl };
    }

    return { html, success: true };

  } catch (error) {
    console.error('[scrape-causelist] Form POST error:', error);
    return { html: '', success: false, error: String(error) };
  }
}

// Parse cause list HTML to extract entries
function parseCauseListHtml(html: string, bench: string, date: string, listType: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  console.log('[scrape-causelist] Parsing HTML response...');
  
  // Check for no records
  if (html.includes('No Record Found') || html.includes('no record found') || html.includes('No Data')) {
    console.log('[scrape-causelist] No records found for this date');
    return [];
  }
  
  // Look for cause list data table
  // The CIS portal returns HTML with table data
  
  // Pattern 1: Standard table rows
  const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = html.match(tableRowPattern) || [];
  console.log(`[scrape-causelist] Found ${rows.length} table rows`);
  
  let currentCourtNo = '1';
  
  for (const row of rows) {
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(cellText);
    }
    
    if (cells.length < 2) continue;
    
    // Skip header rows
    const firstCell = cells[0].toLowerCase();
    if (firstCell.includes('sr') || firstCell.includes('item') || 
        firstCell.includes('case no') || firstCell.includes('s.no')) continue;
    
    // Check for court number header
    const courtMatch = row.match(/Court\s*(?:No\.?)?\s*(\d+)/i) ||
                       row.match(/court[\s-]*(\d+)/i);
    if (courtMatch) {
      currentCourtNo = courtMatch[1];
      console.log(`[scrape-causelist] Found court number: ${currentCourtNo}`);
      continue;
    }
    
    const itemNo = parseInt(cells[0]);
    if (isNaN(itemNo) || itemNo <= 0) continue;
    
    const caseNumber = cells[1] || '';
    if (!caseNumber || caseNumber.length < 3) continue;
    
    let petitioner = '';
    let respondent = '';
    let petitionerLawyer = '';
    let respondentLawyer = '';
    
    // Party names (usually in 3rd cell)
    const partyCell = cells[2] || '';
    const vsMatch = partyCell.match(/(.+?)\s*(?:vs?\.?|v\/s|versus)\s*(.+)/i);
    if (vsMatch) {
      petitioner = vsMatch[1].trim().substring(0, 200);
      respondent = vsMatch[2].trim().substring(0, 200);
    } else if (partyCell) {
      petitioner = partyCell.substring(0, 200);
    }
    
    // Lawyers (usually in 4th and 5th cells or combined)
    if (cells.length > 3) {
      petitionerLawyer = (cells[3] || '').substring(0, 100);
    }
    if (cells.length > 4) {
      respondentLawyer = (cells[4] || '').substring(0, 100);
    }
    
    entries.push({
      item_no: itemNo,
      case_number: caseNumber,
      petitioner: petitioner || null,
      respondent: respondent || null,
      petitioner_lawyer: petitionerLawyer || null,
      respondent_lawyer: respondentLawyer || null,
      court_room_no: currentCourtNo,
      court_location: bench,
      list_type: listType,
      date: date,
      status: 'pending',
    });
  }
  
  console.log(`[scrape-causelist] Parsed ${entries.length} entries`);
  return entries;
}

// Download PDF and upload to storage
async function downloadAndStorePdf(
  pdfUrl: string,
  cookies: string,
  supabase: any,
  bench: string,
  date: string,
  listType: string
): Promise<{ publicUrl: string | null; filename: string; error?: string }> {
  const filename = `${bench}_${date}_${listType}.pdf`;
  console.log(`[scrape-causelist] Downloading PDF from: ${pdfUrl}`);
  
  try {
    const response = await fetch(pdfUrl, {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': CIS_URLS[bench] || pdfUrl,
      }
    });

    if (!response.ok) {
      return { publicUrl: null, filename, error: `PDF download failed: ${response.status}` };
    }

    const pdfBuffer = await response.arrayBuffer();
    console.log(`[scrape-causelist] Downloaded PDF: ${pdfBuffer.byteLength} bytes`);

    // Upload to storage
    const { data, error } = await supabase.storage
      .from('causelist-pdfs')
      .upload(filename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      console.error(`[scrape-causelist] Storage upload error:`, error);
      return { publicUrl: null, filename, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from('causelist-pdfs')
      .getPublicUrl(filename);

    console.log(`[scrape-causelist] PDF uploaded: ${urlData.publicUrl}`);
    return { publicUrl: urlData.publicUrl, filename };

  } catch (error) {
    console.error(`[scrape-causelist] PDF download/upload error:`, error);
    return { publicUrl: null, filename, error: String(error) };
  }
}

// Log scraper run
async function logScraperRun(
  supabase: any, 
  bench: string, 
  status: string, 
  casesFound: number, 
  errorMessage: string | null, 
  listType: string
): Promise<void> {
  try {
    await supabase.from('scraper_logs').insert({
      bench,
      status,
      cases_found: casesFound,
      error_message: errorMessage,
      list_type: listType,
    });
  } catch (err) {
    console.error('[scrape-causelist] Log error:', err);
  }
}

// Main scraping function with retry logic
async function scrapeWithHttpPost(
  bench: string,
  targetDate: string,
  listType: string,
  format: 'html' | 'pdf',
  supabaseUrl: string,
  supabaseKey: string,
  supabase: any,
  lawyerName?: string,
  browserlessKey?: string
): Promise<{
  success: boolean;
  entries: CauseListEntry[];
  pdfUrl?: string;
  pdfFilename?: string;
  error?: string;
  attempts: number;
  captchaSolution?: string;
  rawHtml?: string;
}> {
  const cisUrl = CIS_URLS[bench];
  if (!cisUrl) {
    return { success: false, entries: [], error: `Invalid bench: ${bench}`, attempts: 0 };
  }

  const formattedDate = formatDateForForm(targetDate);
  const maxAttempts = 3;
  let attempts = 0;
  let lastError = '';
  let lastCookies = '';

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[scrape-causelist] ========== Attempt ${attempts}/${maxAttempts} ==========`);

    // Step 1: Get initial page with CAPTCHA (uses Browserless for JS rendering)
    const initialPage = await getInitialPage(cisUrl, browserlessKey);
    if (initialPage.error || !initialPage.captchaBase64) {
      lastError = initialPage.error || 'Failed to get CAPTCHA from page';
      console.log(`[scrape-causelist] Step 1 failed: ${lastError}`);
      continue;
    }
    lastCookies = initialPage.cookies;

    // Step 2: Solve CAPTCHA
    const captchaSolution = await solveCaptcha(initialPage.captchaBase64, supabaseUrl, supabaseKey);
    if (!captchaSolution) {
      lastError = 'Failed to solve CAPTCHA';
      console.log(`[scrape-causelist] CAPTCHA solve failed`);
      continue;
    }

    // Step 3: Submit form
    const formResult = await submitFormPost(
      cisUrl, 
      initialPage.cookies, 
      formattedDate, 
      listType, 
      captchaSolution, 
      format,
      lawyerName
    );

    if (!formResult.success) {
      if (formResult.error?.includes('CAPTCHA')) {
        lastError = formResult.error;
        console.log(`[scrape-causelist] CAPTCHA was wrong, retrying...`);
        continue;
      }
      lastError = formResult.error || 'Form submission failed';
      console.log(`[scrape-causelist] Form submission failed: ${lastError}`);
      continue;
    }

    // Handle PDF format
    if (format === 'pdf' && formResult.pdfUrl) {
      const uploadResult = await downloadAndStorePdf(
        formResult.pdfUrl,
        initialPage.cookies,
        supabase,
        bench,
        targetDate,
        listType === 'D' ? 'DAILY' : 'SUPPLEMENTARY'
      );

      if (uploadResult.error) {
        return {
          success: false,
          entries: [],
          error: `PDF upload failed: ${uploadResult.error}`,
          attempts,
          captchaSolution,
        };
      }

      return {
        success: true,
        entries: [],
        pdfUrl: uploadResult.publicUrl || undefined,
        pdfFilename: uploadResult.filename,
        attempts,
        captchaSolution,
      };
    }

    // Handle HTML format - parse entries
    const entries = parseCauseListHtml(
      formResult.html,
      bench,
      targetDate,
      listType === 'D' ? 'DAILY' : 'SUPPLEMENTARY'
    );

    return {
      success: true,
      entries,
      attempts,
      captchaSolution,
      rawHtml: formResult.html.substring(0, 3000),
    };
  }

  return {
    success: false,
    entries: [],
    error: `Failed after ${maxAttempts} attempts. Last error: ${lastError}`,
    attempts,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const browserlessKey = Deno.env.get('BROWSERLESS_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { 
      action = 'scrape', 
      bench = 'JODHPUR', 
      date, 
      list_type = 'D',
      format = 'html',
      lawyer_name,
    } = await req.json() as ScrapeRequest;
    
    const targetDate = date || getSmartTargetDate();
    
    console.log(`[scrape-causelist] ========================================`);
    console.log(`[scrape-causelist] Action: ${action}, Bench: ${bench}`);
    console.log(`[scrape-causelist] Date: ${targetDate}, List Type: ${list_type}, Format: ${format}`);
    console.log(`[scrape-causelist] Lawyer filter: ${lawyer_name || 'none'}`);
    console.log(`[scrape-causelist] Browserless: ${browserlessKey ? 'Available' : 'Not configured'}`);
    console.log(`[scrape-causelist] ========================================`);

    // Scrape using HTTP POST (with Browserless for JS-rendered CAPTCHA)
    const result = await scrapeWithHttpPost(
      bench,
      targetDate,
      list_type,
      format,
      supabaseUrl,
      supabaseKey,
      supabase,
      lawyer_name,
      browserlessKey
    );

    // Store entries in database if scrape action and HTML format
    let inserted = 0;
    if (action === 'scrape' && result.success && result.entries.length > 0) {
      console.log(`[scrape-causelist] Storing ${result.entries.length} entries`);
      
      for (const entry of result.entries) {
        const { error } = await supabase
          .from('daily_court_docket')
          .upsert(entry, { 
            onConflict: 'case_number,date,court_room_no',
            ignoreDuplicates: false 
          });
        
        if (!error) {
          inserted++;
        }
      }
      
      console.log(`[scrape-causelist] Stored: ${inserted} entries`);
    }

    // Log the scraper run
    await logScraperRun(
      supabase,
      bench,
      result.success ? 'success' : 'failed',
      result.entries.length,
      result.error || null,
      list_type === 'D' ? 'DAILY' : 'SUPPLEMENTARY'
    );

    return new Response(
      JSON.stringify({
        success: result.success,
        format,
        message: result.success 
          ? format === 'pdf' 
            ? `PDF downloaded and stored: ${result.pdfFilename}`
            : `Found ${result.entries.length} cases` 
          : result.error,
        entries: result.entries,
        entries_count: result.entries.length,
        inserted,
        pdf_url: result.pdfUrl,
        pdf_filename: result.pdfFilename,
        attempts: result.attempts,
        captcha_solution: result.captchaSolution,
        raw_content_preview: result.rawHtml,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[scrape-causelist] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
