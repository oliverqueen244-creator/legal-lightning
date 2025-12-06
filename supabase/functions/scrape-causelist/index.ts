import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  bench: 'JAIPUR' | 'JODHPUR';
  date?: string; // Format: YYYY-MM-DD
}

interface CourtInfo {
  court_no: string;
  sitting_judges: string;
  daily_link: string | null;
  supplementary_link: string | null;
}

interface CaseItem {
  item_no: number;
  case_number: string;
  petitioner: string | null;
  respondent: string | null;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const browserlessKey = Deno.env.get('BROWSERLESS_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { bench, date } = await req.json() as ScrapeRequest;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`[SCRAPER] Starting scrape for ${bench} bench, date: ${targetDate}`);
    
    // Determine target URL based on bench
    const baseUrl = bench === 'JODHPUR' 
      ? 'https://hcraj.nic.in/quick-causelist-jdp/'
      : 'https://hcraj.nic.in/quick-causelist-jp/';
    
    console.log(`[SCRAPER] Target URL: ${baseUrl}`);
    
    if (!browserlessKey) {
      console.error('[SCRAPER] No BROWSERLESS_API_KEY configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'BROWSERLESS_API_KEY not configured'
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // Parse date for form submission
    const [year, month, day] = targetDate.split('-');
    
    // Use BrowserQL to interact with the form
    const bqlQuery = `
      mutation ScrapeQuickCauselist {
        goto(url: "${baseUrl}", waitUntil: networkIdle) {
          status
          time
        }
        
        selectDay: select(selector: "#day", value: "${parseInt(day)}") {
          value
        }
        
        selectMonth: select(selector: "#month", value: "${parseInt(month)}") {
          value
        }
        
        selectYear: select(selector: "#year", value: "${year}") {
          value
        }
        
        waitAfterSelect: wait(time: 500) {
          time
        }
        
        submitForm: click(selector: "button[type='submit']") {
          time
        }
        
        waitForResults: waitForSelector(selector: "table", timeout: 10000) {
          time
        }
        
        getHtml: html {
          html
        }
      }
    `;
    
    console.log('[SCRAPER] Executing BrowserQL query...');
    console.log('[SCRAPER] Date params:', { day: parseInt(day), month: parseInt(month), year });
    
    const bqlEndpoint = `https://chrome.browserless.io/chromium/bql?token=${browserlessKey}`;
    
    const bqlResponse = await fetch(bqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: bqlQuery })
    });
    
    if (!bqlResponse.ok) {
      const errorText = await bqlResponse.text();
      console.error('[SCRAPER] BrowserQL error:', errorText);
      throw new Error(`BrowserQL request failed: ${bqlResponse.status}`);
    }
    
    const bqlResult = await bqlResponse.json();
    console.log('[SCRAPER] BrowserQL response:', JSON.stringify(bqlResult).substring(0, 1000));
    
    // Check for errors
    if (bqlResult.errors) {
      console.error('[SCRAPER] BrowserQL errors:', JSON.stringify(bqlResult.errors));
    }
    
    const htmlContent = bqlResult?.data?.getHtml?.html || '';
    console.log(`[SCRAPER] HTML content length: ${htmlContent.length}`);
    
    if (htmlContent.length < 1000 && htmlContent.length > 0) {
      console.log('[SCRAPER] HTML preview:', htmlContent.substring(0, 500));
    }
    
    // Parse the court table from HTML
    const courts = parseCourtTable(htmlContent, baseUrl);
    console.log(`[SCRAPER] Found ${courts.length} courts`);
    
