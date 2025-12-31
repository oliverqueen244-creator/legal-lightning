import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation
const VALID_ACTIONS = ['validate_all', 'validate_causelist', 'validate_live_board', 'cross_validate', 'get_logs'] as const;
type ValidAction = typeof VALID_ACTIONS[number];

function isValidAction(action: unknown): action is ValidAction {
  return typeof action === 'string' && VALID_ACTIONS.includes(action as ValidAction);
}

interface ValidationResult {
  type: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    // Validate action
    if (!isValidAction(action)) {
      console.error(`[data-validation] Invalid action: ${action}`);
      return new Response(
        JSON.stringify({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[data-validation] Action: ${action}`);

    const results: ValidationResult[] = [];

    if (action === 'validate_all' || action === 'validate_causelist') {
      // Validate causelist data
      const today = new Date().toISOString().split('T')[0];
      const { data: docketItems, error: docketError } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('date', today);

      if (docketError) {
        results.push({
          type: 'causelist_fetch',
          status: 'fail',
          message: 'Failed to fetch docket items',
          details: { error: docketError.message }
        });
      } else {
        // Check for duplicate item numbers per court
        const courtItems: Record<string, number[]> = {};
        docketItems?.forEach(item => {
          const key = `${item.court_location}_${item.court_room_no}_${item.list_type}`;
          if (!courtItems[key]) courtItems[key] = [];
          if (item.item_no) courtItems[key].push(item.item_no);
        });

        for (const [court, items] of Object.entries(courtItems)) {
          const duplicates = items.filter((item, index) => items.indexOf(item) !== index);
          if (duplicates.length > 0) {
            results.push({
              type: 'duplicate_item_no',
              status: 'warning',
              message: `Duplicate item numbers found in ${court}`,
              details: { court, duplicates }
            });
          }
        }

        // Check case number format (basic validation)
        const invalidCaseNumbers = docketItems?.filter(item => 
          item.case_number && !item.case_number.match(/^[A-Za-z\s\/\-0-9]+$/)
        );
        if (invalidCaseNumbers && invalidCaseNumbers.length > 0) {
          results.push({
            type: 'invalid_case_number',
            status: 'warning',
            message: `${invalidCaseNumbers.length} items with potentially invalid case numbers`,
            details: { count: invalidCaseNumbers.length }
          });
        }

        if (results.filter(r => r.type.startsWith('duplicate') || r.type.startsWith('invalid')).length === 0) {
          results.push({
            type: 'causelist_validation',
            status: 'pass',
            message: `Validated ${docketItems?.length || 0} docket items successfully`
          });
        }
      }
    }

    if (action === 'validate_all' || action === 'validate_live_board') {
      // Validate live board data
      const { data: liveBoards, error: boardError } = await supabase
        .from('live_board_cache')
        .select('*');

      if (boardError) {
        results.push({
          type: 'live_board_fetch',
          status: 'fail',
          message: 'Failed to fetch live board data',
          details: { error: boardError.message }
        });
      } else {
        const now = new Date();
        const staleThreshold = 30 * 1000; // 30 seconds

        liveBoards?.forEach(board => {
          const lastUpdated = new Date(board.last_updated);
          const staleMs = now.getTime() - lastUpdated.getTime();

          if (staleMs > staleThreshold) {
            results.push({
              type: 'stale_board_data',
              status: staleMs > 60000 ? 'fail' : 'warning',
              message: `${board.court_location} Court ${board.court_no} data is ${Math.round(staleMs / 1000)}s old`,
              details: {
                court_location: board.court_location,
                court_no: board.court_no,
                stale_seconds: Math.round(staleMs / 1000),
                last_updated: board.last_updated
              }
            });
          }

          // Check for invalid current_item
          if (board.current_item && board.current_item < 0) {
            results.push({
              type: 'invalid_current_item',
              status: 'fail',
              message: `Invalid current_item (${board.current_item}) for ${board.court_location} Court ${board.court_no}`,
              details: { court_location: board.court_location, court_no: board.court_no, current_item: board.current_item }
            });
          }

          // Check for valid status
          const validStatuses = ['hearing', 'passover', 'lunch', 'adjourned'];
          if (board.status && !validStatuses.includes(board.status)) {
            results.push({
              type: 'invalid_status',
              status: 'warning',
              message: `Invalid status "${board.status}" for ${board.court_location} Court ${board.court_no}`,
              details: { court_location: board.court_location, court_no: board.court_no, status: board.status }
            });
          }
        });

        const staleBoards = results.filter(r => r.type === 'stale_board_data');
        if (staleBoards.length === 0 && liveBoards && liveBoards.length > 0) {
          results.push({
            type: 'live_board_validation',
            status: 'pass',
            message: `All ${liveBoards.length} courts have fresh data (< 30s)`
          });
        }
      }
    }

    if (action === 'validate_all' || action === 'cross_validate') {
      // Cross-validate: ensure live_board courts have corresponding docket entries
      const today = new Date().toISOString().split('T')[0];
      
      const { data: liveBoards } = await supabase
        .from('live_board_cache')
        .select('court_location, court_no');

      const { data: docketItems } = await supabase
        .from('daily_court_docket')
        .select('court_location, court_room_no')
        .eq('date', today);

      if (liveBoards && docketItems) {
        const docketCourts = new Set(
          docketItems.map(d => `${d.court_location}_${d.court_room_no}`)
        );

        liveBoards.forEach(board => {
          const key = `${board.court_location}_${board.court_no}`;
          if (!docketCourts.has(key)) {
            results.push({
              type: 'orphan_live_board',
              status: 'warning',
              message: `Live board for ${board.court_location} Court ${board.court_no} has no docket entries today`,
              details: { court_location: board.court_location, court_no: board.court_no }
            });
          }
        });
      }
    }

    if (action === 'get_logs') {
      // Return recent validation logs
      const { data: logs, error: logsError } = await supabase
        .from('data_validation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch logs', details: logsError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ logs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log validation results
    for (const result of results) {
      await supabase.from('data_validation_logs').insert({
        validation_type: result.type,
        status: result.status,
        details: result.details,
        court_location: result.details?.court_location as string | undefined,
        court_no: result.details?.court_no as string | undefined
      });
    }

    const summary = {
      total: results.length,
      pass: results.filter(r => r.status === 'pass').length,
      warning: results.filter(r => r.status === 'warning').length,
      fail: results.filter(r => r.status === 'fail').length
    };

    console.log(`[data-validation] Completed: ${summary.pass} pass, ${summary.warning} warnings, ${summary.fail} failures`);

    return new Response(
      JSON.stringify({
        results,
        summary,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[data-validation] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
