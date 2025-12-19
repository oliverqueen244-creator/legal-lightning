import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedCase {
  item_no: number;
  case_number: string;
  petitioner?: string;
  respondent?: string;
  petitioner_lawyer?: string;
  respondent_lawyer?: string;
  court_room_no?: string;
  judge_names?: string;
}

async function callOpenAI(prompt: string, textContent: string): Promise<ParsedCase[]> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Limit text to ~50k chars to fit in context
  const truncatedText = textContent.substring(0, 50000);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `CAUSELIST TEXT:\n${truncatedText}` }
      ],
      temperature: 0.1,
      max_tokens: 8192
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content || '';
  
  // Extract JSON from response
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.log('[PARSE-ALL-CASES] No JSON array found in response');
    return [];
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[PARSE-ALL-CASES] Failed to parse JSON:', e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[PARSE-ALL-CASES] Function started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const causelistId = body.causelist_id;

    // Get causelists to parse (scanned but not fully parsed)
    let query = supabase
      .from('raw_causelists')
      .select('id, storage_path, text_content, bench, list_type, list_date')
      .eq('status', 'scanned')
      .order('created_at', { ascending: true })
      .limit(1);

    if (causelistId) {
      query = supabase
        .from('raw_causelists')
        .select('id, storage_path, text_content, bench, list_type, list_date')
        .eq('id', causelistId);
    }

    const { data: causelists, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch causelists: ${fetchError.message}`);
    }

    if (!causelists?.length) {
      console.log('[PARSE-ALL-CASES] No causelists to parse');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No causelists to parse' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalCasesParsed = 0;
    let totalCasesInserted = 0;

    for (const causelist of causelists) {
      console.log(`[PARSE-ALL-CASES] Processing: ${causelist.id} (${causelist.bench} ${causelist.list_type} ${causelist.list_date})`);

      if (!causelist.text_content) {
        console.log('[PARSE-ALL-CASES] No text content, skipping');
        continue;
      }

      // Update status to parsing
      await supabase
        .from('raw_causelists')
        .update({ status: 'parsing' })
        .eq('id', causelist.id);

      // Call AI to extract all cases
      const prompt = `You are a legal document parser. Extract ALL court cases from this Indian High Court causelist.

For each case, extract:
- item_no: The serial/item number (integer)
- case_number: Full case number (e.g., "S.B. Civil Writ Petition No. 1234/2024")
- petitioner: Petitioner name(s)
- respondent: Respondent name(s)
- petitioner_lawyer: Advocate for petitioner
- respondent_lawyer: Advocate for respondent
- court_room_no: Court room number if mentioned
- judge_names: Judge name(s) if mentioned at the top of the section

Return a JSON array of cases. Example:
[
  {
    "item_no": 1,
    "case_number": "S.B. Civil Writ Petition No. 1234/2024",
    "petitioner": "ABC Company",
    "respondent": "State of Rajasthan",
    "petitioner_lawyer": "Mr. Sharma",
    "respondent_lawyer": "AAG"
  }
]

Extract ALL cases, even partial information. Return ONLY the JSON array, no other text.`;

      try {
        const cases = await callOpenAI(prompt, causelist.text_content);
        totalCasesParsed += cases.length;
        console.log(`[PARSE-ALL-CASES] AI extracted ${cases.length} cases`);

        if (cases.length > 0) {
          // Prepare cases for insertion
          const casesToInsert = cases.map((c: ParsedCase) => ({
            date: causelist.list_date,
            court_location: causelist.bench,
            list_type: causelist.list_type,
            item_no: c.item_no || null,
            case_number: c.case_number || null,
            petitioner: c.petitioner || null,
            respondent: c.respondent || null,
            petitioner_lawyer: c.petitioner_lawyer || null,
            respondent_lawyer: c.respondent_lawyer || null,
            court_room_no: c.court_room_no || null,
            judge_names: c.judge_names || null,
            source_url: causelist.storage_path,
            status: 'pending'
          }));

          // Insert in batches of 50
          for (let i = 0; i < casesToInsert.length; i += 50) {
            const batch = casesToInsert.slice(i, i + 50);
            const { data: inserted, error: insertError } = await supabase
              .from('daily_court_docket')
              .upsert(batch, { 
                onConflict: 'case_fingerprint',
                ignoreDuplicates: true 
              })
              .select('id');

            if (insertError) {
              console.error(`[PARSE-ALL-CASES] Insert error: ${insertError.message}`);
            } else {
              totalCasesInserted += inserted?.length || 0;
            }
          }
        }

        // Update status to fully_parsed
        await supabase
          .from('raw_causelists')
          .update({ status: 'fully_parsed' })
          .eq('id', causelist.id);

        console.log(`[PARSE-ALL-CASES] Causelist ${causelist.id}: ${cases.length} parsed, inserted`);

      } catch (aiError) {
        console.error(`[PARSE-ALL-CASES] AI error for ${causelist.id}:`, aiError);
        await supabase
          .from('raw_causelists')
          .update({ status: 'parse_error' })
          .eq('id', causelist.id);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[PARSE-ALL-CASES] Completed: ${totalCasesParsed} cases parsed, ${totalCasesInserted} inserted, ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      cases_parsed: totalCasesParsed,
      cases_inserted: totalCasesInserted,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[PARSE-ALL-CASES] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
