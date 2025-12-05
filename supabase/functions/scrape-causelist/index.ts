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
  // Convert to IST (UTC + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  const istHour = istTime.getUTCHours();
  
  // If after 6 PM IST (18:00), target tomorrow
  if (istHour >= 18) {
    const tomorrow = new Date(istTime);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  return istTime.toISOString().split('T')[0];
}

// Parse cause list text to extract case entries
function parseCauseListText(text: string, courtLocation: string, courtNo: string, date: string, listType: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  const lines = text.split('\n').filter(line => line.trim());
  
  let currentEntry: Partial<CauseListEntry> | null = null;
  const itemNoPattern = /^\s*(\d+)\s*[.\)]/;
  const casePattern = /([A-Z][A-Z\s.]+(?:No\.?|NUMBER)?[\s]*[\d\/]+)/i;
  const advocatePattern = /(?:Adv\.?|Advocate|Mr\.?|Ms\.?|Shri|Smt\.?)\s*([A-Za-z\s.]+)/gi;
  const partyPattern = /([A-Za-z\s.]+)\s+(?:Vs\.?|vs\.?|V\/s\.?|versus)\s+([A-Za-z\s.]+)/i;
  
  for (const line of lines) {
    const itemMatch = line.match(itemNoPattern);
    if (itemMatch) {
      if (currentEntry && currentEntry.item_no && currentEntry.case_number) {
        entries.push({
          item_no: currentEntry.item_no,
          case_number: currentEntry.case_number || 'Unknown',
          petitioner_lawyer: currentEntry.petitioner_lawyer || null,
          respondent_lawyer: currentEntry.respondent_lawyer || null,
          petitioner: currentEntry.petitioner || null,
          respondent: currentEntry.respondent || null,
          court_room_no: courtNo,
          court_location: courtLocation,
          list_type: listType,
          date: date,
          status: 'pending',
        });
      }
      
      currentEntry = {
        item_no: parseInt(itemMatch[1]),
        court_room_no: courtNo,
        court_location: courtLocation,
        date: date,
        list_type: listType,
        status: 'pending',
      };
    }
    
    // Try to extract case number
    if (currentEntry && !currentEntry.case_number) {
      const caseMatch = line.match(casePattern);
      if (caseMatch) {
        currentEntry.case_number = caseMatch[1].trim();
      }
    }
    
    // Try to extract party names (Petitioner vs Respondent)
    if (currentEntry) {
      const partyMatch = line.match(partyPattern);
      if (partyMatch && !currentEntry.petitioner) {
        currentEntry.petitioner = partyMatch[1].trim();
        currentEntry.respondent = partyMatch[2].trim();
      }
    }
    
    // Try to extract advocate names
    if (currentEntry) {
      const advocates: string[] = [];
      let match;
      while ((match = advocatePattern.exec(line)) !== null) {
        advocates.push(match[1].trim());
      }
      
      if (advocates.length > 0) {
        if (!currentEntry.petitioner_lawyer) {
          currentEntry.petitioner_lawyer = advocates[0];
        }
        if (advocates.length > 1 && !currentEntry.respondent_lawyer) {
          currentEntry.respondent_lawyer = advocates[1];
        }
      }
    }
  }
  
  // Don't forget the last entry
  if (currentEntry && currentEntry.item_no && currentEntry.case_number) {
    entries.push({
      item_no: currentEntry.item_no,
      case_number: currentEntry.case_number || 'Unknown',
      petitioner_lawyer: currentEntry.petitioner_lawyer || null,
      respondent_lawyer: currentEntry.respondent_lawyer || null,
      petitioner: currentEntry.petitioner || null,
      respondent: currentEntry.respondent || null,
      court_room_no: courtNo,
      court_location: courtLocation,
      list_type: listType,
      date: date,
      status: 'pending',
    });
  }
  
  return entries;
}

// Parse structured HTML/markdown from Firecrawl
function parseFirecrawlMarkdown(markdown: string, courtLocation: string, courtNo: string, date: string, listType: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  // Look for table-like structures in markdown
  const tableRowPattern = /\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|/g;
  let match;
  
  while ((match = tableRowPattern.exec(markdown)) !== null) {
    const itemNo = parseInt(match[1]);
    const caseNumber = match[2].trim();
    const petitionerLawyer = match[3].trim() || null;
    const respondentLawyer = match[4].trim() || null;
    
    if (itemNo && caseNumber && caseNumber !== 'Case Number') {
      entries.push({
        item_no: itemNo,
        case_number: caseNumber,
        petitioner_lawyer: petitionerLawyer,
        respondent_lawyer: respondentLawyer,
        petitioner: null,
        respondent: null,
        court_room_no: courtNo,
        court_location: courtLocation,
        list_type: listType,
        date: date,
        status: 'pending',
      });
    }
  }
  
  // If no table found, try line-by-line parsing
  if (entries.length === 0) {
    return parseCauseListText(markdown, courtLocation, courtNo, date, listType);
  }
  
  return entries;
}

