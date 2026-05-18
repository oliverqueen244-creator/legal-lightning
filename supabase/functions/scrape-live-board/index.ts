import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
interface CourtStatus {
  court_no: string;
  current_item: number;
  is_supplementary_running: boolean;
  list_type: string;
  cross_court_from: string | null;
  status: string;
}

// Check if current time (in IST) is within court hours
// Hours: 9:00 AM - 1:00 PM (morning) + 2:00 PM - 6:00 PM (afternoon)
// Lunch break: 1:00 PM - 2:00 PM (scraper OFF)
function isCourtHours(): { inSession: boolean; reason: string } {
  const now = new Date();
  
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const dayOfWeek = istTime.getUTCDay(); // 0 = Sunday
  const timeInMinutes = hours * 60 + minutes;
  
  // Courts closed on Sunday
  if (dayOfWeek === 0) {
    return { inSession: false, reason: "Sunday - Courts closed" };
  }
  
  // Saturday - courts may have limited hours or be closed
  if (dayOfWeek === 6) {
    return { inSession: false, reason: "Saturday - Courts closed" };
  }
  
  // Fixed court hours as per requirement:
  // Morning session: 9:00 AM - 1:00 PM IST
  // Lunch break: 1:00 PM - 2:00 PM IST (OFF)
  // Afternoon session: 2:00 PM - 6:00 PM IST
  const morningStart = 9 * 60;  // 9:00 AM = 540 minutes
  const morningEnd = 13 * 60;   // 1:00 PM = 780 minutes (lunch starts)
  const afternoonStart = 14 * 60; // 2:00 PM = 840 minutes (lunch ends)
  const afternoonEnd = 18 * 60;   // 6:00 PM = 1080 minutes
  
  // Morning session: 9:00 AM - 1:00 PM
  if (timeInMinutes >= morningStart && timeInMinutes < morningEnd) {
    return { inSession: true, reason: "Morning session (9 AM - 1 PM)" };
  }
  
  // Lunch break: 1:00 PM - 2:00 PM
  if (timeInMinutes >= morningEnd && timeInMinutes < afternoonStart) {
    return { inSession: false, reason: `Lunch break (1 PM - 2 PM). Current IST: ${hours}:${minutes.toString().padStart(2, '0')}` };
  }
  
  // Afternoon session: 2:00 PM - 6:00 PM
  if (timeInMinutes >= afternoonStart && timeInMinutes < afternoonEnd) {
    return { inSession: true, reason: "Afternoon session (2 PM - 6 PM)" };
  }
  
  // Outside court hours
  return { inSession: false, reason: `Outside court hours (9 AM - 1 PM, 2 PM - 6 PM). Current IST: ${hours}:${minutes.toString().padStart(2, '0')}` };
}

// Parse item format: "293(S)", "75(D)", "[C-9] 645 (S)", "516-517(S)", "ADJ", "L.BREAK"
function parseItemNumber(itemStr: string): {
  current_item: number;
  is_supplementary_running: boolean;
  list_type: string;
  cross_court_from: string | null;
  status: string;
} {
  const trimmed = itemStr.trim().toUpperCase();
  
  // Check for special statuses
  if (trimmed.includes("ADJ") || trimmed.includes("ADJOURNED")) {
    return { current_item: 0, is_supplementary_running: false, list_type: "daily", cross_court_from: null, status: "adjourned" };
  }
  if (trimmed.includes("L.BREAK") || trimmed.includes("LUNCH")) {
    return { current_item: 0, is_supplementary_running: false, list_type: "daily", cross_court_from: null, status: "lunch" };
  }
  if (trimmed.includes("P/O") || trimmed.includes("PASSOVER")) {
    return { current_item: 0, is_supplementary_running: false, list_type: "daily", cross_court_from: null, status: "passover" };
  }
  
  const isSupplementary = trimmed.includes("(S)");
  const isDaily = trimmed.includes("(D)");
  
  // Check for cross-court assignment [C-9]
  const crossCourtMatch = trimmed.match(/\[C-?(\d+)\]/i);
  const crossCourtFrom = crossCourtMatch ? crossCourtMatch[1] : null;
  
  // Extract the item number (handles ranges like 516-517)
  const numberMatch = trimmed.match(/(\d+)(?:\s*-\s*\d+)?/);
  const currentItem = numberMatch ? parseInt(numberMatch[1], 10) : 0;
  
  return {
    current_item: currentItem,
    is_supplementary_running: isSupplementary,
    list_type: isSupplementary ? "supplementary" : "daily",
    cross_court_from: crossCourtFrom,
    status: currentItem > 0 ? "hearing" : "hearing",
  };
}

