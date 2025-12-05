import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

interface CourtMetadata {
  court_no: string;
  judge_names: string;
  list_type: string;
  bench: string;
}

interface ScrapeRequest {
  action: 'scrape' | 'preview';
  bench?: 'JAIPUR' | 'JODHPUR';
  date?: string;
  court_no?: string;
  list_type?: 'DAILY' | 'SUPPLEMENTARY';
}

interface ScraperLog {
  bench: string;
  status: 'success' | 'partial' | 'failed' | 'warning';
  cases_found: number;
  error_message: string | null;
  list_type: string;
  court_no: string | null;
}

interface BrowserlessResult {
  courts: CourtMetadata[];
  entries: CauseListEntry[];
  pdfLinks: string[];
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// BROWSERLESS SCRAPER
// ============================================================

async function scrapeWithBrowserless(
  baseUrl: string,
  targetDate: string,
  bench: string,
  browserlessApiKey: string,
  maxCourts: number = 5
): Promise<BrowserlessResult> {
  console.log(`[scrape-causelist] 🚀 Starting Browserless scrape for ${bench}`);
  
  const result: BrowserlessResult = {
    courts: [],
    entries: [],
    pdfLinks: [],
  };

  try {
    // Get the page - the website shows today's cause list by default
    console.log(`[scrape-causelist] Getting page content`);
    const contentResponse = await fetch(`https://chrome.browserless.io/content?token=${browserlessApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: baseUrl,
        gotoOptions: {
          waitUntil: 'networkidle2',
          timeout: 30000,
        },
        waitForSelector: {
          selector: 'table',
          timeout: 15000,
        },
      }),
    });

    if (!contentResponse.ok) {
      const errText = await contentResponse.text();
      console.error(`[scrape-causelist] Content error: ${contentResponse.status} - ${errText}`);
      throw new Error(`Content request failed: ${contentResponse.status}`);
    }

    const html = await contentResponse.text();
    console.log(`[scrape-causelist] Got HTML: ${html.length} chars`);
    
    // Log sample of HTML to debug
    const tableIndex = html.indexOf('<table');
    if (tableIndex > -1) {
      console.log(`[scrape-causelist] Table found at index ${tableIndex}`);
      console.log(`[scrape-causelist] Table sample: ${html.substring(tableIndex, tableIndex + 500)}`);
    } else {
      console.log(`[scrape-causelist] No <table> found in HTML`);
      console.log(`[scrape-causelist] HTML sample: ${html.substring(0, 1000)}`);
    }

    // Parse courts from HTML
    result.courts = parseCourtTableFromHtml(html, bench);
    console.log(`[scrape-causelist] Found ${result.courts.length} courts`);

    // Extract PDF links
    result.pdfLinks = extractPdfLinksFromHtml(html, baseUrl);
    console.log(`[scrape-causelist] Found ${result.pdfLinks.length} PDF links`);

    // Step 2: Try to scrape PDF content for each court
    if (result.pdfLinks.length > 0) {
      const pdfsToScrape = result.pdfLinks.slice(0, maxCourts);
      console.log(`[scrape-causelist] Step 2: Scraping ${pdfsToScrape.length} PDFs`);

      for (let i = 0; i < pdfsToScrape.length; i++) {
        const pdfUrl = pdfsToScrape[i];
        const courtNo = extractCourtNoFromUrl(pdfUrl);
        
        console.log(`[scrape-causelist] Scraping PDF ${i + 1}/${pdfsToScrape.length} (court ${courtNo})`);

        try {
          // Try to get PDF content via Browserless
          const pdfResponse = await fetch(`https://chrome.browserless.io/content?token=${browserlessApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: pdfUrl,
              gotoOptions: {
                waitUntil: 'networkidle2',
                timeout: 30000,
              },
              bestAttempt: true,
            }),
          });

          if (pdfResponse.ok) {
            const pdfContent = await pdfResponse.text();
            console.log(`[scrape-causelist] PDF content: ${pdfContent.length} chars`);

            if (pdfContent.length > 500) {
              const listType = result.courts.find(c => c.court_no === courtNo)?.list_type || 'DAILY';
              const entries = parseCauseListContent(pdfContent, bench, courtNo, targetDate, listType);
              result.entries = result.entries.concat(entries);
              console.log(`[scrape-causelist] Parsed ${entries.length} entries from court ${courtNo}`);
            }
          }
        } catch (pdfErr) {
          console.log(`[scrape-causelist] PDF error: ${pdfErr}`);
        }

        // Delay between requests
        if (i < pdfsToScrape.length - 1) {
          await sleep(2000);
        }
      }
    }

  } catch (err) {
    console.error(`[scrape-causelist] Browserless error: ${err}`);
    throw err;
  }

  return result;
}

