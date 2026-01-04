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
  judge_names: string | null;
  stage: string | null;
  next_date: string | null;
}

interface ParseRequest {
  causelist_id: string;
}

// Court name normalization map - built dynamically
const COURT_NORMALIZATION_MAP: Record<string, string> = {};
for (let i = 1; i <= 30; i++) {
  COURT_NORMALIZATION_MAP[`court no. ${i}`] = String(i);
  COURT_NORMALIZATION_MAP[`court no.${i}`] = String(i);
  COURT_NORMALIZATION_MAP[`court ${i}`] = String(i);
  COURT_NORMALIZATION_MAP[`courtno.${i}`] = String(i);
  COURT_NORMALIZATION_MAP[`courtno ${i}`] = String(i);
}

function normalizeCourtNo(courtText: string): string {
  const lower = courtText.toLowerCase().trim();
  
  if (COURT_NORMALIZATION_MAP[lower]) {
    return COURT_NORMALIZATION_MAP[lower];
  }
  
  const match = lower.match(/(\d+)/);
  if (match) {
    return match[1];
  }
  
  console.log(`[COURT-NORM] Could not normalize court: "${courtText}"`);
  return courtText;
}

// Extract all case rows from HTML - handles various table structures
function parseHtmlCauselist(html: string): { cases: ParsedCase[]; courts: string[] } {
  const cases: ParsedCase[] = [];
  const courtsFound = new Set<string>();
  
  // Pattern to find court blocks
  const courtBlockPattern = /Court\s*No\.?\s*:?\s*(\d+)/gi;
  const courtMarkers: { index: number; courtNo: string }[] = [];
  
  let match;
  while ((match = courtBlockPattern.exec(html)) !== null) {
    courtMarkers.push({ index: match.index, courtNo: match[1] });
    courtsFound.add(match[1]);
  }
  
  console.log(`[HTML-PARSE] Found ${courtMarkers.length} court markers: ${[...courtsFound].join(', ')}`);
  
  if (courtMarkers.length === 0) {
    const singleCourtCases = extractCasesFromSection(html, '1');
    cases.push(...singleCourtCases);
  } else {
    for (let i = 0; i < courtMarkers.length; i++) {
      const startIdx = courtMarkers[i].index;
      const endIdx = i < courtMarkers.length - 1 ? courtMarkers[i + 1].index : html.length;
      const courtSection = html.substring(startIdx, endIdx);
      const courtNo = courtMarkers[i].courtNo;
      
      const sectionCases = extractCasesFromSection(courtSection, courtNo);
      cases.push(...sectionCases);
      
      console.log(`[HTML-PARSE] Court ${courtNo}: ${sectionCases.length} cases`);
    }
  }
  
  return { cases, courts: [...courtsFound] };
}

