import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CIS Portal URLs - these are the correct cause list URLs
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
  lawyer_name?: string;
  list_type?: 'D' | 'S'; // D=Daily, S=Supplementary
}

// Smart date logic
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

// Extract cookies from Set-Cookie headers
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

// Extract ASP.NET hidden fields from HTML
function extractAspNetFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  
  const fieldNames = ['__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION', '__EVENTTARGET', '__EVENTARGUMENT'];
  
  for (const fieldName of fieldNames) {
    const regex = new RegExp(`id="${fieldName}"[^>]*value="([^"]*)"`, 'i');
    const match = html.match(regex);
    if (match) {
      fields[fieldName] = match[1];
    }
  }
  
  return fields;
}

// Extract CAPTCHA image as base64
function extractCaptchaBase64(html: string): string | null {
  // Pattern 1: img with src containing captcha
  const imgPatterns = [
    /src="(data:image\/[^"]+captcha[^"]+)"/i,
    /src="([^"]*captcha[^"]*\.(?:png|jpg|jpeg|gif)[^"]*)"/i,
    /src="(CaptchaImage\.axd[^"]*)"/i,
    /src="([^"]*Captcha[^"]*\.axd[^"]*)"/i,
  ];
  
  for (const pattern of imgPatterns) {
    const match = html.match(pattern);
    if (match) {
      const src = match[1];
      if (src.startsWith('data:')) {
        return src;
      }
      // Return the relative URL for fetching
      return src;
    }
  }
  
  // Pattern 2: Look for canvas or specific captcha element
  if (html.includes('imgCaptcha') || html.includes('CaptchaImage')) {
    console.log('[scrape-causelist] Found captcha reference in HTML');
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

// Fetch CAPTCHA image and convert to base64
async function fetchCaptchaImage(captchaUrl: string, baseUrl: string, cookies: string): Promise<string | null> {
  try {
    const fullUrl = captchaUrl.startsWith('http') ? captchaUrl : new URL(captchaUrl, baseUrl).toString();
    console.log(`[scrape-causelist] Fetching CAPTCHA image: ${fullUrl}`);
    
    const response = await fetch(fullUrl, {
      headers: {
        'Cookie': cookies,
        'Referer': baseUrl,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!response.ok) {
      console.error(`[scrape-causelist] CAPTCHA image fetch failed: ${response.status}`);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const contentType = response.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('[scrape-causelist] CAPTCHA image fetch error:', error);
    return null;
  }
}

// Main HTTP-based scraping function
async function scrapeWithHttp(
  bench: string,
  targetDate: string,
  listType: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{
  success: boolean;
  entries: CauseListEntry[];
  error?: string;
  captchaSolution?: string;
  rawHtml?: string;
}> {
  const baseUrl = CIS_URLS[bench];
  if (!baseUrl) {
    return { success: false, entries: [], error: `Invalid bench: ${bench}` };
  }

  const formattedDate = formatDateForForm(targetDate);
  console.log(`[scrape-causelist] Starting HTTP scrape for ${bench}`);
  console.log(`[scrape-causelist] URL: ${baseUrl}`);
  console.log(`[scrape-causelist] Date: ${formattedDate}, List Type: ${listType}`);

  try {
    // Step 1: GET the initial page to get session cookie and CAPTCHA
    console.log('[scrape-causelist] Step 1: Fetching initial page...');
    const initialResponse = await fetch(baseUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!initialResponse.ok) {
      return { success: false, entries: [], error: `Initial page fetch failed: ${initialResponse.status}` };
    }

    const initialHtml = await initialResponse.text();
    console.log(`[scrape-causelist] Initial page: ${initialHtml.length} chars`);

    // Extract session cookies
    const cookies = extractCookies(initialResponse);
    console.log(`[scrape-causelist] Cookies: ${cookies.substring(0, 100)}...`);

    // Extract ASP.NET hidden fields
    const aspFields = extractAspNetFields(initialHtml);
    console.log(`[scrape-causelist] ASP.NET fields: ${Object.keys(aspFields).join(', ')}`);

    // Extract CAPTCHA image URL
    const captchaSrc = extractCaptchaBase64(initialHtml);
    if (!captchaSrc) {
      console.log('[scrape-causelist] HTML preview:', initialHtml.substring(0, 2000));
      return { success: false, entries: [], error: 'CAPTCHA image not found', rawHtml: initialHtml.substring(0, 5000) };
    }

    // Fetch CAPTCHA image if it's a URL
    let captchaBase64: string | null;
    if (captchaSrc.startsWith('data:')) {
      captchaBase64 = captchaSrc;
    } else {
      captchaBase64 = await fetchCaptchaImage(captchaSrc, baseUrl, cookies);
    }

    if (!captchaBase64) {
      return { success: false, entries: [], error: 'Failed to fetch CAPTCHA image' };
    }

    // Step 2: Solve CAPTCHA
    console.log('[scrape-causelist] Step 2: Solving CAPTCHA...');
    const captchaSolution = await solveCaptcha(captchaBase64, supabaseUrl, supabaseKey);
    if (!captchaSolution) {
      return { success: false, entries: [], error: 'Failed to solve CAPTCHA' };
    }

    // Step 3: Submit form with POST request
    console.log('[scrape-causelist] Step 3: Submitting form...');
    
    const formData = new URLSearchParams();
    
    // Add ASP.NET fields
    for (const [key, value] of Object.entries(aspFields)) {
      formData.append(key, value);
    }
    
    // Add form fields matching the CIS portal form
    formData.append('causelstdt', formattedDate);
    formData.append('causelisttype', listType);
    formData.append('txtCaptcha', captchaSolution);
    formData.append('formatradio', 'opthtml'); // HTML format
    formData.append('__EVENTTARGET', 'btnViewCauseList');
    formData.append('__EVENTARGUMENT', '');
    
    console.log(`[scrape-causelist] Form data: date=${formattedDate}, listType=${listType}, captcha=${captchaSolution}`);
    
    const submitResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'Referer': baseUrl,
        'Origin': new URL(baseUrl).origin,
      },
      body: formData.toString()
    });

    if (!submitResponse.ok) {
      return { success: false, entries: [], error: `Form submission failed: ${submitResponse.status}`, captchaSolution };
    }

    const resultHtml = await submitResponse.text();
    console.log(`[scrape-causelist] Result page: ${resultHtml.length} chars`);

    // Check for common error messages
    if (resultHtml.includes('Invalid Captcha') || resultHtml.includes('invalid captcha') || resultHtml.includes('Wrong Captcha')) {
      return { success: false, entries: [], error: 'CAPTCHA validation failed - wrong solution', captchaSolution, rawHtml: resultHtml.substring(0, 2000) };
    }

    // Parse the result HTML for case entries
    const entries = parseCauseListHtml(resultHtml, bench, targetDate, listType === 'D' ? 'DAILY' : 'SUPPLEMENTARY');
    
    console.log(`[scrape-causelist] Parsed ${entries.length} entries`);

    return {
      success: true,
      entries,
      captchaSolution,
      rawHtml: resultHtml.substring(0, 5000),
    };

  } catch (err) {
    console.error(`[scrape-causelist] Error: ${err}`);
    return { success: false, entries: [], error: String(err) };
  }
}

// Parse cause list HTML to extract entries
function parseCauseListHtml(html: string, bench: string, date: string, listType: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  console.log('[scrape-causelist] Parsing response...');
  
  // Check for no records
  if (html.includes('No Record Found') || html.includes('no record found') || html.includes('No Data')) {
    console.log('[scrape-causelist] No records found for this date');
    return [];
  }
  
  // Find table rows
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
    if (cells[0].toLowerCase().includes('sr') || 
        cells[0].toLowerCase().includes('item') ||
        cells[0].toLowerCase().includes('case no')) continue;
    
    // Check for court number header (e.g., "Court No. 1")
    const courtMatch = row.match(/Court\s*(?:No\.?)?\s*(\d+)/i);
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
    
    // Party names (usually in 3rd cell)
    const partyCell = cells[2] || '';
    const vsMatch = partyCell.match(/(.+?)\s*(?:vs?\.?|v\/s|versus)\s*(.+)/i);
    if (vsMatch) {
      petitioner = vsMatch[1].trim().substring(0, 200);
      respondent = vsMatch[2].trim().substring(0, 200);
    } else if (partyCell) {
      petitioner = partyCell.substring(0, 200);
    }
    
    // Lawyers (usually in 4th and 5th cells)
    if (cells.length > 3) petitionerLawyer = (cells[3] || '').substring(0, 100);
    if (cells.length > 4) respondentLawyer = (cells[4] || '').substring(0, 100);
    
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
  
  return entries;
}

// Log scraper run
async function logScraperRun(supabase: any, bench: string, status: string, casesFound: number, errorMessage: string | null, listType: string): Promise<void> {
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

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { 
      action = 'scrape', 
      bench = 'JODHPUR', 
      date, 
      list_type = 'D',
    } = await req.json() as ScrapeRequest;
    
    const targetDate = date || getSmartTargetDate();
    
    console.log(`[scrape-causelist] ========================================`);
    console.log(`[scrape-causelist] Action: ${action}, Bench: ${bench}`);
    console.log(`[scrape-causelist] Date: ${targetDate}, List Type: ${list_type}`);
    console.log(`[scrape-causelist] ========================================`);

    // Scrape using HTTP-based approach (no Browserless needed)
    const result = await scrapeWithHttp(
      bench,
      targetDate,
      list_type,
      supabaseUrl,
      supabaseKey
    );

    // Store entries in database if scrape action
    if (action === 'scrape' && result.success && result.entries.length > 0) {
      console.log(`[scrape-causelist] Storing ${result.entries.length} entries`);
      
      for (const entry of result.entries) {
        await supabase
          .from('daily_court_docket')
          .upsert(entry, { onConflict: 'case_number,date,court_room_no' });
      }
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
        message: result.success 
          ? `Found ${result.entries.length} cases` 
          : result.error,
        entries: result.entries,
        captchaSolved: result.captchaSolution,
        htmlPreview: result.rawHtml?.substring(0, 2000),
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
