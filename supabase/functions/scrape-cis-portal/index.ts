import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CIS_URLS = {
  JAIPUR: 'https://hcraj.nic.in/cishcraj-jp/causelists/',
  JODHPUR: 'https://hcraj.nic.in/cishcraj-jdp/causelists/'
};

interface ScrapeRequest {
  bench: 'JAIPUR' | 'JODHPUR';
  date: string; // DD/MM/YYYY format
  list_type: 'D' | 'S'; // D=Daily, S=Supplementary
  test_mode?: boolean;
}

interface CauseListEntry {
  item_no: number;
  case_number: string;
  petitioner: string;
  respondent: string;
  petitioner_lawyer: string;
  respondent_lawyer: string;
  court_room_no: string;
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
  // Pattern 1: src before id
  const match1 = html.match(/src=["'](data:image\/[^"']+)["'][^>]*id=["']captcha["']/i);
  if (match1) {
    console.log('CAPTCHA found with pattern 1 (src before id)');
    return match1[1];
  }
  
  // Pattern 2: id before src  
  const match2 = html.match(/id=["']captcha["'][^>]*src=["'](data:image\/[^"']+)["']/i);
  if (match2) {
    console.log('CAPTCHA found with pattern 2 (id before src)');
    return match2[1];
  }
  
  // Pattern 3: More flexible - find img tag with captcha id
  const imgMatch = html.match(/<img[^>]*id=["']captcha["'][^>]*>/i);
  if (imgMatch) {
    const srcMatch = imgMatch[0].match(/src=["'](data:image\/[^"']+)["']/i);
    if (srcMatch) {
      console.log('CAPTCHA found with pattern 3 (flexible)');
      return srcMatch[1];
    }
  }
  
  // Pattern 4: Find any base64 image near "captcha" text
  const nearbyMatch = html.match(/src=["'](data:image\/png;base64,[A-Za-z0-9+/=]+)["'][^>]*(?:alt=["']captcha["']|id=["']captcha["'])/i);
  if (nearbyMatch) {
    console.log('CAPTCHA found with pattern 4 (nearby)');
    return nearbyMatch[1];
  }
  
  console.log('No CAPTCHA pattern matched');
  return null;
}

// Solve CAPTCHA using our solve-captcha endpoint
async function solveCaptcha(imageBase64: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/solve-captcha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ image: imageBase64 })
    });
    
    if (!response.ok) {
      console.error('CAPTCHA solver error:', response.status);
      return null;
    }
    
    const result = await response.json();
    if (result.error) {
      console.error('CAPTCHA solver returned error:', result.error);
      return null;
    }
    
    console.log(`CAPTCHA solved: ${result.solution}`);
    return result.solution;
  } catch (error) {
    console.error('CAPTCHA solver exception:', error);
    return null;
  }
}

// Parse cause list HTML to extract entries
function parseCauseListHtml(html: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  console.log('Parsing response...');
  
  // Debug: Check for key page elements
  const hasDateField = html.includes('causelstdt');
  const hasSubmitBtn = html.includes('btnViewCauseList');
  const hasResultDiv = html.includes('grdCauseList') || html.includes('GridView');
  const hasAlertMsg = html.match(/alert\(['"]([^'"]+)['"]\)/)?.[1];
  
  console.log(`Page check: dateField=${hasDateField}, submitBtn=${hasSubmitBtn}, resultDiv=${hasResultDiv}, alert=${hasAlertMsg || 'none'}`);
  
  if (html.includes('Invalid Captcha') || html.includes('invalid captcha') || html.includes('Wrong Captcha') || html.includes('Incorrect Captcha')) {
    console.log('CAPTCHA validation failed');
    throw new Error('CAPTCHA_INVALID');
  }
  
  if (html.includes('No Record Found') || html.includes('no record found') || html.includes('No Data')) {
    console.log('No records found for this date');
    return [];
  }
  
  const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = html.match(tableRowPattern) || [];
  console.log(`Found ${rows.length} table rows`);
  
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
    if (cells[0].toLowerCase().includes('sr') || 
        cells[0].toLowerCase().includes('item') ||
        cells[0].toLowerCase().includes('case')) continue;
    
    const itemNo = parseInt(cells[0]);
    if (isNaN(itemNo) || itemNo <= 0) continue;
    
    const caseNumber = cells[1] || '';
    if (!caseNumber || caseNumber.length < 3) continue;
    
    let petitioner = '', respondent = '', petitionerLawyer = '', respondentLawyer = '';
    
    const partyCell = cells[2] || '';
    const vsMatch = partyCell.match(/(.+?)\s*(?:vs?\.?|v\/s|versus)\s*(.+)/i);
    if (vsMatch) {
      petitioner = vsMatch[1].trim().substring(0, 200);
      respondent = vsMatch[2].trim().substring(0, 200);
    } else if (partyCell) {
      petitioner = partyCell.substring(0, 200);
    }
    
    if (cells.length > 3) petitionerLawyer = (cells[3] || '').substring(0, 100);
    if (cells.length > 4) respondentLawyer = (cells[4] || '').substring(0, 100);
    
    entries.push({
      item_no: itemNo,
      case_number: caseNumber.substring(0, 100),
      petitioner,
      respondent,
      petitioner_lawyer: petitionerLawyer,
      respondent_lawyer: respondentLawyer,
      court_room_no: currentCourtNo
    });
  }
  
