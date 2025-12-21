import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ACCOUNT-WISE NAME SCAN (CRITICAL)
 * 
 * This function orchestrates PDF text extraction and alias scanning:
 * 1. Check if text extraction is complete
 * 2. If not: trigger chunked extraction via pdf-extract-chunk
 * 3. If complete: search for profile's aliases (case-insensitive string match)
 * 4. If match found: enqueue parsing task
 * 
 * ❌ NO case number extraction
 * ❌ NO party identification
 * ❌ NO inserts to daily_court_docket
 */

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
      .select('id, storage_path, text_content, extraction_progress, bench, list_type, list_date, page_count')
      .in('status', ['downloaded', 'notes_extracted', 'scanning', 'text_extracted', 'extracting'])
      .order('created_at', { ascending: true })
      .limit(1);

    if (body.causelist_id) {
      causelistQuery = supabase
        .from('raw_causelists')
        .select('id, storage_path, text_content, extraction_progress, bench, list_type, list_date, page_count')
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

      // Text extraction is complete, proceed with scanning
      console.log(`[SCAN-LAWYER-NAMES] Text ready: ${textContent.length} chars, scanning for aliases...`);

      // Extract and update date if needed
      const extractedDate = extractCauselistDate(textContent);
      if (extractedDate && extractedDate !== causelist.list_date) {
        await supabase
          .from('raw_causelists')
          .update({ list_date: extractedDate })
          .eq('id', causelist.id);
        console.log(`[SCAN-LAWYER-NAMES] Updated causelist date to: ${extractedDate}`);
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

        // Get profile's aliases
        const { data: aliases } = await supabase
          .from('lawyer_aliases')
          .select('alias_name')
          .eq('profile_id', profile.id);

        if (!aliases?.length) {
          continue;
        }

        totalScans++;

        // Simple case-insensitive string matching
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

      // Update causelist status to scanned
      await supabase
        .from('raw_causelists')
        .update({ status: 'scanned' })
        .eq('id', causelist.id);

      // Trigger parse-all-cases
      fetch(`${supabaseUrl}/functions/v1/parse-all-cases`, {
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
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
