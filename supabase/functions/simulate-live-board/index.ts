import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, court_location, court_no, increment } = await req.json();

    if (action === "increment") {
      // Increment current item by specified amount (default 1)
      const { data: current, error: fetchError } = await supabase
        .from("live_board_cache")
        .select("current_item")
        .eq("court_location", court_location)
        .eq("court_no", court_no)
        .single();

      if (fetchError) throw fetchError;

      const newItem = (current?.current_item || 0) + (increment || 1);

      const { error: updateError } = await supabase
        .from("live_board_cache")
        .update({
          current_item: newItem,
          last_updated: new Date().toISOString(),
        })
        .eq("court_location", court_location)
        .eq("court_no", court_no);

      if (updateError) throw updateError;

      console.log(`Updated ${court_location} Court ${court_no} to item ${newItem}`);

      return new Response(
        JSON.stringify({ success: true, current_item: newItem }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "toggle_supplementary") {
      const { data: current, error: fetchError } = await supabase
        .from("live_board_cache")
        .select("is_supplementary_running")
        .eq("court_location", court_location)
        .eq("court_no", court_no)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from("live_board_cache")
        .update({
          is_supplementary_running: !current?.is_supplementary_running,
          last_updated: new Date().toISOString(),
        })
        .eq("court_location", court_location)
        .eq("court_no", court_no);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ 
          success: true, 
          is_supplementary_running: !current?.is_supplementary_running 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_status") {
      const { data, error } = await supabase
        .from("live_board_cache")
        .select("*");

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
