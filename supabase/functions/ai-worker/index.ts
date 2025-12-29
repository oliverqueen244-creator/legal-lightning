import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * AI WORKER - Processes AI jobs slowly and reliably
 * 
 * Features:
 * - Processes ONE job at a time
 * - Enforces token budget per hour
 * - Handles retries with exponential backoff
 * - Multi-provider fallback (Google → OpenAI → OpenRouter)
 * - Exits immediately after processing one job (cron calls repeatedly)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting config
const MIN_JOB_INTERVAL_MS = 3000; // 3 seconds between jobs
const MAX_TOKENS_PER_HOUR = 100000; // Token budget
const RETRY_DELAYS = [60, 300, 900]; // 1min, 5min, 15min

interface AiJob {
  id: string;
  job_type: string;
  provider: string | null;
  payload: {
    causelist_id: string;
    profile_id: string;
    alias: string;
    court_no?: string;
    court_text?: string;
    full_text?: string;
    bench: string;
    list_date: string;
  };
  status: string;
  retries: number;
  max_retries: number;
  priority: number;
}

interface ParsedCase {
  court_room_no: number;
  item_no: number;
  case_type: string;
  case_number: string;
  year: number;
  petitioner: string | null;
  respondent: string | null;
  listing_category: string | null;
  petitioner_lawyer: string[];
  respondent_lawyer: string[];
  advocate_role?: 'petitioner' | 'respondent'; // For SEARCH type
}

interface CourtOverride {
  type: 'court_override';
  court_no: number;
  from_serial: number;
  to_serial: number;
  new_judge: string;
  effective_date?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[AI-WORKER] Starting job processor');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check token budget (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentJobs } = await supabase
      .from('ai_jobs')
      .select('tokens_used')
      .eq('status', 'completed')
      .gte('completed_at', oneHourAgo);

    const tokensUsedThisHour = (recentJobs || []).reduce((sum, j) => sum + (j.tokens_used || 0), 0);
    
