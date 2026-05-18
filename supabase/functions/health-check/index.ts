import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";

interface HealthCheckRequest {
  bench?: 'JAIPUR' | 'JODHPUR';
}

const ECOURTS_URLS: Record<string, string> = {
  JAIPUR: 'https://hcraj.nic.in/quick-causelist-jp/',
  JODHPUR: 'https://hcraj.nic.in/quick-causelist-jdp/',
};

async function pingEcourts(bench: 'JAIPUR' | 'JODHPUR') {
  const url = ECOURTS_URLS[bench];
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    return {
      online: response.ok || response.status === 405,
      status_code: response.status,
      latency_ms: Date.now() - start,
      url,
    };
  } catch (e) {
    return {
      online: false,
      status_code: 0,
      latency_ms: Date.now() - start,
      url,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkDatabase() {
  const start = Date.now();
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    // 1) cheap ping
    const { error: pingError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    // 2) unresolved P0s in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: p0Count, error: p0Error } = await supabase
      .from('admin_error_events')
      .select('id', { count: 'exact', head: true })
      .eq('severity', 'P0')
      .eq('resolved', false)
      .gte('created_at', oneHourAgo);

    return {
      online: !pingError,
      latency_ms: Date.now() - start,
      unresolved_p0_last_hour: p0Count ?? 0,
      error: pingError?.message ?? p0Error?.message ?? null,
    };
  } catch (e) {
    return {
      online: false,
      latency_ms: Date.now() - start,
      unresolved_p0_last_hour: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let body: HealthCheckRequest = {};
  try {
    body = await req.json();
  } catch {
    // GET or empty body — fine, we'll check everything.
  }

  const benches: Array<'JAIPUR' | 'JODHPUR'> = body.bench ? [body.bench] : ['JAIPUR', 'JODHPUR'];
  const [database, ...ecourts] = await Promise.all([
    checkDatabase(),
    ...benches.map(pingEcourts),
  ]);

  const allOk = database.online && ecourts.every((e) => e.online) && (database.unresolved_p0_last_hour ?? 0) === 0;

  return new Response(
    JSON.stringify({
      success: true,
      healthy: allOk,
      database,
      ecourts: benches.map((b, i) => ({ bench: b, ...ecourts[i] })),
      checked_at: new Date().toISOString(),
    }),
    {
      status: allOk ? 200 : 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});