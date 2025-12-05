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

// Step 1: Get initial page - extract CAPTCHA and ASP.NET ViewState
async function getInitialPage(
  cisUrl: string,
  browserlessKey: string
): Promise<{ html: string; captchaImage: string | null; viewState: string | null; eventValidation: string | null; error?: string }> {
  console.log(`[scrape-causelist] Getting initial page...`);
  
  // Script to extract CAPTCHA and ASP.NET hidden fields
  const extractScript = `
    (function() {
      var captchaEl = document.querySelector('#captcha');
      var viewStateEl = document.querySelector('#__VIEWSTATE');
      var eventValidationEl = document.querySelector('#__EVENTVALIDATION');
      
      var marker = document.createElement('div');
      marker.id = '__extracted_data__';
      marker.setAttribute('data-captcha', captchaEl ? captchaEl.src : '');
      marker.setAttribute('data-viewstate', viewStateEl ? viewStateEl.value : '');
      marker.setAttribute('data-eventvalidation', eventValidationEl ? eventValidationEl.value : '');
      document.body.appendChild(marker);
    })();
  `;
  
  const response = await fetch(`https://chrome.browserless.io/content?token=${browserlessKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: cisUrl,
      gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
      waitForSelector: { selector: '#captcha', timeout: 20000 },
      addScriptTag: [{ content: extractScript }],
      waitForTimeout: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[scrape-causelist] Initial page failed: ${response.status} - ${error}`);
    return { html: '', captchaImage: null, viewState: null, eventValidation: null, error: `Initial page failed: ${response.status}` };
  }

  const html = await response.text();
  console.log(`[scrape-causelist] Got page: ${html.length} chars`);
  
  // Extract data from marker
  const markerMatch = html.match(/id="__extracted_data__"[^>]*data-captcha="([^"]*)"[^>]*data-viewstate="([^"]*)"[^>]*data-eventvalidation="([^"]*)"/);
  let captchaImage: string | null = null;
  let viewState: string | null = null;
  let eventValidation: string | null = null;
  
  if (markerMatch) {
    captchaImage = markerMatch[1] || null;
    viewState = markerMatch[2] || null;
    eventValidation = markerMatch[3] || null;
  }
  
  // Fallback: extract CAPTCHA from HTML directly
  if (!captchaImage) {
    const captchaMatch = html.match(/<img[^>]*src=["'](data:image\/[^"']+)["'][^>]*id=["']captcha["']/i) ||
                         html.match(/<img[^>]*id=["']captcha["'][^>]*src=["'](data:image\/[^"']+)["']/i);
    if (captchaMatch) {
      captchaImage = captchaMatch[1];
    }
  }
  
  // Fallback: extract ViewState from HTML
  if (!viewState) {
    const vsMatch = html.match(/<input[^>]*id="__VIEWSTATE"[^>]*value="([^"]*)"/i) ||
                    html.match(/<input[^>]*name="__VIEWSTATE"[^>]*value="([^"]*)"/i);
    if (vsMatch) {
      viewState = vsMatch[1];
    }
  }
  
  // Fallback: extract EventValidation from HTML
  if (!eventValidation) {
    const evMatch = html.match(/<input[^>]*id="__EVENTVALIDATION"[^>]*value="([^"]*)"/i) ||
                    html.match(/<input[^>]*name="__EVENTVALIDATION"[^>]*value="([^"]*)"/i);
    if (evMatch) {
      eventValidation = evMatch[1];
    }
  }
  
  console.log(`[scrape-causelist] CAPTCHA: ${captchaImage ? 'found' : 'not found'}, ViewState: ${viewState ? viewState.length + ' chars' : 'not found'}, EventValidation: ${eventValidation ? eventValidation.length + ' chars' : 'not found'}`);
  
  return { html, captchaImage, viewState, eventValidation };
}

// Step 2: Submit form via direct POST with ViewState (ASP.NET stateless approach)
async function submitFormViaPost(
  cisUrl: string,
  viewState: string,
  eventValidation: string | null,
  formattedDate: string,
  listType: string,
  captchaSolution: string,
  lawyerName?: string
): Promise<{ html: string; success: boolean; error?: string }> {
  console.log(`[scrape-causelist] Submitting form via POST...`);
  
  // Build form data - this is what ASP.NET expects
  const formData = new URLSearchParams();
  formData.append('__VIEWSTATE', viewState);
  if (eventValidation) {
    formData.append('__EVENTVALIDATION', eventValidation);
  }
  formData.append('causelstdt', formattedDate);
  formData.append('causelisttype', listType);
  formData.append('txtCaptcha', captchaSolution);
  formData.append('formatradio', 'formatradio1'); // HTML format
  formData.append('btnSearchCauseList', 'Search');
  if (lawyerName) {
    formData.append('lawyername', lawyerName);
  }
  
  console.log(`[scrape-causelist] POST data: date=${formattedDate}, type=${listType}, captcha=${captchaSolution}`);
  
  try {
    const response = await fetch(cisUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Origin': new URL(cisUrl).origin,
        'Referer': cisUrl,
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.error(`[scrape-causelist] POST failed: ${response.status}`);
      return { html: '', success: false, error: `POST failed: ${response.status}` };
    }

    const html = await response.text();
    console.log(`[scrape-causelist] Got POST response: ${html.length} chars`);
    
    // Check for errors
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes('invalid captcha') || lowerHtml.includes('wrong captcha')) {
      return { html, success: false, error: 'Invalid CAPTCHA' };
    }
    
    return { html, success: true };
  } catch (error) {
    console.error(`[scrape-causelist] POST error:`, error);
    return { html: '', success: false, error: `POST error: ${error}` };
  }
}