  console.log(`Parsed ${entries.length} entries`);
  return entries;
}

// Scrape using direct HTTP requests with session cookies
async function scrapeWithHttpSession(
  baseUrl: string,
  date: string,
  listType: string
): Promise<{ html: string; captchaSolution?: string; error?: string }> {
  console.log(`HTTP session scrape: ${baseUrl}, date=${date}, listType=${listType}`);
  
  // Step 1: GET the initial page to get session cookie and CAPTCHA
  console.log('Step 1: Fetching initial page...');
  const initialResponse = await fetch(baseUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });
  
  if (!initialResponse.ok) {
    return { html: '', error: `Initial page fetch failed: ${initialResponse.status}` };
  }
  
  const initialHtml = await initialResponse.text();
  console.log(`Initial page: ${initialHtml.length} chars`);
  
  // Extract session cookies
  const cookies = extractCookies(initialResponse);
  console.log(`Cookies: ${cookies.substring(0, 100)}...`);
  
  // Extract ASP.NET hidden fields
  const aspFields = extractAspNetFields(initialHtml);
  console.log(`ASP.NET fields found: ${Object.keys(aspFields).join(', ')}`);
  
  // Extract CAPTCHA image
  const captchaBase64 = extractCaptchaBase64(initialHtml);
  if (!captchaBase64) {
    return { html: initialHtml, error: 'CAPTCHA image not found in page' };
  }
  console.log(`CAPTCHA extracted: ${captchaBase64.length} chars`);
  
  // Step 2: Solve CAPTCHA
  console.log('Step 2: Solving CAPTCHA...');
  const captchaSolution = await solveCaptcha(captchaBase64);
  if (!captchaSolution) {
    return { html: initialHtml, error: 'Failed to solve CAPTCHA' };
  }
  
  // Step 3: Submit form with POST request
  console.log('Step 3: Submitting form...');
  
  const formData = new URLSearchParams();
  
  // Add ASP.NET fields
  for (const [key, value] of Object.entries(aspFields)) {
    formData.append(key, value);
  }
  
  // Add form fields
  formData.append('causelstdt', date);
  formData.append('causelisttype', listType);
  formData.append('txtCaptcha', captchaSolution);
  formData.append('formatradio', 'opthtml'); // HTML format
  formData.append('__EVENTTARGET', 'btnViewCauseList');
  formData.append('__EVENTARGUMENT', '');
  
  console.log(`Form data: date=${date}, listType=${listType}, captcha=${captchaSolution}`);
  
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
    return { html: '', error: `Form submission failed: ${submitResponse.status}` };
  }
  
  const resultHtml = await submitResponse.text();
  console.log(`Result page: ${resultHtml.length} chars`);
  
  return { html: resultHtml, captchaSolution };
}