// ============================================================
// PARSING FUNCTIONS
// ============================================================

function parseCourtTableFromHtml(html: string, bench: string): CourtMetadata[] {
  const courts: CourtMetadata[] = [];
  
  // Match table rows
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  
  while ((match = trPattern.exec(html)) !== null) {
    const rowHtml = match[1];
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tdMatch;
    
    while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
      const cellText = tdMatch[1].replace(/<[^>]+>/g, '').trim();
      cells.push(cellText);
    }
    
    if (cells.length >= 3 && /^\d+$/.test(cells[0])) {
      courts.push({
        court_no: cells[0],
        judge_names: cells[1],
        list_type: cells[2] === 'S' ? 'SUPPLEMENTARY' : 'DAILY',
        bench: bench,
      });
    }
  }
  
  console.log(`[scrape-causelist] Parsed ${courts.length} courts`);
  return courts;
}

function extractPdfLinksFromHtml(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const baseHost = new URL(baseUrl).origin;
  const benchCode = baseUrl.includes('jdp') ? 'jdp' : 'jp';
  
  // Pattern: data-pdfpath (base64 encoded)
  const pdfPathPattern = /data-pdfpath=["']([^"']+)["']/gi;
  let match;
  
  while ((match = pdfPathPattern.exec(html)) !== null) {
    try {
      const decoded = atob(match[1]);
      const pdfUrl = `${baseHost}/quick-causelist-${benchCode}/download_pdf.php?path=${encodeURIComponent(decoded)}`;
      if (!links.includes(pdfUrl)) {
        links.push(pdfUrl);
        console.log(`[scrape-causelist] Found PDF: ${decoded.split('/').pop()}`);
      }
    } catch (e) {}
  }
  
  // Pattern: Direct PDF href
  const hrefPattern = /href=["']([^"']*\.pdf[^"']*)["']/gi;
  while ((match = hrefPattern.exec(html)) !== null) {
    let url = match[1];
    if (!url.startsWith('http')) {
      try { url = new URL(url, baseUrl).toString(); } catch { continue; }
    }
    if (!links.includes(url)) {
      links.push(url);
    }
  }
  
  return links;
}

function extractCourtNoFromUrl(pdfUrl: string): string {
  // Pattern: DDMMYYYY_HHMM_COURTNO.pdf -> extract court from COURTNO (e.g., 1001 -> court 1)
  const specialMatch = pdfUrl.match(/\d{8}_\d{4}_(\d+)\.pdf$/i);
  if (specialMatch) {
    const code = specialMatch[1];
    return code.length >= 4 ? code.substring(0, code.length - 3) || '1' : code;
  }
  
  const courtMatch = pdfUrl.match(/court[_-]?(\d+)/i);
  if (courtMatch) return courtMatch[1];
  
  return '1';
}