    if (tokensUsedThisHour >= MAX_TOKENS_PER_HOUR) {
      console.log(`[AI-WORKER] Token budget exhausted: ${tokensUsedThisHour}/${MAX_TOKENS_PER_HOUR}`);
      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'token_budget_exhausted',
        tokens_used: tokensUsedThisHour 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get next job (priority DESC, then oldest first)
    // Also check retry jobs that are due
    const now = new Date().toISOString();
    
    const { data: nextJob, error: fetchError } = await supabase
      .from('ai_jobs')
      .select('*')
      .or(`status.eq.pending,and(status.eq.retry,next_retry_at.lte.${now})`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch job: ${fetchError.message}`);
    }

    if (!nextJob) {
      console.log('[AI-WORKER] No pending jobs');
      return new Response(JSON.stringify({ success: true, message: 'No pending jobs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const job = nextJob as AiJob;
    console.log(`[AI-WORKER] Processing job ${job.id} (${job.job_type}), retry: ${job.retries}`);

    // Mark as processing
    await supabase
      .from('ai_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job.id);

    try {
      // Process the job
      const result = await processJob(job, supabase);

      // Store result - include overrides for SUPPLEMENTARY/NOTICE
      const resultData = result.overrides 
        ? { cases: result.cases, overrides: result.overrides }
        : result.cases;

      // Mark as completed
      await supabase
        .from('ai_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result: resultData,
          provider: result.provider,
          tokens_used: result.tokensUsed
        })
        .eq('id', job.id);

      // Insert parsed cases into daily_court_docket
      if (result.cases && result.cases.length > 0) {
        await insertParsedCases(supabase, job, result.cases);
      }

      // Store overrides in court_overrides table
      if (result.overrides && result.overrides.length > 0) {
        console.log(`[AI-WORKER] Job ${job.id} extracted ${result.overrides.length} court overrides`);
        
        for (const override of result.overrides) {
          await supabase
            .from('court_overrides')
            .insert({
              court_location: job.payload.bench,
              court_no: String(override.court_no),
              override_date: job.payload.list_date,
              from_serial: override.from_serial,
              to_serial: override.to_serial,
              new_judge: override.new_judge,
              override_type: 'judge_substitution',
              source_causelist_id: job.payload.causelist_id,
              is_active: true
            });
        }
        console.log(`[AI-WORKER] Inserted ${result.overrides.length} court overrides for ${job.payload.bench}`);
      }

      const itemCount = result.cases?.length || 0;
      const overrideCount = result.overrides?.length || 0;
      console.log(`[AI-WORKER] Job ${job.id} completed: ${itemCount} cases, ${overrideCount} overrides`);

      return new Response(JSON.stringify({
        success: true,
        job_id: job.id,
        cases_parsed: itemCount,
        overrides_extracted: overrideCount,
        provider: result.provider,
        tokens_used: result.tokensUsed,
        duration_ms: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (jobError) {
      const errorMessage = jobError instanceof Error ? jobError.message : 'Unknown error';
      console.error(`[AI-WORKER] Job ${job.id} failed:`, errorMessage);

      // Handle retry logic
      const newRetries = job.retries + 1;
      
      if (newRetries >= job.max_retries) {
        // Max retries exceeded - mark as failed
        await supabase
          .from('ai_jobs')
          .update({
            status: 'failed',
            error_message: errorMessage,
            retries: newRetries,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        console.log(`[AI-WORKER] Job ${job.id} permanently failed after ${newRetries} retries`);
      } else {
        // Schedule retry with exponential backoff
        const delaySeconds = RETRY_DELAYS[Math.min(newRetries - 1, RETRY_DELAYS.length - 1)];
        const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

        await supabase
          .from('ai_jobs')
          .update({
            status: 'retry',
            error_message: errorMessage,
            retries: newRetries,
            next_retry_at: nextRetryAt
          })
          .eq('id', job.id);

        console.log(`[AI-WORKER] Job ${job.id} scheduled for retry ${newRetries} at ${nextRetryAt}`);
      }

      return new Response(JSON.stringify({
        success: false,
        job_id: job.id,
        error: errorMessage,
        retries: newRetries
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('[AI-WORKER] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processJob(job: AiJob, supabase: any): Promise<{ cases: ParsedCase[]; provider: string; tokensUsed: number; overrides?: CourtOverride[] }> {
  const text = job.payload.court_text || job.payload.full_text;
  
  if (!text) {
    throw new Error('No text content to parse');
  }

  const alias = job.payload.alias;
  const courtNo = job.payload.court_no || 'UNKNOWN';
  const listType = (job.payload as any).list_type || 'DAILY';

  // SUPPLEMENTARY / NOTICE - Rule-based extraction (NO AI)
  if (listType === 'SUPPLEMENTARY' || listType === 'NOTICE') {
    console.log(`[AI-WORKER] Processing ${listType} with rule-based extraction`);
    const overrides = extractCourtOverrides(text);
    
    // Store overrides in a separate table or as job result
    return {
      cases: [],
      provider: 'rule_based',
      tokensUsed: 0,
      overrides
    };
  }

  // SEARCH - Lawyer-centric prompt
  if (listType === 'SEARCH') {
    const prompt = buildSearchPrompt(text, alias);
    return await callAIProviders(prompt, courtNo, 'search');
  }

  // DAILY - Full court block parsing (default)
  const prompt = buildDailyPrompt(text, alias, courtNo);
  return await callAIProviders(prompt, courtNo, 'daily');
}

async function callAIProviders(prompt: string, courtNo: string, parseType: 'daily' | 'search'): Promise<{ cases: ParsedCase[]; provider: string; tokensUsed: number }> {
  const providers = [
    { name: 'google', fn: () => callGoogleAI(prompt) },
    { name: 'openai', fn: () => callOpenAI(prompt) },
    { name: 'openrouter', fn: () => callOpenRouter(prompt) }
  ];

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log(`[AI-WORKER] Trying provider: ${provider.name}`);
      const result = await provider.fn();
      
      if (result.success) {
        const cases = parseType === 'search' 
          ? parseSearchResponse(result.content, courtNo)
          : parseAIResponse(result.content, courtNo);
        return {
          cases,
          provider: provider.name,
          tokensUsed: result.tokensUsed || 0
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log(`[AI-WORKER] Provider ${provider.name} failed: ${lastError.message}`);
      
      if (lastError.message.includes('rate') || lastError.message.includes('429')) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('All AI providers failed');
}

// Rule-based extraction for SUPPLEMENTARY/NOTICE lists
function extractCourtOverrides(text: string): CourtOverride[] {
  const overrides: CourtOverride[] = [];
  
  // Pattern: "Court No. X ... items Y to Z ... will be taken up by Justice NAME"
  // Or: "Court No : X ... Serial Nos. Y to Z ... before Justice NAME"
  const patterns = [
    /Court\s*No\.?\s*:?\s*(\d+)[\s\S]*?(?:items?|serial\s*nos?\.?)\s*(\d+)\s*(?:to|[-–])\s*(\d+)[\s\S]*?(?:before|by|taken\s*up\s*by)\s*(?:HON['']?BLE\s*)?(?:MR\.?\s*|MRS\.?\s*)?JUSTICE\s+([A-Z][A-Z\s\.]+)/gi,
    /(?:items?|serial\s*nos?\.?)\s*(\d+)\s*(?:to|[-–])\s*(\d+)[\s\S]*?Court\s*No\.?\s*:?\s*(\d+)[\s\S]*?(?:before|by)\s*(?:HON['']?BLE\s*)?(?:MR\.?\s*|MRS\.?\s*)?JUSTICE\s+([A-Z][A-Z\s\.]+)/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Determine which capture groups have court_no and serials
      const isFirstPattern = match[0].toLowerCase().indexOf('court') < match[0].toLowerCase().indexOf('serial');
      
      if (isFirstPattern) {
        overrides.push({
          type: 'court_override',
          court_no: parseInt(match[1]),
          from_serial: parseInt(match[2]),
          to_serial: parseInt(match[3]),
          new_judge: match[4].trim()
        });
      } else {
        overrides.push({
          type: 'court_override',
          court_no: parseInt(match[3]),
          from_serial: parseInt(match[1]),
          to_serial: parseInt(match[2]),
          new_judge: match[4].trim()
        });
      }
    }
  }

  // Also check for simple judge substitution patterns
  const simplePattern = /Court\s*No\.?\s*:?\s*(\d+)[\s\S]{0,200}?(?:HON['']?BLE\s*)?(?:MR\.?\s*|MRS\.?\s*)?JUSTICE\s+([A-Z][A-Z\s\.]+?)(?:\s*(?:WILL|SHALL))/gi;
  let simpleMatch;
  while ((simpleMatch = simplePattern.exec(text)) !== null) {
    // Only add if we don't already have an override for this court
    const courtNo = parseInt(simpleMatch[1]);
    if (!overrides.some(o => o.court_no === courtNo)) {
      overrides.push({
        type: 'court_override',
        court_no: courtNo,
        from_serial: 1,
        to_serial: 9999, // All items
        new_judge: simpleMatch[2].trim()
      });
    }
  }

  console.log(`[AI-WORKER] Extracted ${overrides.length} court overrides`);
  return overrides;
}

// PROMPT A - Daily cause list (full court block parsing)
function buildDailyPrompt(text: string, alias: string, courtNo: string): string {
  return `You are parsing an Indian High Court DAILY CAUSE LIST.

You are given the FULL TEXT for ONE COURT ONLY.

Your task:
Extract ALL cases listed in this court.

RULES (STRICT):
- Court room number MUST come from header like "Court No : X"
- DO NOT infer court number from category codes (e.g. 515, 603)
- Each case must include:
  - item_no (serial number)
  - case_type (e.g. "D.B.CIV.WR", "S.B.CR.REV")
  - case_number (just the number part)
  - year (4 digit year)
  - petitioner_name
  - respondent_name
  - listing_category (e.g. "FOR ADMISSION", "FOR ORDERS")
  - advocate_petitioner (array of lawyer names)
  - advocate_respondent (array of lawyer names)
- Advocate suffix rules:
  - "-P" or "(P)" → petitioner lawyer
  - "-R" or "(R)" → respondent lawyer
- Remove -P / -R from names in output
- If case is "With" another case, still extract it separately
- Ignore headers, footers, page numbers, timestamps

CRITICAL: Look for lawyer "${alias}" - they may appear with -P or -R suffix

OUTPUT FORMAT:
Return STRICT JSON:
{
  "court_no": ${courtNo},
  "cases": [
    {
      "item_no": 1,
      "case_type": "D.B.CIV.WR",
      "case_number": "3123",
      "year": 2024,
      "petitioner_name": "...",
      "respondent_name": "...",
      "listing_category": "FOR ADMISSION",
      "advocate_petitioner": ["LAWYER NAME"],
      "advocate_respondent": ["LAWYER NAME"]
    }
  ]
}

NO explanations.
NO markdown.
NO commentary.

COURT TEXT:
${text.substring(0, 50000)}`;
}

// PROMPT B - Search cause list (lawyer-centric)
function buildSearchPrompt(text: string, targetAdvocate: string): string {
  return `You are parsing a FILTERED SEARCH CAUSE LIST for an advocate.

TARGET ADVOCATE: "${targetAdvocate}"

Extract ONLY cases where the target advocate appears.

RULES:
- Match advocate name exactly (case-insensitive)
- Determine role using suffix rules:
  - -P / (P) → petitioner lawyer → advocate_role = "petitioner"
  - -R / (R) → respondent lawyer → advocate_role = "respondent"
- Remove the -P / -R suffix from the advocate name in output
- Extract for each matching case:
  - court_no (from "Court No : X" header)
  - item_no (serial number)
  - case_type (e.g. "D.B.CIV.WR")
  - case_number (just the number)
  - year (4 digit)
  - listing_category (e.g. "FOR ADMISSION")
  - advocate_role ("petitioner" or "respondent")

OUTPUT FORMAT:
Return STRICT JSON array:
[
  {
    "court_no": 5,
    "item_no": 23,
    "case_type": "S.B.CIV.WR",
    "case_number": "4567",
    "year": 2024,
    "listing_category": "FOR ORDERS",
    "advocate_role": "petitioner"
  }
]

NO explanations.
NO markdown.
NO commentary.

SEARCH CAUSELIST TEXT:
${text.substring(0, 50000)}`;
}

async function callGoogleAI(prompt: string): Promise<{ success: boolean; content: string; tokensUsed?: number }> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error('Google AI rate limited');
    throw new Error(`Google AI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

  return { success: true, content, tokensUsed };
}

async function callOpenAI(prompt: string): Promise<{ success: boolean; content: string; tokensUsed?: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You extract case information from legal causelists. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4096,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error('OpenAI rate limited');
    throw new Error(`OpenAI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const tokensUsed = data.usage?.total_tokens || 0;

  return { success: true, content, tokensUsed };
}

async function callOpenRouter(prompt: string): Promise<{ success: boolean; content: string; tokensUsed?: number }> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-flash-1.5',
      messages: [
        { role: 'system', content: 'You extract case information from legal causelists. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4096,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error('OpenRouter rate limited');
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const tokensUsed = data.usage?.total_tokens || 0;

  return { success: true, content, tokensUsed };
}

// Parse response for DAILY prompt
function parseAIResponse(content: string, courtNo: string): ParsedCase[] {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    const courtNoFromResponse = parsed.court_no || parseInt(courtNo) || 0;
    const cases = parsed.cases || [];

    return cases.map((c: any) => ({
      court_room_no: courtNoFromResponse,
      item_no: parseInt(c.item_no) || 0,
      case_type: c.case_type || '',
      case_number: c.case_number || '',
      year: parseInt(c.year) || new Date().getFullYear(),
      petitioner: c.petitioner_name || c.petitioner || null,
      respondent: c.respondent_name || c.respondent || null,
      listing_category: c.listing_category || null,
      petitioner_lawyer: Array.isArray(c.advocate_petitioner) ? c.advocate_petitioner : 
                         (c.advocate_petitioner ? [c.advocate_petitioner] : []),
      respondent_lawyer: Array.isArray(c.advocate_respondent) ? c.advocate_respondent : 
                         (c.advocate_respondent ? [c.advocate_respondent] : [])
    })).filter((c: ParsedCase) => c.item_no > 0 && (c.case_number || c.case_type));
  } catch (e) {
    console.error('[AI-WORKER] Failed to parse DAILY response:', e);
    return [];
  }
}

// Parse response for SEARCH prompt (lawyer-centric)
function parseSearchResponse(content: string, defaultCourtNo: string): ParsedCase[] {
  try {
    // Search returns an array directly
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const cases = JSON.parse(jsonMatch[0]);

    return cases.map((c: any) => ({
      court_room_no: parseInt(c.court_no) || parseInt(defaultCourtNo) || 0,
      item_no: parseInt(c.item_no) || 0,
      case_type: c.case_type || '',
      case_number: c.case_number || '',
      year: parseInt(c.year) || new Date().getFullYear(),
      petitioner: null,
      respondent: null,
      listing_category: c.listing_category || null,
      petitioner_lawyer: [],
      respondent_lawyer: [],
      advocate_role: c.advocate_role || undefined
    })).filter((c: ParsedCase) => c.item_no > 0 && (c.case_number || c.case_type));
  } catch (e) {
    console.error('[AI-WORKER] Failed to parse SEARCH response:', e);
    return [];
  }
}

async function insertParsedCases(supabase: any, job: AiJob, cases: ParsedCase[]) {
  const { profile_id, bench, list_date } = job.payload;

  // Check for existing cases to avoid duplicates
  const { data: existing } = await supabase
    .from('daily_court_docket')
    .select('item_no, court_room_no')
    .eq('date', list_date)
    .eq('court_location', bench);

  const existingKeys = new Set((existing || []).map((c: any) => `${c.item_no}_${c.court_room_no}`));

  const newCases = cases.filter(c => !existingKeys.has(`${c.item_no}_${c.court_room_no}`));

  if (newCases.length === 0) {
    console.log('[AI-WORKER] No new cases to insert (all duplicates)');
    return;
  }

  // Build full case number: CASE_TYPE.CASE_NUMBER/YEAR
  const toInsert = newCases.map(c => ({
    date: list_date,
    court_location: bench,
    court_room_no: String(c.court_room_no),
    item_no: c.item_no,
    case_number: c.case_type && c.case_number ? `${c.case_type}.${c.case_number}/${c.year}` : c.case_number,
    petitioner: c.petitioner,
    respondent: c.respondent,
    petitioner_lawyer: c.petitioner_lawyer.join(', ') || null,
    respondent_lawyer: c.respondent_lawyer.join(', ') || null,
    matched_profile_id: profile_id,
    source_url: `ai_job:${job.id}`,
    status: 'pending',
    list_type: c.listing_category || 'DAILY'
  }));

  const { error: insertError } = await supabase
    .from('daily_court_docket')
    .insert(toInsert);

  if (insertError) {
    console.error('[AI-WORKER] Failed to insert cases:', insertError);
  } else {
    console.log(`[AI-WORKER] Inserted ${newCases.length} new cases`);
  }
}