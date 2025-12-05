import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncPayload {
  action: 'sync' | 'health' | 'force_sync';
  court_location?: string;
  court_no?: string;
  current_item?: number;
  status?: string;
  is_supplementary_running?: boolean;
  source_timestamp?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: SyncPayload = await req.json();
    const { action } = payload;

    console.log(`[sync-live-board] Action: ${action}`);

    if (action === 'health') {
      // Return sync health status
      const { data: syncStatus, error } = await supabase
        .from('sync_status')
        .select('*')
        .order('last_sync_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[sync-live-board] Error fetching sync status:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch sync status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get current live board data
      const { data: liveBoards } = await supabase
        .from('live_board_cache')
        .select('*');

      // Calculate staleness for each court
      const now = new Date();
      const healthStatus = liveBoards?.map(board => {
        const lastUpdated = new Date(board.last_updated);
        const staleSeconds = (now.getTime() - lastUpdated.getTime()) / 1000;
        return {
          court_location: board.court_location,
          court_no: board.court_no,
          last_updated: board.last_updated,
          stale_seconds: Math.round(staleSeconds),
          status: staleSeconds <= 30 ? 'live' : staleSeconds <= 60 ? 'delayed' : 'stale'
        };
      });

      return new Response(
        JSON.stringify({
          sync_history: syncStatus,
          courts: healthStatus,
          timestamp: now.toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sync' || action === 'force_sync') {
      const { court_location, court_no, current_item, status, is_supplementary_running, source_timestamp } = payload;

      if (!court_location || !court_no) {
        return new Response(
          JSON.stringify({ error: 'Missing court_location or court_no' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[sync-live-board] Syncing ${court_location} Court ${court_no}: Item ${current_item}, Status: ${status}`);

      // Update live_board_cache
      const { data: existingBoard } = await supabase
        .from('live_board_cache')
        .select('*')
        .eq('court_location', court_location)
        .eq('court_no', court_no)
        .single();

      const updateData = {
        court_location,
        court_no,
        current_item: current_item ?? existingBoard?.current_item ?? 1,
        status: status ?? existingBoard?.status ?? 'hearing',
        is_supplementary_running: is_supplementary_running ?? existingBoard?.is_supplementary_running ?? false,
        last_updated: new Date().toISOString(),
        source_timestamp: source_timestamp ?? new Date().toISOString()
      };

      const { error: upsertError } = await supabase
        .from('live_board_cache')
        .upsert(updateData, { onConflict: 'court_location,court_no' });

      if (upsertError) {
        console.error('[sync-live-board] Error upserting live board:', upsertError);
        
        // Log failed sync
        await supabase.from('sync_status').insert({
          source_name: `${court_location}_${court_no}`,
          last_sync_at: new Date().toISOString(),
          sync_latency_ms: Date.now() - startTime,
          status: 'failed',
          error_message: upsertError.message
        });

        return new Response(
          JSON.stringify({ error: 'Failed to update live board', details: upsertError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const syncLatency = Date.now() - startTime;

      // Log successful sync
      await supabase.from('sync_status').insert({
        source_name: `${court_location}_${court_no}`,
        last_sync_at: new Date().toISOString(),
        last_source_timestamp: source_timestamp,
        sync_latency_ms: syncLatency,
        status: 'healthy'
      });

      console.log(`[sync-live-board] Sync completed in ${syncLatency}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          court_location,
          court_no,
          sync_latency_ms: syncLatency,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-live-board] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
