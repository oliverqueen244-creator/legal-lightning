import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CASE PARSING WORKER - Multi-AI Provider Support with Rate Limiting
 * 
 * Features:
 * 1. Request throttling - delays between API calls
 * 2. Response caching - avoids re-parsing identical text
 * 3. Optimized text extraction - smaller, targeted chunks
 * 4. Exponential backoff retry for rate limits
 * 
 * Tries AI providers in order:
 * 1. Google AI API (gemini-2.0-flash) - Primary
 * 2. OpenAI (gpt-4o-mini) - Fallback  
 * 3. OpenRouter - Secondary fallback
 * 4. Lovable AI (last resort only)
 */

// Throttling configuration
const MIN_REQUEST_INTERVAL_MS = 2000; // 2 seconds between AI calls
const MAX_RETRIES = 3;

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
  cached?: boolean;
}

// Helper function to sleep for a given number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate a hash for text content (simple but fast)
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// Check cache for existing AI response
async function checkCache(supabase: any, textHash: string, promptHash: string): Promise<AICallResult | null> {
  try {
    const { data, error } = await supabase
      .from('ai_parse_cache')
      .select('response_json, provider, hit_count')
      .eq('text_hash', textHash)
      .eq('prompt_hash', promptHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;

    // Update hit count
    await supabase
      .from('ai_parse_cache')
      .update({ hit_count: (data.hit_count || 0) + 1 })
      .eq('text_hash', textHash)
      .eq('prompt_hash', promptHash);

    console.log(`[CACHE] Hit for hash ${textHash.substring(0, 8)}..., hit_count: ${data.hit_count + 1}`);
    return {
      success: true,
      content: JSON.stringify(data.response_json),
      provider: `${data.provider} (cached)`,
      cached: true
    };
  } catch (e) {
    console.log('[CACHE] Error checking cache:', e);
    return null;
  }
}

// Save response to cache
async function saveToCache(supabase: any, textHash: string, promptHash: string, responseJson: any, provider: string): Promise<void> {
  try {
    await supabase
      .from('ai_parse_cache')
      .upsert({
        text_hash: textHash,
        prompt_hash: promptHash,
        response_json: responseJson,
        provider: provider,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      }, {
        onConflict: 'text_hash,prompt_hash'
      });
    console.log(`[CACHE] Saved response for hash ${textHash.substring(0, 8)}...`);
  } catch (e) {
    console.log('[CACHE] Error saving to cache:', e);
  }
}

// Call Lovable AI Gateway (Last resort fallback - only used when all other providers fail)
async function callLovableAI(systemPrompt: string, userPrompt: string): Promise<AICallResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    return { success: false, content: '', provider: 'lovable', error: 'LOVABLE_API_KEY not configured' };
  }

  const maxRetries = 2;
  const baseDelayMs = 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt === 0) {
        console.log('[AI] Trying Lovable AI...');
      } else {
        console.log(`[AI] Lovable AI retry attempt ${attempt}/${maxRetries}...`);
      }

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
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const status = response.status;

        // Rate limit - retry with backoff
        if (status === 429 && attempt < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt);
          console.log(`[AI] Lovable AI rate limited (429), waiting ${delayMs}ms before retry...`);
          await sleep(delayMs);
          continue;
        }

        // Payment required - skip to next provider
        if (status === 402) {
          console.log(`[AI] Lovable AI payment required (402), skipping to next provider`);
          return { success: false, content: '', provider: 'lovable', error: 'Payment required' };
        }

        console.log(`[AI] Lovable AI failed: ${status} - ${errorText.substring(0, 200)}`);
        return { success: false, content: '', provider: 'lovable', error: `HTTP ${status}` };
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '';
      console.log(`[AI] Lovable AI success, got ${content.length} chars`);
      return { success: true, content, provider: 'lovable' };
    } catch (error) {
      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(`[AI] Lovable AI network error, waiting ${delayMs}ms before retry...`, error);
        await sleep(delayMs);
        continue;
      }
      console.error('[AI] Lovable AI error after all retries:', error);
      return { success: false, content: '', provider: 'lovable', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  return { success: false, content: '', provider: 'lovable', error: 'Max retries exceeded' };
}

