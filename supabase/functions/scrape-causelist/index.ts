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

interface ScrapeRequest {
  action: 'scrape' | 'preview' | 'scrape_url';
  bench?: 'JAIPUR' | 'JODHPUR';
  date?: string;
  court_no?: string;
  url?: string;
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

// Smart date logic: If current IST time < 6 PM, target today, else target tomorrow
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

// Extract PDF links from HTML response
function extractPdfLinksFromHtml(html: string, baseUrl: string): string[] {
  const pdfPattern = /href=["']([^"']*\.pdf[^"']*)["']/gi;
  const links: string[] = [];
  let match;
  
  while ((match = pdfPattern.exec(html)) !== null) {
    let url = match[1];
    // Handle relative URLs
    if (!url.startsWith('http')) {
      try {
        url = new URL(url, baseUrl).toString();
      } catch {
        continue;
      }
    }
    // Avoid duplicates
    if (!links.includes(url)) {
      links.push(url);
    }
  }
  
  console.log(`[scrape-causelist] Extracted ${links.length} PDF links from HTML`);
  return links;
}

// Scrape PDF content using Firecrawl
async function scrapePdfWithFirecrawl(pdfUrl: string, firecrawlApiKey: string): Promise<string> {
  console.log(`[scrape-causelist] Scraping PDF: ${pdfUrl}`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: pdfUrl,
      formats: ['markdown'],
      timeout: 60000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[scrape-causelist] Firecrawl PDF error: ${errorText}`);
    throw new Error(`Failed to scrape PDF: ${response.statusText}`);
  }

  const data = await response.json();
  const markdown = data.data?.markdown || '';
  console.log(`[scrape-causelist] PDF scraped, got ${markdown.length} chars`);
  return markdown;
}

// Extract court number from PDF URL or filename
function extractCourtNoFromUrl(pdfUrl: string): string {
  // Patterns: court1.pdf, Court-2.pdf, court_3.pdf, CourtNo1.pdf, etc.
  const patterns = [
    /court[_\-\s]?no?[_\-\s]?(\d+)/i,
    /court[_\-\s]?(\d+)/i,
    /(\d+)\.pdf$/i,
  ];
  
  for (const pattern of patterns) {
    const match = pdfUrl.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return '1';
}

// Detect list type from URL or content
function detectListType(pdfUrl: string, content: string): string {
  const urlLower = pdfUrl.toLowerCase();
  const contentLower = content.toLowerCase().substring(0, 500);
  
  if (urlLower.includes('supp') || urlLower.includes('/s/') || contentLower.includes('supplementary')) {
    return 'SUPPLEMENTARY';
  }
  return 'DAILY';
}

// Enhanced PDF text parser for Rajasthan High Court cause lists
function parseCauseListPdf(
  pdfText: string, 
  courtLocation: string, 
  courtNo: string, 
  date: string, 
  listType: string
): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  const lines = pdfText.split('\n');
  
  console.log(`[scrape-causelist] Parsing PDF with ${lines.length} lines`);
  
  // Common patterns in Rajasthan HC cause lists
  // Format variations:
  // 1. | S.No | Case Number | Petitioner vs Respondent | Adv for Pet | Adv for Resp |
  // 2. 1. S.B.CWP/1234/2025 - John Doe vs State - Mr. Sharma / AAG
  // 3. Numbered entries with case details on same or multiple lines
  
  // Pattern 1: Table format with pipes
  const tableRowPattern = /\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|/;
  
  // Pattern 2: Numbered list with case number
  const numberedPattern = /^\s*(\d+)[\.\)]\s+([A-Z][A-Z\s./\-]*(?:\/\d{4}|\d{4}\/\d+))/i;
  
  // Pattern 3: Case number detection
  const caseNumberPattern = /([SDB]\.?[AB]?\.?(?:CWP|CIVIL|CRIMINAL|WP|SA|CA|MA|RA|SB|DB|REV|CMA)[\/\s]*(?:No\.?)?\s*\d+[\/\-]\d{4})/gi;
  
  // Pattern 4: Party names (Petitioner vs Respondent)
  const partyPattern = /([A-Za-z\s.&,]+)\s+(?:Vs\.?|vs\.?|V\/s\.?|versus|V\.)\s+([A-Za-z\s.&,]+)/i;
  
  // Pattern 5: Advocate names
  const advocatePatterns = [
    /(?:Adv\.?|Advocate|Counsel)[:\s]*([A-Za-z\s.]+)/gi,
    /(?:Mr\.?|Ms\.?|Shri|Smt\.?)\s+([A-Za-z\s.]+?)(?:\s+(?:Adv|Advocate|for|$))/gi,
  ];
  
  let currentEntry: Partial<CauseListEntry> | null = null;
  let itemCounter = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Skip header lines
    if (line.toLowerCase().includes('s.no') || 
        line.toLowerCase().includes('serial') ||
        line.toLowerCase().includes('case number') ||
        line.toLowerCase().includes('advocate')) {
      continue;
    }
    
    // Try table row pattern
    const tableMatch = line.match(tableRowPattern);
    if (tableMatch) {
      const [, itemNo, caseNum, parties, petAdv, respAdv] = tableMatch;
      const partyMatch = parties.match(partyPattern);
      
      entries.push({
        item_no: parseInt(itemNo),
        case_number: caseNum.trim(),
        petitioner: partyMatch ? partyMatch[1].trim() : null,
        respondent: partyMatch ? partyMatch[2].trim() : null,
        petitioner_lawyer: petAdv?.trim() || null,
        respondent_lawyer: respAdv?.trim() || null,
        court_room_no: courtNo,
        court_location: courtLocation,
        list_type: listType,
        date: date,
        status: 'pending',
      });
      continue;
    }
    
    // Try numbered pattern
    const numberedMatch = line.match(numberedPattern);
    if (numberedMatch) {
      // Save previous entry if exists
      if (currentEntry && currentEntry.case_number) {
        entries.push({
          item_no: currentEntry.item_no || ++itemCounter,
          case_number: currentEntry.case_number,
          petitioner: currentEntry.petitioner || null,
          respondent: currentEntry.respondent || null,
          petitioner_lawyer: currentEntry.petitioner_lawyer || null,
          respondent_lawyer: currentEntry.respondent_lawyer || null,
          court_room_no: courtNo,
          court_location: courtLocation,
          list_type: listType,
          date: date,
          status: 'pending',
        });
      }
      
      currentEntry = {
        item_no: parseInt(numberedMatch[1]),
        case_number: numberedMatch[2].trim(),
      };
      
      // Check if party names are on same line
      const partyMatch = line.match(partyPattern);
      if (partyMatch) {
        currentEntry.petitioner = partyMatch[1].trim();
        currentEntry.respondent = partyMatch[2].trim();
      }
      
      // Check for advocates on same line
      for (const pattern of advocatePatterns) {
        pattern.lastIndex = 0;
        const advMatches = [...line.matchAll(pattern)];
        if (advMatches.length > 0 && !currentEntry.petitioner_lawyer) {
          currentEntry.petitioner_lawyer = advMatches[0][1].trim();
        }
        if (advMatches.length > 1 && !currentEntry.respondent_lawyer) {
          currentEntry.respondent_lawyer = advMatches[1][1].trim();
        }
      }
      
      continue;
    }
    
    // If we have a current entry, try to extract more info from this line
    if (currentEntry) {
      // Try to find case number if not set
      if (!currentEntry.case_number) {
        const caseMatch = line.match(caseNumberPattern);
        if (caseMatch) {
          currentEntry.case_number = caseMatch[0].trim();
        }
      }
      
      // Try to find party names
      if (!currentEntry.petitioner) {
        const partyMatch = line.match(partyPattern);
        if (partyMatch) {
          currentEntry.petitioner = partyMatch[1].trim();
          currentEntry.respondent = partyMatch[2].trim();
        }
      }
      
      // Try to find advocate names
      for (const pattern of advocatePatterns) {
        pattern.lastIndex = 0;
        const advMatches = [...line.matchAll(pattern)];
        if (advMatches.length > 0 && !currentEntry.petitioner_lawyer) {
          currentEntry.petitioner_lawyer = advMatches[0][1].trim();
        }
        if (advMatches.length > 1 && !currentEntry.respondent_lawyer) {
          currentEntry.respondent_lawyer = advMatches[1][1].trim();
        }
      }
    }
    
    // Try to detect a new entry by case number alone
    if (!currentEntry || !currentEntry.case_number) {
      caseNumberPattern.lastIndex = 0;
      const caseMatches = [...line.matchAll(caseNumberPattern)];
      if (caseMatches.length > 0) {
        // Save previous
        if (currentEntry && currentEntry.case_number) {
          entries.push({
            item_no: currentEntry.item_no || ++itemCounter,
            case_number: currentEntry.case_number,
            petitioner: currentEntry.petitioner || null,
            respondent: currentEntry.respondent || null,
            petitioner_lawyer: currentEntry.petitioner_lawyer || null,
            respondent_lawyer: currentEntry.respondent_lawyer || null,
            court_room_no: courtNo,
            court_location: courtLocation,
            list_type: listType,
            date: date,
            status: 'pending',
          });
        }
        
        currentEntry = {
          item_no: ++itemCounter,
          case_number: caseMatches[0][0].trim(),
        };
      }
    }
  }
  
  // Don't forget the last entry
  if (currentEntry && currentEntry.case_number) {
    entries.push({
      item_no: currentEntry.item_no || ++itemCounter,
      case_number: currentEntry.case_number,
      petitioner: currentEntry.petitioner || null,
      respondent: currentEntry.respondent || null,
      petitioner_lawyer: currentEntry.petitioner_lawyer || null,
      respondent_lawyer: currentEntry.respondent_lawyer || null,
      court_room_no: courtNo,
      court_location: courtLocation,
      list_type: listType,
      date: date,
      status: 'pending',
    });
  }
  
  console.log(`[scrape-causelist] Parsed ${entries.length} entries from PDF`);
  return entries;
}

// Log scraper run to database
async function logScraperRun(supabase: any, log: ScraperLog): Promise<void> {
  try {
    await supabase.from('scraper_logs').insert(log);
    console.log(`[scrape-causelist] Logged: ${log.status}, ${log.cases_found} cases`);
  } catch (err) {
    console.error('[scrape-causelist] Failed to log scraper run:', err);
  }
}

// Submit form to court website and get PDF links
async function submitFormAndGetPdfLinks(
  baseUrl: string, 
  targetDate: string,
  firecrawlApiKey: string
): Promise<string[]> {
  // Parse date parts as integers to remove zero-padding
  // "2025-12-05" -> day="5", month="12", year="2025"
  const dateParts = targetDate.split('-');
  const year = dateParts[0];
  const month = String(parseInt(dateParts[1], 10)); // "12" stays "12"
  const day = String(parseInt(dateParts[2], 10));   // "05" becomes "5"
  
  console.log(`[scrape-causelist] ==========================================`);
  console.log(`[scrape-causelist] Form submission for date: ${day}/${month}/${year}`);
  console.log(`[scrape-causelist] Target URL: ${baseUrl}`);
  console.log(`[scrape-causelist] ==========================================`);
  
  // Method 1: Try direct POST with form data
  try {
    console.log(`[scrape-causelist] Method 1: Direct POST...`);
    const formData = new URLSearchParams({
      day: day,
      month: month,
      year: year,
    });
    
    console.log(`[scrape-causelist] POST body: ${formData.toString()}`);
    
    const postResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formData.toString(),
    });
    
    console.log(`[scrape-causelist] POST response status: ${postResponse.status}`);
    
    if (postResponse.ok) {
      const html = await postResponse.text();
      console.log(`[scrape-causelist] POST HTML length: ${html.length} chars`);
      
      // Log a snippet of the response to debug
      const snippet = html.substring(0, 500);
      console.log(`[scrape-causelist] HTML snippet: ${snippet.replace(/\n/g, ' ').substring(0, 200)}...`);
      
      const pdfLinks = extractPdfLinksFromHtml(html, baseUrl);
      if (pdfLinks.length > 0) {
        console.log(`[scrape-causelist] ✅ Got ${pdfLinks.length} PDF links from POST`);
        return pdfLinks;
      } else {
        console.log(`[scrape-causelist] No PDF links found in POST response`);
      }
    }
  } catch (err) {
    console.log(`[scrape-causelist] ❌ Direct POST failed: ${err}`);
  }
  
  // Method 2: Use Firecrawl with actions to fill and submit form
  console.log(`[scrape-causelist] Method 2: Firecrawl with form actions...`);
  
  try {
    const actions = [
      { type: 'select', selector: '#day', value: day },
      { type: 'select', selector: '#month', value: month },
      { type: 'select', selector: '#year', value: year },
      { type: 'click', selector: 'button[type="submit"]' },
      { type: 'wait', milliseconds: 8000 }, // Increased wait for PDF generation
    ];
    
    console.log(`[scrape-causelist] Firecrawl actions:`, JSON.stringify(actions));
    
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: baseUrl,
        formats: ['markdown', 'links', 'html'],
        waitFor: 5000,
        actions: actions,
      }),
    });
    
    console.log(`[scrape-causelist] Firecrawl response status: ${firecrawlResponse.status}`);
    
    if (firecrawlResponse.ok) {
      const data = await firecrawlResponse.json();
      const html = data.data?.html || '';
      const links = data.data?.links || [];
      
      console.log(`[scrape-causelist] Firecrawl HTML length: ${html.length} chars`);
      console.log(`[scrape-causelist] Firecrawl links count: ${links.length}`);
      
      // Extract PDF links from both HTML and links array
      let pdfLinks = extractPdfLinksFromHtml(html, baseUrl);
      
      // Also check the links array
      const linksPdfs = links.filter((link: string) => 
        link.toLowerCase().endsWith('.pdf')
      );
      
      console.log(`[scrape-causelist] PDFs from HTML: ${pdfLinks.length}, PDFs from links: ${linksPdfs.length}`);
      
      pdfLinks = [...new Set([...pdfLinks, ...linksPdfs])];
      
      if (pdfLinks.length > 0) {
        console.log(`[scrape-causelist] ✅ Got ${pdfLinks.length} PDF links from Firecrawl actions`);
        return pdfLinks;
      } else {
        console.log(`[scrape-causelist] No PDF links found in Firecrawl response`);
        // Log HTML snippet for debugging
        const snippet = html.substring(0, 300);
        console.log(`[scrape-causelist] HTML snippet: ${snippet.replace(/\n/g, ' ').substring(0, 200)}...`);
      }
    } else {
      const errorText = await firecrawlResponse.text();
      console.log(`[scrape-causelist] Firecrawl error: ${errorText}`);
    }
  } catch (err) {
    console.log(`[scrape-causelist] ❌ Firecrawl actions failed: ${err}`);
  }
  
  // Method 3: Try constructing PDF URLs directly based on known patterns
  console.log(`[scrape-causelist] Method 3: Trying direct PDF URL construction...`);
  
  try {
    // Known URL patterns for Rajasthan HC cause lists
    const pdfBaseUrl = baseUrl.replace(/\/$/, '');
    const possiblePatterns = [
      `${pdfBaseUrl}/pdfs/${year}${month.padStart(2, '0')}${day.padStart(2, '0')}/`,
      `${pdfBaseUrl}/pdf/${day}${month}${year}/`,
      `${pdfBaseUrl}/${day}-${month}-${year}/`,
    ];
    
    console.log(`[scrape-causelist] Checking URL patterns:`, possiblePatterns);
    
    // First, just try scraping the base page without form submission
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: baseUrl,
        formats: ['links', 'html'],
        waitFor: 3000,
      }),
    });
    
    if (firecrawlResponse.ok) {
      const data = await firecrawlResponse.json();
      const html = data.data?.html || '';
      const links = data.data?.links || [];
      
      console.log(`[scrape-causelist] Fallback HTML length: ${html.length} chars`);
      
      let pdfLinks = extractPdfLinksFromHtml(html, baseUrl);
      const linksPdfs = links.filter((link: string) => 
        link.toLowerCase().endsWith('.pdf')
      );
      
      pdfLinks = [...new Set([...pdfLinks, ...linksPdfs])];
      
      if (pdfLinks.length > 0) {
        console.log(`[scrape-causelist] ✅ Fallback got ${pdfLinks.length} PDF links`);
        return pdfLinks;
      }
    }
  } catch (err) {
    console.log(`[scrape-causelist] ❌ Fallback scrape failed: ${err}`);
  }
  
  console.log(`[scrape-causelist] ⚠️ All methods failed to find PDF links`);
  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { 
      action, 
      bench = 'JAIPUR', 
      date, 
      court_no = '1', 
      url, 
      list_type = 'DAILY' 
    } = await req.json() as ScrapeRequest;
    
    const targetDate = date || getSmartTargetDate();
    
    console.log(`[scrape-causelist] ========================================`);
    console.log(`[scrape-causelist] Action: ${action}, Bench: ${bench}`);
    console.log(`[scrape-causelist] Date: ${targetDate}, Court: ${court_no}, List: ${list_type}`);
    console.log(`[scrape-causelist] ========================================`);
    
    const baseUrls: Record<string, string> = {
      'JAIPUR': 'https://hcraj.nic.in/quick-causelist-jp/',
      'JODHPUR': 'https://hcraj.nic.in/quick-causelist-jdp/',
    };
    
    const targetUrl = url || baseUrls[bench];
    
    if (!targetUrl) {
      await logScraperRun(supabase, {
        bench,
        status: 'failed',
        cases_found: 0,
        error_message: 'Invalid bench specified',
        list_type,
        court_no,
      });
      
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid bench specified' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!firecrawlApiKey) {
      await logScraperRun(supabase, {
        bench,
        status: 'failed',
        cases_found: 0,
        error_message: 'Firecrawl API key not configured',
        list_type,
        court_no,
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Firecrawl API key not configured.',
          needs_firecrawl: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // STEP 1: Submit form to get PDF links
    console.log(`[scrape-causelist] STEP 1: Getting PDF links from ${targetUrl}`);
    const pdfLinks = await submitFormAndGetPdfLinks(targetUrl, targetDate, firecrawlApiKey);
    
    console.log(`[scrape-causelist] Found ${pdfLinks.length} PDF links:`);
    pdfLinks.forEach((link, i) => console.log(`  ${i + 1}. ${link}`));
    
    // STEP 2: Scrape and parse each PDF
    let allEntries: CauseListEntry[] = [];
    const pdfResults: { url: string; entries: number; error?: string }[] = [];
    
    if (pdfLinks.length > 0) {
      console.log(`[scrape-causelist] STEP 2: Scraping ${pdfLinks.length} PDFs...`);
      
      for (const pdfUrl of pdfLinks) {
        try {
          // Extract court number from URL
          const pdfCourtNo = extractCourtNoFromUrl(pdfUrl);
          
          // Scrape PDF content
          const pdfContent = await scrapePdfWithFirecrawl(pdfUrl, firecrawlApiKey);
          
          if (pdfContent.length < 100) {
            console.log(`[scrape-causelist] PDF ${pdfUrl} has very little content, skipping`);
            pdfResults.push({ url: pdfUrl, entries: 0, error: 'Empty or minimal content' });
            continue;
          }
          
          // Detect list type from URL/content
          const detectedListType = detectListType(pdfUrl, pdfContent);
          
          // Parse the PDF content
          const entries = parseCauseListPdf(
            pdfContent, 
            bench, 
            pdfCourtNo, 
            targetDate, 
            detectedListType
          );
          
          console.log(`[scrape-causelist] Parsed ${entries.length} entries from ${pdfUrl}`);
          pdfResults.push({ url: pdfUrl, entries: entries.length });
          
          allEntries = allEntries.concat(entries);
          
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[scrape-causelist] Failed to process PDF ${pdfUrl}: ${errorMsg}`);
          pdfResults.push({ url: pdfUrl, entries: 0, error: errorMsg });
        }
      }
    }
    
    console.log(`[scrape-causelist] Total entries parsed: ${allEntries.length}`);
    
    // If preview mode, return the parsed data without inserting
    if (action === 'preview') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          entries: allEntries,
          pdf_links: pdfLinks,
          pdf_results: pdfResults,
          target_date: targetDate,
          message: `Found ${pdfLinks.length} PDFs with ${allEntries.length} total case entries`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // STEP 3: Insert entries into database
    if (allEntries.length > 0) {
      console.log(`[scrape-causelist] STEP 3: Inserting ${allEntries.length} entries into database...`);
      
      let inserted = 0;
      let updated = 0;
      let errors = 0;
      
      for (const entry of allEntries) {
        try {
          // Check if entry exists
          const { data: existing } = await supabase
            .from('daily_court_docket')
            .select('id')
            .eq('case_number', entry.case_number)
            .eq('date', entry.date)
            .eq('court_room_no', entry.court_room_no)
            .eq('list_type', entry.list_type)
            .single();
          
          if (existing) {
            // Update existing
            const { error: updateError } = await supabase
              .from('daily_court_docket')
              .update({
                petitioner_lawyer: entry.petitioner_lawyer,
                respondent_lawyer: entry.respondent_lawyer,
                petitioner: entry.petitioner,
                respondent: entry.respondent,
                item_no: entry.item_no,
              })
              .eq('id', existing.id);
            
            if (updateError) {
              console.error(`[scrape-causelist] Update error: ${updateError.message}`);
              errors++;
            } else {
              updated++;
            }
          } else {
            // Insert new
            const { error: insertError } = await supabase
              .from('daily_court_docket')
              .insert(entry);
            
            if (insertError) {
              console.error(`[scrape-causelist] Insert error: ${insertError.message}`);
              errors++;
            } else {
              inserted++;
            }
          }
        } catch (err) {
          console.error(`[scrape-causelist] DB operation error:`, err);
          errors++;
        }
      }
      
      console.log(`[scrape-causelist] Database results: ${inserted} inserted, ${updated} updated, ${errors} errors`);
      
      await logScraperRun(supabase, {
        bench,
        status: errors > 0 ? 'partial' : 'success',
        cases_found: allEntries.length,
        error_message: errors > 0 ? `${errors} database errors` : null,
        list_type,
        court_no,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Processed ${allEntries.length} entries: ${inserted} inserted, ${updated} updated, ${errors} errors`,
          entries_count: allEntries.length,
          inserted,
          updated,
          errors,
          pdf_links: pdfLinks,
          pdf_results: pdfResults,
          target_date: targetDate,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // No entries found
    console.log(`[scrape-causelist] No entries found`);
    
    await logScraperRun(supabase, {
      bench,
      status: 'warning',
      cases_found: 0,
      error_message: pdfLinks.length > 0 
        ? 'PDFs found but could not parse entries - possible format change'
        : 'No PDF links found - form submission may have failed',
      list_type,
      court_no,
    });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: pdfLinks.length > 0 
          ? 'Found PDFs but could not extract case entries. The PDF format may have changed.'
          : 'No PDF links found. The website form submission may have failed.',
        entries_count: 0,
        pdf_links: pdfLinks,
        pdf_results: pdfResults,
        target_date: targetDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[scrape-causelist] Unhandled error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logScraperRun(supabase, {
      bench: 'UNKNOWN',
      status: 'failed',
      cases_found: 0,
      error_message: errorMessage,
      list_type: 'DAILY',
      court_no: null,
    });
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