// Extract judge names from main page content
function extractJudgeNames(markdown: string, courtNo: string): string | null {
  // Look for patterns like "Court 1 - Hon'ble Justice XYZ"
  const judgePattern = new RegExp(`Court\\s*(?:No\\.?)?\\s*${courtNo}[\\s\\-:]+(?:Hon'?ble\\s+)?(?:Justice\\s+)?([A-Za-z\\s.]+)`, 'i');
  const match = markdown.match(judgePattern);
  return match ? match[1].trim() : null;
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

// Update court metadata with judge names
async function updateCourtMetadata(supabase: any, bench: string, courtNo: string, judgeNames: string | null): Promise<void> {
  if (!judgeNames) return;
  
  try {
    await supabase
      .from('court_metadata')
      .upsert({
        bench,
        court_no: courtNo,
        judge_names: judgeNames,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'bench,court_no',
      });
    console.log(`[scrape-causelist] Updated judge names for ${bench} Court ${courtNo}`);
  } catch (err) {
    console.error('[scrape-causelist] Failed to update court metadata:', err);
  }
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
    
    // Smart date: Use provided date or determine based on IST time
    const targetDate = date || getSmartTargetDate();
    
    console.log(`[scrape-causelist] Action: ${action}, Bench: ${bench}, Date: ${targetDate}, Court: ${court_no}, List: ${list_type}`);
    
    // Determine the cause list URL based on bench
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

    // Check if Firecrawl is configured
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
          error: 'Firecrawl API key not configured. Please connect Firecrawl in workspace settings.',
          needs_firecrawl: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Use Firecrawl to scrape the cause list page
    console.log(`[scrape-causelist] Fetching ${targetUrl} with Firecrawl...`);
    
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ['markdown', 'links'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      console.error(`[scrape-causelist] Firecrawl error: ${errorText}`);
      
      await logScraperRun(supabase, {
        bench,
        status: 'failed',
        cases_found: 0,
        error_message: `Firecrawl scrape failed: ${errorText}`,
        list_type,
        court_no,
      });
      
      return new Response(
        JSON.stringify({ success: false, error: `Firecrawl scrape failed: ${errorText}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const firecrawlData = await firecrawlResponse.json();
    console.log(`[scrape-causelist] Firecrawl response received, parsing...`);
    
    const markdown = firecrawlData.data?.markdown || '';
    const links = firecrawlData.data?.links || [];
    
    // Extract judge names from main page
    const judgeNames = extractJudgeNames(markdown, court_no);
    if (judgeNames) {
      await updateCourtMetadata(supabase, bench, court_no, judgeNames);
    }
    
    // Find PDF links - look for Daily (D) and Supplementary (S) links
    const pdfLinks = links.filter((link: string) => 
      link.toLowerCase().includes('.pdf') || 
      link.toLowerCase().includes('causelist') ||
      link.toLowerCase().includes('court')
    );
    
    // Filter links based on list_type
    const dailyLinks = links.filter((link: string) => 
      link.toLowerCase().includes('/d/') || link.toLowerCase().includes('daily')
    );
    const supplementaryLinks = links.filter((link: string) => 
      link.toLowerCase().includes('/s/') || link.toLowerCase().includes('supplementary')
    );
    
    console.log(`[scrape-causelist] Found ${pdfLinks.length} PDF links, ${dailyLinks.length} daily, ${supplementaryLinks.length} supplementary`);
    
    // Parse the markdown content for case entries
    const entries = parseFirecrawlMarkdown(markdown, bench, court_no, targetDate, list_type);
    
    console.log(`[scrape-causelist] Parsed ${entries.length} entries from page content`);
    
    // WARNING: Zero cases found - possible layout change
    if (entries.length === 0 && action !== 'preview') {
      await logScraperRun(supabase, {
        bench,
        status: 'warning',
        cases_found: 0,
        error_message: 'WARNING: POSSIBLE LAYOUT CHANGE - No structured entries found',
        list_type,
        court_no,
      });
    }
    
    // If preview mode, just return the parsed data
    if (action === 'preview') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          entries,
          pdf_links: pdfLinks,
          daily_links: dailyLinks,
          supplementary_links: supplementaryLinks,
          judge_names: judgeNames,
          target_date: targetDate,
          raw_content_preview: markdown.substring(0, 2000),
          message: `Found ${entries.length} case entries and ${pdfLinks.length} PDF links`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Insert entries into database
    if (entries.length > 0) {
      let inserted = 0;
      let updated = 0;
      
      for (const entry of entries) {
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
          await supabase
            .from('daily_court_docket')
            .update({
              petitioner_lawyer: entry.petitioner_lawyer,
              respondent_lawyer: entry.respondent_lawyer,
              petitioner: entry.petitioner,
              respondent: entry.respondent,
              item_no: entry.item_no,
            })
            .eq('id', existing.id);
          updated++;
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from('daily_court_docket')
            .insert(entry);
          
          if (!insertError) {
            inserted++;
          } else {
            console.error(`[scrape-causelist] Failed to insert: ${insertError.message}`);
          }
        }
      }
      
      await logScraperRun(supabase, {
        bench,
        status: 'success',
        cases_found: entries.length,
        error_message: null,
        list_type,
        court_no,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Processed ${entries.length} entries: ${inserted} inserted, ${updated} updated`,
          entries_count: entries.length,
          inserted,
          updated,
          pdf_links: pdfLinks,
          target_date: targetDate,
          judge_names: judgeNames,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // No entries found, return PDF links for manual download
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'No structured entries found. The cause list may be in PDF format.',
        entries_count: 0,
        pdf_links: pdfLinks,
        daily_links: dailyLinks,
        supplementary_links: supplementaryLinks,
        target_date: targetDate,
        suggestion: 'Try downloading the PDF links and uploading manually, or specify a direct PDF URL.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[scrape-causelist] Error:', error);
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
