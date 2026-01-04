import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { reportBackendError, abstractBenchCode, ERROR_CODES } from "../_shared/errorReporting.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ACCOUNT-WISE NAME SCAN (CRITICAL)
 * 
 * This function orchestrates PDF text extraction and alias scanning:
 * 1. Classify PDF type (DAILY, SUPPLEMENTARY, NOTICE, SEARCH)
 * 2. Route based on type - AI parsing only for DAILY and SEARCH
 * 3. Check if text extraction is complete
 * 4. If not: trigger chunked extraction via pdf-extract-chunk
 * 5. If complete: search for profile's aliases (case-insensitive string match)
 * 6. If match found: enqueue parsing task
 * 
 * ROUTING LOGIC:
 * - DAILY: ✅ AI parsing (court-wise)
 * - SEARCH: ✅ AI parsing (lawyer-wise)
 * - SUPPLEMENTARY: ❌ No AI (simple extraction only)
 * - NOTICE: ❌ No AI (skip entirely)
 * 
 * ❌ NO case number extraction
 * ❌ NO party identification
 * ❌ NO inserts to daily_court_docket
 */

type PdfType = 'DAILY' | 'SUPPLEMENTARY' | 'NOTICE' | 'SEARCH' | 'UNKNOWN';

interface ScanRequest {
  profile_id?: string;
  causelist_id?: string;
}

interface ExtractionProgress {
  pages_done: number;
  total_pages: number;
  status: 'in_progress' | 'complete' | 'error';
  last_updated: string;
  error_count: number;
}

const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// PDF Classification - determines routing for AI usage
// IMPORTANT: Trust metadata first, only fall back to content classification
function classifyPdf(text: string, pageCount?: number, metadataListType?: string): PdfType {
  // PRIORITY 1: Trust metadata from upload/source if available
  if (metadataListType) {
    const upperType = metadataListType.toUpperCase();
    if (upperType === 'DAILY') return 'DAILY';
    if (upperType === 'SUPPLEMENTARY') return 'SUPPLEMENTARY';
    if (upperType === 'NOTICE') return 'NOTICE';
    if (upperType === 'SEARCH') return 'SEARCH';
  }
  
  // PRIORITY 2: Content-based classification (fallback only)
  // Use specific patterns to avoid false positives from procedural text
  const upperText = text.toUpperCase();
  
  // Check for document title patterns (more specific)
  if (/DAILY\s+CAUSE\s*LIST/i.test(text)) return 'DAILY';
  
  // Only classify as SUPPLEMENTARY if it's in the document title, not just mentioned
  // Check for patterns like "SUPPLEMENTARY CAUSE LIST FOR" or "SUPPLEMENTARY LIST"
  if (/^.*?SUPPLEMENTARY\s+CAUSE\s*LIST\s*(FOR|DATED)/im.test(text.substring(0, 2000))) return 'SUPPLEMENTARY';
  
  if (upperText.includes('NOTICE')) return 'NOTICE';
  if (upperText.includes('SEARCH CAUSELIST')) return 'SEARCH';
  
  return 'UNKNOWN';
}

// Check if PDF type requires AI parsing
function shouldUseAiParsing(pdfType: PdfType): boolean {
  // Only DAILY and SEARCH use AI
  return pdfType === 'DAILY' || pdfType === 'SEARCH';
}

