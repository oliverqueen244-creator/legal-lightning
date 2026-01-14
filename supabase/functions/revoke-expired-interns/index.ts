/**
 * INTERN INTEGRATION PHASE 2A: Scheduled Expiry Job
 * 
 * PURPOSE: Revoke expired intern accounts daily
 * 
 * CONSTRAINTS:
 * - Not callable by users (service role only)
 * - No UI surface
 * - Idempotent and silent
 * - Operational only
 * 
 * SECURITY REVIEW: 2026-01-14
 * - Uses service role key (not anon)
 * - Validates authorization header
 * - Logs all actions
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate authorization - must be service role or cron
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('x-cron-secret');
    
    // Check for cron secret (for scheduled invocation)
    const expectedCronSecret = Deno.env.get('CRON_SECRET');
    const isCronCall = expectedCronSecret && cronSecret === expectedCronSecret;
    
    // Check for service role key
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const isServiceCall = authHeader === `Bearer ${supabaseServiceKey}`;
    
    if (!isCronCall && !isServiceCall) {
      console.warn('[revoke-expired-interns] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Call the revocation function
    const { data, error } = await supabase.rpc('revoke_expired_intern_accounts');

    if (error) {
      console.error('[revoke-expired-interns] RPC error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const revokedCount = data || 0;
    
    console.log(`[revoke-expired-interns] Revoked ${revokedCount} expired intern account(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        revoked_count: revokedCount,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[revoke-expired-interns] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
