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

// Use Firecrawl to render page with JavaScript (CAPTCHA is dynamically loaded)
async function fetchRenderedPage(baseUrl: string, firecrawlApiKey: string): Promise<{ html: string; screenshot?: string }> {
  console.log(`Fetching rendered page via Firecrawl: ${baseUrl}`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: baseUrl,
      formats: ['html', 'screenshot'],
      waitFor: 5000, // Wait for JavaScript to load CAPTCHA
      timeout: 30000
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Firecrawl error:', response.status, errorText);
    throw new Error(`Firecrawl error: ${response.status}`);
  }

  const data = await response.json();
  const html = data.data?.html || '';
  const screenshot = data.data?.screenshot || '';
  
  console.log(`Firecrawl returned HTML (${html.length} chars), screenshot: ${screenshot ? 'yes' : 'no'}`);
  
  return { html, screenshot };
}

// Convert screenshot URL to base64 for Gemini
async function convertScreenshotToBase64(screenshotUrl: string): Promise<string> {
  // If already base64, return as-is
  if (screenshotUrl.startsWith('data:')) {
    return screenshotUrl;
  }
  
  console.log(`Fetching screenshot URL: ${screenshotUrl.substring(0, 100)}...`);
  
  const response = await fetch(screenshotUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch screenshot: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  
  console.log(`Converted screenshot to base64 (${base64.length} chars)`);
  
  return `data:image/png;base64,${base64}`;
}

// Extract base64 CAPTCHA from rendered HTML
function extractCaptchaBase64(html: string): string | null {
  console.log(`Searching for CAPTCHA in HTML (${html.length} chars)`);
  
  // Look for img tag with id="captcha" and extract src
  const imgTagMatch = html.match(/<img[^>]*id=["']?captcha["']?[^>]*>/i);
  if (imgTagMatch) {
    console.log('Found img tag with captcha id:', imgTagMatch[0].substring(0, 150));
    const srcMatch = imgTagMatch[0].match(/src=["'](data:image[^"']+)["']/i);
    if (srcMatch) {
      console.log(`Extracted CAPTCHA base64 (${srcMatch[1].length} chars)`);
      return srcMatch[1];
    }
  }
  
  // Search for any base64 PNG images
  const base64Pattern = /data:image\/png;base64,[A-Za-z0-9+\/=]+/g;
  const allBase64 = html.match(base64Pattern);
  if (allBase64 && allBase64.length > 0) {
    console.log(`Found ${allBase64.length} base64 images`);
    // Return the one near "captcha" text
    for (const b64 of allBase64) {
      const idx = html.indexOf(b64);
      const context = html.substring(Math.max(0, idx - 200), Math.min(html.length, idx + b64.length + 200));
      if (context.toLowerCase().includes('captcha')) {
        console.log('Found CAPTCHA base64 near captcha text');
        return b64;
      }
    }
    // Return first one as fallback
    console.log('Returning first base64 image');
    return allBase64[0];
  }
  
  console.log('Could not find base64 CAPTCHA in HTML');
  return null;
}

// Solve CAPTCHA using Gemini - can accept either base64 CAPTCHA image or full page screenshot
async function solveCaptchaWithGemini(imageData: string, isFullScreenshot: boolean = false): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }
  
  console.log(`Sending ${isFullScreenshot ? 'screenshot' : 'CAPTCHA'} to Gemini (${imageData.length} chars)...`);
  
  const prompt = isFullScreenshot 
    ? `This is a screenshot of a court cause list form page. 
Find the CAPTCHA image near the "Enter Verification Code" label.
The CAPTCHA contains ONLY English letters (A-Z) and numbers (0-9) - typically 5-6 characters.

IMPORTANT RULES:
- Return ONLY letters (A-Z) and numbers (0-9)
- Do NOT include any special symbols like ^, -, _, *, @, #, etc.
- Do NOT include spaces, quotes, periods, or any punctuation
- Do NOT include any explanation or text before/after the answer

Just output the alphanumeric characters you see in the CAPTCHA.`
    : `This is a CAPTCHA image from a court website.
The CAPTCHA contains ONLY English letters (A-Z) and numbers (0-9).
There are NO special characters, symbols, or punctuation marks in the CAPTCHA.

IMPORTANT RULES:
1. Look at the characters carefully
2. Identify ONLY letters (A-Z) and numbers (0-9)
3. Do NOT include any symbols like ^, -, _, *, @, #, etc.
4. Do NOT include spaces, quotes, periods, or any punctuation
5. Do NOT include any explanation

Return ONLY the alphanumeric characters you see.`;
  
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
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageData } }
        ]
      }],
      max_tokens: 50
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    
    if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
    if (response.status === 402) throw new Error('Payment required. Please add credits.');
    throw new Error(`Gemini API error: ${response.status}`);
  }
  
  const data = await response.json();
  const rawSolution = data.choices?.[0]?.message?.content?.trim() || '';
  
  // Remove ALL non-alphanumeric characters and convert to uppercase
  const cleanSolution = rawSolution.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  console.log(`Gemini raw response: "${rawSolution}"`);
  console.log(`Cleaned CAPTCHA solution: "${cleanSolution}"`);
  
  return cleanSolution;
}

