import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractText } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ACCOUNT-WISE NAME SCAN (CRITICAL)
 * 
 * This function runs per profile per causelist:
 * 1. Extract plain text from PDF using unpdf (no AI needed)
 * 2. Search for profile's aliases (case-insensitive string match)
 * 3. If match found: enqueue parsing task
 * 4. If no match: STOP, do nothing
 * 
 * ❌ NO case number extraction
 * ❌ NO party identification
 * ❌ NO inserts to daily_court_docket
 */

interface ScanRequest {
  profile_id?: string;
  causelist_id?: string;
}

// Extract text using unpdf library (fast, free, no API limits)
async function extractTextFromPDF(pdfArrayBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log('[SCAN-LAWYER-NAMES] Extracting text with unpdf...');
    const startTime = Date.now();
    
    const { text, totalPages } = await extractText(pdfArrayBuffer);
    
    // Join text array into single string
    const fullText = Array.isArray(text) ? text.join('\n') : text;
    
    const elapsed = Date.now() - startTime;
    console.log(`[SCAN-LAWYER-NAMES] Extracted ${fullText.length} chars from ${totalPages} pages in ${elapsed}ms`);
    
    return fullText;
  } catch (error) {
    console.error('[SCAN-LAWYER-NAMES] unpdf extraction error:', error);
    return '';
  }
}

// Extract causelist date from PDF text content
function extractCauselistDate(textContent: string): string | null {
  // Common date patterns in Indian causelists
  const patterns = [
    // "Thursday Dated : 18/12/2025" or "Dated : 18/12/2025"
    /Dated\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
    // "Date: 18-12-2025" or "Date : 18-12-2025"
    /Date\s*:\s*(\d{1,2})-(\d{1,2})-(\d{4})/i,
    // "18.12.2025" at start of line
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})/m,
    // "Cause List for 18/12/2025"
    /Cause\s*List\s*(?:for|dated?)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
    // "Daily Causelist" followed by date
    /Daily\s*Causelist.*?(\d{1,2})\/(\d{1,2})\/(\d{4})/is,
  ];

  for (const pattern of patterns) {
    const match = textContent.match(pattern);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      const dateStr = `${year}-${month}-${day}`;
      console.log(`[SCAN-LAWYER-NAMES] Extracted date from PDF: ${dateStr}`);
      return dateStr;
    }
  }

  console.log('[SCAN-LAWYER-NAMES] Could not extract date from PDF content');
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
      .select('id, storage_path, text_content, bench, list_type, list_date')
      .in('status', ['downloaded', 'notes_extracted', 'scanning'])
      .order('created_at', { ascending: true })
      .limit(1);

    if (body.causelist_id) {
      causelistQuery = supabase
        .from('raw_causelists')
        .select('id, storage_path, text_content, bench, list_type, list_date')
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

    for (const causelist of causelists) {
      console.log(`[SCAN-LAWYER-NAMES] Processing causelist: ${causelist.id} (${causelist.bench} ${causelist.list_type})`);

      // Get or extract text content
      let textContent = causelist.text_content;

      if (!textContent) {
        // Mark as extracting FIRST to prevent duplicate processing
        await supabase
          .from('raw_causelists')
          .update({ status: 'extracting' })
          .eq('id', causelist.id);
        
        console.log('[SCAN-LAWYER-NAMES] No cached text, extracting from PDF...');
        
        const { data: pdfData, error: downloadError } = await supabase.storage
          .from('causelist-pdfs')
          .download(causelist.storage_path);

        if (downloadError || !pdfData) {
          console.error(`[SCAN-LAWYER-NAMES] Failed to download PDF: ${downloadError?.message}`);
          await supabase.from('raw_causelists').update({ status: 'download_error' }).eq('id', causelist.id);
          continue;
        }

        // Extract text using unpdf
        const arrayBuffer = await pdfData.arrayBuffer();
        textContent = await extractTextFromPDF(arrayBuffer);

        if (!textContent) {
          console.error('[SCAN-LAWYER-NAMES] Failed to extract text from PDF');
          await supabase.from('raw_causelists').update({ status: 'extract_error' }).eq('id', causelist.id);
          continue;
        }

        // Extract date and save text immediately
        const extractedDate = extractCauselistDate(textContent);
        console.log(`[SCAN-LAWYER-NAMES] Extracted date: ${extractedDate}, saving ${textContent.length} chars`);
        
        const { error: saveError } = await supabase
          .from('raw_causelists')
          .update({ 
            text_content: textContent.substring(0, 500000), 
            status: 'scanned',
            list_date: extractedDate || causelist.list_date
          })
          .eq('id', causelist.id);

        if (saveError) {
          console.error(`[SCAN-LAWYER-NAMES] Failed to save text: ${saveError.message}`);
          continue;
        }
        console.log('[SCAN-LAWYER-NAMES] Text saved successfully');
      } else {
        // Even if text is cached, try to extract and update date if not already set
        const extractedDate = extractCauselistDate(textContent);
        if (extractedDate && extractedDate !== causelist.list_date) {
          await supabase
            .from('raw_causelists')
            .update({ list_date: extractedDate })
            .eq('id', causelist.id);
          console.log(`[SCAN-LAWYER-NAMES] Updated cached causelist date to: ${extractedDate}`);
        }
      }

      const textLower = textContent.toLowerCase();

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

        // Get profile's aliases ONLY
        const { data: aliases } = await supabase
          .from('lawyer_aliases')
          .select('alias_name')
          .eq('profile_id', profile.id);

        if (!aliases?.length) {
          continue;
        }

        totalScans++;

        // Simple case-insensitive string matching - NO AI
        const matchedAliases: string[] = [];
        for (const { alias_name } of aliases) {
          const aliasLower = alias_name.toLowerCase().trim();
          if (textLower.includes(aliasLower)) {
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

          // Enqueue parsing tasks for each matched alias
          for (const alias of matchedAliases) {
            const { error: queueError } = await supabase
              .from('case_parse_queue')
              .insert({
                profile_id: profile.id,
                raw_causelist_id: causelist.id,
                matched_alias: alias,
                status: 'pending'
              });

            if (!queueError) {
              totalEnqueued++;
            }
          }
        } else {
          console.log(`[SCAN-LAWYER-NAMES] Profile ${profile.id}: No matches, STOPPING`);
        }
      }

      // Update causelist status
      await supabase
        .from('raw_causelists')
        .update({ status: 'scanned' })
        .eq('id', causelist.id);

      // Trigger parse-all-cases to extract all cases from this causelist
      const parseUrl = `${supabaseUrl}/functions/v1/parse-all-cases`;
      fetch(parseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ causelist_id: causelist.id })
      }).then(() => {
        console.log(`[SCAN-LAWYER-NAMES] Triggered parse-all-cases for ${causelist.id}`);
      }).catch(err => console.error('[SCAN-LAWYER-NAMES] Failed to trigger parse-all-cases:', err));
    }

    const duration = Date.now() - startTime;
    console.log(`[SCAN-LAWYER-NAMES] Completed: ${totalScans} scans, ${totalMatches} matches, ${totalEnqueued} enqueued, ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      scans_performed: totalScans,
      matches_found: totalMatches,
      tasks_enqueued: totalEnqueued,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[SCAN-LAWYER-NAMES] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
