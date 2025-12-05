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

// Full scrape using Browserless /function endpoint with Puppeteer
async function scrapeWithBrowserlessPuppeteer(
  cisUrl: string,
  browserlessKey: string,
  formattedDate: string,
  listType: string,
  captchaSolution: string,
  lawyerName?: string
): Promise<{ html: string; success: boolean; captchaBase64?: string; error?: string }> {
  console.log(`[scrape-causelist] Scraping with Browserless Puppeteer...`);
  console.log(`[scrape-causelist] URL: ${cisUrl}, Date: ${formattedDate}, ListType: ${listType}`);
  
  // Puppeteer script to execute in Browserless
  const puppeteerCode = `
    module.exports = async ({ page }) => {
      const url = "${cisUrl}";
      const targetDate = "${formattedDate}";
      const listType = "${listType}";
      const captchaSolution = "${captchaSolution}";
      const lawyerName = "${lawyerName || ''}";
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for form elements
      await page.waitForSelector('#causelstdt', { timeout: 10000 });
      await page.waitForSelector('#captcha', { timeout: 10000 });
      
      // Get CAPTCHA image for validation
      const captchaImg = await page.$eval('#captcha', el => el.src);
      
      // Clear and set the date
      await page.$eval('#causelstdt', el => el.value = '');
      await page.type('#causelstdt', targetDate);
      
      // Select cause list type
      await page.select('#causelisttype', listType);
      
      // Fill lawyer name if provided
      if (lawyerName) {
        await page.type('#lawyername', lawyerName);
      }
      
      // Select HTML format
      await page.click('#formatradio1');
      
      // Fill CAPTCHA
      await page.type('#txtCaptcha', captchaSolution);
      
      // Click search button
      await page.click('#btnSearchCauseList');
      
      // Wait for AJAX results - either the results div or an error message
      await page.waitForFunction(() => {
        const body = document.body.innerText;
        return body.includes('No Record Found') || 
               body.includes('Invalid Captcha') ||
               document.querySelectorAll('table tr').length > 5;
      }, { timeout: 15000 });
      
      // Additional wait for DOM to settle
      await new Promise(r => setTimeout(r, 2000));
      
      // Get final HTML
      const html = await page.content();
      
      return { 
        html, 
        captchaBase64: captchaImg,
        bodyText: await page.$eval('body', el => el.innerText.substring(0, 500))
      };
    };
  `;

  try {
    const response = await fetch(`https://chrome.browserless.io/function?token=${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: puppeteerCode,
        context: {}
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[scrape-causelist] Browserless function error: ${response.status} - ${errorText}`);
      return { html: '', success: false, error: `Browserless error: ${response.status} - ${errorText.substring(0, 200)}` };
    }

    const result = await response.json();
    console.log(`[scrape-causelist] Browserless result preview: ${result.bodyText || 'N/A'}`);
    
    const html = result.html || '';
    console.log(`[scrape-causelist] Got HTML: ${html.length} chars`);
    
    // Check for CAPTCHA error
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes('invalid captcha') || lowerHtml.includes('wrong captcha') ||
        lowerHtml.includes('enter valid captcha')) {
      return { html, success: false, captchaBase64: result.captchaBase64, error: 'Invalid CAPTCHA' };
    }
    
    return { html, success: true, captchaBase64: result.captchaBase64 };
  } catch (error) {
    console.error('[scrape-causelist] Browserless Puppeteer error:', error);
    return { html: '', success: false, error: String(error) };
  }
}

