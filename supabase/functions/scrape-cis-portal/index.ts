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

// Use Firecrawl to load page and capture screenshot of CAPTCHA
async function loadPageAndCaptureCaptcha(
  baseUrl: string,
  firecrawlApiKey: string
): Promise<{ captchaBase64: string; screenshot: string } | null> {
  console.log(`Loading CIS page with Firecrawl: ${baseUrl}`);
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: baseUrl,
        formats: ['screenshot', 'html'],
        waitFor: 5000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firecrawl error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const screenshot = data.data?.screenshot || '';
    const html = data.data?.html || '';
    
    console.log(`Got screenshot (${screenshot?.length || 0} chars) and HTML (${html?.length || 0} chars)`);
    
    return { captchaBase64: screenshot, screenshot };
  } catch (err) {
    console.error('Firecrawl page load error:', err);
    return null;
  }
}

// Solve CAPTCHA using Gemini Vision from full page screenshot
async function solveCaptchaFromScreenshot(screenshotBase64: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }
  
  console.log('Sending page screenshot to Gemini for CAPTCHA solving...');
  
  // Clean up base64 if needed
  let imageData = screenshotBase64;
  if (!imageData.startsWith('data:')) {
    imageData = `data:image/png;base64,${imageData}`;
  }
  
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
            text: `This is a screenshot of a court cause list form page. There is a CAPTCHA image near the bottom of the form, usually next to "Enter Verification Code" label. The CAPTCHA shows text characters that need to be entered to submit the form.

Look at the CAPTCHA image in this screenshot and read the characters shown. The CAPTCHA typically contains 5-6 alphanumeric characters.

Return ONLY the exact characters you see in the CAPTCHA, nothing else. No explanation, no quotes, just the characters.`
          },
          {
            type: 'image_url',
            image_url: {
              url: imageData
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
  
  // Clean up the solution - remove any quotes or extra text
  const cleanSolution = solution.replace(/['"]/g, '').trim();
  
  console.log(`Gemini solved CAPTCHA: "${cleanSolution}"`);
  
  return cleanSolution;
}

// Use Firecrawl actions to fill form and submit
async function submitFormWithFirecrawl(
  baseUrl: string,
  date: string,
  listType: string,
  captchaSolution: string,
  firecrawlApiKey: string
): Promise<string> {
  console.log(`Submitting form via Firecrawl with date=${date}, listType=${listType}, captcha=${captchaSolution}`);
  
  // Parse date (DD/MM/YYYY) to components
  const [day, month, year] = date.split('/');
  
  // Build JavaScript to fill and submit the form
  const fillFormScript = `
    // Set date
    const dateInput = document.getElementById('causelstdt');
    if (dateInput) {
      dateInput.value = '${date}';
    }
    
    // Set list type
    const listTypeSelect = document.getElementById('causelisttype');
    if (listTypeSelect) {
      listTypeSelect.value = '${listType}';
    }
    
    // Set format to HTML
    const formatRadio = document.getElementById('formatradio1');
    if (formatRadio) {
      formatRadio.checked = true;
    }
    
    // Set CAPTCHA
    const captchaInput = document.getElementById('txtCaptcha');
    if (captchaInput) {
      captchaInput.value = '${captchaSolution}';
    }
    
    // Trigger any change events
    if (listTypeSelect) {
      listTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  `;
  
  try {
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
        actions: [
          { type: 'wait', milliseconds: 2000 },
          { type: 'executeJavascript', script: fillFormScript },
          { type: 'wait', milliseconds: 1000 },
          { type: 'click', selector: '#btnViewCauseList' },
          { type: 'wait', milliseconds: 5000 },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firecrawl submit error:', response.status, errorText);
      throw new Error(`Form submission failed: ${response.status}`);
    }

    const data = await response.json();
    const html = data.data?.html || '';
    const markdown = data.data?.markdown || '';
    
    console.log(`Form submitted, got HTML (${html.length} chars), markdown (${markdown.length} chars)`);
    
    return html || markdown;
  } catch (err) {
    console.error('Form submission error:', err);
    throw err;
  }
}

// Parse cause list HTML to extract entries
function parseCauseListHtml(html: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  console.log('Parsing response...');
  
  // Check for error messages
  if (html.includes('Invalid Captcha') || html.includes('invalid captcha') || html.includes('Wrong Captcha')) {
    console.log('CAPTCHA validation failed');
    throw new Error('CAPTCHA_INVALID');
  }
  
  if (html.includes('No Record Found') || html.includes('no record found') || html.includes('No Data')) {
    console.log('No records found for this date/type');
    return [];
  }
  
  // Try to find court-wise data in the response
  // Pattern: Look for structured data with case numbers
  
  // Look for table rows with case data
  const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  
  let currentCourtNo = '1';
  const courtPattern = /Court\s*(?:No\.?|Room)?\s*:?\s*(\d+)/gi;
  
  // First, try to identify court sections
  let courtMatch;
  while ((courtMatch = courtPattern.exec(html)) !== null) {
    console.log(`Found court reference: ${courtMatch[0]}`);
  }
  
  // Parse table rows
  const rows = html.match(tableRowPattern) || [];
  console.log(`Found ${rows.length} table rows`);
  
  for (const row of rows) {
    const cells: string[] = [];
    let cellMatch;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    
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
  
  // Also try to parse from markdown-like format
  if (entries.length === 0) {
    // Look for numbered patterns like "1. CaseNumber - Parties"
    const numberedPattern = /^\s*(\d+)[\.\)]\s+([^\n]+)/gm;
    let match;
    while ((match = numberedPattern.exec(html)) !== null) {
      const itemNo = parseInt(match[1]);
      const content = match[2];
      
      // Try to extract case number
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
}> {
  const baseUrl = CIS_URLS[request.bench];
  const maxAttempts = 3;
  
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_API_KEY) {
    return {
      success: false,
      entries: [],
      error: 'FIRECRAWL_API_KEY is not configured',
      attempts: 0
    };
  }
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n=== Attempt ${attempt}/${maxAttempts} for ${request.bench} ${request.list_type === 'D' ? 'Daily' : 'Supplementary'} ===`);
    
    try {
      // Step 1: Load page and capture CAPTCHA via screenshot
      const pageData = await loadPageAndCaptureCaptcha(baseUrl, FIRECRAWL_API_KEY);
      
      if (!pageData || !pageData.screenshot) {
        console.log('Failed to load page or capture screenshot');
        continue;
      }
      
      // Step 2: Solve CAPTCHA with Gemini
      const captchaSolution = await solveCaptchaFromScreenshot(pageData.screenshot);
      
      if (!captchaSolution || captchaSolution.length < 3) {
        console.log(`Invalid CAPTCHA solution: "${captchaSolution}"`);
        continue;
      }
      
      // Step 3: Submit form
      const resultHtml = await submitFormWithFirecrawl(
        baseUrl,
        request.date,
        request.list_type,
        captchaSolution,
        FIRECRAWL_API_KEY
      );
      
      // Step 4: Parse results
      try {
        const entries = parseCauseListHtml(resultHtml);
        
        return {
          success: true,
          entries,
          attempts: attempt,
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