// Main scrape function
async function scrapeWithViewState(
  cisUrl: string,
  browserlessKey: string,
  formattedDate: string,
  listType: string,
  lawyerName: string | undefined,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ html: string; success: boolean; captchaSolution?: string; error?: string }> {
  console.log(`[scrape-causelist] Starting ViewState-based scrape...`);
  
  // Step 1: Get initial page with CAPTCHA and ViewState
  const initial = await getInitialPage(cisUrl, browserlessKey);
  
  if (initial.error) {
    return { html: '', success: false, error: initial.error };
  }
  
  if (!initial.captchaImage) {
    console.error(`[scrape-causelist] CAPTCHA not found in initial page`);
    return { html: initial.html, success: false, error: 'CAPTCHA image not found' };
  }
  
  if (!initial.viewState) {
    console.error(`[scrape-causelist] ViewState not found - cannot submit form`);
    return { html: initial.html, success: false, error: 'ViewState not found' };
  }
  
  // Step 2: Solve CAPTCHA
  const captchaSolution = await solveCaptcha(initial.captchaImage, supabaseUrl, supabaseKey);
  if (!captchaSolution) {
    return { html: '', success: false, error: 'CAPTCHA solve failed' };
  }
  
  // Step 3: Submit form via POST with ViewState
  const result = await submitFormViaPost(
    cisUrl,
    initial.viewState,
    initial.eventValidation,
    formattedDate,
    listType,
    captchaSolution,
    lawyerName
  );
  
  return { ...result, captchaSolution };
}

// Parse cause list HTML to extract entries
function parseCauseListHtml(html: string, bench: string, date: string, listType: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  console.log('[scrape-causelist] Parsing HTML response...');
  
  if (html.includes('No Record Found') || html.includes('no record found') || html.includes('No Data')) {
    console.log('[scrape-causelist] No records found');
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
    
    const firstCell = cells[0].toLowerCase();
    if (firstCell.includes('sr') || firstCell.includes('item') || 
        firstCell.includes('case no') || firstCell.includes('s.no')) continue;
    
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
    
    const partyCell = cells[2] || '';
    const vsMatch = partyCell.match(/(.+?)\s*(?:vs?\.?|v\/s|versus)\s*(.+)/i);
    if (vsMatch) {
      petitioner = vsMatch[1].trim().substring(0, 200);
      respondent = vsMatch[2].trim().substring(0, 200);
    } else if (partyCell) {
      petitioner = partyCell.substring(0, 200);
    }
    
    const petitionerLawyer = cells.length > 3 ? (cells[3] || '').substring(0, 100) : '';
    const respondentLawyer = cells.length > 4 ? (cells[4] || '').substring(0, 100) : '';
    
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
async function logScraperRun(supabase: any, bench: string, status: string, casesFound: number, errorMessage: string | null, listType: string): Promise<void> {
  try {
    await supabase.from('scraper_logs').insert({
      bench, status, cases_found: casesFound, error_message: errorMessage, list_type: listType,
    });
  } catch (err) {
    console.error('[scrape-causelist] Log error:', err);
  }
}

// Main handler
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
    const formattedDate = formatDateForForm(targetDate);
    
    console.log(`[scrape-causelist] ========================================`);
    console.log(`[scrape-causelist] Action: ${action}, Bench: ${bench}`);
    console.log(`[scrape-causelist] Date: ${targetDate} (${formattedDate}), ListType: ${list_type}`);
    console.log(`[scrape-causelist] Lawyer: ${lawyer_name || 'none'}`);
    console.log(`[scrape-causelist] ========================================`);

    if (!browserlessKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Browserless API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const cisUrl = CIS_URLS[bench];
    if (!cisUrl) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid bench: ${bench}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Scrape with retries
    const maxAttempts = 2;
    let lastResult: { html: string; success: boolean; captchaSolution?: string; error?: string } = {
      html: '', success: false, error: 'No attempts made'
    };
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[scrape-causelist] === Attempt ${attempt}/${maxAttempts} ===`);
      
      lastResult = await scrapeWithViewState(
        cisUrl,
        browserlessKey,
        formattedDate,
        list_type,
        lawyer_name,
        supabaseUrl,
        supabaseKey
      );
      
      if (lastResult.success) break;
      if (!lastResult.error?.includes('CAPTCHA')) break; // Only retry on CAPTCHA errors
      
      console.log(`[scrape-causelist] Retrying due to: ${lastResult.error}`);
    }

    // Parse results
    const entries = lastResult.success ? parseCauseListHtml(
      lastResult.html,
      bench,
      targetDate,
      list_type === 'D' ? 'DAILY' : 'SUPPLEMENTARY'
    ) : [];

    // Store entries if scrape action
    let inserted = 0;
    if (action === 'scrape' && lastResult.success && entries.length > 0) {
      for (const entry of entries) {
        const { error } = await supabase.from('daily_court_docket')
          .upsert(entry, { onConflict: 'case_number,date,court_room_no', ignoreDuplicates: false });
        if (!error) inserted++;
      }
    }

    // Log
    await logScraperRun(supabase, bench, lastResult.success ? 'success' : 'failed', entries.length, lastResult.error || null, list_type === 'D' ? 'DAILY' : 'SUPPLEMENTARY');

    return new Response(
      JSON.stringify({
        success: lastResult.success,
        message: lastResult.success ? `Found ${entries.length} cases` : lastResult.error,
        entries,
        entries_count: entries.length,
        inserted,
        captcha_solution: lastResult.captchaSolution,
        raw_content_preview: lastResult.html.substring(0, 3000),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[scrape-causelist] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
