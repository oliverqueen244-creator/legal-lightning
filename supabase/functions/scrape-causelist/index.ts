import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import FirecrawlApp from "https://esm.sh/@mendable/firecrawl-js@1.8.0";

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { bench, date } = await req.json() as ScrapeRequest;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`[SCRAPER] Starting scrape for ${bench} bench, date: ${targetDate}`);
    
    // Determine target URL based on bench
    const baseUrl = bench === 'JODHPUR' 
      ? 'https://hcraj.nic.in/quick-causelist-jdp/'
      : 'https://hcraj.nic.in/quick-causelist-jp/';
    
    console.log(`[SCRAPER] Target URL: ${baseUrl}`);
    
    // Step 1: Scrape the master table to get court info and links
    let masterContent: string;
    
    if (firecrawlKey) {
      console.log('[SCRAPER] Using Firecrawl for scraping');
      const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey });
      const scrapeResult = await firecrawl.scrapeUrl(baseUrl, { 
        formats: ['html', 'markdown'] 
      });
      
      if (!scrapeResult.success) {
        throw new Error('Firecrawl scrape failed');
      }
      masterContent = scrapeResult.html || scrapeResult.markdown || '';
    } else {
      console.log('[SCRAPER] Using native fetch (no Firecrawl key)');
      const response = await fetch(baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      masterContent = await response.text();
    }
    
    console.log(`[SCRAPER] Fetched master page, content length: ${masterContent.length}`);
    
    // Step 2: Parse the master table to extract court metadata
    const courts = parseCourtTable(masterContent, baseUrl);
    console.log(`[SCRAPER] Found ${courts.length} courts`);
    
    if (courts.length === 0) {
      // Log warning but don't fail - might be a holiday or off hours
      await logScraperRun(supabase, bench, 'warning', 0, 'No courts found in master table', 'DAILY', null);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'No courts found - portal may be empty or unavailable',
        courts_found: 0,
        cases_found: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
          const dailyCases = await scrapeCauseListPage(
            court.daily_link, 
            firecrawlKey,
            court.sitting_judges
          );
          
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
          const suppCases = await scrapeCauseListPage(
            court.supplementary_link, 
            firecrawlKey,
            court.sitting_judges
          );
          
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

// Parse the master table to extract court info
function parseCourtTable(html: string, baseUrl: string): CourtInfo[] {
  const courts: CourtInfo[] = [];
  
  // Match table rows containing court info
  // Pattern: Court No | Judge Names | D button | S button
  const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(tableRowRegex) || [];
  
  for (const row of rows) {
    // Skip header rows
    if (row.includes('<th') || row.includes('Court No')) continue;
    
    // Extract cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let match;
    
    while ((match = cellRegex.exec(row)) !== null) {
      cells.push(match[1].trim());
    }
    
    if (cells.length >= 2) {
      // Extract court number (usually first cell, might contain link)
      const courtNoMatch = cells[0].match(/(\d+)/);
      const court_no = courtNoMatch ? courtNoMatch[1] : '';
      
      // Extract judge names (usually second cell, clean HTML)
      const sitting_judges = cells[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!court_no) continue;
      
      // Extract Daily link (D button)
      const dailyLinkMatch = row.match(/href=["']([^"']*)['""][^>]*>[\s]*D[\s]*</i);
      const daily_link = dailyLinkMatch 
        ? resolveUrl(dailyLinkMatch[1], baseUrl) 
        : null;
      
      // Extract Supplementary link (S button)
      const suppLinkMatch = row.match(/href=["']([^"']*)['""][^>]*>[\s]*S[\s]*</i);
      const supplementary_link = suppLinkMatch 
        ? resolveUrl(suppLinkMatch[1], baseUrl) 
        : null;
      
      courts.push({
        court_no,
        sitting_judges,
        daily_link,
        supplementary_link
      });
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

// Scrape a cause list page (PDF or HTML)
async function scrapeCauseListPage(
  url: string, 
  firecrawlKey: string | undefined,
  judgeNames: string
): Promise<CaseItem[]> {
  let content: string;
  
  // Check if it's a PDF
  if (url.toLowerCase().includes('.pdf')) {
    console.log(`[SCRAPER] PDF detected, using Firecrawl for: ${url}`);
    if (!firecrawlKey) {
      throw new Error('PDF scraping requires Firecrawl API key');
    }
    
    const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey });
    const result = await firecrawl.scrapeUrl(url, { formats: ['markdown'] });
    
    if (!result.success) {
      throw new Error('Failed to scrape PDF');
    }
    content = result.markdown || '';
  } else {
    // HTML page
    if (firecrawlKey) {
      const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey });
      const result = await firecrawl.scrapeUrl(url, { formats: ['html', 'markdown'] });
      if (!result.success) {
        throw new Error('Failed to scrape HTML page');
      }
      content = (result as any).html || (result as any).markdown || '';
    } else {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      content = await response.text();
    }
  }
  
  return parseCauseList(content);
}

// Parse cause list content to extract cases
function parseCauseList(content: string): CaseItem[] {
  const cases: CaseItem[] = [];
  
  // Try to find table rows with case data
  // Common patterns: Item No | Case No | Petitioner vs Respondent | Advocates
  
  const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = content.match(tableRowRegex) || [];
  
  for (const row of rows) {
    // Skip header rows
    if (row.includes('<th') || row.toLowerCase().includes('item') && row.toLowerCase().includes('case')) continue;
    
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
      const itemNoMatch = cells[0].match(/(\d+)/);
      const item_no = itemNoMatch ? parseInt(itemNoMatch[1], 10) : 0;
      
      if (item_no === 0) continue;
      
      const case_number = cells[1] || '';
      
      // Parse parties (usually "Petitioner Vs. Respondent")
      const partiesText = cells[2] || '';
      const partiesSplit = partiesText.split(/\s+vs\.?\s+/i);
      const petitioner = partiesSplit[0]?.trim() || null;
      const respondent = partiesSplit[1]?.trim() || null;
      
      // Parse lawyers (might be in separate cells or combined)
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
  
  // If no table found, try markdown/text parsing
  if (cases.length === 0) {
    const lines = content.split('\n');
    let currentItem = 0;
    
    for (const line of lines) {
      // Look for patterns like "1. D.B. Civil Writ Petition No. 1234/2024"
      const itemMatch = line.match(/^(\d+)[\.\)]\s*(.+)/);
      if (itemMatch) {
        currentItem = parseInt(itemMatch[1], 10);
        const case_number = itemMatch[2].trim();
        
        cases.push({
          item_no: currentItem,
          case_number,
          petitioner: null,
          respondent: null,
          petitioner_lawyer: null,
          respondent_lawyer: null
        });
      }
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
  
  if (error && !error.message.includes('duplicate')) {
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