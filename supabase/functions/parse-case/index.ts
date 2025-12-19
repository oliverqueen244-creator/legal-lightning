import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CASE PARSING WORKER - Multi-AI Provider Support
 * 
 * Tries AI providers in order:
 * 1. Lovable AI (google/gemini-2.5-flash)
 * 2. Google AI API (gemini-2.0-flash)
 * 3. OpenAI (gpt-4o-mini)
 * 4. OpenRouter (as last resort)
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

interface AICallResult {
  success: boolean;
  content: string;
  provider: string;
  error?: string;
}

// Call Lovable AI Gateway
async function callLovableAI(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<AICallResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    return { success: false, content: '', provider: 'lovable', error: 'LOVABLE_API_KEY not configured' };
  }

  try {
    console.log('[AI] Trying Lovable AI...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[AI] Lovable AI failed: ${response.status} - ${errorText.substring(0, 200)}`);
      return { success: false, content: '', provider: 'lovable', error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    console.log(`[AI] Lovable AI success, got ${content.length} chars`);
    return { success: true, content, provider: 'lovable' };
  } catch (error) {
    console.error('[AI] Lovable AI error:', error);
    return { success: false, content: '', provider: 'lovable', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Call Google AI API directly
async function callGoogleAI(systemPrompt: string, userPrompt: string): Promise<AICallResult> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) {
    return { success: false, content: '', provider: 'google', error: 'GOOGLE_AI_API_KEY not configured' };
  }

  try {
    console.log('[AI] Trying Google AI...');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { maxOutputTokens: 10000, temperature: 0.1 }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[AI] Google AI failed: ${response.status} - ${errorText.substring(0, 200)}`);
      return { success: false, content: '', provider: 'google', error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[AI] Google AI success, got ${content.length} chars`);
    return { success: true, content, provider: 'google' };
  } catch (error) {
    console.error('[AI] Google AI error:', error);
    return { success: false, content: '', provider: 'google', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Call OpenAI API
async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<AICallResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return { success: false, content: '', provider: 'openai', error: 'OPENAI_API_KEY not configured' };
  }

  try {
    console.log('[AI] Trying OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 10000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[AI] OpenAI failed: ${response.status} - ${errorText.substring(0, 200)}`);
      return { success: false, content: '', provider: 'openai', error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    console.log(`[AI] OpenAI success, got ${content.length} chars`);
    return { success: true, content, provider: 'openai' };
  } catch (error) {
    console.error('[AI] OpenAI error:', error);
    return { success: false, content: '', provider: 'openai', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Call OpenRouter API
async function callOpenRouter(systemPrompt: string, userPrompt: string): Promise<AICallResult> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    return { success: false, content: '', provider: 'openrouter', error: 'OPENROUTER_API_KEY not configured' };
  }

  try {
    console.log('[AI] Trying OpenRouter...');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 10000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[AI] OpenRouter failed: ${response.status} - ${errorText.substring(0, 200)}`);
      return { success: false, content: '', provider: 'openrouter', error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    console.log(`[AI] OpenRouter success, got ${content.length} chars`);
    return { success: true, content, provider: 'openrouter' };
  } catch (error) {
    console.error('[AI] OpenRouter error:', error);
    return { success: false, content: '', provider: 'openrouter', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Try all AI providers in sequence
async function callAIWithFallback(systemPrompt: string, userPrompt: string, maxTokens: number = 10000): Promise<AICallResult> {
  const providers = [
    () => callLovableAI(systemPrompt, userPrompt, maxTokens),
    () => callGoogleAI(systemPrompt, userPrompt),
    () => callOpenAI(systemPrompt, userPrompt),
    () => callOpenRouter(systemPrompt, userPrompt)
  ];

  for (const callProvider of providers) {
    const result = await callProvider();
    if (result.success) return result;
    console.log(`[AI] ${result.provider} failed: ${result.error}, trying next...`);
  }

  return { success: false, content: '', provider: 'none', error: 'All AI providers failed' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const TIMEOUT_GUARD_MS = 50000;
  console.log('[PARSE-CASE] Function started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get next pending queue item
    const { data: queueItem, error: queueError } = await supabase
      .from('case_parse_queue')
      .select(`*, raw_causelists (id, storage_path, text_content, bench, list_type, list_date)`)
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
    const textContent = causelist.text_content;

    if (!textContent) {
      throw new Error('Text content not available. Run scan-lawyer-names first to extract PDF text.');
    }

    console.log(`[PARSE-CASE] Parsing cases for alias: ${queueItem.matched_alias}`);

    const systemPrompt = `You are an expert legal document parser specializing in Indian High Court causelists. 
Extract case data with extreme accuracy. Pay close attention to lawyer name suffixes and prefixes.
Return only valid JSON array.`;

    const userPrompt = `Extract all court cases from this Indian High Court causelist that mention the lawyer name "${queueItem.matched_alias}" (case-insensitive, partial match allowed).

CRITICAL - LAWYER NAME FORMAT RULES:
In Indian causelists, lawyer names often have suffixes or prefixes indicating their role:
- "-P" or "(P)" suffix = Petitioner's lawyer (e.g., "RAMESH PUROHIT-P", "MR. SHARMA (P)")
- "-R" or "(R)" suffix = Respondent's lawyer (e.g., "RAMESH PUROHIT-R", "ADV. KUMAR (R)")  
- "Sh.", "Shri", "Mr.", "Ms.", "Adv.", "Advocate" = Common prefixes (ignore when matching)
- "AAG", "GA", "Govt. Adv." = Government Advocates (typically respondent side)
- Names may be ALL CAPS, Mixed Case, or have extra spaces

When you see "${queueItem.matched_alias}" with:
- "-R" suffix → They are the RESPONDENT'S lawyer
- "-P" suffix → They are the PETITIONER'S lawyer
- No suffix → Check context to determine role

The matched lawyer name should be extracted WITHOUT the -P/-R suffix in the output.

For each case containing this lawyer, extract:
- court_room_no: Court/Bench number (e.g., "DB-I", "SB-III", "Court No. 1", "BENCH-A")
- item_no: Serial/Item number (must be an integer, e.g., 45, 603, 1)
- case_number: Full case number exactly as written (e.g., "C.M.A. 1693/2004", "S.B. Civil Writ Petition No. 1234/2024")
- petitioner: Petitioner name(s) - party bringing the case
- respondent: Respondent name(s) - party responding
- petitioner_lawyer: Clean lawyer name(s) for petitioner (remove -P suffix)
- respondent_lawyer: Clean lawyer name(s) for respondent (remove -R suffix)

EXAMPLES:
If causelist shows: "MANISH PITLIYA-P, RAMESH PUROHIT-R"
Then: petitioner_lawyer="MANISH PITLIYA", respondent_lawyer="RAMESH PUROHIT"

If causelist shows: "Adv. John Doe (P) / AAG (R)"
Then: petitioner_lawyer="Adv. John Doe", respondent_lawyer="AAG"

Return a JSON array. Example:
[{"court_room_no": "DB-I", "item_no": 45, "case_number": "D.B. Civil Writ Petition No. 1234/2024", "petitioner": "ABC Company", "respondent": "State of Rajasthan", "petitioner_lawyer": "Sh. John Doe", "respondent_lawyer": "AAG"}]

IMPORTANT: 
- Match "${queueItem.matched_alias}" even if it appears with suffixes like -P, -R, (P), (R)
- Remove these suffixes when outputting the lawyer names
- Return empty array [] if no matching cases found

Causelist text:
${textContent.substring(0, 200000)}`;

    const aiResult = await callAIWithFallback(systemPrompt, userPrompt);

    if (!aiResult.success) {
      throw new Error(`AI parsing failed: ${aiResult.error}`);
    }

    console.log(`[PARSE-CASE] AI response from provider: ${aiResult.provider}`);

    // Clean JSON response
    let responseText = aiResult.content;
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsedCases: ParsedCase[] = [];
    try {
      parsedCases = JSON.parse(responseText);
      if (!Array.isArray(parsedCases)) parsedCases = [];
    } catch (e) {
      console.error('[PARSE-CASE] Failed to parse AI response:', e);
      parsedCases = [];
    }

    console.log(`[PARSE-CASE] Parsed ${parsedCases.length} cases for alias ${queueItem.matched_alias}`);

    // Insert cases ONE BY ONE
    let insertedCount = 0;
    let skippedCount = 0;

    for (const caseData of parsedCases) {
      if (Date.now() - startTime > TIMEOUT_GUARD_MS) {
        console.log('[PARSE-CASE] Timeout guard triggered');
        break;
      }

      const { data: existing } = await supabase
        .from('daily_court_docket')
        .select('id')
        .eq('date', causelist.list_date)
        .eq('court_location', causelist.bench)
        .eq('case_number', caseData.case_number)
        .eq('item_no', caseData.item_no)
        .single();

      if (existing) {
        skippedCount++;
        continue;
      }

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
          matched_profile_id: queueItem.profile_id,
          source_url: causelist.storage_path,
          status: 'pending'
        });

      if (!insertError) insertedCount++;
    }

    await supabase
      .from('case_parse_queue')
      .update({ status: 'done', cases_parsed: insertedCount, completed_at: new Date().toISOString() })
      .eq('id', queueItem.id);

    const duration = Date.now() - startTime;
    console.log(`[PARSE-CASE] Done: ${insertedCount} inserted, ${skippedCount} skipped, ${duration}ms, provider: ${aiResult.provider}`);

    return new Response(JSON.stringify({
      success: true,
      queue_item_id: queueItem.id,
      cases_parsed: parsedCases.length,
      cases_inserted: insertedCount,
      cases_skipped: skippedCount,
      duration_ms: duration,
      ai_provider: aiResult.provider
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[PARSE-CASE] Error:', error);

    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await supabase
        .from('case_parse_queue')
        .update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown error', completed_at: new Date().toISOString() })
        .eq('status', 'processing');
    } catch (e) {
      console.error('[PARSE-CASE] Failed to mark queue item as failed:', e);
    }

    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
