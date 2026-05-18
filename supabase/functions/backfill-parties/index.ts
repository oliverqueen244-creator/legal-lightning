import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
interface BackfillRequest {
  date?: string;
  dry_run?: boolean;
  limit?: number;
}

/**
 * PHASE 3: Party Backfill from case_title_raw
 * 
 * Pattern observed in Rajasthan HC causelists:
 * "PETITIONER_NAME STATE OF RAJASTHAN (Department info)"
 * "PETITIONER_NAME THE STATE OF RAJASTHAN"
 * "PETITIONER_NAME RESPONDENT_NAME (with departments)"
 * 
 * Strategy:
 * 1. If "STATE OF RAJASTHAN" present - split on it
 * 2. If "VS" or "V/S" present - split on it  
 * 3. Otherwise use longest capitalized prefix heuristic
 */

// Known respondent markers that indicate where petitioner ends
const RESPONDENT_MARKERS = [
  /\bSTATE\s+OF\s+RAJASTHAN\b/i,
  /\bTHE\s+STATE\s+OF\s+RAJASTHAN\b/i,
  /\bUNION\s+OF\s+INDIA\b/i,
  /\bTHE\s+UNION\s+OF\s+INDIA\b/i,
  /\bSTATE\b(?=\s*\()/i, // "STATE (" pattern
];

// VS patterns
const VS_PATTERNS = [
  /\s+VS\.?\s+/i,
  /\s+V\/S\.?\s+/i,
  /\s+VERSUS\s+/i,
];

function extractPartiesFromTitle(caseTitle: string): { petitioner: string | null; respondent: string | null } {
  if (!caseTitle || caseTitle.trim().length < 5) {
    return { petitioner: null, respondent: null };
  }

  const cleaned = caseTitle.trim();
  
  // Skip if it looks like garbage (page numbers, time markers)
  if (/^Page\s+\d+/i.test(cleaned) || /^\d+:\d+\s*(AM|PM)/i.test(cleaned)) {
    return { petitioner: null, respondent: null };
  }

  // Remove trailing page/time markers
  const withoutTrailers = cleaned
    .replace(/\s*Page\s+\d+\s+of\s+\d+\s*$/i, '')
    .replace(/\s*\d{1,2}:\d{2}\s*(AM|PM)\s+TO\s+\d{1,2}:\d{2}\s*(AM|PM)\s*$/i, '')
    .trim();

  // Try VS patterns first (most reliable)
  for (const vsPattern of VS_PATTERNS) {
    const match = withoutTrailers.match(vsPattern);
    if (match && match.index !== undefined) {
      const petitioner = withoutTrailers.slice(0, match.index).trim();
      const respondent = withoutTrailers.slice(match.index + match[0].length).trim();
      if (petitioner && respondent) {
        return { 
          petitioner: cleanPartyName(petitioner), 
          respondent: cleanPartyName(respondent) 
        };
      }
    }
  }

  // Try known respondent markers
  for (const marker of RESPONDENT_MARKERS) {
    const match = withoutTrailers.match(marker);
    if (match && match.index !== undefined && match.index > 3) {
      const petitioner = withoutTrailers.slice(0, match.index).trim();
      const respondentPart = withoutTrailers.slice(match.index).trim();
      if (petitioner) {
        return { 
          petitioner: cleanPartyName(petitioner), 
          respondent: cleanPartyName(respondentPart) 
        };
      }
    }
  }

  // Fallback: Find capitalized segments
  // Pattern: "NAME1 NAME2 (stuff)" - first all-caps word sequence is petitioner
  const words = withoutTrailers.split(/\s+/);
  
  // Find transition point - where we go from CAPS to mixed case or hit (
  let petitionerEnd = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Stop at parenthesis
    if (word.startsWith('(')) break;
    // Check if word is all caps (excluding small words)
    if (word.length > 2 && word === word.toUpperCase() && /^[A-Z]/.test(word)) {
      petitionerEnd = i + 1;
    } else if (petitionerEnd > 0) {
      // Hit a non-caps word after we had caps
      break;
    }
  }

  if (petitionerEnd > 0 && petitionerEnd < words.length) {
    const petitioner = words.slice(0, petitionerEnd).join(' ');
    const respondent = words.slice(petitionerEnd).join(' ');
    return {
      petitioner: cleanPartyName(petitioner),
      respondent: cleanPartyName(respondent)
    };
  }

  // Last resort: just return the whole thing as petitioner
  return { 
    petitioner: cleanPartyName(withoutTrailers), 
    respondent: null 
  };
}

