import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedCase {
  court_no: string;
  case_number: string;
  item_no: number | null;
  petitioner: string | null;
  respondent: string | null;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
  stage: string | null;
  next_date: string | null;
}

interface ParseRequest {
  causelist_id: string;
  profile_id?: string;
}

// Court name normalization map
const COURT_NORMALIZATION_MAP: Record<string, string> = {
  // Jaipur courts
  'court no. 1': '1',
  'court no. 2': '2',
  'court no. 3': '3',
  'court no. 4': '4',
  'court no. 5': '5',
  'court no. 6': '6',
  'court no. 7': '7',
  'court no. 8': '8',
  'court no. 9': '9',
  'court no. 10': '10',
  'court no. 11': '11',
  'court no. 12': '12',
  'court no. 13': '13',
  'court no. 14': '14',
  'court no. 15': '15',
  'court no. 16': '16',
  'court no. 17': '17',
  'court no. 18': '18',
  'court no. 19': '19',
  'court no. 20': '20',
  'court no. 21': '21',
  'court no. 22': '22',
  'court no. 23': '23',
  'court no. 24': '24',
  'court no. 25': '25',
  'court no. 26': '26',
  'court no. 27': '27',
  'court no. 28': '28',
  'court no. 29': '29',
  'court no. 30': '30',
  // Alternative formats
  'court 1': '1',
  'court 2': '2',
  'court 3': '3',
  'court 4': '4',
  'court 5': '5',
  'court 6': '6',
  'court 7': '7',
  'court 8': '8',
  'court 9': '9',
  'court 10': '10',
  'court 11': '11',
  'court 12': '12',
  'court 13': '13',
  'court 14': '14',
  'court 15': '15',
  'court 16': '16',
  'court 17': '17',
  'court 18': '18',
  'court 19': '19',
  'court 20': '20',
  'court 21': '21',
  'court 22': '22',
  'court 23': '23',
  'court 24': '24',
  'court 25': '25',
  'court 26': '26',
  'court 27': '27',
  'court 28': '28',
  'court 29': '29',
  'court 30': '30',
  // Roman numerals
  'court no. i': '1',
  'court no. ii': '2',
  'court no. iii': '3',
  'court no. iv': '4',
  'court no. v': '5',
  'court no. vi': '6',
  'court no. vii': '7',
  'court no. viii': '8',
  'court no. ix': '9',
  'court no. x': '10',
};

function normalizeCourtNo(courtText: string): string {
  const lower = courtText.toLowerCase().trim();
  
  // Try direct mapping
  if (COURT_NORMALIZATION_MAP[lower]) {
    return COURT_NORMALIZATION_MAP[lower];
  }
  
  // Extract number from text like "Court No. 5" or "5"
  const match = lower.match(/(\d+)/);
  if (match) {
    return match[1];
  }
  
  // Return original if no normalization possible
  console.log(`[COURT-NORM] Could not normalize court: "${courtText}"`);
  return courtText;
}

