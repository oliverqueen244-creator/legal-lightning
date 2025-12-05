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

// Fetch CIS page and extract cookies
async function fetchCISPage(baseUrl: string): Promise<{ html: string; cookies: string }> {
  console.log(`Fetching CIS page: ${baseUrl}`);
  
  const response = await fetch(baseUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch CIS page: ${response.status}`);
  }
  
  const cookies = response.headers.get('set-cookie') || '';
  const html = await response.text();
  
  console.log(`Got HTML (${html.length} chars), cookies: ${cookies ? 'yes' : 'no'}`);
  
  return { html, cookies };
}

// Extract base64 CAPTCHA from HTML
function extractCaptchaBase64(html: string): string | null {
  // Pattern 1: src="data:..." id="captcha"
  const pattern1 = /src=["'](data:image\/[^"']+)["'][^>]*id=["']captcha["']/i;
  const match1 = html.match(pattern1);
  if (match1) {
    console.log('Found CAPTCHA with pattern 1');
    return match1[1];
  }
  
  // Pattern 2: id="captcha" ... src="data:..."
  const pattern2 = /id=["']captcha["'][^>]*src=["'](data:image\/[^"']+)["']/i;
  const match2 = html.match(pattern2);
  if (match2) {
    console.log('Found CAPTCHA with pattern 2');
    return match2[1];
  }
  
  // Pattern 3: Generic img with captcha in any attribute
  const pattern3 = /<img[^>]*captcha[^>]*src=["'](data:image\/[^"']+)["']/i;
  const match3 = html.match(pattern3);
  if (match3) {
    console.log('Found CAPTCHA with pattern 3');
    return match3[1];
  }
  
  // Pattern 4: Look for any base64 image near captcha text
  const pattern4 = /captcha[\s\S]{0,200}(data:image\/png;base64,[A-Za-z0-9+\/=]+)/i;
  const match4 = html.match(pattern4);
  if (match4) {
    console.log('Found CAPTCHA with pattern 4');
    return match4[1];
  }
  
  console.log('Could not find CAPTCHA in HTML');
  return null;
}

// Solve CAPTCHA using Gemini via Lovable AI
async function solveCaptchaWithGemini(captchaBase64: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }
  
  console.log(`Sending CAPTCHA to Gemini (${captchaBase64.length} chars)...`);
  
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
            text: `This is a CAPTCHA image from a court website. Read the characters shown in this CAPTCHA image.
The CAPTCHA typically contains 5-6 alphanumeric characters (letters and numbers).
Return ONLY the exact characters you see, nothing else. No explanation, no quotes, no punctuation - just the characters.`
          },
          {
            type: 'image_url',
            image_url: {
              url: captchaBase64
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
  
  // Clean up the solution - remove any quotes, spaces, or extra text
  const cleanSolution = solution.replace(/['".\s]/g, '').trim();
  
  console.log(`Gemini solved CAPTCHA: "${cleanSolution}"`);
  
  return cleanSolution;
}

// Submit form via POST request
async function submitCauseListForm(
  baseUrl: string,
  cookies: string,
  date: string,
  listType: string,
  captchaSolution: string
): Promise<string> {
  console.log(`Submitting form: date=${date}, listType=${listType}, captcha=${captchaSolution}`);
  
  const formData = new URLSearchParams({
    'causelstdt': date,
    'causelisttype': listType,
    'formatradio': '1', // HTML format
    'txtCaptcha': captchaSolution
  });
  
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Origin': baseUrl.replace(/\/causelists\/?$/, ''),
    'Referer': baseUrl,
  };
  
  if (cookies) {
    headers['Cookie'] = cookies;
  }
  
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: formData.toString()
  });
  
  if (!response.ok) {
    throw new Error(`Form submission failed: ${response.status}`);
  }
  
  const html = await response.text();
  console.log(`Form response: ${html.length} chars`);
  
  return html;
}

// Parse cause list HTML to extract entries
function parseCauseListHtml(html: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  console.log('Parsing response...');
  
  // Check for error messages
  if (html.includes('Invalid Captcha') || html.includes('invalid captcha') || html.includes('Wrong Captcha') || html.includes('Incorrect Captcha')) {
    console.log('CAPTCHA validation failed');
    throw new Error('CAPTCHA_INVALID');
  }
  
  if (html.includes('No Record Found') || html.includes('no record found') || html.includes('No Data')) {
    console.log('No records found for this date/type');
    return [];
  }
  
  // Parse table rows
  const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = html.match(tableRowPattern) || [];
  console.log(`Found ${rows.length} table rows`);
  
  let currentCourtNo = '1';
  
  // Try to find court number patterns
  const courtPattern = /Court\s*(?:No\.?|Room)?\s*:?\s*(\d+)/gi;
  let courtMatch;
  while ((courtMatch = courtPattern.exec(html)) !== null) {
    console.log(`Found court reference: ${courtMatch[0]}`);
  }
  
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
    
    // Skip header rows or empty rows
    if (cells.length < 2) continue;
    if (cells[0].toLowerCase().includes('sr') || 
        cells[0].toLowerCase().includes('item') ||
        cells[0].toLowerCase().includes('case')) continue;
    
    // Try to parse as case entry
    const itemNo = parseInt(cells[0]);
    if (isNaN(itemNo) || itemNo <= 0) continue;
    
    // Case number is usually in cells[1]
    const caseNumber = cells[1] || '';
    if (!caseNumber || caseNumber.length < 3) continue;
    
    // Parse petitioner vs respondent
    let petitioner = '';
    let respondent = '';
    let petitionerLawyer = '';
    let respondentLawyer = '';
    
    // Look for "vs" or "V/s" pattern
    const partyCell = cells[2] || '';
    const vsMatch = partyCell.match(/(.+?)\s*(?:vs?\.?|v\/s|versus)\s*(.+)/i);
    if (vsMatch) {
      petitioner = vsMatch[1].trim().substring(0, 200);
      respondent = vsMatch[2].trim().substring(0, 200);
    } else if (partyCell) {
      petitioner = partyCell.substring(0, 200);
    }
    
    // Lawyers in subsequent cells
    if (cells.length > 3) {
      petitionerLawyer = (cells[3] || '').substring(0, 100);
    }
    if (cells.length > 4) {
      respondentLawyer = (cells[4] || '').substring(0, 100);
    }
    
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
  
  // Fallback: try to parse from numbered patterns
  if (entries.length === 0) {
    const numberedPattern = /^\s*(\d+)[\.\)]\s+([^\n]+)/gm;
    let match;
    while ((match = numberedPattern.exec(html)) !== null) {
      const itemNo = parseInt(match[1]);
      const content = match[2];
      
      const caseMatch = content.match(/([A-Z]+[\/\-\s]*(?:No\.?)?\s*\d+[\/\-]\d+)/i);
      if (caseMatch && itemNo > 0) {
        entries.push({
          item_no: itemNo,
          case_number: caseMatch[1],
          petitioner: '',
          respondent: '',
          petitioner_lawyer: '',
          respondent_lawyer: '',
          court_room_no: currentCourtNo
        });
      }
    }
  }
  
  console.log(`Parsed ${entries.length} entries`);
  
  if (entries.length > 0) {
    console.log('Sample entry:', JSON.stringify(entries[0]));
  }
  
  return entries;
}

// Main scrape function
async function scrapeCISPortal(request: ScrapeRequest): Promise<{
  success: boolean;
  entries: CauseListEntry[];
  error?: string;
  attempts: number;
  rawResponse?: string;
  captchaExtracted?: boolean;
  captchaSolution?: string;
}> {
  const baseUrl = CIS_URLS[request.bench];
  const maxAttempts = 3;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n=== Attempt ${attempt}/${maxAttempts} for ${request.bench} ${request.list_type === 'D' ? 'Daily' : 'Supplementary'} ===`);
    
    try {
      // Step 1: Fetch the CIS page to get HTML with embedded CAPTCHA
      const { html: pageHtml, cookies } = await fetchCISPage(baseUrl);
      
      // Step 2: Extract base64 CAPTCHA from HTML
      const captchaBase64 = extractCaptchaBase64(pageHtml);
      
      if (!captchaBase64) {
        console.log('Failed to extract CAPTCHA from HTML');
        if (request.test_mode) {
          return {
            success: false,
            entries: [],
            error: 'Could not extract CAPTCHA from page HTML',
            attempts: attempt,
            captchaExtracted: false,
            rawResponse: pageHtml.substring(0, 3000)
          };
        }
        continue;
      }
      
      console.log(`Extracted CAPTCHA base64 (${captchaBase64.length} chars)`);
      
      // Step 3: Solve CAPTCHA with Gemini
      const captchaSolution = await solveCaptchaWithGemini(captchaBase64);
      
      if (!captchaSolution || captchaSolution.length < 3 || captchaSolution.length > 10) {
        console.log(`Invalid CAPTCHA solution: "${captchaSolution}"`);
        continue;
      }
      
      // Step 4: Submit form with solved CAPTCHA
      const resultHtml = await submitCauseListForm(
        baseUrl,
        cookies,
        request.date,
        request.list_type,
        captchaSolution
      );
      
      // Step 5: Parse results
      try {
        const entries = parseCauseListHtml(resultHtml);
        
        return {
          success: true,
          entries,
          attempts: attempt,
          captchaExtracted: true,
          captchaSolution: request.test_mode ? captchaSolution : undefined,
          rawResponse: request.test_mode ? resultHtml.substring(0, 5000) : undefined
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
        .upsert(insertData, { 
          onConflict: 'date,court_location,court_room_no,item_no',
          ignoreDuplicates: false 
        });
      
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
    
    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.success 
          ? `Scraped ${result.entries.length} entries in ${result.attempts} attempt(s)`
          : result.error,
        entries_count: result.entries.length,
        entries: test_mode ? result.entries : undefined,
        raw_response_preview: result.rawResponse,
        captcha_extracted: result.captchaExtracted,
        captcha_solution: result.captchaSolution,
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
