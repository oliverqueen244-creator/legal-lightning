import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CASE PARSING WORKER
 * 
 * Processes ONE queue item at a time:
 * 1. Get pending queue item
 * 2. Parse ONLY the matched alias's cases
 * 3. Insert into daily_court_docket with matched_profile_id
 * 4. Mark queue item as done
 * 
 * ✅ Per-case commit (no bulk insert)
 * ✅ Timeout safe (small work units)
 * ✅ Idempotent (checks for duplicates)
 */

interface ParsedCase {
  court_room_no: string;
  item_no: number;
  case_number: string;
  petitioner: string | null;
  respondent: string | null;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const TIMEOUT_GUARD_MS = 50000; // Stop 10s before edge function timeout
  console.log('[PARSE-CASE] Function started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const body = await req.json().catch(() => ({}));

    // Get next pending queue item
    const { data: queueItem, error: queueError } = await supabase
      .from('case_parse_queue')
      .select(`
        *,
        raw_causelists (
          id, storage_path, text_content, bench, list_type, list_date
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (queueError || !queueItem) {
      console.log('[PARSE-CASE] No pending items in queue');
      return new Response(JSON.stringify({ success: true, message: 'No pending items' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[PARSE-CASE] Processing queue item: ${queueItem.id}, alias: ${queueItem.matched_alias}`);

    // Mark as processing
    await supabase
      .from('case_parse_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', queueItem.id);

    const causelist = queueItem.raw_causelists;
    let textContent = causelist.text_content;

    // Get text content if not cached
    if (!textContent) {
      console.log('[PARSE-CASE] Fetching text content from storage...');
      
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from('causelist-pdfs')
        .download(causelist.storage_path);

      if (downloadError || !pdfData) {
        throw new Error(`Failed to download PDF: ${downloadError?.message}`);
      }

      const pdfBase64 = btoa(
        new Uint8Array(await pdfData.arrayBuffer())
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'Extract ALL text from this PDF. Return only raw text.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract all text from this PDF.' },
                { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } }
              ]
            }
          ],
          max_tokens: 50000
        })
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract text from PDF');
      }

      const extractResult = await extractResponse.json();
      textContent = extractResult.choices?.[0]?.message?.content || '';

      // Cache it
      await supabase
        .from('raw_causelists')
        .update({ text_content: textContent.substring(0, 100000) })
        .eq('id', causelist.id);
    }

    // Use AI to parse ONLY cases containing the matched alias
    console.log(`[PARSE-CASE] Parsing cases for alias: ${queueItem.matched_alias}`);

    const parsePrompt = `Extract all court cases from this causelist that mention the lawyer name "${queueItem.matched_alias}" (case-insensitive match).

For each matching case, extract:
- court_room_no: Court/Bench number (e.g., "DB-I", "SB-III")
- item_no: Serial/Item number (integer)
- case_number: Full case number (e.g., "S.B. Civil Writ Petition No. 1234/2024")
- petitioner: Petitioner name(s)
- respondent: Respondent name(s)  
- petitioner_lawyer: Lawyer(s) for petitioner (look for "Adv.", "Advocate", or lawyer names after petitioner)
- respondent_lawyer: Lawyer(s) for respondent

Return a JSON array of cases. Example:
[
  {
    "court_room_no": "DB-I",
    "item_no": 45,
    "case_number": "D.B. Civil Writ Petition No. 1234/2024",
    "petitioner": "ABC Company",
    "respondent": "State of Rajasthan",
    "petitioner_lawyer": "Sh. John Doe",
    "respondent_lawyer": "AAG"
  }
]

Only return valid JSON array. If no matching cases found, return empty array [].

Causelist text:
${textContent.substring(0, 80000)}`;

    const parseResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a legal document parser. Extract case data accurately. Return only valid JSON.' },
          { role: 'user', content: parsePrompt }
        ],
        max_tokens: 10000
      })
    });

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text();
      throw new Error(`AI parsing failed: ${errorText}`);
    }

    const parseResult = await parseResponse.json();
    let responseText = parseResult.choices?.[0]?.message?.content || '[]';

    // Clean JSON response
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsedCases: ParsedCase[] = [];
    try {
      parsedCases = JSON.parse(responseText);
      if (!Array.isArray(parsedCases)) {
        parsedCases = [];
      }
    } catch (e) {
      console.error('[PARSE-CASE] Failed to parse AI response:', e);
      parsedCases = [];
    }

    console.log(`[PARSE-CASE] Parsed ${parsedCases.length} cases for alias ${queueItem.matched_alias}`);

    // Insert cases ONE BY ONE with matched_profile_id
    let insertedCount = 0;
    let skippedCount = 0;

    for (const caseData of parsedCases) {
      // Check timeout guard
      if (Date.now() - startTime > TIMEOUT_GUARD_MS) {
        console.log('[PARSE-CASE] Timeout guard triggered, stopping inserts');
        break;
      }

      // Check for duplicate
      const { data: existing } = await supabase
        .from('daily_court_docket')
        .select('id')
        .eq('date', causelist.list_date)
        .eq('court_location', causelist.bench)
        .eq('case_number', caseData.case_number)
        .eq('item_no', caseData.item_no)
        .single();

      if (existing) {
        console.log(`[PARSE-CASE] Duplicate found, skipping: ${caseData.case_number}`);
        skippedCount++;
        continue;
      }

      // Insert with matched_profile_id (ACCOUNT ISOLATION)
      const { error: insertError } = await supabase
        .from('daily_court_docket')
        .insert({
          date: causelist.list_date,
          court_location: causelist.bench,
          list_type: causelist.list_type,
          court_room_no: caseData.court_room_no || 'UNKNOWN',
          item_no: caseData.item_no || 0,
          case_number: caseData.case_number,
          petitioner: caseData.petitioner,
          respondent: caseData.respondent,
          petitioner_lawyer: caseData.petitioner_lawyer,
          respondent_lawyer: caseData.respondent_lawyer,
          matched_profile_id: queueItem.profile_id, // CRITICAL: Account isolation
          source_url: causelist.storage_path,
          status: 'pending'
        });

      if (insertError) {
        console.error(`[PARSE-CASE] Insert failed for ${caseData.case_number}:`, insertError.message);
      } else {
        insertedCount++;
      }
    }

    // Mark queue item as done
    await supabase
      .from('case_parse_queue')
      .update({
        status: 'done',
        cases_parsed: insertedCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', queueItem.id);

    const duration = Date.now() - startTime;
    console.log(`[PARSE-CASE] Completed: ${insertedCount} inserted, ${skippedCount} skipped, ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      queue_item_id: queueItem.id,
      cases_parsed: parsedCases.length,
      cases_inserted: insertedCount,
      cases_skipped: skippedCount,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[PARSE-CASE] Error:', error);

    // Try to mark queue item as failed
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from('case_parse_queue')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('status', 'processing');
    } catch (e) {
      console.error('[PARSE-CASE] Failed to mark queue item as failed:', e);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
