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
  court_room_no: string;
  court_location: string;
  list_type: string;
  date: string;
}

interface ScrapeRequest {
  action: 'scrape' | 'preview' | 'scrape_url';
  bench?: 'JAIPUR' | 'JODHPUR';
  date?: string;
  court_no?: string;
  url?: string;
}

// Parse cause list text to extract case entries
function parseCauseListText(text: string, courtLocation: string, courtNo: string, date: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  // Common patterns in cause lists:
  // Item No. | Case Number | Petitioner vs Respondent | Advocates
  const lines = text.split('\n').filter(line => line.trim());
  
  let currentEntry: Partial<CauseListEntry> | null = null;
  let itemNoPattern = /^\s*(\d+)\s*[.\)]/;
  let casePattern = /([A-Z][A-Z\s.]+(?:No\.?|NUMBER)?[\s]*[\d\/]+)/i;
  let advocatePattern = /(?:Adv\.?|Advocate|Mr\.?|Ms\.?|Shri|Smt\.?)\s*([A-Za-z\s.]+)/gi;
  
  for (const line of lines) {
    // Check if this is a new item number
    const itemMatch = line.match(itemNoPattern);
    if (itemMatch) {
      // Save previous entry if exists
      if (currentEntry && currentEntry.item_no && currentEntry.case_number) {
        entries.push({
          item_no: currentEntry.item_no,
          case_number: currentEntry.case_number || 'Unknown',
          petitioner_lawyer: currentEntry.petitioner_lawyer || null,
          respondent_lawyer: currentEntry.respondent_lawyer || null,
          court_room_no: courtNo,
          court_location: courtLocation,
          list_type: 'DAILY',
          date: date,
        });
      }
      
      currentEntry = {
        item_no: parseInt(itemMatch[1]),
        court_room_no: courtNo,
        court_location: courtLocation,
        date: date,
      };
    }
    
    // Try to extract case number
    if (currentEntry && !currentEntry.case_number) {
      const caseMatch = line.match(casePattern);
      if (caseMatch) {
        currentEntry.case_number = caseMatch[1].trim();
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
      court_room_no: courtNo,
      court_location: courtLocation,
      list_type: 'DAILY',
      date: date,
    });
  }
  
  return entries;
}

// Alternative: Parse structured HTML/markdown from Firecrawl
function parseFirecrawlMarkdown(markdown: string, courtLocation: string, courtNo: string, date: string): CauseListEntry[] {
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
        court_room_no: courtNo,
        court_location: courtLocation,
        list_type: 'DAILY',
        date: date,
      });
    }
  }
  
  // If no table found, try line-by-line parsing
  if (entries.length === 0) {
    return parseCauseListText(markdown, courtLocation, courtNo, date);
  }
  
  return entries;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, bench = 'JAIPUR', date, court_no = '1', url } = await req.json() as ScrapeRequest;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`[scrape-causelist] Action: ${action}, Bench: ${bench}, Date: ${targetDate}, Court: ${court_no}`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Determine the cause list URL based on bench
    const baseUrls: Record<string, string> = {
      'JAIPUR': 'https://hcraj.nic.in/quick-causelist-jp/',
      'JODHPUR': 'https://hcraj.nic.in/quick-causelist-jdp/',
    };
    
    const targetUrl = url || baseUrls[bench];
    
    if (!targetUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid bench specified' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if Firecrawl is configured
    if (!firecrawlApiKey) {
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
        waitFor: 3000, // Wait for dynamic content
      }),
    });

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      console.error(`[scrape-causelist] Firecrawl error: ${errorText}`);
      return new Response(
        JSON.stringify({ success: false, error: `Firecrawl scrape failed: ${errorText}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const firecrawlData = await firecrawlResponse.json();
    console.log(`[scrape-causelist] Firecrawl response received, parsing...`);
    
    const markdown = firecrawlData.data?.markdown || '';
    const links = firecrawlData.data?.links || [];
    
    // Find PDF links in the page
    const pdfLinks = links.filter((link: string) => 
      link.toLowerCase().includes('.pdf') || 
      link.toLowerCase().includes('causelist') ||
      link.toLowerCase().includes('court')
    );
    
    console.log(`[scrape-causelist] Found ${pdfLinks.length} potential cause list links`);
    
    // Parse the markdown content for case entries
    const entries = parseFirecrawlMarkdown(markdown, bench, court_no, targetDate);
    
    console.log(`[scrape-causelist] Parsed ${entries.length} entries from page content`);
    
    // If preview mode, just return the parsed data
    if (action === 'preview') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          entries,
          pdf_links: pdfLinks,
          raw_content_preview: markdown.substring(0, 2000),
          message: `Found ${entries.length} case entries and ${pdfLinks.length} PDF links`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Insert entries into database
    if (entries.length > 0) {
      // Use upsert to avoid duplicates
      const { data: insertedData, error: insertError } = await supabase
        .from('daily_court_docket')
        .upsert(
          entries.map(entry => ({
            item_no: entry.item_no,
            case_number: entry.case_number,
            petitioner_lawyer: entry.petitioner_lawyer,
            respondent_lawyer: entry.respondent_lawyer,
            court_room_no: entry.court_room_no,
            court_location: entry.court_location,
            list_type: entry.list_type,
            date: entry.date,
          })),
          { 
            onConflict: 'case_number,date,court_room_no',
            ignoreDuplicates: false 
          }
        )
        .select();

      if (insertError) {
        // If upsert fails due to missing unique constraint, try individual inserts
        console.log(`[scrape-causelist] Upsert failed, trying individual inserts: ${insertError.message}`);
        
        let inserted = 0;
        let skipped = 0;
        
        for (const entry of entries) {
          // Check if entry exists
          const { data: existing } = await supabase
            .from('daily_court_docket')
            .select('id')
            .eq('case_number', entry.case_number)
            .eq('date', entry.date)
            .eq('court_room_no', entry.court_room_no)
            .single();
          
          if (existing) {
            // Update existing
            await supabase
              .from('daily_court_docket')
              .update({
                petitioner_lawyer: entry.petitioner_lawyer,
                respondent_lawyer: entry.respondent_lawyer,
                item_no: entry.item_no,
              })
              .eq('id', existing.id);
            skipped++;
          } else {
            // Insert new
            const { error: singleInsertError } = await supabase
              .from('daily_court_docket')
              .insert(entry);
            
            if (!singleInsertError) {
              inserted++;
            } else {
              console.error(`[scrape-causelist] Failed to insert: ${singleInsertError.message}`);
            }
          }
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Processed ${entries.length} entries: ${inserted} inserted, ${skipped} updated`,
            entries_count: entries.length,
            inserted,
            updated: skipped,
            pdf_links: pdfLinks
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Successfully inserted ${insertedData?.length || entries.length} cause list entries`,
          entries_count: insertedData?.length || entries.length,
          pdf_links: pdfLinks
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
        suggestion: 'Try downloading the PDF links and uploading manually, or specify a direct PDF URL.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[scrape-causelist] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