// Use Firecrawl to fill form and submit
async function submitFormWithFirecrawl(
  baseUrl: string,
  date: string,
  listType: string,
  captchaSolution: string,
  firecrawlApiKey: string
): Promise<string> {
  console.log(`Submitting form via Firecrawl: date=${date}, listType=${listType}, captcha=${captchaSolution}`);
  
  const fillFormScript = `
    // Set date
    const dateInput = document.getElementById('causelstdt');
    if (dateInput) dateInput.value = '${date}';
    
    // Set list type
    const listTypeSelect = document.getElementById('causelisttype');
    if (listTypeSelect) listTypeSelect.value = '${listType}';
    
    // Set format to HTML
    const formatRadio = document.getElementById('formatradio1');
    if (formatRadio) formatRadio.checked = true;
    
    // Set CAPTCHA
    const captchaInput = document.getElementById('txtCaptcha');
    if (captchaInput) captchaInput.value = '${captchaSolution}';
    
    // Trigger events
    if (listTypeSelect) listTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  `;
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: baseUrl,
      formats: ['html', 'markdown'],
      waitFor: 3000,
      timeout: 60000,
      actions: [
        { type: 'wait', milliseconds: 3000 },
        { type: 'executeJavascript', script: fillFormScript },
        { type: 'wait', milliseconds: 1000 },
        { type: 'click', selector: '#btnViewCauseList' },
        { type: 'wait', milliseconds: 8000 },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Firecrawl submit error:', response.status, errorText);
    throw new Error(`Form submission failed: ${response.status}`);
  }

  const data = await response.json();
  const html = data.data?.html || data.data?.markdown || '';
  
  console.log(`Form submitted, got response (${html.length} chars)`);
  return html;
}

// Parse cause list HTML to extract entries
function parseCauseListHtml(html: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  console.log('Parsing response...');
  
  if (html.includes('Invalid Captcha') || html.includes('invalid captcha') || html.includes('Wrong Captcha') || html.includes('Incorrect Captcha')) {
    console.log('CAPTCHA validation failed');
    throw new Error('CAPTCHA_INVALID');
  }
  
  if (html.includes('No Record Found') || html.includes('no record found') || html.includes('No Data')) {
    console.log('No records found');
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
  
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_API_KEY) {
    return { success: false, entries: [], error: 'FIRECRAWL_API_KEY not configured', attempts: 0 };
  }
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n=== Attempt ${attempt}/${maxAttempts} for ${request.bench} ===`);
    
    try {
      // Step 1: Fetch rendered page with Firecrawl (JS loaded)
      const { html: pageHtml, screenshot } = await fetchRenderedPage(baseUrl, FIRECRAWL_API_KEY);
      
      // Step 2: Try to extract CAPTCHA from HTML first
      let captchaBase64 = extractCaptchaBase64(pageHtml);
      let useScreenshot = false;
      
      // Step 3: If no CAPTCHA in HTML, use screenshot
      if (!captchaBase64 && screenshot) {
        console.log('No CAPTCHA in HTML, using screenshot for Gemini');
        captchaBase64 = await convertScreenshotToBase64(screenshot);
        useScreenshot = true;
      }
      
      if (!captchaBase64) {
        console.log('Failed to get CAPTCHA image');
        if (request.test_mode) {
          return {
            success: false,
            entries: [],
            error: 'Could not extract CAPTCHA',
            attempts: attempt,
            captchaExtracted: false,
            rawResponse: pageHtml.substring(0, 3000)
          };
        }
        continue;
      }
      
      // Step 4: Solve CAPTCHA with Gemini
      const captchaSolution = await solveCaptchaWithGemini(captchaBase64, useScreenshot);
      
      if (!captchaSolution || captchaSolution.length < 3 || captchaSolution.length > 10) {
        console.log(`Invalid CAPTCHA solution: "${captchaSolution}"`);
        continue;
      }
      
      // Step 5: Submit form
      const resultHtml = await submitFormWithFirecrawl(
        baseUrl,
        request.date,
        request.list_type,
        captchaSolution,
        FIRECRAWL_API_KEY
      );
      
      // Step 6: Parse results
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
        return { success: false, entries: [], error: errMsg, attempts: attempt };
      }
      
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
