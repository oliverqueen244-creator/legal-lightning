/**
 * Edge Function: fetch-case-orders
 * 
 * Fetches orders for a specific case from eCourts portal.
 * 
 * ⚠️ CRITICAL LIMITATIONS:
 * - Requires CAPTCHA solving (manual or via service)
 * - Rate limited to prevent IP blocks
 * - PDF availability may be delayed
 * 
 * Flow:
 * 1. Receive case details (type, number, year, bench)
 * 2. Check rate limits
 * 3. Attempt to fetch orders page
 * 4. If CAPTCHA detected → queue for manual solving OR use solving service
 * 5. Parse orders table
 * 6. Queue new PDFs for download
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  ECOURTS_CONFIG, 
  buildCaseOrdersUrl, 
  detectCaptcha, 
  detectBlocking,
  canMakeRequest,
  recordRequest,
  type Bench 
} from "../_shared/courtScraper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FetchOrdersRequest {
  tracked_case_id: string;
  case_type: string;
  case_number: number;
  case_year: number;
  bench: Bench;
  trigger: 'manual' | 'backfill' | 'post_listing' | 'scheduled';
  captcha_solution?: string;  // If CAPTCHA was pre-solved
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: FetchOrdersRequest = await req.json();
    const { tracked_case_id, case_type, case_number, case_year, bench, trigger } = body;

    console.log(`[fetch-case-orders] Starting for case ${case_type} ${case_number}/${case_year} at ${bench}`);

    // 1. Check rate limits
    const rateCheck = canMakeRequest(bench);
    if (!rateCheck.allowed) {
      console.log(`[fetch-case-orders] Rate limited. Wait ${rateCheck.waitMs}ms`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'rate_limited',
          retry_after_ms: rateCheck.waitMs 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Try to lock case for processing
    const { data: jobId, error: lockError } = await supabase
      .rpc('try_lock_case_for_job', { 
        p_case_id: tracked_case_id, 
        p_job_type: trigger 
      });

    if (lockError || !jobId) {
      console.log(`[fetch-case-orders] Case is locked or error:`, lockError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'case_locked' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Build URL and fetch (this is where CAPTCHA blocks us)
    const ordersUrl = buildCaseOrdersUrl(bench);
    console.log(`[fetch-case-orders] Fetching: ${ordersUrl}`);
    
    recordRequest(bench);

    // ⚠️ LIMITATION: The actual form submission requires:
    // - Selecting case type from dropdown
    // - Entering case number and year
    // - Solving CAPTCHA
    // - Submitting the form via POST
    
    // For now, we can only detect if the page is accessible
    const response = await fetch(ordersUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const html = await response.text();

    // 4. Check for blocking
    const blockCheck = detectBlocking(html, response.status);
    if (blockCheck.blocked) {
      console.error(`[fetch-case-orders] Blocked: ${blockCheck.reason}`);
      
      // Update job as blocked
      await supabase
        .from('order_fetch_jobs')
        .update({ 
          status: 'failed',
          error_reason: blockCheck.reason,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      return new Response(
        JSON.stringify({ success: false, error: 'blocked', reason: blockCheck.reason }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Check for CAPTCHA
    if (detectCaptcha(html)) {
      console.log(`[fetch-case-orders] CAPTCHA detected`);
      
      // Update job status
      await supabase
        .from('order_fetch_jobs')
        .update({ 
          status: 'captcha_blocked',
          captcha_required: true,
          error_reason: 'CAPTCHA required - manual intervention needed'
        })
        .eq('id', jobId);

      // Queue for manual CAPTCHA solving
      await supabase
        .from('captcha_queue')
        .insert({
          job_id: jobId,
          captcha_image_url: ordersUrl,
          status: 'pending',
        });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'captcha_required',
          job_id: jobId,
          message: 'CAPTCHA detected. Case queued for manual intervention.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. If we somehow got past CAPTCHA (unlikely without solving it)
    // This would be the parsing logic
    console.log(`[fetch-case-orders] Page loaded. HTML length: ${html.length}`);
    
    // Mark job as needing manual processing
    await supabase
      .from('order_fetch_jobs')
      .update({ 
        status: 'manual_required',
        error_reason: 'Automated parsing not possible - requires form submission with CAPTCHA'
      })
      .eq('id', jobId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        job_id: jobId,
        status: 'manual_required',
        message: 'Page accessible but automated form submission not implemented. CAPTCHA solving service required.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fetch-case-orders] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