function extractCasesFromSection(html: string, courtNo: string): ParsedCase[] {
  const cases: ParsedCase[] = [];
  
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  
  let rowMatch;
  let itemCounter = 0;
  
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];
    
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowContent)) !== null) {
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(cellText);
    }
    cellPattern.lastIndex = 0;
    
    if (cells.length < 3) continue;
    
    // Skip header rows
    const rowText = cells.join(' ').toLowerCase();
    if (rowText.includes('sr. no') || rowText.includes('serial') || 
        rowText.includes('case number') || rowText.includes('name of advocate') ||
        (rowText.includes('petitioner') && rowText.includes('respondent') && rowText.includes('advocate'))) {
      continue;
    }
    
    // Find case number
    let caseNumber = '';
    const casePatterns = [
      /\b[A-Z]{1,4}\.?\s*[A-Z]*\.?\s*(?:Criminal|Civil|Writ|Appeal|Misc|Review|Original|Transfer|Tax|Motor|Arbitration|Reference|PIL|Contempt)?\.?\s*\w*\.?\s*\d+\/\d{4}/i,
      /\b(?:S\.?B\.?|D\.?B\.?)\s*(?:Criminal|Civil|Writ)?\s*\w*\.?\s*\d+\/\d{4}/i,
      /\bCRL\.?\s*\w*\.?\s*\d+\/\d{4}/i,
      /\bCW\.?\s*\w*\.?\s*\d+\/\d{4}/i,
      /\b\w+\.\w*\.?\s*\d+\/\d{4}/i,
    ];
    
    for (const cell of cells) {
      for (const pattern of casePatterns) {
        const caseMatch = cell.match(pattern);
        if (caseMatch) {
          caseNumber = caseMatch[0].trim();
          break;
        }
      }
      if (caseNumber) break;
    }
    
    if (!caseNumber) continue;
    
    itemCounter++;
    
    const parsedCase: ParsedCase = {
      court_no: courtNo,
      case_number: caseNumber,
      item_no: null,
      petitioner: null,
      respondent: null,
      petitioner_lawyer: null,
      respondent_lawyer: null,
      judge_names: null,
      stage: null,
      next_date: null,
    };
    
    // Extract item number
    const firstCell = cells[0];
    const itemMatch = firstCell.match(/^\s*(\d+)\s*$/);
    if (itemMatch) {
      parsedCase.item_no = parseInt(itemMatch[1], 10);
    } else {
      parsedCase.item_no = itemCounter;
    }
    
    // Extract parties
    for (const cell of cells) {
      if (cell.toLowerCase().includes(' vs ') || cell.toLowerCase().includes(' v/s ') || 
          cell.toLowerCase().includes(' versus ') || cell.includes(' Vs. ')) {
        const parts = cell.split(/\s+(?:vs\.?|v\/s|versus)\s+/i);
        if (parts.length >= 2) {
          parsedCase.petitioner = parts[0].trim().substring(0, 500) || null;
          parsedCase.respondent = parts[1].trim().substring(0, 500) || null;
        }
        break;
      }
    }
    
    // Extract lawyers as raw text (ALL mentioned lawyers)
    for (const cell of cells) {
      const petLawyerMatches = cell.match(/([A-Z][A-Za-z\s\.]+)\s*-\s*P(?:\b|$)/gi);
      if (petLawyerMatches && petLawyerMatches.length > 0) {
        const lawyers = petLawyerMatches.map(m => m.replace(/-\s*P$/i, '').trim());
        parsedCase.petitioner_lawyer = lawyers.join(', ');
      }
      
      const respLawyerMatches = cell.match(/([A-Z][A-Za-z\s\.]+)\s*-\s*R(?:\b|$)/gi);
      if (respLawyerMatches && respLawyerMatches.length > 0) {
        const lawyers = respLawyerMatches.map(m => m.replace(/-\s*R$/i, '').trim());
        parsedCase.respondent_lawyer = lawyers.join(', ');
      }
    }
    
    // Extract stage
    const stagePatterns = ['fresh', 'hearing', 'admission', 'final', 'arguments', 'orders', 'misc', 'motion'];
    for (const cell of cells) {
      const cellLower = cell.toLowerCase();
      for (const stage of stagePatterns) {
        if (cellLower.includes(stage)) {
          parsedCase.stage = cell.trim();
          break;
        }
      }
    }
    
    // Extract next date
    const datePattern = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/;
    for (const cell of cells) {
      const dateMatch = cell.match(datePattern);
      if (dateMatch) {
        parsedCase.next_date = dateMatch[0];
      }
    }
    
    cases.push(parsedCase);
  }
  
  return cases;
}

function detectBenchFromHtml(html: string): 'JAIPUR' | 'JODHPUR' {
  const htmlLower = html.toLowerCase();
  const jaipurCount = (htmlLower.match(/jaipur/g) || []).length;
  const jodhpurCount = (htmlLower.match(/jodhpur/g) || []).length;
  return jodhpurCount > jaipurCount ? 'JODHPUR' : 'JAIPUR';
}

function extractDateFromHtml(html: string): string {
  const patterns = [
    /(?:dated?|for)\s*:?\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i,
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[3] && match[3].length === 4) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
  }
  
  return new Date().toISOString().split('T')[0];
}