// Extract causelist date from PDF text content
function extractCauselistDate(textContent: string): string | null {
  const patterns = [
    /Dated\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
    /Date\s*:\s*(\d{1,2})-(\d{1,2})-(\d{4})/i,
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})/m,
    /Cause\s*List\s*(?:for|dated?)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
    /Daily\s*Causelist.*?(\d{1,2})\/(\d{1,2})\/(\d{4})/is,
  ];

  for (const pattern of patterns) {
    const match = textContent.match(pattern);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

// Check if extraction is stalled (last_updated > 5 minutes ago)
function isExtractionStalled(progress: ExtractionProgress): boolean {
  const lastUpdated = new Date(progress.last_updated).getTime();
  return Date.now() - lastUpdated > STALE_TIMEOUT_MS;
}

// STEP 3: Court-wise split for DAILY causelists (NO AI)
interface CourtBlock {
  court_no: string;
  court_text: string;
  start_index: number;
  end_index: number;
}

function splitByCourtBlocks(text: string): CourtBlock[] {
  const courtPattern = /Court\s*No\s*[:\.]?\s*(\d+)/gi;
  const blocks: CourtBlock[] = [];
  const matches: { index: number; courtNo: string }[] = [];
  
  // Find all court number positions
  let match;
  while ((match = courtPattern.exec(text)) !== null) {
    matches.push({
      index: match.index,
      courtNo: match[1]
    });
  }
  
  if (matches.length === 0) {
    console.log('[COURT-SPLIT] No court blocks found');
    return [];
  }
  
  console.log(`[COURT-SPLIT] Found ${matches.length} court markers`);
  
  // Create blocks from each court marker to the next
  for (let i = 0; i < matches.length; i++) {
    const startIndex = matches[i].index;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index : text.length;
    const courtText = text.substring(startIndex, endIndex).trim();
    
    blocks.push({
      court_no: matches[i].courtNo,
      court_text: courtText,
      start_index: startIndex,
      end_index: endIndex
    });
  }
  
  console.log(`[COURT-SPLIT] Created ${blocks.length} court blocks: ${blocks.map(b => `Court ${b.court_no}`).join(', ')}`);
  return blocks;
}

// Filter court blocks that contain a lawyer's alias (context-aware)
function filterCourtBlocksForAlias(blocks: CourtBlock[], alias: string): CourtBlock[] {
  return blocks.filter(block => isLawyerNameMatch(block.court_text, alias));
}

// Context-aware alias matching - only match within lawyer name contexts
// Returns true if alias appears in a lawyer name context (not just anywhere in text)
function isLawyerNameMatch(text: string, alias: string): boolean {
  const aliasLower = alias.toLowerCase().trim();
  const textLower = text.toLowerCase();
  
  // Skip very short aliases (likely to cause false positives)
  if (aliasLower.length < 4) {
    console.log(`[MATCH] Skipping short alias: "${alias}" (${aliasLower.length} chars)`);
    return false;
  }
  
  // Skip common false-positive words
  const blacklist = ['admin', 'state', 'union', 'india', 'court', 'judge', 'order', 'petition', 'appeal', 'case'];
  if (blacklist.includes(aliasLower)) {
    console.log(`[MATCH] Skipping blacklisted alias: "${alias}"`);
    return false;
  }
  
  // Pattern 1: "Adv. {name}" or "Advocate {name}"
  const advPattern = new RegExp(`\\badv\\.?\\s*${escapeRegex(aliasLower)}\\b`, 'i');
  if (advPattern.test(text)) {
    console.log(`[MATCH] Found "Adv." pattern for "${alias}"`);
    return true;
  }
  
  // Pattern 2: "{name}-P" or "{name}-R" (petitioner/respondent lawyer notation)
  const lawyerSuffixPattern = new RegExp(`\\b${escapeRegex(aliasLower)}\\s*-\\s*[PR]\\b`, 'i');
  if (lawyerSuffixPattern.test(text)) {
    console.log(`[MATCH] Found lawyer suffix (-P/-R) pattern for "${alias}"`);
    return true;
  }
  
  // Pattern 3: Within "Name of Advocate" column sections
  // Look for the alias appearing after "Name of Advocate" header within reasonable distance
  const advocateColumnPattern = /name\s+of\s+advocate/gi;
  let match;
  while ((match = advocateColumnPattern.exec(textLower)) !== null) {
    // Check next 5000 chars after "Name of Advocate" header for the alias
    const searchWindow = textLower.substring(match.index, match.index + 5000);
    if (searchWindow.includes(aliasLower)) {
      console.log(`[MATCH] Found in "Name of Advocate" column for "${alias}"`);
      return true;
    }
  }
  
  // Pattern 4: Look for name appearing between pipe characters (table format)
  // e.g., "| RAMESH CHANDRA PUROHIT-P |"
  const tablePattern = new RegExp(`\\|[^|]*${escapeRegex(aliasLower)}[^|]*\\|`, 'gi');
  const tableMatches = text.match(tablePattern);
  if (tableMatches) {
    // Verify it's in a lawyer context (has -P, -R, or appears after case details)
    for (const tableMatch of tableMatches) {
      const matchLower = tableMatch.toLowerCase();
      // Check if this table cell looks like a lawyer name (has suffix or "adv")
      if (/-[pr]\b/i.test(tableMatch) || /\badv\.?\s/i.test(tableMatch)) {
        console.log(`[MATCH] Found in table cell with lawyer markers for "${alias}"`);
        return true;
      }
    }
  }
  
  // Pattern 5: Appears near common lawyer patterns in same line/paragraph
  // Split into lines and check each line
  const lines = text.split(/[\n\r]+/);
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    if (lineLower.includes(aliasLower)) {
      // Check if this line has lawyer indicators
      if (/-[pr]\b/i.test(line) || /\badv\.?\s/i.test(line) || /advocate/i.test(line) || /counsel/i.test(line)) {
        console.log(`[MATCH] Found in line with lawyer indicators for "${alias}"`);
        return true;
      }
    }
  }
  
  // No contextual match found
  return false;
}

// Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Timing obfuscation helper
function randomDelay(minMs = 50, maxMs = 200): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Add timing obfuscation to prevent timing analysis
  await randomDelay();

  const startTime = Date.now();
  console.log('[SCAN-LAWYER-NAMES] Function started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ScanRequest = await req.json().catch(() => ({}));

    // Get causelists to scan
    let causelistQuery = supabase
      .from('raw_causelists')
      .select('id, storage_path, text_content, extraction_progress, bench, list_type, list_date, page_count, source_type, query_lawyer_name, input_format')
      .in('status', ['downloaded', 'notes_extracted', 'scanning', 'text_extracted', 'extracting'])
      .order('created_at', { ascending: true })
      .limit(1);

    if (body.causelist_id) {
      causelistQuery = supabase
        .from('raw_causelists')
        .select('id, storage_path, text_content, extraction_progress, bench, list_type, list_date, page_count, source_type, query_lawyer_name, input_format')
        .eq('id', body.causelist_id);
    }

    const { data: causelists, error: causelistError } = await causelistQuery;

    if (causelistError) {
      throw new Error(`Failed to fetch causelists: ${causelistError.message}`);
    }

    if (!causelists?.length) {
      console.log('[SCAN-LAWYER-NAMES] No causelists to scan');
      return new Response(JSON.stringify({ success: true, message: 'No causelists to scan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get profiles with aliases
    let profilesQuery = supabase
      .from('profiles')
      .select('id')
      .eq('onboarding_completed', true);

    if (body.profile_id) {
      profilesQuery = supabase
        .from('profiles')
        .select('id')
        .eq('id', body.profile_id);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles?.length) {
      console.log('[SCAN-LAWYER-NAMES] No profiles with completed onboarding');
      return new Response(JSON.stringify({ success: true, message: 'No profiles to scan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalScans = 0;
    let totalMatches = 0;
    let totalEnqueued = 0;
    let extractionsTriggered = 0;

    for (const causelist of causelists) {
      console.log(`[SCAN-LAWYER-NAMES] Processing causelist: ${causelist.id} (${causelist.bench} ${causelist.list_type})`);

      // EARLY EXIT: Route HTML causelists to deterministic parser (bypass all alias scanning)
      // HTML = high-confidence, structure-reliable source - parse ALL cases unconditionally
      if (causelist.input_format === 'HTML' || causelist.source_type === 'HTML_SEARCH' || causelist.source_type === 'HTML_COMPLETE') {
        console.log(`[SCAN-LAWYER-NAMES] HTML causelist detected (input_format: ${causelist.input_format}) - routing to html-causelist-parse (bypassing alias scan)`);
        
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/html-causelist-parse`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              causelist_id: causelist.id
            })
          });
          
          const result = await response.json();
          console.log(`[SCAN-LAWYER-NAMES] html-causelist-parse result:`, result);
          
          if (result.success) {
            console.log(`[SCAN-LAWYER-NAMES] HTML causelist parsed: ${result.cases_inserted} inserted, ${result.cases_updated} updated from ${result.courts_processed} courts`);
          } else {
            console.error(`[SCAN-LAWYER-NAMES] HTML causelist parse failed:`, result.error);
          }
        } catch (err) {
          console.error(`[SCAN-LAWYER-NAMES] Failed to call html-causelist-parse:`, err);
        }
        
        continue; // Skip all other processing for HTML causelists
      }

      const progress = causelist.extraction_progress as ExtractionProgress | null;
      let textContent = causelist.text_content;

      // Check if we need to extract text
      // If text already exists (legacy extraction), skip chunked extraction
      const needsExtraction = !textContent && (!progress || progress.status !== 'complete');
      
      if (needsExtraction) {
        // Check if extraction is in progress
        if (progress?.status === 'in_progress' && !isExtractionStalled(progress)) {
          console.log(`[SCAN-LAWYER-NAMES] Extraction in progress: ${progress.pages_done}/${progress.total_pages} pages`);
          continue; // Skip, let the extraction complete
        }

        // Check if extraction errored out
        if (progress?.status === 'error' && progress.error_count >= 3) {
          console.log(`[SCAN-LAWYER-NAMES] Extraction failed permanently after ${progress.error_count} attempts`);
          continue;
        }

        // Trigger extraction (new or resume stalled)
        const startPage = progress?.status === 'in_progress' ? progress.pages_done : 0;
        
        console.log(`[SCAN-LAWYER-NAMES] Triggering pdf-extract-chunk from page ${startPage}`);
        
        // Mark as extracting
        await supabase
          .from('raw_causelists')
          .update({ status: 'extracting' })
          .eq('id', causelist.id);

        // Trigger extraction
        try {
          await fetch(`${supabaseUrl}/functions/v1/pdf-extract-chunk`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              causelist_id: causelist.id,
              start_page: startPage
            })
          });
          extractionsTriggered++;
          console.log(`[SCAN-LAWYER-NAMES] Extraction triggered for ${causelist.id}`);
        } catch (err) {
          console.error(`[SCAN-LAWYER-NAMES] Failed to trigger extraction:`, err);
        }

        continue; // Don't scan yet, wait for extraction
      }

      // Text extraction is complete, proceed with classification and scanning
      console.log(`[SCAN-LAWYER-NAMES] Text ready: ${textContent.length} chars`);

      // STEP 2: CLASSIFY PDF TYPE (CRITICAL ROUTING LOGIC)
      // Trust metadata list_type first, fall back to content classification
      const pdfType = classifyPdf(textContent, causelist.page_count, causelist.list_type);
      const useAi = shouldUseAiParsing(pdfType);
      
      console.log(`[SCAN-LAWYER-NAMES] PDF Classification: ${pdfType} (metadata: ${causelist.list_type}) | AI Parsing: ${useAi ? '✅ YES' : '❌ NO'}`);

      // Handle NOTICE type - skip entirely
      if (pdfType === 'NOTICE') {
        console.log(`[SCAN-LAWYER-NAMES] NOTICE type detected - skipping entirely`);
        await supabase
          .from('raw_causelists')
          .update({ status: 'skipped_notice' })
          .eq('id', causelist.id);
        continue;
      }

      // Extract and update date if needed
      const extractedDate = extractCauselistDate(textContent);
      if (extractedDate && extractedDate !== causelist.list_date) {
        await supabase
          .from('raw_causelists')
          .update({ list_date: extractedDate })
          .eq('id', causelist.id);
        console.log(`[SCAN-LAWYER-NAMES] Updated causelist date to: ${extractedDate}`);
      }

      // STEP 3: For DAILY type, split by court blocks (NO AI for splitting)
      let courtBlocks: CourtBlock[] = [];
      if (pdfType === 'DAILY') {
        courtBlocks = splitByCourtBlocks(textContent);
        console.log(`[SCAN-LAWYER-NAMES] DAILY causelist split into ${courtBlocks.length} court blocks`);
      }

      // Scan for each profile's aliases
      for (const profile of profiles) {
        // Check if already scanned
        const { data: existingScan } = await supabase
          .from('profile_scan_log')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('raw_causelist_id', causelist.id)
          .single();

        if (existingScan) {
          console.log(`[SCAN-LAWYER-NAMES] Profile ${profile.id} already scanned for causelist ${causelist.id}`);
          continue;
        }

        // Get profile's aliases
        const { data: aliases } = await supabase
          .from('lawyer_aliases')
          .select('alias_name')
          .eq('profile_id', profile.id);

        if (!aliases?.length) {
          continue;
        }

        totalScans++;

        // Context-aware alias matching - only match within lawyer name contexts
        const matchedAliases: string[] = [];
        for (const { alias_name } of aliases) {
          if (isLawyerNameMatch(textContent, alias_name)) {
            matchedAliases.push(alias_name);
          }
        }

        // Log the scan
        await supabase.from('profile_scan_log').insert({
          profile_id: profile.id,
          raw_causelist_id: causelist.id,
          aliases_searched: aliases.map(a => a.alias_name),
          matches_found: matchedAliases.length
        });

        if (matchedAliases.length > 0) {
          totalMatches += matchedAliases.length;
          console.log(`[SCAN-LAWYER-NAMES] Profile ${profile.id}: Found ${matchedAliases.length} matches: ${matchedAliases.join(', ')}`);

          // ROUTING: Only enqueue AI parsing for DAILY and SEARCH types
          if (useAi) {
            for (const alias of matchedAliases) {
              if (pdfType === 'DAILY' && courtBlocks.length > 0) {
                // STEP 3: DAILY - Create ONE AI job per court block containing the alias
                const relevantBlocks = filterCourtBlocksForAlias(courtBlocks, alias);
                console.log(`[SCAN-LAWYER-NAMES] Alias "${alias}" found in ${relevantBlocks.length} court blocks`);
                
                for (const block of relevantBlocks) {
                  // INSERT INTO ai_jobs - worker will process
                  const { error: jobError } = await supabase
                    .from('ai_jobs')
                    .insert({
                      job_type: 'court_parse',
                      payload: {
                        causelist_id: causelist.id,
                        profile_id: profile.id,
                        alias: alias,
                        court_no: block.court_no,
                        court_text: block.court_text,
                        bench: causelist.bench,
                        list_date: causelist.list_date,
                        list_type: pdfType
                      },
                      status: 'pending',
                      priority: 0
                    });

                  if (!jobError) {
                    totalEnqueued++;
                    console.log(`[SCAN-LAWYER-NAMES] AI job created: Court ${block.court_no} for "${alias}" (${block.court_text.length} chars)`);
                  } else {
                    console.error(`[SCAN-LAWYER-NAMES] Failed to create AI job:`, jobError);
                  }
                }
              } else {
                // SEARCH type or fallback - single job for full text
                const { error: jobError } = await supabase
                  .from('ai_jobs')
                  .insert({
                    job_type: 'lawyer_parse',
                    payload: {
                      causelist_id: causelist.id,
                      profile_id: profile.id,
                      alias: alias,
                      full_text: textContent,
                      bench: causelist.bench,
                      list_date: causelist.list_date,
                      list_type: pdfType
                    },
                    status: 'pending',
                    priority: 0
                  });

                if (!jobError) {
                  totalEnqueued++;
                }
              }
            }
            console.log(`[SCAN-LAWYER-NAMES] Created ${totalEnqueued} AI jobs for ${pdfType} (worker will process)`);
          } else {
            // SUPPLEMENTARY: Log match but skip AI parsing
            console.log(`[SCAN-LAWYER-NAMES] SUPPLEMENTARY match found - skipping AI parsing, logging only`);
          }
        } else {
          console.log(`[SCAN-LAWYER-NAMES] Profile ${profile.id}: No matches`);
        }
      }

      // Update causelist status based on type
      const newStatus = useAi ? 'jobs_created' : 'scanned_no_ai';
      await supabase
        .from('raw_causelists')
        .update({ status: newStatus })
        .eq('id', causelist.id);

      // NO LONGER triggering parse-case directly - worker handles it
      console.log(`[SCAN-LAWYER-NAMES] Causelist ${causelist.id} status: ${newStatus} (AI worker will process jobs)`)
    }

    const duration = Date.now() - startTime;
    console.log(`[SCAN-LAWYER-NAMES] Completed: ${totalScans} scans, ${totalMatches} matches, ${totalEnqueued} enqueued, ${extractionsTriggered} extractions triggered, ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      scans_performed: totalScans,
      matches_found: totalMatches,
      tasks_enqueued: totalEnqueued,
      extractions_triggered: extractionsTriggered,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[SCAN-LAWYER-NAMES] Error:', error);
    
    // Report to admin error console
    reportBackendError({
      severity: 'P1',
      domain: 'INGESTION',
      errorCode: 'SCAN_LAWYER_NAMES_FAIL',
      message: `Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
