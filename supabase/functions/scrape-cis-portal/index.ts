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

// Parse cause list HTML to extract entries
function parseCauseListHtml(html: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  console.log('Parsing response...');
  
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

// Single Firecrawl call that: loads page, solves CAPTCHA via external API, fills form, submits
async function scrapeWithSingleSession(
  baseUrl: string,
  date: string,
  listType: string,
  firecrawlApiKey: string,
  solverEndpoint: string
): Promise<{ html: string; captchaSolution?: string; debugInfo?: string }> {
  console.log(`Single-session scrape: ${baseUrl}, date=${date}, listType=${listType}`);
  
  // JavaScript that runs in the browser to:
  // 1. Extract CAPTCHA base64
  // 2. Call our solver endpoint
  // 3. Fill form with solution
  // 4. Submit form
  const solveAndSubmitScript = `
    (async function() {
      try {
        // Get CAPTCHA image base64
        const captchaImg = document.getElementById('captcha');
        if (!captchaImg) {
          window.__scraperError = 'CAPTCHA image not found';
          return;
        }
        
        const captchaBase64 = captchaImg.src;
        if (!captchaBase64 || !captchaBase64.startsWith('data:')) {
          window.__scraperError = 'CAPTCHA not loaded as base64';
          return;
        }
        
        window.__captchaExtracted = captchaBase64.substring(0, 100);
        
        // Call our solver endpoint
        const response = await fetch('${solverEndpoint}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: captchaBase64 })
        });
        
        if (!response.ok) {
          window.__scraperError = 'Solver API error: ' + response.status;
          return;
        }
        
        const { solution, error } = await response.json();
        if (error || !solution) {
          window.__scraperError = 'Solver returned error: ' + (error || 'no solution');
          return;
        }
        
        window.__captchaSolution = solution;
        
        // Fill form
        const dateInput = document.getElementById('causelstdt');
        if (dateInput) dateInput.value = '${date}';
        
        const listTypeSelect = document.getElementById('causelisttype');
        if (listTypeSelect) {
          listTypeSelect.value = '${listType}';
          listTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        const formatRadio = document.getElementById('formatradio1');
        if (formatRadio) formatRadio.checked = true;
        
        const captchaInput = document.getElementById('txtCaptcha');
        if (captchaInput) captchaInput.value = solution;
        
        window.__formFilled = true;
        
      } catch (err) {
        window.__scraperError = 'Script error: ' + err.message;
      }
    })();
  `;
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: baseUrl,
      formats: ['html'],
      waitFor: 5000,
      timeout: 90000,
      actions: [
        { type: 'wait', milliseconds: 4000 }, // Wait for page to fully load
        { type: 'executeJavascript', script: solveAndSubmitScript },
        { type: 'wait', milliseconds: 8000 }, // Wait for API call and form fill to complete
        { type: 'click', selector: '#btnViewCauseList' },
        { type: 'wait', milliseconds: 10000 }, // Wait for results to load
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Firecrawl error:', response.status, errorText);
    throw new Error(`Firecrawl error: ${response.status}`);
  }

  const data = await response.json();
  const html = data.data?.html || '';
  
  console.log(`Firecrawl returned HTML (${html.length} chars)`);
  
  // Try to extract debug info from the page
  let captchaSolution: string | undefined;
  let debugInfo: string | undefined;
  
  const solutionMatch = html.match(/window\.__captchaSolution\s*=\s*['"]([^'"]+)['"]/);
  if (solutionMatch) captchaSolution = solutionMatch[1];
  
  const errorMatch = html.match(/window\.__scraperError\s*=\s*['"]([^'"]+)['"]/);
  if (errorMatch) debugInfo = errorMatch[1];
  
  return { html, captchaSolution, debugInfo };
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
  debugInfo?: string;
}> {
  const baseUrl = CIS_URLS[request.bench];
  const maxAttempts = 3;
  
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_API_KEY) {
    return { success: false, entries: [], error: 'FIRECRAWL_API_KEY not configured', attempts: 0 };
  }
  
  // Get our solver endpoint URL
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const solverEndpoint = `${supabaseUrl}/functions/v1/solve-captcha`;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n=== Attempt ${attempt}/${maxAttempts} for ${request.bench} ===`);
    
    try {
      const { html, captchaSolution, debugInfo } = await scrapeWithSingleSession(
        baseUrl,
        request.date,
        request.list_type,
        FIRECRAWL_API_KEY,
        solverEndpoint
      );
      
      console.log(`CAPTCHA solution: ${captchaSolution || 'unknown'}`);
      console.log(`Debug info: ${debugInfo || 'none'}`);
      
      if (debugInfo) {
        console.log(`Script error: ${debugInfo}`);
        if (attempt === maxAttempts) {
          return {
            success: false,
            entries: [],
            error: debugInfo,
            attempts: attempt,
            captchaExtracted: false,
            debugInfo,
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
          captchaExtracted: true,
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
        captcha_extracted: result.captchaExtracted,
        captcha_solution: result.captchaSolution,
        debug_info: result.debugInfo,
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
