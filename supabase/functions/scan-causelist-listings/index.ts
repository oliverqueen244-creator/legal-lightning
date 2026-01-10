/**
 * Edge Function: scan-causelist-listings
 * 
 * Scans the daily cause list to mark which tracked cases are listed today.
 * This enables the post-listing order polling workflow.
 * 
 * Trigger: Once per day per bench (via cron or manual)
 * 
 * Flow:
 * 1. Get today's cause list (already parsed in raw_causelists/daily_court_docket)
 * 2. Match against tracked_cases by case_number + case_type + bench
 * 3. Mark matches as listed_today = true
 * 4. Queue post-listing order checks for +24h, +48h, +72h
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Bench = 'JAIPUR' | 'JODHPUR';

interface ScanRequest {
  bench: Bench;
  date?: string;  // YYYY-MM-DD, defaults to today
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: ScanRequest = await req.json();
    const bench = body.bench;
    const targetDate = body.date || new Date().toISOString().split('T')[0];

    console.log(`[scan-causelist-listings] Scanning ${bench} for ${targetDate}`);

    // 1. Reset listed_today for all cases in this bench
    const { error: resetError } = await supabase
      .from('tracked_cases')
      .update({ listed_today: false })
      .eq('bench', bench)
      .eq('listed_today', true);

    if (resetError) {
      console.warn(`[scan-causelist-listings] Reset warning:`, resetError.message);
    }

    // 2. Get all tracked cases for this bench
    const { data: trackedCases, error: trackedError } = await supabase
      .from('tracked_cases')
      .select('id, case_type, case_number, case_year')
      .eq('bench', bench)
      .eq('is_active', true);

    if (trackedError) throw trackedError;

    if (!trackedCases || trackedCases.length === 0) {
      console.log(`[scan-causelist-listings] No tracked cases for ${bench}`);
      return new Response(
        JSON.stringify({ success: true, matched: 0, total_tracked: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[scan-causelist-listings] Found ${trackedCases.length} tracked cases`);

    // 3. Get today's docket items for this bench
    const courtLocation = bench === 'JAIPUR' ? 'JAIPUR' : 'JODHPUR';
    
    const { data: docketItems, error: docketError } = await supabase
      .from('daily_court_docket')
      .select('case_number')
      .eq('court_location', courtLocation)
      .eq('date', targetDate);

    if (docketError) throw docketError;

    if (!docketItems || docketItems.length === 0) {
      console.log(`[scan-causelist-listings] No docket items found for ${targetDate}`);
      return new Response(
        JSON.stringify({ success: true, matched: 0, total_docket: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[scan-causelist-listings] Found ${docketItems.length} docket items`);

    // 4. Build lookup set of docket case numbers (normalized)
    const docketCaseNumbers = new Set(
      docketItems
        .map(item => item.case_number?.toUpperCase().replace(/\s+/g, ''))
        .filter(Boolean)
    );

    // 5. Match tracked cases against docket
    const matchedCaseIds: string[] = [];
    
    for (const tracked of trackedCases) {
      // Build case number string (e.g., "S.B.CIVILWRITPETITION/12345/2024")
      const normalizedCaseType = tracked.case_type.toUpperCase().replace(/\s+/g, '');
      const caseKey = `${normalizedCaseType}/${tracked.case_number}/${tracked.case_year}`;
      
      // Also try without year
      const caseKeyNoYear = `${normalizedCaseType}/${tracked.case_number}`;
      
      // Check various formats
      const isListed = Array.from(docketCaseNumbers).some(docketNum => {
        if (!docketNum) return false;
        return docketNum.includes(String(tracked.case_number)) &&
               docketNum.includes(normalizedCaseType.substring(0, 10)); // Partial match on type
      });
      
      if (isListed) {
        matchedCaseIds.push(tracked.id);
      }
    }

    console.log(`[scan-causelist-listings] Matched ${matchedCaseIds.length} cases`);

    // 6. Update matched cases
    if (matchedCaseIds.length > 0) {
      const { error: updateError } = await supabase
        .from('tracked_cases')
        .update({ 
          listed_today: true,
          last_listed_date: targetDate
        })
        .in('id', matchedCaseIds);

      if (updateError) throw updateError;

      // 7. Queue post-listing order checks
      const now = new Date();
      const jobsToInsert = matchedCaseIds.flatMap(caseId => [
        {
          job_type: 'post_listing',
          tracked_case_id: caseId,
          bench,
          status: 'pending',
          priority: 3,
          next_attempt_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // +24h
        },
        {
          job_type: 'post_listing',
          tracked_case_id: caseId,
          bench,
          status: 'pending',
          priority: 4,
          next_attempt_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(), // +48h
        },
        {
          job_type: 'post_listing',
          tracked_case_id: caseId,
          bench,
          status: 'pending',
          priority: 5,
          next_attempt_at: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(), // +72h
        },
      ]);

      const { error: jobError } = await supabase
        .from('order_fetch_jobs')
        .insert(jobsToInsert);

      if (jobError) {
        console.warn(`[scan-causelist-listings] Job queue warning:`, jobError.message);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: targetDate,
        bench,
        matched: matchedCaseIds.length,
        total_tracked: trackedCases.length,
        total_docket: docketItems.length,
        jobs_queued: matchedCaseIds.length * 3
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[scan-causelist-listings] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