function cleanPartyName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/^\s*[,;]\s*/, '')
    .replace(/\s*[,;]\s*$/, '')
    .trim();
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: BackfillRequest = await req.json().catch(() => ({}));
    const dryRun = body.dry_run ?? false;
    const limit = body.limit ?? 5000;

    console.log(`[BACKFILL-PARTIES] Starting. dry_run=${dryRun}, limit=${limit}, date=${body.date || 'all'}`);

    // Get cases needing party backfill
    let query = supabase
      .from('daily_court_docket')
      .select('id, case_title_raw, petitioner, respondent')
      .is('petitioner', null)
      .not('case_title_raw', 'is', null)
      .limit(limit);

    if (body.date) {
      query = query.eq('date', body.date);
    }

    const { data: cases, error: fetchError } = await query;

    if (fetchError) {
      console.error('[BACKFILL-PARTIES] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch cases', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BACKFILL-PARTIES] Found ${cases?.length || 0} cases to process`);

    const stats = {
      total_processed: 0,
      success_both: 0,
      success_petitioner_only: 0,
      failed: 0,
      skipped_garbage: 0,
      examples: [] as any[],
      failures: [] as any[],
    };

    const updates: { id: string; petitioner: string; respondent: string | null }[] = [];

    for (const caseRow of (cases || [])) {
      stats.total_processed++;
      
      const result = extractPartiesFromTitle(caseRow.case_title_raw);

      if (result.petitioner) {
        if (result.respondent) {
          stats.success_both++;
        } else {
          stats.success_petitioner_only++;
        }

        updates.push({
          id: caseRow.id,
          petitioner: result.petitioner,
          respondent: result.respondent,
        });

        // Collect examples
        if (stats.examples.length < 10) {
          stats.examples.push({
            raw: caseRow.case_title_raw.slice(0, 150),
            petitioner: result.petitioner.slice(0, 80),
            respondent: result.respondent?.slice(0, 80) || null,
          });
        }
      } else {
        if (caseRow.case_title_raw.includes('Page') || caseRow.case_title_raw.includes('AM')) {
          stats.skipped_garbage++;
        } else {
          stats.failed++;
          if (stats.failures.length < 5) {
            stats.failures.push(caseRow.case_title_raw.slice(0, 150));
          }
        }
      }
    }

    // Apply updates if not dry run
    let updatedCount = 0;
    if (!dryRun && updates.length > 0) {
      // Batch update in chunks of 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        for (const update of batch) {
          // SAFETY: Never overwrite non-NULL values
          const { error: updateError } = await supabase
            .from('daily_court_docket')
            .update({
              petitioner: update.petitioner,
              respondent: update.respondent,
            })
            .eq('id', update.id)
            .is('petitioner', null); // CRITICAL: Only update if still NULL

          if (!updateError) {
            updatedCount++;
          }
        }

        console.log(`[BACKFILL-PARTIES] Progress: ${i + batch.length}/${updates.length}`);
      }
    }

    const response = {
      success: true,
      dry_run: dryRun,
      stats: {
        total_cases_found: cases?.length || 0,
        total_processed: stats.total_processed,
        would_update: updates.length,
        actually_updated: dryRun ? 0 : updatedCount,
        success_both_parties: stats.success_both,
        success_petitioner_only: stats.success_petitioner_only,
        failed: stats.failed,
        skipped_garbage: stats.skipped_garbage,
        success_rate: stats.total_processed > 0 
          ? `${(((stats.success_both + stats.success_petitioner_only) / stats.total_processed) * 100).toFixed(1)}%`
          : '0%',
      },
      examples: stats.examples,
      failure_samples: stats.failures,
    };

    console.log(`[BACKFILL-PARTIES] Complete:`, JSON.stringify(response.stats));

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BACKFILL-PARTIES] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', details: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
