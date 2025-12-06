import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckRequest {
  bench: 'JAIPUR' | 'JODHPUR';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bench } = await req.json() as HealthCheckRequest;
    
    const url = bench === 'JODHPUR' 
      ? 'https://hcraj.nic.in/quick-causelist-jdp/'
      : 'https://hcraj.nic.in/quick-causelist-jp/';
    
    console.log(`[HEALTH-CHECK] Pinging ${bench} portal: ${url}`);
    
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const latency = Date.now() - startTime;
    const isOnline = response.ok || response.status === 405; // Some servers don't allow HEAD
    
    console.log(`[HEALTH-CHECK] ${bench} portal: ${isOnline ? 'ONLINE' : 'OFFLINE'} (${latency}ms)`);
    
    return new Response(JSON.stringify({
      success: true,
      bench,
      online: isOnline,
      status_code: response.status,
      latency_ms: latency,
      url
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[HEALTH-CHECK] Error:', errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      online: false,
      error: errorMessage
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});