// Parse HTML table to extract court data
function parseDisplayBoard(html: string, courtLocation: string): CourtStatus[] {
  const results: CourtStatus[] = [];
  
  // Find the tbody with class "mytbody" which contains the court data
  const tbodyMatch = html.match(/<tbody class="mytbody">([\s\S]*?)<\/tbody>/i);
  
  if (tbodyMatch) {
    const tbodyContent = tbodyMatch[1];
    
    // Match each row - the structure is:
    // <tr><td>Court Number</td><td>Item Number</td></tr>
    const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
    
    let match;
    while ((match = rowRegex.exec(tbodyContent)) !== null) {
      // Extract text content, removing HTML tags
      const courtNoRaw = match[1].replace(/<[^>]*>/g, "").trim();
      const itemRaw = match[2].replace(/<[^>]*>/g, "").trim();
      
      // Extract just the number from court cell
      const courtNoMatch = courtNoRaw.match(/(\d+)/);
      const courtNo = courtNoMatch ? courtNoMatch[1] : "";
      
      if (courtNo && itemRaw) {
        const parsed = parseItemNumber(itemRaw);
        results.push({
          court_no: courtNo,
          ...parsed,
        });
        console.log(`[${courtLocation}] Court ${courtNo}: "${itemRaw}" -> item=${parsed.current_item}, supp=${parsed.is_supplementary_running}, cross=${parsed.cross_court_from}`);
      }
    }
  }
  
  // Fallback: try matching td pairs directly if tbody approach failed
  if (results.length === 0) {
    console.log(`[${courtLocation}] Fallback parsing...`);
    
    // Look for consecutive td pairs in table
    const tdPairRegex = /<td[^>]*>[\s]*(\d{1,2})[\s]*<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi;
    
    let match;
    while ((match = tdPairRegex.exec(html)) !== null) {
      const courtNo = match[1].trim();
      const itemRaw = match[2].replace(/<[^>]*>/g, "").trim();
      
      // Skip if item doesn't look like a valid item number
      if (!/\d|ADJ|BREAK|P\/O/i.test(itemRaw)) continue;
      
      const parsed = parseItemNumber(itemRaw);
      results.push({
        court_no: courtNo,
        ...parsed,
      });
    }
  }

  console.log(`[${courtLocation}] Parsed ${results.length} courts from HTML`);
  return results;
}

async function scrapeBoard(url: string, location: string): Promise<CourtStatus[]> {
  try {
    console.log(`Fetching ${location} display board...`);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${location}: ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    console.log(`[${location}] Received ${html.length} bytes`);
    
    return parseDisplayBoard(html, location);
  } catch (error) {
    console.error(`Error scraping ${location}:`, error);
    return [];
  }
}

async function markAllCourtsInactive(supabase: any, location: string): Promise<void> {
  const { error } = await supabase
    .from("live_board_cache")
    .update({ is_active: false })
    .eq("court_location", location);
  
  if (error) {
    console.error(`Error marking ${location} courts inactive:`, error);
  } else {
    console.log(`[${location}] Marked all courts as inactive`);
  }
}