    if (courts.length === 0) {
      // Check if there's a "no data" message
      if (htmlContent.includes('No Causelist') || htmlContent.includes('No data') || htmlContent.length < 2000) {
        await logScraperRun(supabase, bench, 'warning', 0, 'No causelist available for this date', 'DAILY', null);
        
        return new Response(JSON.stringify({
          success: true,
          message: 'No causelist available for this date',
          courts_found: 0,
          cases_found: 0
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Log for debugging
      console.log('[SCRAPER] HTML sample:', htmlContent.substring(0, 2000));
    }
    
    // Step 3: Upsert court metadata
    for (const court of courts) {
      const { error: upsertError } = await supabase
        .from('court_metadata')
        .upsert({
          bench,
          court_no: court.court_no,
          sitting_judges: court.sitting_judges,
          last_updated: new Date().toISOString()
        }, { 
          onConflict: 'bench,court_no',
          ignoreDuplicates: false 
        });
      
      if (upsertError) {
        console.error(`[SCRAPER] Error upserting court ${court.court_no}:`, upsertError);
      }
    }
    
    console.log(`[SCRAPER] Updated court_metadata for ${courts.length} courts`);
    
    // Step 4: Deep scrape each cause list link
    let totalCases = 0;
    const errors: string[] = [];
    
    for (const court of courts) {
      // Scrape Daily list
      if (court.daily_link) {
        try {
          const dailyCases = await scrapeCauseListPdf(court.daily_link, browserlessKey);
          
          for (const caseItem of dailyCases) {
            await insertDocketItem(supabase, {
              ...caseItem,
              date: targetDate,
              court_location: bench,
              court_room_no: court.court_no,
              list_type: 'DAILY',
              judge_names: court.sitting_judges,
              source_url: court.daily_link
            });
          }
          
          totalCases += dailyCases.length;
          console.log(`[SCRAPER] Court ${court.court_no} Daily: ${dailyCases.length} cases`);
        } catch (err: unknown) {
          const errMessage = err instanceof Error ? err.message : 'Unknown error';
          const errMsg = `Court ${court.court_no} Daily: ${errMessage}`;
          console.error(`[SCRAPER] ${errMsg}`);
          errors.push(errMsg);
        }
      }
      
      // Scrape Supplementary list
      if (court.supplementary_link) {
        try {
          const suppCases = await scrapeCauseListPdf(court.supplementary_link, browserlessKey);
          
          for (const caseItem of suppCases) {
            await insertDocketItem(supabase, {
              ...caseItem,
              date: targetDate,
              court_location: bench,
              court_room_no: court.court_no,
              list_type: 'SUPPLEMENTARY',
              judge_names: court.sitting_judges,
              source_url: court.supplementary_link
            });
          }
          
          totalCases += suppCases.length;
          console.log(`[SCRAPER] Court ${court.court_no} Supplementary: ${suppCases.length} cases`);
        } catch (err: unknown) {
          const errMessage = err instanceof Error ? err.message : 'Unknown error';
          const errMsg = `Court ${court.court_no} Supp: ${errMessage}`;
          console.error(`[SCRAPER] ${errMsg}`);
          errors.push(errMsg);
        }
      }
    }
    
    // Step 5: Log the scraper run
    const status = errors.length > 0 ? (totalCases > 0 ? 'partial' : 'failed') : 'success';
    await logScraperRun(
      supabase, 
      bench, 
      status, 
      totalCases, 
      errors.length > 0 ? errors.join('; ') : null,
      'DAILY',
      null
    );
    
    const duration = Date.now() - startTime;
    console.log(`[SCRAPER] Completed in ${duration}ms. Status: ${status}, Cases: ${totalCases}`);
    
    return new Response(JSON.stringify({
      success: true,
      bench,
      date: targetDate,
      courts_found: courts.length,
      cases_found: totalCases,
      status,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SCRAPER] Fatal error:', errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

// Parse the court table from the Quick Download result page
function parseCourtTable(html: string, baseUrl: string): CourtInfo[] {
  const courts: CourtInfo[] = [];
  
  // Look for table with court data
  // Expected structure: Court No | Judge Name | D (daily) | S (supplementary)
  
  // Find all table rows
  const tableRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = html.match(tableRowRegex) || [];
  
  console.log(`[SCRAPER] Found ${rows.length} table rows`);
  
  for (const row of rows) {
    // Skip header rows
    if (row.includes('<th') || row.toLowerCase().includes('court no')) continue;
    
    // Extract cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let match;
    
    while ((match = cellRegex.exec(row)) !== null) {
      cells.push(match[1].trim());
    }
    
    if (cells.length >= 2) {
      // Extract court number
      const courtNoMatch = cells[0].match(/(\d+)/);
      const court_no = courtNoMatch ? courtNoMatch[1] : '';
      
      // Extract judge names (clean HTML tags)
      const sitting_judges = cells[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!court_no || !sitting_judges) continue;
      
      // Extract PDF links
      let daily_link: string | null = null;
      let supplementary_link: string | null = null;
      
      // Look for links in the row
      const linkRegex = /href=["']([^"']+\.pdf[^"']*)["']/gi;
      let linkMatch;
      const links: string[] = [];
      
      while ((linkMatch = linkRegex.exec(row)) !== null) {
        links.push(resolveUrl(linkMatch[1], baseUrl));
      }
      
      // Also check for D and S buttons/links
      if (row.match(/>\s*D\s*</i) || row.toLowerCase().includes('daily')) {
        const dLinkMatch = row.match(/href=["']([^"']*)['""][^>]*>[\s]*D[\s]*</i);
        if (dLinkMatch) {
          daily_link = resolveUrl(dLinkMatch[1], baseUrl);
        } else if (links.length > 0) {
          daily_link = links[0];
        }
      }
      
      if (row.match(/>\s*S\s*</i) || row.toLowerCase().includes('supp')) {
        const sLinkMatch = row.match(/href=["']([^"']*)['""][^>]*>[\s]*S[\s]*</i);
        if (sLinkMatch) {
          supplementary_link = resolveUrl(sLinkMatch[1], baseUrl);
        } else if (links.length > 1) {
          supplementary_link = links[1];
        }
      }
      
      // If we found links but couldn't categorize, assign first to daily
      if (!daily_link && !supplementary_link && links.length > 0) {
        daily_link = links[0];
        if (links.length > 1) {
          supplementary_link = links[1];
        }
      }
      
      courts.push({
        court_no,
        sitting_judges,
        daily_link,
        supplementary_link
      });
      
      console.log(`[SCRAPER] Court ${court_no}: ${sitting_judges.substring(0, 50)}... D:${!!daily_link} S:${!!supplementary_link}`);
    }
  }
  
  return courts;
}

// Resolve relative URLs
function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) {
    const base = new URL(baseUrl);
    return `${base.origin}${url}`;
  }
  return `${baseUrl.replace(/\/$/, '')}/${url}`;
}

// Scrape a cause list PDF using Browserless
async function scrapeCauseListPdf(
  url: string, 
  browserlessKey: string
): Promise<CaseItem[]> {
  console.log(`[SCRAPER] Fetching cause list: ${url}`);
  
  // For PDFs, we'll use a simple fetch and try to extract text
  // If it's an HTML page, parse directly
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/html')) {
      const html = await response.text();
      return parseCauseListHtml(html);
    } else if (contentType.includes('pdf')) {
      // For PDFs, we'll need to use Browserless to render or convert
      // For now, return empty and log
      console.log(`[SCRAPER] PDF detected, skipping for now: ${url}`);
      return [];
    } else {
      console.log(`[SCRAPER] Unknown content type: ${contentType}`);
      return [];
    }
  } catch (error) {
    console.error(`[SCRAPER] Error fetching ${url}:`, error);
    return [];
  }
}

// Parse cause list HTML to extract cases
function parseCauseListHtml(html: string): CaseItem[] {
  const cases: CaseItem[] = [];
  
  // Find table rows with case data
  const tableRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = html.match(tableRowRegex) || [];
  
  for (const row of rows) {
    // Skip header rows
    if (row.includes('<th')) continue;
    
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let match;
    
    while ((match = cellRegex.exec(row)) !== null) {
      cells.push(
        match[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      );
    }
    
    if (cells.length >= 3) {
      // Try to extract item number from first cell
      const itemNoMatch = cells[0].match(/(\d+)/);
      const item_no = itemNoMatch ? parseInt(itemNoMatch[1], 10) : 0;
      
      if (item_no === 0) continue;
      
      const case_number = cells[1] || '';
      
      // Parse parties (usually "Petitioner Vs. Respondent")
      const partiesText = cells[2] || '';
      const partiesSplit = partiesText.split(/\s+vs\.?\s+/i);
      const petitioner = partiesSplit[0]?.trim() || null;
      const respondent = partiesSplit[1]?.trim() || null;
      
      // Parse lawyers (might be in separate cells)
      let petitioner_lawyer: string | null = null;
      let respondent_lawyer: string | null = null;
      
      if (cells.length >= 4) {
        const lawyerText = cells[3] || '';
        const lawyerSplit = lawyerText.split(/\s+vs\.?\s+/i);
        petitioner_lawyer = lawyerSplit[0]?.trim() || null;
        respondent_lawyer = lawyerSplit[1]?.trim() || null;
      }
      
      cases.push({
        item_no,
        case_number,
        petitioner,
        respondent,
        petitioner_lawyer,
        respondent_lawyer
      });
    }
  }
  
  return cases;
}

// Insert docket item
async function insertDocketItem(supabase: any, item: any) {
  const { error } = await supabase
    .from('daily_court_docket')
    .upsert({
      date: item.date,
      court_location: item.court_location,
      court_room_no: item.court_room_no,
      item_no: item.item_no,
      case_number: item.case_number,
      petitioner: item.petitioner,
      respondent: item.respondent,
      petitioner_lawyer: item.petitioner_lawyer,
      respondent_lawyer: item.respondent_lawyer,
      list_type: item.list_type,
      judge_names: item.judge_names,
      source_url: item.source_url,
      status: 'pending'
    }, {
      onConflict: 'date,court_location,court_room_no,item_no,list_type',
      ignoreDuplicates: false
    });
  
  if (error && !error.message?.includes('duplicate')) {
    console.error('[SCRAPER] Insert error:', error);
  }
}

// Log scraper run
async function logScraperRun(
  supabase: any, 
  bench: string, 
  status: string, 
  casesFound: number, 
  errorMessage: string | null,
  listType: string,
  courtNo: string | null
) {
  await supabase.from('scraper_logs').insert({
    bench,
    status,
    cases_found: casesFound,
    error_message: errorMessage,
    list_type: listType,
    court_no: courtNo,
    run_at: new Date().toISOString()
  });
}