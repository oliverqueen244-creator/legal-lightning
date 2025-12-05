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
  test_mode?: boolean; // Just return parsed data without storing
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

// Fetch the CIS page and get session cookie
async function fetchPageAndCookie(baseUrl: string): Promise<{ html: string; cookies: string }> {
  console.log(`Fetching CIS page: ${baseUrl}`);
  
  const response = await fetch(baseUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    }
  });
  
  const cookies = response.headers.get('set-cookie') || '';
  const html = await response.text();
  
  console.log(`Got page (${html.length} chars), cookies: ${cookies.substring(0, 100)}...`);
  
  return { html, cookies };
}

// Fetch CAPTCHA image as base64
async function fetchCaptchaImage(baseUrl: string, cookies: string): Promise<string> {
  const captchaUrl = `${baseUrl}CaptchaSecurityImages.php?width=100&height=40&characters=5`;
  console.log(`Fetching CAPTCHA from: ${captchaUrl}`);
  
  const response = await fetch(captchaUrl, {
    method: 'GET',
    headers: {
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': baseUrl,
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch CAPTCHA: ${response.status}`);
  }
  
  const buffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  
  console.log(`Got CAPTCHA image (${buffer.byteLength} bytes)`);
  
  return base64;
}

// Solve CAPTCHA using Gemini Vision
async function solveCaptchaWithGemini(captchaBase64: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }
  
  console.log('Sending CAPTCHA to Gemini for solving...');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'This is a CAPTCHA image from a government website. Read the text/characters shown in this CAPTCHA image. Return ONLY the exact characters you see, nothing else. No explanation, no quotes, just the characters. The CAPTCHA typically contains 5 alphanumeric characters.'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${captchaBase64}`
            }
          }
        ]
      }],
      max_tokens: 50
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('Payment required. Please add credits to your workspace.');
    }
    throw new Error(`Gemini API error: ${response.status}`);
  }
  
  const data = await response.json();
  const solution = data.choices?.[0]?.message?.content?.trim() || '';
  
  console.log(`Gemini solved CAPTCHA: "${solution}"`);
  
  return solution;
}

// Submit form with solved CAPTCHA
async function submitCauseListForm(
  baseUrl: string,
  cookies: string,
  date: string,
  listType: string,
  captchaSolution: string
): Promise<string> {
  console.log(`Submitting form with date=${date}, listType=${listType}, captcha=${captchaSolution}`);
  
  const formData = new URLSearchParams();
  formData.append('causelistradio', 'C'); // Cause List
  formData.append('causelstdt', date);
  formData.append('causelisttype', listType);
  formData.append('formatradio', '1'); // HTML format
  formData.append('txtCaptcha', captchaSolution);
  formData.append('Submit', 'Submit');
  
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Cookie': cookies,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': baseUrl,
      'Origin': baseUrl.replace('/causelists/', ''),
    },
    body: formData.toString()
  });
  
  const html = await response.text();
  console.log(`Form submission response (${html.length} chars)`);
  
  return html;
}

// Parse cause list HTML to extract entries
function parseCauseListHtml(html: string, bench: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  console.log('Parsing HTML response...');
  
  // Check for error messages
  if (html.includes('Invalid Captcha') || html.includes('invalid captcha')) {
    console.log('CAPTCHA validation failed');
    throw new Error('CAPTCHA_INVALID');
  }
  
  if (html.includes('No Record Found') || html.includes('no record found')) {
    console.log('No records found for this date/type');
    return [];
  }
  
  // Look for table with cause list data
  // The HTML structure varies but typically has tables with case data
  
  // Pattern 1: Look for tables with case number patterns
  const casePattern = /(\d+)\s*[.)\s]+\s*((?:S\.B\.|D\.B\.|[\w\s]+)\s*(?:Civil|Criminal|Writ|Appeal|Petition|Misc|Application|Case|Review|Revision)[\w\s./()-]*\d+\/\d+)/gi;
  
  // Pattern 2: Look for structured table rows
  const tableRowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  
  // Try to find court-wise sections
  const courtSectionPattern = /Court\s*(?:No\.?|Number)?\s*:?\s*(\d+)[\s\S]*?(?=Court\s*(?:No\.?|Number)?|$)/gi;
  
  let currentCourtNo = '1';
  let match;
  
  // First, try to parse structured tables
  const rows = html.match(tableRowPattern) || [];
  console.log(`Found ${rows.length} table rows`);
  
  for (const row of rows) {
    const cells: string[] = [];
    let cellMatch;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      // Strip HTML tags and clean up whitespace
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(cellText);
    }
    
    // Skip header rows or empty rows
    if (cells.length < 3) continue;
    if (cells[0].toLowerCase().includes('sr') || cells[0].toLowerCase().includes('item')) continue;
    
    // Try to parse as case entry
    const itemNo = parseInt(cells[0]);
    if (isNaN(itemNo)) continue;
    
    // Typically: Item No, Case No, Petitioner vs Respondent, Lawyers
    const caseNumber = cells[1] || '';
    
    // Parse petitioner vs respondent
    let petitioner = '';
    let respondent = '';
    let petitionerLawyer = '';
    let respondentLawyer = '';
    
    // Look for "vs" or "V/s" pattern in party names
    const partyCell = cells[2] || '';
    const vsMatch = partyCell.match(/(.+?)\s*(?:vs?\.?|v\/s)\s*(.+)/i);
    if (vsMatch) {
      petitioner = vsMatch[1].trim();
      respondent = vsMatch[2].trim();
    } else {
      petitioner = partyCell;
    }
    
    // Lawyers are often in subsequent cells
    if (cells.length > 3) {
      petitionerLawyer = cells[3] || '';
    }
    if (cells.length > 4) {
      respondentLawyer = cells[4] || '';
    }
    
    if (caseNumber) {
      entries.push({
        item_no: itemNo,
        case_number: caseNumber,
        petitioner,
        respondent,
        petitioner_lawyer: petitionerLawyer,
        respondent_lawyer: respondentLawyer,
        court_room_no: currentCourtNo
      });
    }
  }
  
  console.log(`Parsed ${entries.length} entries from HTML`);
  
  // Log sample entry for debugging
  if (entries.length > 0) {
    console.log('Sample entry:', JSON.stringify(entries[0]));
  }
  
  return entries;
}