// Call Google AI API directly (Primary provider) with exponential backoff retry
async function callGoogleAI(systemPrompt: string, userPrompt: string): Promise<AICallResult> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) {
    return { success: false, content: '', provider: 'google', error: 'GOOGLE_AI_API_KEY not configured' };
  }

  const maxRetries = MAX_RETRIES;
  const baseDelayMs = 1000; // Start with 1 second delay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt === 0) {
        console.log('[AI] Trying Google AI...');
      } else {
        console.log(`[AI] Google AI retry attempt ${attempt}/${maxRetries}...`);
      }
      
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
        const status = response.status;
        
        // Check if it's a rate limit error (429) and we have retries left
        if (status === 429 && attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = baseDelayMs * Math.pow(2, attempt);
          console.log(`[AI] Google AI rate limited (429), waiting ${delayMs}ms before retry...`);
          await sleep(delayMs);
          continue; // Retry the request
        }
        
        console.log(`[AI] Google AI failed: ${status} - ${errorText.substring(0, 200)}`);
        return { success: false, content: '', provider: 'google', error: `HTTP ${status}` };
      }

      const result = await response.json();
      const content = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log(`[AI] Google AI success, got ${content.length} chars`);
      return { success: true, content, provider: 'google' };
    } catch (error) {
      // On network errors, also retry with backoff
      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(`[AI] Google AI network error, waiting ${delayMs}ms before retry...`, error);
        await sleep(delayMs);
        continue;
      }
      console.error('[AI] Google AI error after all retries:', error);
      return { success: false, content: '', provider: 'google', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Should not reach here, but just in case
  return { success: false, content: '', provider: 'google', error: 'Max retries exceeded' };
}

// Call OpenAI API with retry logic
async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<AICallResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return { success: false, content: '', provider: 'openai', error: 'OPENAI_API_KEY not configured' };
  }

  const maxRetries = MAX_RETRIES;
  const baseDelayMs = 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt === 0) {
        console.log('[AI] Trying OpenAI...');
      } else {
        console.log(`[AI] OpenAI retry attempt ${attempt}/${maxRetries}...`);
      }

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
        const status = response.status;

        if (status === 429 && attempt < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt);
          console.log(`[AI] OpenAI rate limited (429), waiting ${delayMs}ms before retry...`);
          await sleep(delayMs);
          continue;
        }

        console.log(`[AI] OpenAI failed: ${status} - ${errorText.substring(0, 200)}`);
        return { success: false, content: '', provider: 'openai', error: `HTTP ${status}` };
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '';
      console.log(`[AI] OpenAI success, got ${content.length} chars`);
      return { success: true, content, provider: 'openai' };
    } catch (error) {
      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(`[AI] OpenAI network error, waiting ${delayMs}ms before retry...`);
        await sleep(delayMs);
        continue;
      }
      console.error('[AI] OpenAI error after all retries:', error);
      return { success: false, content: '', provider: 'openai', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  return { success: false, content: '', provider: 'openai', error: 'Max retries exceeded' };
}

// Call OpenRouter API with retry logic
async function callOpenRouter(systemPrompt: string, userPrompt: string): Promise<AICallResult> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    return { success: false, content: '', provider: 'openrouter', error: 'OPENROUTER_API_KEY not configured' };
  }

  const maxRetries = MAX_RETRIES;
  const baseDelayMs = 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt === 0) {
        console.log('[AI] Trying OpenRouter...');
      } else {
        console.log(`[AI] OpenRouter retry attempt ${attempt}/${maxRetries}...`);
      }

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
        const status = response.status;

        if (status === 429 && attempt < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt);
          console.log(`[AI] OpenRouter rate limited (429), waiting ${delayMs}ms before retry...`);
          await sleep(delayMs);
          continue;
        }

        console.log(`[AI] OpenRouter failed: ${status} - ${errorText.substring(0, 200)}`);
        return { success: false, content: '', provider: 'openrouter', error: `HTTP ${status}` };
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '';
      console.log(`[AI] OpenRouter success, got ${content.length} chars`);
      return { success: true, content, provider: 'openrouter' };
    } catch (error) {
      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(`[AI] OpenRouter network error, waiting ${delayMs}ms before retry...`);
        await sleep(delayMs);
        continue;
      }
      console.error('[AI] OpenRouter error after all retries:', error);
      return { success: false, content: '', provider: 'openrouter', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  return { success: false, content: '', provider: 'openrouter', error: 'Max retries exceeded' };
}