function generateCaseIdentityHash(courtNo: string, caseNumber: string, date: string): string {
  const normalized = `${courtNo}|${caseNumber.toUpperCase().replace(/\s+/g, '')}|${date}`;
  // Simple hash for deduplication
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function parseSearchHtmlTable(html: string): ParsedCase[] {
  const cases: ParsedCase[] = [];
  
  // Extract table rows - looking for case data rows
  // Pattern: rows containing case numbers like "S.B. Criminal", "D.B.", etc.
  
  // First, find all table rows
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  
  let rowMatch;
  let currentCourt = '';
  
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];
    
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowContent)) !== null) {
      // Strip HTML tags and clean up whitespace
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(cellText);
    }
    
    // Reset cellPattern lastIndex for next row
    cellPattern.lastIndex = 0;
    
    // Skip empty rows or header rows
    if (cells.length < 3) continue;
    
    // Check if this is a court header row
    const rowText = cells.join(' ').toLowerCase();
    if (rowText.includes('court no') || rowText.match(/^court\s+\d+/i)) {
      // Extract court number
      const courtMatch = rowText.match(/court\s*(?:no\.?)?\s*(\d+)/i);
      if (courtMatch) {
        currentCourt = courtMatch[1];
        console.log(`[PARSE] Found court header: Court ${currentCourt}`);
      }
      continue;
    }
    
    // Check if this looks like a case row (has case number pattern)
    const caseNumberPatterns = [
      /\b[A-Z]{1,3}\.?[A-Z]{0,3}\.?\s*(?:Criminal|Civil|Writ|Appeal|Misc|Review|Original|Transfer|Tax|Motor|Arbitration|Reference|PIL|Contempt)?\.?\s*\w*\.?\s*\d+\/\d{4}/i,
      /\b(?:S\.?B\.?|D\.?B\.?)\s*(?:Criminal|Civil|Writ)?\s*\w*\.?\s*\d+\/\d{4}/i,
      /\bCRL\.?\s*\w*\.?\s*\d+\/\d{4}/i,
      /\bCW\.?\s*\w*\.?\s*\d+\/\d{4}/i,
    ];
    
    let caseNumber = '';
    for (const cell of cells) {
      for (const pattern of caseNumberPatterns) {
        const match = cell.match(pattern);
        if (match) {
          caseNumber = match[0].trim();
          break;
        }
      }
      if (caseNumber) break;
    }
    
    if (!caseNumber) continue;
    
    // Parse the row - typical format:
    // [Sr. No, Case Number, Petitioner vs Respondent, Lawyer, Stage, Next Date]
    const parsedCase: ParsedCase = {
      court_no: currentCourt || '0',
      case_number: caseNumber,
      item_no: null,
      petitioner: null,
      respondent: null,
      petitioner_lawyer: null,
      respondent_lawyer: null,
      stage: null,
      next_date: null,
    };
    
    // Try to extract serial/item number
    const firstCell = cells[0];
    const itemMatch = firstCell.match(/^\d+$/);
    if (itemMatch) {
      parsedCase.item_no = parseInt(itemMatch[0], 10);
    }
    
    // Look for parties (usually contains "Vs" or "V/s")
    for (const cell of cells) {
      if (cell.toLowerCase().includes(' vs ') || cell.toLowerCase().includes(' v/s ') || cell.toLowerCase().includes(' versus ')) {
        const parts = cell.split(/\s+(?:vs\.?|v\/s|versus)\s+/i);
        if (parts.length >= 2) {
          parsedCase.petitioner = parts[0].trim().substring(0, 500) || null;
          parsedCase.respondent = parts[1].trim().substring(0, 500) || null;
        }
        break;
      }
    }
    
    // Look for lawyer names (usually has -P or -R suffix, or "Adv.")
    for (const cell of cells) {
      // Petitioner lawyer pattern
      const petLawyerMatch = cell.match(/([A-Z][A-Za-z\s\.]+)\s*-\s*P/i);
      if (petLawyerMatch) {
        parsedCase.petitioner_lawyer = petLawyerMatch[1].trim();
      }
      
      // Respondent lawyer pattern
      const respLawyerMatch = cell.match(/([A-Z][A-Za-z\s\.]+)\s*-\s*R/i);
      if (respLawyerMatch) {
        parsedCase.respondent_lawyer = respLawyerMatch[1].trim();
      }
      
      // "Adv." pattern
      if (cell.toLowerCase().includes('adv.') && !parsedCase.petitioner_lawyer) {
        parsedCase.petitioner_lawyer = cell.replace(/adv\.?\s*/i, '').trim();
      }
    }
    
    // Look for stage/status
    const stagePatterns = ['fresh', 'hearing', 'admission', 'final', 'arguments', 'orders', 'misc'];
    for (const cell of cells) {
      const cellLower = cell.toLowerCase();
      for (const stage of stagePatterns) {
        if (cellLower.includes(stage)) {
          parsedCase.stage = cell.trim();
          break;
        }
      }
    }
    
    // Look for next date
    const datePattern = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/;
    for (const cell of cells) {
      const dateMatch = cell.match(datePattern);
      if (dateMatch) {
        parsedCase.next_date = dateMatch[0];
      }
    }
    
    cases.push(parsedCase);
  }
  
  console.log(`[PARSE] Extracted ${cases.length} cases from HTML table`);
  return cases;
}

function detectBenchFromHtml(html: string): 'JAIPUR' | 'JODHPUR' {
  const htmlLower = html.toLowerCase();
  
  if (htmlLower.includes('jodhpur') && !htmlLower.includes('jaipur')) {
    return 'JODHPUR';
  }
  if (htmlLower.includes('jaipur') && !htmlLower.includes('jodhpur')) {
    return 'JAIPUR';
  }
  
  // Count occurrences
  const jaipurCount = (htmlLower.match(/jaipur/g) || []).length;
  const jodhpurCount = (htmlLower.match(/jodhpur/g) || []).length;
  
  return jodhpurCount > jaipurCount ? 'JODHPUR' : 'JAIPUR';
}

