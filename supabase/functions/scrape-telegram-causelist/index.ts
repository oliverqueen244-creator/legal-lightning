import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Telegram channel for Rajasthan High Court
const CHANNEL_URL = 'https://t.me/s/hcrajtc';

interface CauselistInfo {
  bench: 'JAIPUR' | 'JODHPUR';
  court_no: string;
  list_type: 'DAILY' | 'SUPPLEMENTARY';
  date: string;
  pdf_url: string;
  message_text: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!firecrawlKey) {
      console.error('[telegram-causelist] FIRECRAWL_API_KEY not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'FIRECRAWL_API_KEY not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action = 'scrape', date } = body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    console.log(`[telegram-causelist] Action: ${action}, Date: ${targetDate}`);

    if (action === 'scrape') {
      // Use Firecrawl to scrape the public Telegram channel with JS rendering
      console.log(`[telegram-causelist] Scraping channel: ${CHANNEL_URL}`);
      
      const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: CHANNEL_URL,
          formats: ['markdown', 'html', 'links'],
          waitFor: 5000, // Wait for JS to load
          timeout: 60000,
        })
      });

      const firecrawlData = await firecrawlResponse.json();
      
      if (!firecrawlResponse.ok || !firecrawlData.success) {
        console.error('[telegram-causelist] Firecrawl error:', firecrawlData);
        return new Response(JSON.stringify({
          success: false,
          error: firecrawlData.error || 'Failed to scrape Telegram channel'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const html = firecrawlData.data?.html || '';
      const markdown = firecrawlData.data?.markdown || '';
      const links = firecrawlData.data?.links || [];

      console.log(`[telegram-causelist] Scraped HTML length: ${html.length}, Links: ${links.length}`);

      // Parse messages and find PDF links
      const causelists = parseChannelContent(html, markdown, links, targetDate);
      console.log(`[telegram-causelist] Found ${causelists.length} causelists`);

      // Process each causelist PDF
      let totalCases = 0;
      const errors: string[] = [];
      const processedCauselists: CauselistInfo[] = [];

      for (const causelist of causelists) {
        try {
          console.log(`[telegram-causelist] Processing: ${causelist.bench} Court ${causelist.court_no} - ${causelist.pdf_url}`);
          
          // Download and parse the PDF using Firecrawl
          const cases = await processCauselistPdf(
            causelist,
            supabase,
            firecrawlKey,
            openRouterKey || lovableApiKey,
            targetDate
          );
          
          totalCases += cases;
          processedCauselists.push(causelist);
          console.log(`[telegram-causelist] Processed ${cases} cases from ${causelist.bench} Court ${causelist.court_no}`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${causelist.bench} Court ${causelist.court_no}: ${errMsg}`);
          console.error(`[telegram-causelist] Error:`, errMsg);
        }
      }

      // Log the scraper run
      await supabase.from('scraper_logs').insert({
        bench: 'TELEGRAM',
        status: causelists.length === 0 ? 'warning' : (errors.length === 0 ? 'success' : (totalCases > 0 ? 'partial' : 'failed')),
        cases_found: totalCases,
        list_type: 'DAILY',
        error_message: errors.length > 0 ? errors.join('; ') : (causelists.length === 0 ? 'No causelists found in channel' : null)
      });

      return new Response(JSON.stringify({
        success: true,
        channel: CHANNEL_URL,
        causelists_found: causelists.length,
        causelists: processedCauselists.map(c => ({
          bench: c.bench,
          court_no: c.court_no,
          list_type: c.list_type,
          pdf_url: c.pdf_url
        })),
        cases_processed: totalCases,
        errors: errors.length > 0 ? errors : undefined,
        duration_ms: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'test') {
      // Test scraping the channel
      const testResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: CHANNEL_URL,
          formats: ['markdown', 'links'],
          waitFor: 3000,
        })
      });

      const testData = await testResponse.json();
      
      return new Response(JSON.stringify({
        success: testData.success,
        message: testData.success ? 'Successfully scraped Telegram channel' : 'Failed to scrape channel',
        markdown_preview: testData.data?.markdown?.substring(0, 500),
        links_found: testData.data?.links?.length || 0,
        sample_links: testData.data?.links?.slice(0, 10)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Invalid action. Use "scrape" or "test"'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[telegram-causelist] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function parseChannelContent(
  html: string,
  markdown: string,
  links: string[],
  targetDate: string
): CauselistInfo[] {
  const causelists: CauselistInfo[] = [];
  const seenUrls = new Set<string>();

  // Find PDF links from the links array
  const pdfLinks = links.filter(link => 
    link.includes('.pdf') || 
    link.includes('causelist') ||
    link.includes('cause_list') ||
    link.includes('hcraj.nic.in')
  );

  console.log(`[telegram-causelist] Found ${pdfLinks.length} potential PDF links`);

  // Parse message blocks from HTML to get context for each PDF
  const messageBlocks = html.match(/<div class="tgme_widget_message[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];
  
  for (const block of messageBlocks) {
    // Extract message text
    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const messageText = textMatch ? 
      textMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim() : '';

    // Extract links from this message block
    const blockLinks = block.match(/href=["']([^"']+)["']/gi) || [];
    const blockUrls = blockLinks
      .map(l => l.match(/href=["']([^"']+)["']/i)?.[1])
      .filter(Boolean) as string[];

    // Find PDF URLs in this block
    for (const url of blockUrls) {
      if (seenUrls.has(url)) continue;
      
      if (url.includes('.pdf') || url.includes('causelist')) {
        seenUrls.add(url);
        
        const info = extractCauselistInfo(messageText, url, targetDate);
        if (info) {
          causelists.push(info);
        }
      }
    }

    // Also check for document attachments (Telegram files)
    const docMatch = block.match(/href=["']([^"']*(?:cdn|telesco\.pe|tgstat)[^"']*)["']/i);
    if (docMatch && docMatch[1] && !seenUrls.has(docMatch[1])) {
      seenUrls.add(docMatch[1]);
      const info = extractCauselistInfo(messageText, docMatch[1], targetDate);
      if (info) {
        causelists.push(info);
      }
    }
  }

  // Also process standalone PDF links not in message blocks
  for (const url of pdfLinks) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    
    const info = extractCauselistInfo('', url, targetDate);
    if (info) {
      causelists.push(info);
    }
  }

  return causelists;
}

function extractCauselistInfo(
  messageText: string,
  pdfUrl: string,
  targetDate: string
): CauselistInfo | null {
  const lowerText = messageText.toLowerCase();
  const lowerUrl = pdfUrl.toLowerCase();
  
  // Determine bench from text or URL
  let bench: 'JAIPUR' | 'JODHPUR' = 'JAIPUR';
  if (lowerText.includes('jodhpur') || lowerText.includes('जोधपुर') || 
      lowerUrl.includes('jodh') || lowerUrl.includes('jdp')) {
    bench = 'JODHPUR';
  } else if (lowerText.includes('jaipur') || lowerText.includes('जयपुर') ||
             lowerUrl.includes('jaip') || lowerUrl.includes('jp')) {
    bench = 'JAIPUR';
  }
  
  // Determine list type
  let list_type: 'DAILY' | 'SUPPLEMENTARY' = 'DAILY';
  if (lowerText.includes('supp') || lowerText.includes('अनुपूरक') ||
      lowerUrl.includes('supp')) {
    list_type = 'SUPPLEMENTARY';
  }
  
  // Extract court number from text or URL
  let court_no = '1';
  const courtMatch = messageText.match(/court\s*(?:no\.?)?\s*[:\-]?\s*(\d+)/i) ||
                     messageText.match(/कोर्ट\s*(?:नं\.?)?\s*[:\-]?\s*(\d+)/i) ||
                     pdfUrl.match(/_(\d+)\.pdf$/i) ||
                     pdfUrl.match(/court[-_]?(\d+)/i);
  if (courtMatch) {
    court_no = courtMatch[1];
  }
  
  // Extract date from message or URL if available
  let date = targetDate;
  const dateMatch = messageText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/) ||
                    pdfUrl.match(/(\d{2})(\d{2})(\d{4})/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
    date = `${year}-${month}-${day}`;
  }

  return {
    bench,
    court_no,
    list_type,
    date,
    pdf_url: pdfUrl,
    message_text: messageText.substring(0, 200)
  };
}

async function processCauselistPdf(
  causelist: CauselistInfo,
  supabase: any,
  firecrawlKey: string,
  aiApiKey: string | undefined,
  targetDate: string
): Promise<number> {
  // Use Firecrawl to extract content from the PDF
  const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: causelist.pdf_url,
      formats: ['markdown'],
      timeout: 60000,
    })
  });

  const scrapeData = await scrapeResponse.json();
  
  if (!scrapeData.success) {
    console.log(`[telegram-causelist] Could not scrape PDF directly, trying alternative approach`);
    // PDF might need different handling - store the URL for manual processing
    return 0;
  }

  const pdfContent = scrapeData.data?.markdown || '';
  console.log(`[telegram-causelist] PDF content length: ${pdfContent.length}`);

  if (pdfContent.length < 100) {
    console.log(`[telegram-causelist] PDF content too short, skipping`);
    return 0;
  }

  // Parse cases from the PDF content
  const cases = parseCasesFromPdfContent(pdfContent, causelist);
  
  // Insert cases into database
  let insertedCount = 0;
  for (const caseItem of cases) {
    const { error } = await supabase
      .from('daily_court_docket')
      .upsert({
        date: causelist.date,
        court_location: causelist.bench,
        court_room_no: causelist.court_no,
        list_type: causelist.list_type,
        item_no: caseItem.item_no,
        case_number: caseItem.case_number,
        petitioner: caseItem.petitioner,
        respondent: caseItem.respondent,
        petitioner_lawyer: caseItem.petitioner_lawyer,
        respondent_lawyer: caseItem.respondent_lawyer,
        source_url: causelist.pdf_url,
        status: 'pending'
      }, {
        onConflict: 'date,court_location,court_room_no,item_no',
        ignoreDuplicates: false
      });

    if (!error) {
      insertedCount++;
    }
  }

  return insertedCount;
}

interface ParsedCase {
  item_no: number;
  case_number: string;
  petitioner: string | null;
  respondent: string | null;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
}

function parseCasesFromPdfContent(content: string, causelist: CauselistInfo): ParsedCase[] {
  const cases: ParsedCase[] = [];
  const lines = content.split('\n');

  // Common patterns in causelists:
  // "1. D.B. Civil Misc. Appeal No. 1234/2024 - Petitioner vs Respondent"
  // "| 1 | SBCWP/1234/2024 | ABC | XYZ | Adv. Name1 | Adv. Name2 |"
  
  let currentItemNo = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Pattern 1: Numbered list format
    const numberedMatch = line.match(/^(\d+)[\.\)\s]+(.+)/);
    if (numberedMatch) {
      currentItemNo = parseInt(numberedMatch[1], 10);
      const restOfLine = numberedMatch[2];
      
      // Extract case number
      const caseNoMatch = restOfLine.match(/([A-Z\.]+\s*(?:No\.)?\s*\d+\/\d+)/i);
      if (caseNoMatch) {
        cases.push({
          item_no: currentItemNo,
          case_number: caseNoMatch[1].trim(),
          petitioner: null,
          respondent: null,
          petitioner_lawyer: null,
          respondent_lawyer: null
        });
      }
      continue;
    }

    // Pattern 2: Table format with pipes
    if (line.includes('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2) {
        const itemNoMatch = cells[0].match(/(\d+)/);
        if (itemNoMatch) {
          const itemNo = parseInt(itemNoMatch[1], 10);
          const caseNumber = cells[1] || '';
          
          // Skip header rows
          if (caseNumber.toLowerCase().includes('case') || caseNumber.toLowerCase().includes('item')) {
            continue;
          }
          
          cases.push({
            item_no: itemNo,
            case_number: caseNumber,
            petitioner: cells[2] || null,
            respondent: cells[3] || null,
            petitioner_lawyer: cells[4] || null,
            respondent_lawyer: cells[5] || null
          });
        }
      }
    }
  }

  console.log(`[telegram-causelist] Parsed ${cases.length} cases from PDF content`);
  return cases;
}
