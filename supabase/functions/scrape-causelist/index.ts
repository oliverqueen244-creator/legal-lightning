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

// Use BrowserQL for full automation including CAPTCHA solving
async function scrapeWithBrowserQL(
  cisUrl: string,
  browserlessKey: string,
  formattedDate: string,
  listType: string,
  lawyerName?: string
): Promise<{ html: string; success: boolean; captchaSolved?: boolean; error?: string }> {
  console.log(`[scrape-causelist] Starting BrowserQL scrape...`);
  console.log(`[scrape-causelist] URL: ${cisUrl}`);
  console.log(`[scrape-causelist] Date: ${formattedDate}, Type: ${listType}, Lawyer: ${lawyerName || 'none'}`);
  
  // Build BrowserQL mutation
  const lawyerTypeStep = lawyerName ? `
    fillLawyer: type(
      selector: "#lawyername"
      text: "${lawyerName}"
    ) {
      time
    }
  ` : '';
  
  const bqlQuery = `
    mutation ScrapeCauseList {
      goto(url: "${cisUrl}", waitUntil: networkIdle) {
        status
        time
      }
      
      fillDate: type(
        selector: "#causelstdt"
        text: "${formattedDate}"
      ) {
        time
      }
      
      selectListType: evaluate(
        content: "document.querySelector('#causelisttype').value = '${listType}'; document.querySelector('#causelisttype').dispatchEvent(new Event('change', {bubbles: true}));"
      ) {
        time
      }
      
      ${lawyerTypeStep}
      
      selectHtmlFormat: click(
        selector: "#formatradio1"
      ) {
        time
      }
      
      solveCaptcha: solveImageCaptcha(
        captchaSelector: "#captcha"
        inputSelector: "#txtCaptcha"
        timeout: 30000
      ) {
        found
        solved
        time
        token
      }
      
      waitBeforeSubmit: waitForTimeout(time: 500) {
        time
      }
      
      submitForm: click(
        selector: "#btnSearchCauseList"
      ) {
        time
      }
      
      waitForResults: waitForTimeout(time: 8000) {
        time
      }
      
      getHtml: html {
        html
      }
    }
  `;
  
  console.log(`[scrape-causelist] Executing BrowserQL query...`);
  
  try {
    // Use the correct BrowserQL endpoint
    const endpoint = `https://chrome.browserless.io/chromium/bql?token=${browserlessKey}`;
    console.log(`[scrape-causelist] Endpoint: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: bqlQuery,
      }),
    });
    
    const responseText = await response.text();
    console.log(`[scrape-causelist] Response status: ${response.status}`);
    console.log(`[scrape-causelist] Response preview: ${responseText.substring(0, 500)}`);
    
    if (!response.ok) {
      console.error(`[scrape-causelist] BrowserQL request failed: ${response.status}`);
      return { html: '', success: false, error: `BrowserQL failed: ${response.status} - ${responseText.substring(0, 200)}` };
    }
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error(`[scrape-causelist] Failed to parse response as JSON`);
      return { html: '', success: false, error: `Invalid JSON response: ${responseText.substring(0, 100)}` };
    }
    
    // Check for GraphQL errors
    if (result.errors && result.errors.length > 0) {
      const errorMsg = result.errors.map((e: any) => e.message).join(', ');
      console.error(`[scrape-causelist] BrowserQL errors: ${errorMsg}`);
      return { html: '', success: false, error: `BrowserQL errors: ${errorMsg}` };
    }
    
    console.log(`[scrape-causelist] Response structure:`, JSON.stringify(Object.keys(result)));
    console.log(`[scrape-causelist] Data keys:`, result.data ? Object.keys(result.data) : 'no data');
    
    // Get CAPTCHA result
    const captchaResult = result.data?.solveCaptcha;
    const captchaSolved = captchaResult?.solved === true;
    console.log(`[scrape-causelist] CAPTCHA found: ${captchaResult?.found}, solved: ${captchaSolved}`);
    
    // Get HTML from response
    const html = result.data?.getHtml?.html || '';
    console.log(`[scrape-causelist] Got HTML: ${html.length} chars`);
    
    // Check for errors in HTML
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes('invalid captcha') || lowerHtml.includes('wrong captcha')) {
      return { html, success: false, captchaSolved, error: 'Invalid CAPTCHA - BrowserQL solution was rejected' };
    }
    
    if (lowerHtml.includes('no record found') || lowerHtml.includes('no data')) {
      return { html, success: true, captchaSolved, error: 'No records found for this date' };
    }
    
    return { html, success: true, captchaSolved };
    
  } catch (error) {
    console.error(`[scrape-causelist] BrowserQL error:`, error);
    return { html: '', success: false, error: `BrowserQL error: ${error}` };
  }
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
    console.log(`[scrape-causelist] Using BrowserQL with solveImageCaptcha`);
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
    let lastResult: { html: string; success: boolean; captchaSolved?: boolean; error?: string } = {
      html: '', success: false, error: 'No attempts made'
    };
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[scrape-causelist] === Attempt ${attempt}/${maxAttempts} ===`);
      
      lastResult = await scrapeWithBrowserQL(
        cisUrl,
        browserlessKey,
        formattedDate,
        list_type,
        lawyer_name
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
        captcha_solved: lastResult.captchaSolved,
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