function extractJudgesFromHtml(html: string, courtNo: string): string | null {
  const courtPattern = new RegExp(`Court\\s*No\\.?\\s*:?\\s*${courtNo}[\\s\\S]{0,500}`, 'i');
  const courtSection = html.match(courtPattern);
  
  if (courtSection) {
    const judgePattern = /Hon['']?ble\s+(?:Mr\.?\s+)?Justice\s+([A-Z][A-Za-z\s\.]+)/gi;
    const judges: string[] = [];
    let judgeMatch;
    
    while ((judgeMatch = judgePattern.exec(courtSection[0])) !== null) {
      judges.push(judgeMatch[1].trim());
    }
    
    if (judges.length > 0) {
      return judges.join(', ');
    }
  }
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { causelist_id }: ParseRequest = await req.json();
    
    if (!causelist_id) {
      return new Response(
        JSON.stringify({ error: 'causelist_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[HTML-CAUSELIST-PARSE] Processing causelist: ${causelist_id}`);

    const { data: causelist, error: fetchError } = await supabase
      .from('raw_causelists')
      .select('*')
      .eq('id', causelist_id)
      .single();

    if (fetchError || !causelist) {
      console.error('[HTML-CAUSELIST-PARSE] Failed to fetch causelist:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Causelist not found', details: fetchError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let htmlContent = causelist.text_content;
    
    if (!htmlContent && causelist.storage_path) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('causelist-pdfs')
        .download(causelist.storage_path);
      
      if (downloadError) {
        console.error('[HTML-CAUSELIST-PARSE] Failed to download file:', downloadError);
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

    // Parse ALL cases from HTML unconditionally
    const { cases, courts } = parseHtmlCauselist(htmlContent);
    
    console.log(`[HTML-CAUSELIST-PARSE] Parsed ${cases.length} cases from ${courts.length} courts`);

    if (cases.length === 0) {
      await supabase
        .from('raw_causelists')
        .update({ status: 'parsed_empty' })
        .eq('id', causelist_id);
      
      return new Response(
        JSON.stringify({ success: true, cases_found: 0, cases_inserted: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bench = causelist.bench || detectBenchFromHtml(htmlContent);
    const listDate = causelist.list_date || extractDateFromHtml(htmlContent);

    // Insert ALL cases unconditionally - NO lawyer matching gate
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const caseData of cases) {
      const courtNo = normalizeCourtNo(caseData.court_no);
      const judgeNames = caseData.judge_names || extractJudgesFromHtml(htmlContent, courtNo);
      
      // Deduplication check
      const { data: existing } = await supabase
        .from('daily_court_docket')
        .select('id, origin, structure_confidence')
        .eq('court_location', bench)
        .eq('court_room_no', courtNo)
        .eq('case_number', caseData.case_number)
        .eq('date', listDate)
        .limit(1)
        .single();

      if (existing) {
        // HTML has priority over PDF - update if lower confidence
        if (existing.origin === 'PDF' || (existing.structure_confidence || 0) < 0.9) {
          const { error: updateError } = await supabase
            .from('daily_court_docket')
            .update({
              petitioner: caseData.petitioner || undefined,
              respondent: caseData.respondent || undefined,
              petitioner_lawyer: caseData.petitioner_lawyer || undefined,
              respondent_lawyer: caseData.respondent_lawyer || undefined,
              judge_names: judgeNames || undefined,
              item_no: caseData.item_no || undefined,
              origin: 'HTML_FULL_CAUSELIST',
              confidence_source: 'court_structure',
              structure_confidence: 0.9,
              raw_causelist_id: causelist_id,
            })
            .eq('id', existing.id);
          
          if (!updateError) updatedCount++;
          else errors.push(`Update ${caseData.case_number}: ${updateError.message}`);
        } else {
          skippedCount++;
        }
        continue;
      }

      // Insert new case - NO matched_profile_id (matching happens post-processing)
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
          judge_names: judgeNames,
          list_type: 'DAILY',
          status: 'pending',
          origin: 'HTML_FULL_CAUSELIST',
          confidence_source: 'court_structure',
          structure_confidence: 0.9,
          raw_causelist_id: causelist_id,
          source_url: `html:${causelist_id}`,
        });

      if (insertError) {
        errors.push(`${caseData.case_number}: ${insertError.message}`);
      } else {
        insertedCount++;
      }
    }

    // Update causelist metadata
    await supabase
      .from('raw_causelists')
      .update({ 
        status: 'parsed_complete',
        input_format: 'HTML',
        source_granularity: 'FULL_CAUSELIST',
        structure_confidence: 0.9,
      })
      .eq('id', causelist_id);

    // Trigger post-processing lawyer matching
    try {
      console.log('[HTML-CAUSELIST-PARSE] Triggering post-processing alias matching...');
      await supabase.functions.invoke('match-docket-aliases', {
        body: { causelist_id, date: listDate, bench }
      });
    } catch {
      console.log('[HTML-CAUSELIST-PARSE] Post-processing match deferred');
    }

    console.log(`[HTML-CAUSELIST-PARSE] Complete: ${insertedCount} inserted, ${updatedCount} updated, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        cases_found: cases.length,
        cases_inserted: insertedCount,
        cases_updated: updatedCount,
        cases_skipped: skippedCount,
        courts_processed: courts.length,
        errors: errors.length > 0 ? errors : undefined,
        bench,
        list_date: listDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[HTML-CAUSELIST-PARSE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