function extractDateFromHtml(html: string): string {
  // Look for date patterns in various formats
  const patterns = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
    /(\d{1,2})\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      // Try to parse and format as YYYY-MM-DD
      try {
        if (match[3] && match[3].length === 4) {
          // DD/MM/YYYY format
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          const year = match[3];
          return `${year}-${month}-${day}`;
        } else if (match[1] && match[1].length === 4) {
          // YYYY/MM/DD format
          const year = match[1];
          const month = match[2].padStart(2, '0');
          const day = match[3].padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      } catch (e) {
        console.log(`[DATE] Failed to parse date: ${match[0]}`);
      }
    }
  }
  
  // Default to today
  const today = new Date();
  return today.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { causelist_id, profile_id }: ParseRequest = await req.json();
    
    if (!causelist_id) {
      return new Response(
        JSON.stringify({ error: 'causelist_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SEARCH-HTML-PARSE] Processing causelist: ${causelist_id}`);

    // Fetch the causelist record
    const { data: causelist, error: fetchError } = await supabase
      .from('raw_causelists')
      .select('*')
      .eq('id', causelist_id)
      .single();

    if (fetchError || !causelist) {
      console.error('[SEARCH-HTML-PARSE] Failed to fetch causelist:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Causelist not found', details: fetchError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the HTML content
    let htmlContent = causelist.text_content;
    
    if (!htmlContent && causelist.storage_path) {
      // Fetch from storage if not in text_content
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('causelist-pdfs')
        .download(causelist.storage_path);
      
      if (downloadError) {
        console.error('[SEARCH-HTML-PARSE] Failed to download file:', downloadError);
        return new Response(
          JSON.stringify({ error: 'Failed to download HTML file' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      htmlContent = await fileData.text();
    }

    if (!htmlContent) {
      return new Response(
        JSON.stringify({ error: 'No HTML content available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the HTML table
    const cases = parseSearchHtmlTable(htmlContent);
    
    if (cases.length === 0) {
      console.log('[SEARCH-HTML-PARSE] No cases found in HTML');
      
      // Update status
      await supabase
        .from('raw_causelists')
        .update({ status: 'parsed_empty' })
        .eq('id', causelist_id);
      
      return new Response(
        JSON.stringify({ success: true, cases_found: 0, cases_inserted: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detect bench and date
    const bench = causelist.bench || detectBenchFromHtml(htmlContent);
    const listDate = causelist.list_date || extractDateFromHtml(htmlContent);
    const queryLawyerName = causelist.query_lawyer_name;

    // Get profile ID if query_lawyer_name is set
    let matchedProfileId = profile_id || null;
    
    if (!matchedProfileId && queryLawyerName) {
      // Try to find profile by alias
      const { data: aliasMatch } = await supabase
        .from('lawyer_aliases')
        .select('profile_id')
        .ilike('alias_name', queryLawyerName)
        .limit(1)
        .single();
      
      if (aliasMatch) {
        matchedProfileId = aliasMatch.profile_id;
        console.log(`[SEARCH-HTML-PARSE] Matched profile ${matchedProfileId} for lawyer: ${queryLawyerName}`);
      }
    }

    // Insert cases into daily_court_docket
    let insertedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const caseData of cases) {
      const courtNo = normalizeCourtNo(caseData.court_no);
      const identityHash = generateCaseIdentityHash(courtNo, caseData.case_number, listDate);
      
      // Check for existing case (deduplication)
      const { data: existing } = await supabase
        .from('daily_court_docket')
        .select('id, match_confidence')
        .eq('court_location', bench)
        .eq('court_room_no', courtNo)
        .eq('case_number', caseData.case_number)
        .eq('date', listDate)
        .limit(1)
        .single();

      if (existing) {
        // Only update if new confidence is higher or equal
        const existingConfidence = existing.match_confidence || 0;
        if (existingConfidence < 0.9) {
          const { error: updateError } = await supabase
            .from('daily_court_docket')
            .update({
              matched_profile_id: matchedProfileId,
              match_confidence: 0.9,
              match_method: 'query_match',
              petitioner: caseData.petitioner || undefined,
              respondent: caseData.respondent || undefined,
              petitioner_lawyer: caseData.petitioner_lawyer || undefined,
              respondent_lawyer: caseData.respondent_lawyer || undefined,
            })
            .eq('id', existing.id);
          
          if (!updateError) {
            insertedCount++;
          }
        } else {
          skippedCount++;
        }
        continue;
      }

      // Insert new case
      const { error: insertError } = await supabase
        .from('daily_court_docket')
        .insert({
          court_location: bench,
          court_room_no: courtNo,
          case_number: caseData.case_number,
          date: listDate,
          item_no: caseData.item_no,
          petitioner: caseData.petitioner,
          respondent: caseData.respondent,
          petitioner_lawyer: caseData.petitioner_lawyer,
          respondent_lawyer: caseData.respondent_lawyer,
          matched_profile_id: matchedProfileId,
          match_confidence: matchedProfileId ? 0.9 : null,
          match_method: matchedProfileId ? 'query_match' : null,
          list_type: 'DAILY',
          status: 'pending',
          source_url: `search-html:${causelist_id}`,
        });

      if (insertError) {
        console.error(`[SEARCH-HTML-PARSE] Insert error for case ${caseData.case_number}:`, insertError);
        errors.push(`${caseData.case_number}: ${insertError.message}`);
      } else {
        insertedCount++;
      }
    }

    // Update causelist status
    await supabase
      .from('raw_causelists')
      .update({ status: 'parsed_direct' })
      .eq('id', causelist_id);

    console.log(`[SEARCH-HTML-PARSE] Complete: ${insertedCount} inserted, ${skippedCount} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        cases_found: cases.length,
        cases_inserted: insertedCount,
        cases_skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined,
        bench,
        list_date: listDate,
        matched_profile_id: matchedProfileId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SEARCH-HTML-PARSE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