// Track last request time for throttling
let lastRequestTime = 0;

// Try all AI providers in sequence with throttling
async function callAIWithFallback(
  supabase: any, 
  systemPrompt: string, 
  userPrompt: string, 
  textForCache: string
): Promise<AICallResult> {
  // Generate cache keys
  const textHash = hashText(textForCache);
  const promptHash = hashText(systemPrompt);

  // Check cache first
  const cachedResult = await checkCache(supabase, textHash, promptHash);
  if (cachedResult) {
    return cachedResult;
  }

  // Throttle requests - ensure minimum interval between AI calls
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
    console.log(`[THROTTLE] Waiting ${waitTime}ms before next AI call...`);
    await sleep(waitTime);
  }
  lastRequestTime = Date.now();

  // Provider fallback chain: Google → OpenAI → OpenRouter → Lovable AI (last resort)
  const providers = [
    () => callGoogleAI(systemPrompt, userPrompt),
    () => callOpenAI(systemPrompt, userPrompt),
    () => callOpenRouter(systemPrompt, userPrompt),
    () => callLovableAI(systemPrompt, userPrompt)
  ];

  const failedProviders: string[] = [];

  for (const callProvider of providers) {
    const result = await callProvider();
    if (result.success) {
      // Save successful response to cache
      try {
        const jsonMatch = result.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedJson = JSON.parse(jsonMatch[0]);
          await saveToCache(supabase, textHash, promptHash, parsedJson, result.provider);
        }
      } catch (e) {
        // Don't fail if cache save fails
        console.log('[CACHE] Could not cache response:', e);
      }
      
      // Log fallback path if any providers failed
      if (failedProviders.length > 0) {
        console.log(`[AI] Successfully fell back from [${failedProviders.join(' → ')}] to ${result.provider}`);
      }
      
      return result;
    }
    
    failedProviders.push(result.provider);
    console.log(`[AI] ${result.provider} failed: ${result.error}, trying next...`);
    
    // Add delay between provider switches
    await sleep(500);
  }

  // All providers failed - return graceful degradation result
  console.error(`[AI] ALL PROVIDERS FAILED: [${failedProviders.join(' → ')}]`);
  return { 
    success: false, 
    content: '', 
    provider: 'none', 
    error: `All AI providers failed after trying: ${failedProviders.join(', ')}` 
  };
}

// Configuration for batch processing
const SECTIONS_PER_BATCH = 20; // Process 20 mentions per AI call
const CONTEXT_BEFORE = 300; // Characters before the alias match
const CONTEXT_AFTER = 800; // Characters after (includes case details, next item)

interface TextExtractionResult {
  text: string;
  totalSections: number;
  processedSections: number;
  startSection: number;
  endSection: number;
  hasMore: boolean;
  nextStartSection: number;
}

// Extract text around each individual mention WITHOUT merging
function extractRelevantText(
  textContent: string, 
  alias: string, 
  batchStart: number = 0
): TextExtractionResult {
  const aliasPattern = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const matches: number[] = [];
  let match;
  
  while ((match = aliasPattern.exec(textContent)) !== null) {
    matches.push(match.index);
  }

  if (matches.length === 0) {
    console.log(`[TEXT] No occurrences of alias found`);
    return {
      text: textContent.substring(0, 30000),
      totalSections: 1,
      processedSections: 1,
      startSection: 0,
      endSection: 1,
      hasMore: false,
      nextStartSection: 0
    };
  }

  console.log(`[TEXT] Found ${matches.length} total occurrences of alias`);

  const totalSections = matches.length;
  
  // Get the batch of mentions to process (NO MERGING - each mention is a section)
  const batchEnd = Math.min(batchStart + SECTIONS_PER_BATCH, totalSections);
  const batchMatches = matches.slice(batchStart, batchEnd);
  
  // Extract context around each match individually
  const excerpts = batchMatches.map((pos, idx) => {
    const start = Math.max(0, pos - CONTEXT_BEFORE);
    const end = Math.min(textContent.length, pos + CONTEXT_AFTER);
    const excerpt = textContent.substring(start, end);
    return `--- CASE MENTION ${batchStart + idx + 1} ---\n${excerpt}`;
  });
  
  const result = excerpts.join('\n\n');
  const hasMore = batchEnd < totalSections;
  
  console.log(`[TEXT] Batch ${batchStart + 1}-${batchEnd} of ${totalSections} mentions, ${result.length} chars extracted, hasMore: ${hasMore}`);
  
  return {
    text: result,
    totalSections,
    processedSections: batchMatches.length,
    startSection: batchStart,
    endSection: batchEnd,
    hasMore,
    nextStartSection: batchEnd
  };
}