// Get initial page to extract CAPTCHA
async function getInitialPage(cisUrl: string, browserlessKey: string): Promise<{
  captchaBase64: string | null;
  error?: string;
}> {
  console.log(`[scrape-causelist] Fetching initial page for CAPTCHA...`);
  
  try {
    const response = await fetch(`https://chrome.browserless.io/content?token=${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: cisUrl,
        waitForSelector: { selector: '#captcha', timeout: 15000 },
        gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
      }),
    });

    if (!response.ok) {
      return { captchaBase64: null, error: `Browserless failed: ${response.status}` };
    }

    const html = await response.text();
    
    // Extract CAPTCHA
    const captchaMatch = html.match(/<img[^>]*src=["'](data:image\/[^"']+)["'][^>]*id=["']captcha["']/i) ||
                         html.match(/<img[^>]*id=["']captcha["'][^>]*src=["'](data:image\/[^"']+)["']/i);
    
    if (captchaMatch) {
      console.log(`[scrape-causelist] CAPTCHA extracted successfully`);
      return { captchaBase64: captchaMatch[1] };
    }
    
    console.log(`[scrape-causelist] CAPTCHA not found in HTML`);
    return { captchaBase64: null, error: 'CAPTCHA not found' };
  } catch (error) {
    console.error('[scrape-causelist] Initial page error:', error);
    return { captchaBase64: null, error: String(error) };
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
    
    const partyCell = cells[2] || '';
    const vsMatch = partyCell.match(/(.+?)\s*(?:vs?\.?|v\/s|versus)\s*(.+)/i);
    if (vsMatch) {
      petitioner = vsMatch[1].trim().substring(0, 200);
      respondent = vsMatch[2].trim().substring(0, 200);
    } else if (partyCell) {
      petitioner = partyCell.substring(0, 200);
    }
    
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

// Main scraping function
async function scrapeWithRetry(
  bench: string,
  targetDate: string,
  listType: string,
  supabaseUrl: string,
  supabaseKey: string,
  lawyerName?: string,
  browserlessKey?: string
): Promise<{
  success: boolean;
  entries: CauseListEntry[];
  error?: string;
  attempts: number;
  captchaSolution?: string;
  rawHtml?: string;
}> {
  const cisUrl = CIS_URLS[bench];
  if (!cisUrl) {
    return { success: false, entries: [], error: `Invalid bench: ${bench}`, attempts: 0 };
  }

  if (!browserlessKey) {
    return { success: false, entries: [], error: 'Browserless API key not configured', attempts: 0 };
  }

  const formattedDate = formatDateForForm(targetDate);
  const maxAttempts = 3;
  let attempts = 0;
  let lastError = '';

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[scrape-causelist] ========== Attempt ${attempts}/${maxAttempts} ==========`);

    // Step 1: Get initial page to extract CAPTCHA
    const initialPage = await getInitialPage(cisUrl, browserlessKey);
    if (initialPage.error || !initialPage.captchaBase64) {
      lastError = initialPage.error || 'Failed to get CAPTCHA';
      console.log(`[scrape-causelist] Step 1 failed: ${lastError}`);
      continue;
    }

    // Step 2: Solve CAPTCHA
    const captchaSolution = await solveCaptcha(initialPage.captchaBase64, supabaseUrl, supabaseKey);
    if (!captchaSolution) {
      lastError = 'Failed to solve CAPTCHA';
      continue;
    }

    // Step 3: Full scrape with Puppeteer (new session with form fill)
    const scrapeResult = await scrapeWithBrowserlessPuppeteer(
      cisUrl,
      browserlessKey,
      formattedDate,
      listType,
      captchaSolution,
      lawyerName
    );

    if (!scrapeResult.success) {
      if (scrapeResult.error?.includes('CAPTCHA')) {
        lastError = scrapeResult.error;
        console.log(`[scrape-causelist] CAPTCHA was wrong, retrying...`);
        continue;
      }
      lastError = scrapeResult.error || 'Scrape failed';
      continue;
    }

    // Parse results
    const entries = parseCauseListHtml(
      scrapeResult.html,
      bench,
      targetDate,
      listType === 'D' ? 'DAILY' : 'SUPPLEMENTARY'
    );

    return {
      success: true,
      entries,
      attempts,
      captchaSolution,
      rawHtml: scrapeResult.html.substring(0, 5000),
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

    // Scrape using Browserless Puppeteer
    const result = await scrapeWithRetry(
      bench,
      targetDate,
      list_type,
      supabaseUrl,
      supabaseKey,
      lawyer_name,
      browserlessKey
    );

    // Store entries in database if scrape action
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
          ? `Found ${result.entries.length} cases` 
          : result.error,
        entries: result.entries,
        entries_count: result.entries.length,
        inserted,
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