// Main scrape function with retry logic
async function scrapeCISPortal(request: ScrapeRequest): Promise<{
  success: boolean;
  entries: CauseListEntry[];
  error?: string;
  attempts: number;
  rawHtml?: string;
}> {
  const baseUrl = CIS_URLS[request.bench];
  const maxAttempts = 3;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n=== Attempt ${attempt}/${maxAttempts} for ${request.bench} ${request.list_type === 'D' ? 'Daily' : 'Supplementary'} ===`);
    
    try {
      // Step 1: Fetch page and get session
      const { cookies } = await fetchPageAndCookie(baseUrl);
      
      if (!cookies) {
        console.log('No session cookie received, retrying...');
        continue;
      }
      
      // Step 2: Fetch CAPTCHA
      const captchaBase64 = await fetchCaptchaImage(baseUrl, cookies);
      
      // Step 3: Solve CAPTCHA with Gemini
      const captchaSolution = await solveCaptchaWithGemini(captchaBase64);
      
      if (!captchaSolution || captchaSolution.length < 3) {
        console.log('Invalid CAPTCHA solution, retrying...');
        continue;
      }
      
      // Step 4: Submit form
      const resultHtml = await submitCauseListForm(
        baseUrl,
        cookies,
        request.date,
        request.list_type,
        captchaSolution
      );
      
      // Step 5: Parse results
      try {
        const entries = parseCauseListHtml(resultHtml, request.bench);
        
        return {
          success: true,
          entries,
          attempts: attempt,
          rawHtml: request.test_mode ? resultHtml.substring(0, 5000) : undefined
        };
      } catch (parseError: unknown) {
        const errMsg = parseError instanceof Error ? parseError.message : String(parseError);
        if (errMsg === 'CAPTCHA_INVALID') {
          console.log('CAPTCHA was invalid, retrying with new CAPTCHA...');
          continue;
        }
        throw parseError;
      }
      
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Attempt ${attempt} failed:`, errMsg);
      
      // Don't retry on rate limit or payment errors
      if (errMsg.includes('Rate limit') || errMsg.includes('Payment required')) {
        return {
          success: false,
          entries: [],
          error: errMsg,
          attempts: attempt
        };
      }
      
      if (attempt === maxAttempts) {
        return {
          success: false,
          entries: [],
          error: errMsg,
          attempts: attempt
        };
      }
    }
  }
  
  return {
    success: false,
    entries: [],
    error: 'Max attempts reached',
    attempts: maxAttempts
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const body = await req.json() as ScrapeRequest;
    
    const { bench = 'JODHPUR', date, list_type = 'D', test_mode = false } = body;
    
    // Validate inputs
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
    
    // Execute scrape
    const result = await scrapeCISPortal({
      bench: bench as 'JAIPUR' | 'JODHPUR',
      date,
      list_type: list_type as 'D' | 'S',
      test_mode
    });
    
    // If not test mode and successful, store in database
    if (!test_mode && result.success && result.entries.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Convert DD/MM/YYYY to YYYY-MM-DD for database
      const dateParts = date.split('/');
      const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      
      const listTypeFull = list_type === 'D' ? 'DAILY' : 'SUPPLEMENTARY';
      
      // Insert entries
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
        .upsert(insertData, { 
          onConflict: 'date,court_location,court_room_no,item_no',
          ignoreDuplicates: false 
        });
      
      if (insertError) {
        console.error('Database insert error:', insertError);
      } else {
        console.log(`Inserted/updated ${result.entries.length} entries in database`);
      }
      
      // Log scraper run
      await supabase.from('scraper_logs').insert({
        bench,
        status: 'success',
        cases_found: result.entries.length,
        list_type: listTypeFull,
        court_no: 'ALL'
      });
    }
    
    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.success 
          ? `Successfully scraped ${result.entries.length} entries in ${result.attempts} attempt(s)`
          : result.error,
        entries_count: result.entries.length,
        entries: test_mode ? result.entries : undefined,
        raw_html_preview: result.rawHtml,
        attempts: result.attempts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Edge function error:', errMsg);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