function parseCauseListContent(
  content: string,
  bench: string,
  courtNo: string,
  date: string,
  listType: string
): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  // Clean HTML tags
  const text = content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  
  const lines = text.split(/[\n\r]+|(?=\d+\.\s)/);
  
  const casePattern = /([SDB]\.?[AB]?\.?(?:CWP|CIVIL|CRIMINAL|WP|SA|CA|MA|RA|SB|DB|REV|CMA|CR|CRL|MISC)[\/\s]*(?:No\.?)?\s*\d+[\/\-]\d{4})/gi;
  const partyPattern = /([A-Za-z\s.&,]+?)\s+(?:Vs\.?|vs\.?|V\/s\.?|versus|V\.)\s+([A-Za-z\s.&,]+)/i;
  
  let itemCounter = 0;
  let currentCase: Partial<CauseListEntry> | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 5) continue;
    
    // Skip headers
    if (/s\.?no|serial|case\s*number|advocate|hon.*ble/i.test(trimmed)) continue;
    
    // Look for case numbers
    casePattern.lastIndex = 0;
    const caseMatch = trimmed.match(casePattern);
    
    if (caseMatch) {
      // Save previous
      if (currentCase?.case_number) {
        entries.push({
          item_no: currentCase.item_no || ++itemCounter,
          case_number: currentCase.case_number,
          petitioner: currentCase.petitioner || null,
          respondent: currentCase.respondent || null,
          petitioner_lawyer: currentCase.petitioner_lawyer || null,
          respondent_lawyer: currentCase.respondent_lawyer || null,
          court_room_no: courtNo,
          court_location: bench,
          list_type: listType,
          date: date,
          status: 'pending',
        });
      }
      
      // Check for item number
      const itemMatch = trimmed.match(/^(\d+)[\.\)\s]/);
      currentCase = {
        item_no: itemMatch ? parseInt(itemMatch[1]) : ++itemCounter,
        case_number: caseMatch[0].trim(),
      };
      
      // Check for parties
      const partyMatch = trimmed.match(partyPattern);
      if (partyMatch) {
        currentCase.petitioner = partyMatch[1].trim().substring(0, 200);
        currentCase.respondent = partyMatch[2].trim().substring(0, 200);
      }
    } else if (currentCase) {
      // Add parties if not found
      if (!currentCase.petitioner) {
        const partyMatch = trimmed.match(partyPattern);
        if (partyMatch) {
          currentCase.petitioner = partyMatch[1].trim().substring(0, 200);
          currentCase.respondent = partyMatch[2].trim().substring(0, 200);
        }
      }
      
      // Look for advocates
      const advMatch = trimmed.match(/(?:Adv\.?|Advocate)[:\s]*([A-Za-z\s.]+?)(?:,|$)/i);
      if (advMatch && !currentCase.petitioner_lawyer) {
        currentCase.petitioner_lawyer = advMatch[1].trim().substring(0, 200);
      }
    }
  }
  
  // Save last
  if (currentCase?.case_number) {
    entries.push({
      item_no: currentCase.item_no || ++itemCounter,
      case_number: currentCase.case_number,
      petitioner: currentCase.petitioner || null,
      respondent: currentCase.respondent || null,
      petitioner_lawyer: currentCase.petitioner_lawyer || null,
      respondent_lawyer: currentCase.respondent_lawyer || null,
      court_room_no: courtNo,
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
async function logScraperRun(supabase: any, log: ScraperLog): Promise<void> {
  try {
    await supabase.from('scraper_logs').insert(log);
  } catch (err) {
    console.error('[scrape-causelist] Log error:', err);
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { 
      action, 
      bench = 'JAIPUR', 
      date, 
      court_no = '1', 
      list_type = 'DAILY' 
    } = await req.json() as ScrapeRequest;
    
    const targetDate = date || getSmartTargetDate();
    
    console.log(`[scrape-causelist] ========================================`);
    console.log(`[scrape-causelist] Action: ${action}, Bench: ${bench}`);
    console.log(`[scrape-causelist] Date: ${targetDate}`);
    console.log(`[scrape-causelist] Browserless: ${browserlessApiKey ? '✓' : '✗'}`);
    console.log(`[scrape-causelist] ========================================`);
    
    const baseUrls: Record<string, string> = {
      'JAIPUR': 'https://hcraj.nic.in/quick-causelist-jp/',
      'JODHPUR': 'https://hcraj.nic.in/quick-causelist-jdp/',
    };
    
    const targetUrl = baseUrls[bench];
    
    if (!targetUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid bench' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!browserlessApiKey && !firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'No scraping API configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let result: BrowserlessResult = { courts: [], entries: [], pdfLinks: [] };
    let scrapeMethod = 'none';

    // Try Browserless
    if (browserlessApiKey) {
      try {
        result = await scrapeWithBrowserless(targetUrl, targetDate, bench, browserlessApiKey, 5);
        scrapeMethod = 'browserless';
      } catch (err) {
        console.error(`[scrape-causelist] Browserless failed: ${err}`);
      }
    }

    // Fallback to Firecrawl for court list only
    if (result.courts.length === 0 && firecrawlApiKey) {
      try {
        console.log(`[scrape-causelist] Trying Firecrawl fallback`);
        const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: targetUrl,
            formats: ['html'],
            waitFor: 10000,
          }),
        });

        if (fcResponse.ok) {
          const fcData = await fcResponse.json();
          const html = fcData.data?.html || '';
          result.courts = parseCourtTableFromHtml(html, bench);
          result.pdfLinks = extractPdfLinksFromHtml(html, targetUrl);
          scrapeMethod = 'firecrawl';
        }
      } catch (err) {
        console.error(`[scrape-causelist] Firecrawl failed: ${err}`);
      }
    }

    // Store court metadata
    if (result.courts.length > 0) {
      console.log(`[scrape-causelist] Storing ${result.courts.length} courts`);
      for (const court of result.courts) {
        await supabase
          .from('court_metadata')
          .upsert({
            bench: court.bench,
            court_no: court.court_no,
            judge_names: court.judge_names,
            last_updated: new Date().toISOString(),
          }, { onConflict: 'bench,court_no' });
      }
    }

    console.log(`[scrape-causelist] Results: ${result.courts.length} courts, ${result.entries.length} entries`);

    // Preview mode
    if (action === 'preview') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          entries: result.entries,
          courts: result.courts,
          pdf_links: result.pdfLinks,
          target_date: targetDate,
          scrape_method: scrapeMethod,
          message: `Found ${result.courts.length} courts, ${result.entries.length} cases`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert entries
    if (result.entries.length > 0) {
      let inserted = 0, updated = 0, errors = 0;
      
      for (const entry of result.entries) {
        try {
          const { data: existing } = await supabase
            .from('daily_court_docket')
            .select('id')
            .eq('case_number', entry.case_number)
            .eq('date', entry.date)
            .eq('court_room_no', entry.court_room_no)
            .single();
          
          if (existing) {
            const { error } = await supabase
              .from('daily_court_docket')
              .update({
                petitioner_lawyer: entry.petitioner_lawyer,
                respondent_lawyer: entry.respondent_lawyer,
                petitioner: entry.petitioner,
                respondent: entry.respondent,
                item_no: entry.item_no,
              })
              .eq('id', existing.id);
            if (error) errors++; else updated++;
          } else {
            const { error } = await supabase.from('daily_court_docket').insert(entry);
            if (error) errors++; else inserted++;
          }
        } catch { errors++; }
      }
      
      await logScraperRun(supabase, {
        bench,
        status: errors === 0 ? 'success' : 'partial',
        cases_found: result.entries.length,
        error_message: errors > 0 ? `${errors} errors` : null,
        list_type,
        court_no,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          entries_count: result.entries.length,
          inserted, updated, errors,
          courts_found: result.courts.length,
          target_date: targetDate,
          scrape_method: scrapeMethod,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    await logScraperRun(supabase, {
      bench,
      status: result.courts.length > 0 ? 'warning' : 'failed',
      cases_found: 0,
      error_message: result.courts.length > 0 ? 'No case data in PDFs' : 'No data found',
      list_type,
      court_no,
    });
    
    return new Response(
      JSON.stringify({ 
        success: result.courts.length > 0, 
        entries_count: 0,
        courts_found: result.courts.length,
        courts: result.courts,
        target_date: targetDate,
        scrape_method: scrapeMethod,
        message: result.courts.length > 0 ? `Found ${result.courts.length} courts, PDFs not accessible` : 'No data found'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[scrape-causelist] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