// Timing obfuscation helper
function randomDelay(minMs = 50, maxMs = 200): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Add timing obfuscation to prevent timing analysis
  await randomDelay();

  const startTime = Date.now();
  const TIMEOUT_GUARD_MS = 50000;
  console.log('[PARSE-CASE] Function started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get next pending queue item (skip recently retried items)
    const { data: queueItem, error: queueError } = await supabase
      .from('case_parse_queue')
      .select(`*, raw_causelists (id, storage_path, text_content, bench, list_type, list_date)`)
      .eq('status', 'pending')
      .or('last_retry_at.is.null,last_retry_at.lt.' + new Date(Date.now() - 60000).toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (queueError || !queueItem) {
      console.log('[PARSE-CASE] No pending items in queue');
      return new Response(JSON.stringify({ success: true, message: 'No pending items' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[PARSE-CASE] Processing queue item: ${queueItem.id}, alias: ${queueItem.matched_alias}, retry: ${queueItem.retry_count || 0}`);

    // Mark as processing
    await supabase
      .from('case_parse_queue')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString(),
        last_retry_at: new Date().toISOString()
      })
      .eq('id', queueItem.id);

    const causelist = queueItem.raw_causelists;
    const textContent = causelist.text_content;

    if (!textContent) {
      throw new Error('Text content not available. Run scan-lawyer-names first to extract PDF text.');
    }

    console.log(`[PARSE-CASE] Parsing cases for alias: ${queueItem.matched_alias}`);

    // Get the batch start from the queue item (default 0 for first batch)
    const batchStart = queueItem.batch_start || 0;

    // OPTIMIZED: Extract relevant text in batches
    const extraction = extractRelevantText(textContent, queueItem.matched_alias, batchStart);

    console.log(`[PARSE-CASE] Processing batch: mentions ${extraction.startSection + 1}-${extraction.endSection} of ${extraction.totalSections}`);

    const systemPrompt = `You are an expert legal document parser specializing in Indian High Court causelists. 
Extract case data with extreme accuracy. Pay close attention to lawyer name suffixes and prefixes.
Return only valid JSON array.

CRITICAL — COURT ROOM NUMBER EXTRACTION RULES (NON-NEGOTIABLE):
- Court room numbers ONLY appear in section headers like: "Court No : 3" or "Court No. 12"
- Numbers appearing at the END of case rows such as: 515, 502, 603, 400-PIL, 2602, 1303, 4200, 4500
  are CATEGORY CODES, NOT court room numbers.
- CATEGORY CODES must NEVER be assigned to court_room_no.
- Valid court_room_no: single or double digit numbers (1-99), or bench identifiers (DB-I, SB-II).
- If no explicit court header exists, set court_room_no = null.
- A court_room_no with 3 or more digits is ALWAYS WRONG.`;

    const userPrompt = `Extract all UNIQUE court cases from these causelist excerpts. Each "CASE MENTION" section contains context around where "${queueItem.matched_alias}" appears.

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

CRITICAL - COURT ROOM NUMBER EXTRACTION:
- Court room numbers come from section headers like "Court No : 4" or "Court No : 5"
- DO NOT use trailing 3-4 digit category codes (like 603, 602, 4200, 515, 502) as court room numbers
- These trailing codes are case category identifiers, NOT court rooms
- If you cannot identify a clear court header, set court_room_no to null

VALIDATION BEFORE OUTPUT:
- case_number MUST NOT be null or empty
- court_room_no must be null OR a valid 1-2 digit number OR a bench identifier (DB-I, SB-II)
- court_room_no with 3+ digits is INVALID - reject such cases

For each case containing this lawyer, extract:
- court_room_no: Court/Bench number from section header (e.g., "4", "5", null if unknown, NEVER "603" or "515")
- item_no: Serial/Item number (must be an integer)
- case_number: Full case number exactly as written (REQUIRED - skip case if missing)
- petitioner: Petitioner name(s)
- respondent: Respondent name(s)
- petitioner_lawyer: Clean lawyer name(s) for petitioner (remove -P suffix)
- respondent_lawyer: Clean lawyer name(s) for respondent (remove -R suffix)

Return a JSON array. Example:
[{"court_room_no": "4", "item_no": 33, "case_number": "C.M.A. 1693/2004", "petitioner": "ABC Company", "respondent": "State", "petitioner_lawyer": "John Doe", "respondent_lawyer": "Jane Smith"}]

IMPORTANT: 
- Extract ONE case per mention section (each "CASE MENTION" marker = one case)
- If a case number appears in multiple mentions, include it only ONCE
- Return empty array [] if no valid cases found
- SKIP any case where case_number is null or empty

Lawyer to find: "${queueItem.matched_alias}"
Causelist excerpts (mentions ${extraction.startSection + 1}-${extraction.endSection} of ${extraction.totalSections} total):
${extraction.text}`;

    // Call AI with caching and throttling
    const aiResult = await callAIWithFallback(supabase, systemPrompt, userPrompt, extraction.text);

    if (!aiResult.success) {
      // Handle failure - increment retry count
      const newRetryCount = (queueItem.retry_count || 0) + 1;
      
      if (newRetryCount >= MAX_RETRIES) {
        await supabase
          .from('case_parse_queue')
          .update({ 
            status: 'failed', 
            error_message: aiResult.error,
            retry_count: newRetryCount,
            provider_used: 'none',
            completed_at: new Date().toISOString()
          })
          .eq('id', queueItem.id);
        throw new Error(`AI parsing failed after ${MAX_RETRIES} retries: ${aiResult.error}`);
      } else {
        // Reset to pending for retry
        await supabase
          .from('case_parse_queue')
          .update({ 
            status: 'pending', 
            retry_count: newRetryCount,
            error_message: aiResult.error
          })
          .eq('id', queueItem.id);
        
        console.log(`[PARSE-CASE] AI failed, will retry (attempt ${newRetryCount}/${MAX_RETRIES})`);
        return new Response(JSON.stringify({
          success: false,
          message: 'Will retry',
          retry_count: newRetryCount
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log(`[PARSE-CASE] AI response from provider: ${aiResult.provider}${aiResult.cached ? ' (CACHED)' : ''}`);

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

    // FIX 2: Remove item_no from deduplication - use case identity only
    // FIX 5: Fail-loud on uniqueness violations
    // FIX 8: Validate cases before insertion
    let insertedCount = 0;
    let skippedCount = 0;
    let rejectedCount = 0;

    // Known category codes that should never be court_room_no
    const CATEGORY_CODE_PATTERN = /^[0-9]{3,}$/;

    for (const caseData of parsedCases) {
      if (Date.now() - startTime > TIMEOUT_GUARD_MS) {
        console.log('[PARSE-CASE] Timeout guard triggered');
        break;
      }

      // FIX 8: VALIDATION - Reject cases with missing case_number
      if (!caseData.case_number || caseData.case_number.trim() === '') {
        console.log('[PARSE-CASE] Rejected: missing case_number');
        rejectedCount++;
        continue;
      }

      // FIX 8: VALIDATION - Reject or fix invalid court_room_no (category codes)
      let validCourtRoomNo: string | null = caseData.court_room_no || null;
      if (validCourtRoomNo && CATEGORY_CODE_PATTERN.test(validCourtRoomNo)) {
        console.log(`[PARSE-CASE] Rejected category code as court_room_no: ${validCourtRoomNo}`);
        validCourtRoomNo = null;
      }

      // FIX 2: Deduplication uses case identity ONLY (date + court_location + case_number)
      // item_no is presentation metadata, NOT part of identity
      const { data: existing } = await supabase
        .from('daily_court_docket')
        .select('id')
        .eq('date', causelist.list_date)
        .eq('court_location', causelist.bench)
        .eq('case_number', caseData.case_number)
        .maybeSingle();

      if (existing) {
        console.log(`[PARSE-CASE] Skipped duplicate: ${caseData.case_number}`);
        skippedCount++;
        continue;
      }

      // FIX 5: FAIL-LOUD insertion with proper error handling
      const { error: insertError } = await supabase
        .from('daily_court_docket')
        .insert({
          date: causelist.list_date,
          court_location: causelist.bench,
          list_type: causelist.list_type,
          court_room_no: validCourtRoomNo, // May be null if invalid
          item_no: caseData.item_no || null,
          case_number: caseData.case_number,
          petitioner: caseData.petitioner,
          respondent: caseData.respondent,
          petitioner_lawyer: caseData.petitioner_lawyer,
          respondent_lawyer: caseData.respondent_lawyer,
          matched_profile_id: queueItem.profile_id,
          source_url: causelist.storage_path,
          status: 'pending'
        });

      if (insertError) {
        // FIX 5: FAIL-LOUD - Log uniqueness violations explicitly
        if (insertError.code === '23505') {
          console.error(`[PARSE-CASE] UNIQUENESS VIOLATION - This is a BUG: ${caseData.case_number}`, insertError.message);
          skippedCount++;
        } else {
          console.error(`[PARSE-CASE] INSERT FAILED: ${caseData.case_number}`, insertError.message);
          rejectedCount++;
        }
      } else {
        insertedCount++;
      }
    }

    console.log(`[PARSE-CASE] Results: ${insertedCount} inserted, ${skippedCount} skipped, ${rejectedCount} rejected`);

    // Update current queue item as done
    await supabase
      .from('case_parse_queue')
      .update({ 
        status: 'done', 
        cases_parsed: insertedCount, 
        completed_at: new Date().toISOString(),
        provider_used: aiResult.provider,
        retry_count: queueItem.retry_count || 0
      })
      .eq('id', queueItem.id);

    const duration = Date.now() - startTime;
    console.log(`[PARSE-CASE] Batch done: ${insertedCount} inserted, ${skippedCount} skipped, ${duration}ms, provider: ${aiResult.provider}${aiResult.cached ? ' (CACHED)' : ''}`);

    // If there are more sections to process, create a follow-up queue item
    let nextBatchQueued = false;
    if (extraction.hasMore) {
      console.log(`[PARSE-CASE] Queueing next batch starting at section ${extraction.nextStartSection}`);
      
      const { error: queueNextError } = await supabase
        .from('case_parse_queue')
        .insert({
          profile_id: queueItem.profile_id,
          raw_causelist_id: queueItem.raw_causelist_id,
          matched_alias: queueItem.matched_alias,
          status: 'pending',
          batch_start: extraction.nextStartSection
        });
      
      if (queueNextError) {
        console.error('[PARSE-CASE] Failed to queue next batch:', queueNextError);
      } else {
        nextBatchQueued = true;
        console.log(`[PARSE-CASE] Next batch queued successfully`);
        
        // Trigger next processing immediately via background task
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        
        EdgeRuntime.waitUntil(
          fetch(`${supabaseUrl}/functions/v1/parse-case`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`
            },
            body: JSON.stringify({})
          }).catch(err => console.error('[PARSE-CASE] Failed to trigger next batch:', err))
        );
      }
    }

    return new Response(JSON.stringify({
      success: true,
      queue_item_id: queueItem.id,
      cases_parsed: parsedCases.length,
      cases_inserted: insertedCount,
      cases_skipped: skippedCount,
      duration_ms: duration,
      ai_provider: aiResult.provider,
      cached: aiResult.cached || false,
      batch_info: {
        sections_processed: `${extraction.startSection}-${extraction.endSection}`,
        total_sections: extraction.totalSections,
        has_more: extraction.hasMore,
        next_batch_queued: nextBatchQueued
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[PARSE-CASE] Error:', error);

    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
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

    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
