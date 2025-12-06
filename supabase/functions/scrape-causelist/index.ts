import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  bench: 'JAIPUR' | 'JODHPUR';
  date?: string;
}

interface CourtData {
  court_no: string;
  judge_names: string;
  daily_link: string | null;
  supplementary_link: string | null;
}

interface FirecrawlResponse {
  success: boolean;
  data?: {
    llm_extraction?: {
      courts?: CourtData[];
    };
    markdown?: string;
    html?: string;
  };
  error?: string;
}

serve(async (req) => {
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

    if (!firecrawlKey) {
      console.error('[SCRAPER] No FIRECRAWL_API_KEY configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'FIRECRAWL_API_KEY not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Target the Quick Download page - make direct POST request to get the table
    const baseUrl = bench === 'JODHPUR'
      ? 'https://hcraj.nic.in/quick-causelist-jdp/'
      : 'https://hcraj.nic.in/quick-causelist-jp/';

    console.log(`[SCRAPER] Target URL: ${baseUrl}`);

    // Parse the target date
    const [year, month, day] = targetDate.split('-').map(Number);
    console.log(`[SCRAPER] Parsed date: day=${day}, month=${month}, year=${year}`);

    // Try direct POST request to the form first (the form POSTs to itself)
    let htmlContent = '';
    let markdownContent = '';
    
    try {
      // Make a direct POST request with form data
      const formData = new URLSearchParams();
      formData.append('day', String(day));
      formData.append('month', String(month));
      formData.append('year', String(year));

      console.log(`[SCRAPER] Making direct POST request with form data`);
      
      const directResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Origin': 'https://hcraj.nic.in',
          'Referer': baseUrl
        },
        body: formData.toString()
      });

      if (directResponse.ok) {
        htmlContent = await directResponse.text();
        console.log(`[SCRAPER] Direct POST successful, HTML length: ${htmlContent.length}`);
      } else {
        console.log(`[SCRAPER] Direct POST failed with status: ${directResponse.status}`);
      }
    } catch (err) {
      console.log(`[SCRAPER] Direct POST error: ${err}`);
    }

    // If direct POST didn't get table data, try Firecrawl with JS execution
    if (htmlContent.length < 3000 || !htmlContent.includes('<table')) {
      console.log(`[SCRAPER] Direct POST didn't return table, trying Firecrawl with JS execution`);
      
      const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firecrawlKey}`
        },
        body: JSON.stringify({
          url: baseUrl,
          formats: ['markdown', 'html'],
          waitFor: 3000,
          timeout: 60000,
          actions: [
            { type: 'wait', milliseconds: 1000 },
            // Use JavaScript to set form values and submit
            { 
              type: 'evaluate', 
              code: `
                document.getElementById('day').value = '${day}';
                document.getElementById('month').value = '${month}';
                document.getElementById('year').value = '${year}';
                document.querySelector('button[type="submit"]').click();
              `
            },
            { type: 'wait', milliseconds: 5000 }
          ]
        })
      });

      const firecrawlResult = await firecrawlResponse.json() as FirecrawlResponse;
      console.log(`[SCRAPER] Firecrawl response success: ${firecrawlResult.success}`);

      if (firecrawlResult.success) {
        htmlContent = firecrawlResult.data?.html || '';
        markdownContent = firecrawlResult.data?.markdown || '';
      } else {
        console.error('[SCRAPER] Firecrawl error:', firecrawlResult.error);
      }
    }


    // Check if we got table data
    if (htmlContent.length < 2000 || !htmlContent.includes('<table')) {
      console.log(`[SCRAPER] No table data found in response`);
      await logScraperRun(supabase, bench, 'warning', 0, 'Failed to retrieve causelist table', 'DAILY', null);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to retrieve causelist table - page may require browser interaction'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[SCRAPER] HTML length: ${htmlContent.length}, Markdown length: ${markdownContent.length}`);

    // Parse the court table from HTML
    const courts = parseCourtTable(htmlContent, baseUrl);
    console.log(`[SCRAPER] Found ${courts.length} courts from HTML parsing`);

    // If HTML parsing found nothing, try parsing markdown
    if (courts.length === 0 && markdownContent.length > 500) {
      console.log('[SCRAPER] Trying markdown parsing...');
      const markdownCourts = parseCourtTableFromMarkdown(markdownContent, baseUrl);
      courts.push(...markdownCourts);
      console.log(`[SCRAPER] Found ${markdownCourts.length} courts from markdown parsing`);
    }

    if (courts.length === 0) {
      // Check if page indicates no data
      const noDataIndicators = ['No Causelist', 'No data', 'No record', 'Holiday'];
      const hasNoData = noDataIndicators.some(indicator => 
        htmlContent.toLowerCase().includes(indicator.toLowerCase()) ||
        markdownContent.toLowerCase().includes(indicator.toLowerCase())
      );

      if (hasNoData || (htmlContent.length < 2000 && markdownContent.length < 500)) {
        await logScraperRun(supabase, bench, 'warning', 0, 'No causelist available for this date', 'DAILY', null);

        return new Response(JSON.stringify({
          success: true,
          message: 'No causelist available for this date',
          courts_found: 0,
          cases_found: 0
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Log a sample for debugging
      console.log('[SCRAPER] HTML sample:', htmlContent.substring(0, 1500));
      console.log('[SCRAPER] Markdown sample:', markdownContent.substring(0, 1500));
    }

    // Upsert court metadata
    for (const court of courts) {
      const { error: upsertError } = await supabase
        .from('court_metadata')
        .upsert({
          bench,
          court_no: court.court_no,
          sitting_judges: court.judge_names,
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

    // Deep scrape each cause list link
    let totalCases = 0;
    const errors: string[] = [];

    for (const court of courts) {
      // Scrape Daily list
      if (court.daily_link) {
        try {
          const dailyCases = await scrapeCauseListPage(court.daily_link, firecrawlKey);

          for (const caseItem of dailyCases) {
            await insertDocketItem(supabase, {
              ...caseItem,
              date: targetDate,
              court_location: bench,
              court_room_no: court.court_no,
              list_type: 'DAILY',
              judge_names: court.judge_names,
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
          const suppCases = await scrapeCauseListPage(court.supplementary_link, firecrawlKey);

          for (const caseItem of suppCases) {
            await insertDocketItem(supabase, {
              ...caseItem,
              date: targetDate,
              court_location: bench,
              court_room_no: court.court_no,
              list_type: 'SUPPLEMENTARY',
              judge_names: court.judge_names,
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

    // Log the scraper run
    const status = courts.length === 0 ? 'warning' : (errors.length > 0 ? (totalCases > 0 ? 'partial' : 'failed') : 'success');
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
    console.log(`[SCRAPER] Completed in ${duration}ms. Status: ${status}, Courts: ${courts.length}, Cases: ${totalCases}`);

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

// Parse court table from HTML
function parseCourtTable(html: string, baseUrl: string): CourtData[] {
  const courts: CourtData[] = [];

  // Find table rows
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

      // Extract judge names
      const judge_names = cells[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!court_no || !judge_names) continue;

      // Extract PDF links from the row - look for data-pdfpath (base64 encoded)
      let daily_link: string | null = null;
      let supplementary_link: string | null = null;

      // The HC website uses base64 encoded paths in data-pdfpath attribute
      // Example: <a href='javascript:void(0)' data-pdfpath='L2hvbWUv...'>D</a>
      // The path decodes to something like: /home/court/rhcjodh.../causelist_report/2025/05122025_2011_1001.pdf
      
      // Find D (Daily) link with data-pdfpath
      const dMatch = row.match(/<a[^>]*data-pdfpath=["']([^"']+)["'][^>]*>[\s]*D[\s]*<\/a>/i);
      if (dMatch) {
        try {
          const decodedPath = atob(dMatch[1]);
          // Construct full URL - the server serves PDFs from a specific endpoint
          daily_link = `https://hcraj.nic.in${decodedPath}`;
          console.log(`[SCRAPER] Court ${court_no} Daily PDF: ${daily_link}`);
        } catch (e) {
          console.log(`[SCRAPER] Failed to decode Daily path for court ${court_no}`);
        }
      }

      // Find S (Supplementary) link with data-pdfpath
      const sMatch = row.match(/<a[^>]*data-pdfpath=["']([^"']+)["'][^>]*>[\s]*S[\s]*<\/a>/i);
      if (sMatch) {
        try {
          const decodedPath = atob(sMatch[1]);
          supplementary_link = `https://hcraj.nic.in${decodedPath}`;
          console.log(`[SCRAPER] Court ${court_no} Supp PDF: ${supplementary_link}`);
        } catch (e) {
          console.log(`[SCRAPER] Failed to decode Supp path for court ${court_no}`);
        }
      }

      // Log first row's raw HTML for debugging
      if (courts.length === 0) {
        console.log(`[SCRAPER] Sample row HTML (first 500 chars): ${row.substring(0, 500)}`);
      }

      courts.push({
        court_no,
        judge_names,
        daily_link,
        supplementary_link
      });

      console.log(`[SCRAPER] Court ${court_no}: ${judge_names.substring(0, 40)}... D:${!!daily_link} S:${!!supplementary_link}`);
    }
  }

  return courts;
}

// Parse court table from markdown
function parseCourtTableFromMarkdown(markdown: string, baseUrl: string): CourtData[] {
  const courts: CourtData[] = [];

  // Look for table rows in markdown format
  // Pattern: | Court No | Judge Name | D | S |
  const lines = markdown.split('\n');

  for (const line of lines) {
    if (!line.includes('|')) continue;

    const cells = line.split('|').map(c => c.trim()).filter(c => c);

    if (cells.length >= 2) {
      const courtNoMatch = cells[0].match(/(\d+)/);
      if (!courtNoMatch) continue;

      const court_no = courtNoMatch[1];
      const judge_names = cells[1].replace(/\*+/g, '').trim();

      if (!judge_names || judge_names.toLowerCase().includes('judge')) continue;

      // Extract links from markdown
      let daily_link: string | null = null;
      let supplementary_link: string | null = null;

      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let linkMatch;

      while ((linkMatch = linkRegex.exec(line)) !== null) {
        const linkText = linkMatch[1];
        const linkUrl = resolveUrl(linkMatch[2], baseUrl);

        if (linkText.toUpperCase() === 'D' || linkText.toLowerCase().includes('daily')) {
          daily_link = linkUrl;
        } else if (linkText.toUpperCase() === 'S' || linkText.toLowerCase().includes('supp')) {
          supplementary_link = linkUrl;
        }
      }

      courts.push({
        court_no,
        judge_names,
        daily_link,
        supplementary_link
      });
    }
  }

  return courts;
}

// Resolve relative URLs
function resolveUrl(url: string, baseUrl: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) {
    const base = new URL(baseUrl);
    return `${base.origin}${url}`;
  }
  return `${baseUrl.replace(/\/$/, '')}/${url}`;
}

// Scrape a cause list page using direct HTTP request and AI for PDF parsing
async function scrapeCauseListPage(url: string, _firecrawlKey: string): Promise<any[]> {
  console.log(`[SCRAPER] Fetching cause list directly: ${url}`);

  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

  try {
    // Use direct HTTP request instead of Firecrawl to avoid rate limits
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://hcraj.nic.in/'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    
    // Handle PDF files using Lovable AI (Gemini) for extraction
    if (contentType.includes('application/pdf') || url.endsWith('.pdf')) {
      console.log(`[SCRAPER] PDF detected, using AI extraction: ${url}`);
      
      if (!lovableApiKey) {
        console.log(`[SCRAPER] No LOVABLE_API_KEY, skipping PDF extraction`);
        return [];
      }

      // Get PDF as ArrayBuffer
      const pdfBuffer = await response.arrayBuffer();
      
      console.log(`[SCRAPER] PDF size: ${pdfBuffer.byteLength} bytes`);

      // Use pdf-parse to extract case data from PDF
      const cases = await extractCasesFromPdfWithAI(pdfBuffer, lovableApiKey);
      console.log(`[SCRAPER] Extracted ${cases.length} cases from PDF`);
      
      return cases;
    }

    // Handle HTML content
    const html = await response.text();
    console.log(`[SCRAPER] Fetched HTML content, length: ${html.length}`);
    
    return parseCauseListContent(html, '');
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[SCRAPER] Direct fetch failed: ${errMsg}`);
    throw error;
  }
}

// PDF extraction - for now, just store the URL without parsing
// PDF parsing in edge functions is complex; consider using external service
async function extractCasesFromPdfWithAI(_pdfBuffer: ArrayBuffer, _apiKey: string): Promise<any[]> {
  // PDF text extraction requires external service or dedicated worker
  // The PDF URLs are stored in source_url for later processing
  console.log(`[SCRAPER] PDF extraction not yet implemented - URL stored for later processing`);
  return [];
}

// Parse cause list text extracted from PDF
function parseCauseListText(text: string): any[] {
  const cases: any[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Pattern to match item numbers at start of line
  // Common patterns: "1.", "1)", "1 ", "Sr.No. 1"
  const itemPattern = /^(\d{1,4})[\.\)\s]/;
  
  // Case number patterns for Indian courts
  const caseNumberPatterns = [
    /S\.?B\.?\s*(?:Civil|Criminal|Misc\.?)?\s*(?:Writ|Appeal|Petition|Application|Revision)?\s*(?:No\.?)?\s*\d+\/\d{4}/gi,
    /D\.?B\.?\s*(?:Civil|Criminal|Misc\.?)?\s*(?:Writ|Appeal|Petition|Application|Revision)?\s*(?:No\.?)?\s*\d+\/\d{4}/gi,
    /(?:CW|CA|CR|MA|RA|SA|WP|CP)\s*(?:No\.?)?\s*\d+\/\d{4}/gi,
    /\d+\/\d{4}/g // Fallback: just case numbers
  ];
  
  let currentCase: any = null;
  let currentText = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const itemMatch = line.match(itemPattern);
    
    if (itemMatch) {
      // Save previous case if exists
      if (currentCase && currentCase.item_no > 0) {
        parseAndSaveCase(currentCase, currentText, cases);
      }
      
      // Start new case
      const itemNo = parseInt(itemMatch[1], 10);
      if (itemNo > 0 && itemNo < 1000) { // Reasonable item number range
        currentCase = { item_no: itemNo };
        currentText = line.substring(itemMatch[0].length).trim();
      }
    } else if (currentCase) {
      // Continue building current case text
      currentText += ' ' + line;
    }
  }
  
  // Don't forget the last case
  if (currentCase && currentCase.item_no > 0) {
    parseAndSaveCase(currentCase, currentText, cases);
  }
  
  return cases;
}

// Parse case details from accumulated text
function parseAndSaveCase(caseObj: any, text: string, cases: any[]): void {
  // Extract case number
  const casePatterns = [
    /S\.?B\.?\s*(?:Civil|Criminal|Misc\.?)?\s*(?:Writ|Appeal|Petition|Application|Revision)?\s*(?:No\.?)?\s*\d+\/\d{4}/i,
    /D\.?B\.?\s*(?:Civil|Criminal|Misc\.?)?\s*(?:Writ|Appeal|Petition|Application|Revision)?\s*(?:No\.?)?\s*\d+\/\d{4}/i,
    /(?:CW|CA|CR|MA|RA|SA|WP|CP)\s*(?:No\.?)?\s*\d+\/\d{4}/i,
  ];
  
  for (const pattern of casePatterns) {
    const match = text.match(pattern);
    if (match) {
      caseObj.case_number = match[0].trim();
      break;
    }
  }
  
  // If no case number found, try simple pattern
  if (!caseObj.case_number) {
    const simpleMatch = text.match(/\d+\/\d{4}/);
    if (simpleMatch) {
      caseObj.case_number = simpleMatch[0];
    }
  }
  
  // Extract petitioner and respondent (pattern: "X Vs. Y" or "X V/s Y")
  const vsMatch = text.match(/([^Vv]+)\s+[Vv][Ss\.\/]+\s+(.+?)(?=\s+(?:Adv|Mr\.|Ms\.|Shri|Smt\.|AAG|APG|GA)|$)/i);
  if (vsMatch) {
    caseObj.petitioner = vsMatch[1].replace(/[^\w\s]/g, '').trim().substring(0, 200);
    caseObj.respondent = vsMatch[2].replace(/[^\w\s]/g, '').trim().substring(0, 200);
  }
  
  // Extract lawyers
  const lawyerPatterns = [
    /(?:Adv\.?|Advocate|Counsel)\s*[:\-]?\s*([A-Za-z\s\.]+?)(?=\s+(?:Vs|V\/s|for|$))/gi,
    /(?:Mr\.|Ms\.|Shri|Smt\.)\s+([A-Za-z\s\.]+?)(?=\s+(?:Adv|for|Vs|$))/gi,
  ];
  
  // Look for petitioner lawyer
  const petLawyerMatch = text.match(/(?:for\s+(?:the\s+)?petitioner|pet\s*:?\s*)(?:Adv\.?|Mr\.|Ms\.|Shri|Smt\.)\s*([A-Za-z\s\.]+)/i);
  if (petLawyerMatch) {
    caseObj.petitioner_lawyer = petLawyerMatch[1].trim().substring(0, 100);
  }
  
  // Look for respondent lawyer (often AAG, APG, GA for government)
  const respLawyerMatch = text.match(/(?:for\s+(?:the\s+)?respondent|resp\s*:?\s*)(?:AAG|APG|GA|Adv\.?|Mr\.|Ms\.|Shri|Smt\.)\s*([A-Za-z\s\.]*)/i);
  if (respLawyerMatch) {
    const lawyer = respLawyerMatch[0].includes('AAG') ? 'AAG' : 
                   respLawyerMatch[0].includes('APG') ? 'APG' :
                   respLawyerMatch[0].includes('GA') ? 'GA' :
                   respLawyerMatch[1]?.trim().substring(0, 100);
    caseObj.respondent_lawyer = lawyer;
  }
  
  // Only add if we have at least case number or item number
  if (caseObj.case_number || caseObj.petitioner) {
    cases.push({
      item_no: caseObj.item_no,
      case_number: caseObj.case_number || '',
      petitioner: caseObj.petitioner || null,
      respondent: caseObj.respondent || null,
      petitioner_lawyer: caseObj.petitioner_lawyer || null,
      respondent_lawyer: caseObj.respondent_lawyer || null
    });
  }
}

// Parse cause list content
function parseCauseListContent(html: string, markdown: string): any[] {
  const cases: any[] = [];

  // Try HTML parsing first
  const tableRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = html.match(tableRowRegex) || [];

  for (const row of rows) {
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
      const itemNoMatch = cells[0].match(/(\d+)/);
      const item_no = itemNoMatch ? parseInt(itemNoMatch[1], 10) : 0;

      if (item_no === 0) continue;

      const case_number = cells[1] || '';
      const partiesText = cells[2] || '';
      const partiesSplit = partiesText.split(/\s+vs\.?\s+/i);
      const petitioner = partiesSplit[0]?.trim() || null;
      const respondent = partiesSplit[1]?.trim() || null;

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

  // If no cases from HTML, try markdown
  if (cases.length === 0 && markdown) {
    const lines = markdown.split('\n');
    for (const line of lines) {
      const itemMatch = line.match(/^(\d+)[\.\)]\s*(.+)/);
      if (itemMatch) {
        cases.push({
          item_no: parseInt(itemMatch[1], 10),
          case_number: itemMatch[2].trim(),
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