// Track case item transitions for duration estimation
async function trackItemTransition(
  supabase: any,
  location: string,
  courtNo: string,
  prevItem: number,
  newItem: number,
  isSupplementary: boolean,
  sessionDate: string
): Promise<void> {
  const now = new Date().toISOString();
  
  try {
    // Close previous item if it was active and calculate duration
    if (prevItem > 0 && prevItem !== newItem) {
      // First, get the started_at time to calculate duration
      const { data: prevRecord, error: fetchError } = await supabase
        .from("case_item_durations")
        .select("id, started_at")
        .eq("court_location", location)
        .eq("court_no", courtNo)
        .eq("item_no", prevItem)
        .eq("session_date", sessionDate)
        .is("ended_at", null)
        .maybeSingle();
      
      if (!fetchError && prevRecord) {
        // Calculate duration in JavaScript
        const startedAt = new Date(prevRecord.started_at);
        const endedAt = new Date(now);
        const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
        
        // Only record valid durations (30s to 1 hour)
        const validDuration = durationSeconds >= 30 && durationSeconds <= 3600 
          ? durationSeconds 
          : null;
        
        const { error: closeError } = await supabase
          .from("case_item_durations")
          .update({ 
            ended_at: now,
            duration_seconds: validDuration
          })
          .eq("id", prevRecord.id);
        
        if (closeError) {
          console.error(`[${location}] Error closing item ${prevItem}:`, closeError);
        } else {
          console.log(`[${location}] Closed item ${prevItem}, duration: ${validDuration || 'invalid'}s`);
        }
      }
    }
    
    // Start tracking new item if it's a valid item number
    if (newItem > 0 && newItem !== prevItem) {
      const { error: insertError } = await supabase
        .from("case_item_durations")
        .upsert({
          court_location: location,
          court_no: courtNo,
          item_no: newItem,
          is_supplementary: isSupplementary,
          started_at: now,
          session_date: sessionDate,
        }, {
          onConflict: "court_location,court_no,item_no,is_supplementary,session_date",
          ignoreDuplicates: true
        });
      
      if (insertError && !insertError.message?.includes("duplicate")) {
        console.error(`[${location}] Error starting item ${newItem}:`, insertError);
      } else {
        console.log(`[${location}] Started tracking item ${newItem}`);
      }
    }
  } catch (error) {
    // Don't let tracking failures affect the main scraping
    console.error(`[${location}] Item transition tracking error:`, error);
  }
}

async function updateLiveBoardCache(
  supabase: any,
  location: string,
  courts: CourtStatus[]
): Promise<void> {
  const now = new Date().toISOString();
  const sessionDate = now.split("T")[0]; // YYYY-MM-DD
  
  // First, fetch current state for transition tracking
  const { data: currentState } = await supabase
    .from("live_board_cache")
    .select("court_no, current_item, is_supplementary_running")
    .eq("court_location", location);
  
  const currentStateMap = new Map<string, { item: number; supp: boolean }>();
  if (currentState) {
    for (const row of currentState) {
      currentStateMap.set(row.court_no, { 
        item: row.current_item, 
        supp: row.is_supplementary_running 
      });
    }
  }
  
  // Mark all courts for this location as inactive first
  await markAllCourtsInactive(supabase, location);
  
  // Track transitions and upsert active courts
  for (const court of courts) {
    const prev = currentStateMap.get(court.court_no);
    const prevItem = prev?.item || 0;
    
    // Track item transition for duration estimation
    if (court.current_item !== prevItem) {
      await trackItemTransition(
        supabase,
        location,
        court.court_no,
        prevItem,
        court.current_item,
        court.is_supplementary_running,
        sessionDate
      );
    }
    
    const { error } = await supabase
      .from("live_board_cache")
      .upsert(
        {
          court_location: location,
          court_no: court.court_no,
          current_item: court.current_item,
          is_supplementary_running: court.is_supplementary_running,
          list_type: court.list_type,
          cross_court_from: court.cross_court_from,
          status: court.status,
          last_updated: now,
          source_timestamp: now,
          is_active: true,
        },
        {
          onConflict: "court_location,court_no",
        }
      );
    
    if (error) {
      console.error(`Error upserting court ${location}-${court.court_no}:`, error);
    }
  }
  
  console.log(`[${location}] Updated ${courts.length} active courts in cache`);
}

