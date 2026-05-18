import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
/**
 * AGGREGATE CASE DURATIONS
 * 
 * Calculates and updates court-specific average case durations.
 * Should be run daily after court hours to refresh averages.
 * 
 * Process:
 * 1. Close any open duration records from today (session ended)
 * 2. Calculate duration for records where it's missing
 * 3. Refresh the court_avg_duration table with new aggregates
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const results = {
    closedRecords: 0,
    calculatedDurations: 0,
    updatedAverages: 0,
    errors: [] as string[],
  };

  try {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();

    // Step 1: Close any open records from today (court session ended)
    console.log("Closing open duration records from today...");
    const { data: openRecords, error: fetchError } = await supabase
      .from("case_item_durations")
      .select("id, started_at")
      .eq("session_date", today)
      .is("ended_at", null);

    if (fetchError) {
      results.errors.push(`Failed to fetch open records: ${fetchError.message}`);
    } else if (openRecords && openRecords.length > 0) {
      for (const record of openRecords) {
        const startedAt = new Date(record.started_at);
        const endedAt = new Date(now);
        const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

        // Only count if reasonable duration (30s to 1 hour)
        const validDuration = durationSeconds >= 30 && durationSeconds <= 3600 
          ? durationSeconds 
          : null;

        const { error: updateError } = await supabase
          .from("case_item_durations")
          .update({ 
            ended_at: now,
            duration_seconds: validDuration
          })
          .eq("id", record.id);

        if (updateError) {
          results.errors.push(`Failed to close record ${record.id}: ${updateError.message}`);
        } else {
          results.closedRecords++;
        }
      }
    }

    // Step 2: Calculate duration for any records that have ended_at but no duration_seconds
    console.log("Calculating missing durations...");
    const { data: missingDurations, error: missingError } = await supabase
      .from("case_item_durations")
      .select("id, started_at, ended_at")
      .not("ended_at", "is", null)
      .is("duration_seconds", null);

    if (missingError) {
      results.errors.push(`Failed to fetch missing durations: ${missingError.message}`);
    } else if (missingDurations && missingDurations.length > 0) {
      for (const record of missingDurations) {
        const startedAt = new Date(record.started_at);
        const endedAt = new Date(record.ended_at);
        const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

        // Only count if reasonable duration
        const validDuration = durationSeconds >= 30 && durationSeconds <= 3600 
          ? durationSeconds 
          : null;

        const { error: updateError } = await supabase
          .from("case_item_durations")
          .update({ duration_seconds: validDuration })
          .eq("id", record.id);

        if (!updateError && validDuration) {
          results.calculatedDurations++;
        }
      }
    }

    // Step 3: Refresh court averages using the database function
    console.log("Refreshing court averages...");
    const { data: refreshCount, error: refreshError } = await supabase
      .rpc("refresh_court_averages");

    if (refreshError) {
      results.errors.push(`Failed to refresh averages: ${refreshError.message}`);
    } else {
      results.updatedAverages = refreshCount || 0;
    }

    console.log("Aggregation complete:", results);

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        ...results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Aggregation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        ...results,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
