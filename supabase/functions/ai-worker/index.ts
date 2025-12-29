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

      // Mark as completed
      await supabase
        .from('ai_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result: result.cases,
          provider: result.provider,
          tokens_used: result.tokensUsed
        })
        .eq('id', job.id);

      // Insert parsed cases into daily_court_docket
      if (result.cases && result.cases.length > 0) {
        await insertParsedCases(supabase, job, result.cases);
      }

      console.log(`[AI-WORKER] Job ${job.id} completed: ${result.cases?.length || 0} cases parsed`);

      return new Response(JSON.stringify({
        success: true,
        job_id: job.id,
        cases_parsed: result.cases?.length || 0,
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

async function processJob(job: AiJob, supabase: any): Promise<{ cases: ParsedCase[]; provider: string; tokensUsed: number }> {
  const text = job.payload.court_text || job.payload.full_text;
  
  if (!text) {
    throw new Error('No text content to parse');
  }

  const alias = job.payload.alias;
  const courtNo = job.payload.court_no || 'UNKNOWN';

  const prompt = buildParsePrompt(text, alias, job.job_type, courtNo);

  // Try providers in order
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
        const cases = parseAIResponse(result.content, courtNo);
        return {
          cases,
          provider: provider.name,
          tokensUsed: result.tokensUsed || 0
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log(`[AI-WORKER] Provider ${provider.name} failed: ${lastError.message}`);
      
      // If rate limited, don't try next provider - schedule retry
      if (lastError.message.includes('rate') || lastError.message.includes('429')) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('All AI providers failed');
}

function buildParsePrompt(text: string, alias: string, jobType: string, courtNo: string): string {
  return `Extract all cases from this court causelist text where the lawyer "${alias}" appears.

COURT NUMBER: ${courtNo}
JOB TYPE: ${jobType}

For each case, extract:
- item_no (the serial/item number)
- case_number (full case number like "D.B.CIV.WR.3123/2024")
- petitioner (name of petitioner/appellant)
- respondent (name of respondent)
- petitioner_lawyer (lawyer for petitioner, with -P suffix if "${alias}" appears here)
- respondent_lawyer (lawyer for respondent, with -R suffix if "${alias}" appears here)

IMPORTANT:
- Look for "${alias}" in the lawyer fields and identify which side they represent
- Add -P suffix if petitioner's lawyer, -R suffix if respondent's lawyer
- court_room_no should be "${courtNo}"
- Return ONLY valid JSON, no markdown

Return format:
{
  "cases": [
    {
      "court_room_no": "${courtNo}",
      "item_no": 1,
      "case_number": "...",
      "petitioner": "...",
      "respondent": "...",
      "petitioner_lawyer": "...",
      "respondent_lawyer": "..."
    }
  ]
}

TEXT TO PARSE:
${text.substring(0, 30000)}`;
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

function parseAIResponse(content: string, courtNo: string): ParsedCase[] {
  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    const cases = parsed.cases || [];

    return cases.map((c: any) => ({
      court_room_no: c.court_room_no || courtNo,
      item_no: parseInt(c.item_no) || 0,
      case_number: c.case_number || 'Unknown',
      petitioner: c.petitioner || null,
      respondent: c.respondent || null,
      petitioner_lawyer: c.petitioner_lawyer || null,
      respondent_lawyer: c.respondent_lawyer || null
    })).filter((c: ParsedCase) => c.item_no > 0 && c.case_number !== 'Unknown');
  } catch (e) {
    console.error('[AI-WORKER] Failed to parse AI response:', e);
    return [];
  }
}

async function insertParsedCases(supabase: any, job: AiJob, cases: ParsedCase[]) {
  const { causelist_id, profile_id, bench, list_date } = job.payload;

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

  const toInsert = newCases.map(c => ({
    date: list_date,
    court_location: bench,
    court_room_no: c.court_room_no,
    item_no: c.item_no,
    case_number: c.case_number,
    petitioner: c.petitioner,
    respondent: c.respondent,
    petitioner_lawyer: c.petitioner_lawyer,
    respondent_lawyer: c.respondent_lawyer,
    matched_profile_id: profile_id,
    source_url: `ai_job:${job.id}`,
    status: 'pending'
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