// Main scrape function
async function scrapeCISPortal(request: ScrapeRequest): Promise<{
  success: boolean;
  entries: CauseListEntry[];
  error?: string;
  attempts: number;
  rawResponse?: string;
  captchaSolution?: string;
}> {
  const baseUrl = CIS_URLS[request.bench];
  const maxAttempts = 3;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n=== Attempt ${attempt}/${maxAttempts} for ${request.bench} ===`);
    
    try {
      const { html, captchaSolution, error } = await scrapeWithHttpSession(
        baseUrl,
        request.date,
        request.list_type
      );
      
      if (error) {
        console.log(`Scrape error: ${error}`);
        if (attempt === maxAttempts) {
          return {
            success: false,
            entries: [],
            error,
            attempts: attempt,
            captchaSolution,
            rawResponse: request.test_mode ? html.substring(0, 5000) : undefined
          };
        }
        continue;
      }
      
      try {
        const entries = parseCauseListHtml(html);
        
        return {
          success: true,
          entries,
          attempts: attempt,
          captchaSolution: request.test_mode ? captchaSolution : undefined,
          rawResponse: request.test_mode ? html.substring(0, 5000) : undefined
        };
      } catch (parseError: unknown) {
        const errMsg = parseError instanceof Error ? parseError.message : String(parseError);
        if (errMsg === 'CAPTCHA_INVALID') {
          console.log('CAPTCHA was invalid, retrying...');
          continue;
        }
        throw parseError;
      }
      
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Attempt ${attempt} failed:`, errMsg);
      
      if (attempt === maxAttempts) {
        return { success: false, entries: [], error: errMsg, attempts: attempt };
      }
    }
  }
  
  return { success: false, entries: [], error: 'Max attempts reached', attempts: maxAttempts };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const body = await req.json() as ScrapeRequest;
    const { bench = 'JODHPUR', date, list_type = 'D', test_mode = false } = body;
    
    if (!date) {
      return new Response(
        JSON.stringify({ success: false, error: 'Date is required (DD/MM/YYYY format)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!['JAIPUR', 'JODHPUR'].includes(bench)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid bench. Use JAIPUR or JODHPUR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`\n========== CIS Portal Scrape Request ==========`);
    console.log(`Bench: ${bench}, Date: ${date}, List Type: ${list_type}, Test Mode: ${test_mode}`);
    
    const result = await scrapeCISPortal({
      bench: bench as 'JAIPUR' | 'JODHPUR',
      date,
      list_type: list_type as 'D' | 'S',
      test_mode
    });
    
    // Store in database if not test mode and successful
    if (!test_mode && result.success && result.entries.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const dateParts = date.split('/');
      const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      const listTypeFull = list_type === 'D' ? 'DAILY' : 'SUPPLEMENTARY';
      
      const insertData = result.entries.map(entry => ({
        date: isoDate,
        court_location: bench,
        list_type: listTypeFull,
        court_room_no: entry.court_room_no,
        item_no: entry.item_no,
        case_number: entry.case_number,
        petitioner: entry.petitioner,
        respondent: entry.respondent,
        petitioner_lawyer: entry.petitioner_lawyer,
        respondent_lawyer: entry.respondent_lawyer,
        status: 'pending'
      }));
      
      const { error: insertError } = await supabase
        .from('daily_court_docket')
        .upsert(insertData, { onConflict: 'date,court_location,court_room_no,item_no', ignoreDuplicates: false });
      
      if (insertError) {
        console.error('Database insert error:', insertError);
      } else {
        console.log(`Inserted/updated ${result.entries.length} entries`);
      }
      
      await supabase.from('scraper_logs').insert({
        bench,
        status: 'success',
        cases_found: result.entries.length,
        list_type: listTypeFull,
        court_no: 'ALL'
      });
    }
    
    // Log failed attempts
    if (!result.success) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('scraper_logs').insert({
          bench,
          status: 'error',
          error_message: result.error?.substring(0, 500),
          list_type: list_type === 'D' ? 'DAILY' : 'SUPPLEMENTARY'
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.success 
          ? `Scraped ${result.entries.length} entries in ${result.attempts} attempt(s)`
          : result.error,
        entries_count: result.entries.length,
        entries: test_mode ? result.entries : undefined,
        attempts: result.attempts,
        captcha_solution: result.captchaSolution,
        raw_response_preview: result.rawResponse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Handler error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