async function markAllCourtsNotSitting(supabase: any): Promise<void> {
  // Update all courts by filtering on court_location (both benches)
  const { error } = await supabase
    .from("live_board_cache")
    .update({ 
      is_active: false,
      status: 'not_sitting'
    })
    .in("court_location", ["JODHPUR", "JAIPUR"]);
  
  if (error) {
    console.error("Error marking all courts as not sitting:", error);
  } else {
    console.log("Marked all courts as not sitting (outside court hours)");
  }
}

async function logSyncStatus(
  supabase: any,
  location: string,
  courtsCount: number,
  latencyMs: number,
  error?: string
): Promise<void> {
  await supabase.from("sync_status").insert({
    source_name: `live-board-${location.toLowerCase()}`,
    status: error ? "error" : "healthy",
    error_message: error || null,
    sync_latency_ms: latencyMs,
    last_sync_at: new Date().toISOString(),
    last_source_timestamp: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check if we're within court hours
  const courtHoursCheck = isCourtHours();
  console.log(`Court hours check: ${courtHoursCheck.inSession ? 'IN SESSION' : 'CLOSED'} - ${courtHoursCheck.reason}`);
  
  if (!courtHoursCheck.inSession) {
    // Mark all courts as not sitting and return early
    await markAllCourtsNotSitting(supabase);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Courts not in session",
        reason: courtHoursCheck.reason,
        scrapes: 0,
        courts_marked_inactive: true
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const JODHPUR_URL = "https://hcraj.nic.in/displayboard/jodhpur.php";
  const JAIPUR_URL = "https://hcraj.nic.in/displayboard/jaipur.php";
  
  const LOOP_DURATION_MS = 55000; // Run for 55 seconds
  const SCRAPE_INTERVAL_MS = 3000; // Scrape every 3 seconds
  
  const startTime = Date.now();
  let scrapeCount = 0;
  let totalJodhpurCourts = 0;
  let totalJaipurCourts = 0;

  console.log("Starting live board scraper loop...");

  // Main loop - runs for ~55 seconds
  while (Date.now() - startTime < LOOP_DURATION_MS) {
    const scrapeStart = Date.now();
    
    try {
      // Scrape both boards in parallel
      const [jodhpurCourts, jaipurCourts] = await Promise.all([
        scrapeBoard(JODHPUR_URL, "JODHPUR"),
        scrapeBoard(JAIPUR_URL, "JAIPUR"),
      ]);
      
      const scrapeLatency = Date.now() - scrapeStart;
      
      // Update database in parallel (this now marks inactive first, then updates active)
      await Promise.all([
        updateLiveBoardCache(supabase, "JODHPUR", jodhpurCourts),
        updateLiveBoardCache(supabase, "JAIPUR", jaipurCourts),
      ]);
      
      // Log sync status (only every 5th scrape to reduce DB writes)
      if (scrapeCount % 5 === 0) {
        await Promise.all([
          logSyncStatus(supabase, "JODHPUR", jodhpurCourts.length, scrapeLatency),
          logSyncStatus(supabase, "JAIPUR", jaipurCourts.length, scrapeLatency),
        ]);
      }
      
      totalJodhpurCourts = jodhpurCourts.length;
      totalJaipurCourts = jaipurCourts.length;
      scrapeCount++;
      
      console.log(`Scrape #${scrapeCount}: JODHPUR=${jodhpurCourts.length}, JAIPUR=${jaipurCourts.length}, latency=${scrapeLatency}ms`);
      
    } catch (error) {
      console.error(`Scrape error:`, error);
    }
    
    // Wait for next interval
    const elapsed = Date.now() - scrapeStart;
    const waitTime = Math.max(0, SCRAPE_INTERVAL_MS - elapsed);
    
    if (Date.now() - startTime + waitTime < LOOP_DURATION_MS) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } else {
      break; // Exit loop if we'd exceed the duration
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log(`Scraper loop completed: ${scrapeCount} scrapes in ${totalDuration}ms`);

  return new Response(
    JSON.stringify({
      success: true,
      scrapes: scrapeCount,
      duration_ms: totalDuration,
      jodhpur_courts: totalJodhpurCourts,
      jaipur_courts: totalJaipurCourts,
      court_session: courtHoursCheck.reason,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
