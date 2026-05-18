/**
 * DPDP Act "right to erasure" handler.
 *
 * Calls the request_account_deletion RPC (anonymises profile, records
 * consent revocation) and then deletes the auth.users row via
 * service-role admin API.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = userData.user.id;

  let reason: string | null = null;
  try {
    const body = await req.json();
    reason = typeof body?.reason === 'string' ? body.reason : null;
  } catch {
    // empty body is fine
  }

  // 1) Anonymise profile + record consent revocation
  const { error: rpcError } = await userClient.rpc('request_account_deletion', { p_reason: reason });
  if (rpcError) {
    console.error('[account-deletion] RPC failed', rpcError);
    return new Response(JSON.stringify({ error: rpcError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 2) Delete the auth user (service role required).
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('[account-deletion] auth delete failed', deleteError);
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
