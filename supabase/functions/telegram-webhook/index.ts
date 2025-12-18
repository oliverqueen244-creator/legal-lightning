import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Handle graceful shutdown
addEventListener('beforeunload', (ev: any) => {
  console.log('[TELEGRAM] Function shutdown due to:', ev.detail?.reason || 'unknown');
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface TelegramUpdate {
  update_id: number;
  message?: TelegramBotMessage;
  channel_post?: TelegramBotMessage;
}

interface TelegramBotMessage {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  document?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
  };
  photo?: Array<{ file_id: string }>;
  chat: {
    id: number;
    title?: string;
    type: string;
  };
  forward_from_chat?: {
    id: number;
    title?: string;
  };
}

interface LegacyMessage {
  message_id: number;
  date: string;
  text: string;
  channel: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
}

interface LegacyPayload {
  action: 'new_message' | 'batch_messages' | 'test';
  messages?: LegacyMessage[];
  message?: LegacyMessage;
}

interface ParsedCase {
  item_no: number;
  case_number: string;
  petitioner?: string;
  respondent?: string;
  petitioner_lawyer?: string;
  respondent_lawyer?: string;
  judge_names?: string;
  court_room_no?: string;
}

interface CourtSection {
  court_identifier: string;
  judge_names: string;
  start_item_no: number;
  end_item_no: number;
  items_contiguous: boolean;
  court_text?: string; // Text extracted for this court
}

interface PdfStructure {
  total_courts_detected: number;
  item_numbering_type_global: 'continuous_global' | 'resets_per_court' | 'unknown';
  courts: CourtSection[];
  courts_interleaved: boolean;
  safe_for_court_based_split: boolean;
  notes: string;
}

// AI Provider types for round-robin distribution
type AIProvider = 'gemini' | 'gpt4o';

interface ParsingMetadata {
  parsing_strategy: 'court_split' | 'single_shot';
  parsing_status: 'complete' | 'partial';
  cases_parsed_count: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const url = new URL(req.url);
    
    // Handle setup - register webhook with Telegram
    if (url.searchParams.get('action') === 'setup') {
      if (!botToken) {
        return new Response(
          JSON.stringify({ success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;
      const setWebhookUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
      
      const response = await fetch(setWebhookUrl);
      const result = await response.json();
      
      console.log('[TELEGRAM] Webhook setup result:', result);
      
      return new Response(
        JSON.stringify({ success: result.ok, result, webhook_url: webhookUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle status check
    if (url.searchParams.get('action') === 'status') {
      if (!botToken) {
        return new Response(
          JSON.stringify({ success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const [botRes, webhookRes] = await Promise.all([
        fetch(`https://api.telegram.org/bot${botToken}/getMe`),
        fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
      ]);
      
      const [botInfo, webhookInfo] = await Promise.all([botRes.json(), webhookRes.json()]);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          bot: botInfo.result,
          webhook: webhookInfo.result 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse incoming request
    const body = await req.json();
    
    // Check if this is a Telegram Bot API update (has update_id)
    if ('update_id' in body) {
      return await handleTelegramUpdate(body as TelegramUpdate, supabase, botToken!, lovableApiKey);
    }
    
    // Otherwise treat as legacy Python script payload
    return await handleLegacyPayload(body as LegacyPayload, supabase, req, lovableApiKey);

  } catch (error) {
    console.error('[TELEGRAM] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleTelegramUpdate(update: TelegramUpdate, supabase: any, botToken: string, lovableApiKey?: string) {
  console.log('[TELEGRAM] Received update:', update.update_id);

  const message = update.message || update.channel_post;
  if (!message) {
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  const text = message.text || message.caption || '';
  const fileName = message.document?.file_name || '';
  
  console.log(`[TELEGRAM] Message from ${message.chat.title || message.chat.id}: ${text.substring(0, 100)}`);

  // Check if this is a PDF document (likely a causelist)
  const isPdf = message.document?.mime_type === 'application/pdf' || 
                fileName.toLowerCase().endsWith('.pdf');

  // Check if this is a causelist
  const lowerText = text.toLowerCase();
  const lowerFile = fileName.toLowerCase();
  const isCauselist = 
    lowerText.includes('causelist') ||
    lowerText.includes('cause list') ||
    lowerText.includes('वादसूची') ||
    lowerFile.includes('causelist') ||
    isPdf;

  if (!isCauselist && !message.document) {
    console.log('[TELEGRAM] Not a causelist message, skipping');
    return new Response(JSON.stringify({ ok: true, skipped: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // Extract metadata
  const bench = determineBench(text, fileName);
  const listType = determineListType(text, fileName);
  const courtNo = extractCourtNumber(text, fileName);
  const date = extractDate(text, fileName, new Date(message.date * 1000).toISOString());

  console.log(`[TELEGRAM] Processing: bench=${bench}, type=${listType}, court=${courtNo}, date=${date}`);

  // Start background processing - return immediately to Telegram
  const backgroundTask = async () => {
    const startTime = Date.now();
    console.log(`[TELEGRAM-BG] ========== STARTING PIPELINE ==========`);
    console.log(`[TELEGRAM-BG] bench=${bench}, type=${listType}, date=${date}`);
    
    let parsingMetadata: ParsingMetadata = {
      parsing_strategy: 'single_shot',
      parsing_status: 'partial',
      cases_parsed_count: 0,
    };
    
    try {
      // PHASE 1: PDF INGESTION - Download the PDF
      let pdfContent: Uint8Array | null = null;
      let fileUrl = '';
      
      if (message.document && botToken) {
        console.log(`[TELEGRAM-BG] PHASE 1: PDF INGESTION`);
        try {
          const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${message.document.file_id}`;
          const fileResponse = await fetch(getFileUrl);
          const fileData = await fileResponse.json();
          
          if (fileData.ok && fileData.result.file_path) {
            fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
            const pdfResponse = await fetch(fileUrl);
            if (pdfResponse.ok) {
              pdfContent = new Uint8Array(await pdfResponse.arrayBuffer());
              console.log(`[TELEGRAM-BG] ✓ PDF downloaded: ${pdfContent.length} bytes`);
            }
          }
        } catch (err) {
          console.error('[TELEGRAM-BG] ✗ Error downloading PDF:', err);
        }
      }

      if (!pdfContent || !lovableApiKey) {
        console.log('[TELEGRAM-BG] ✗ No PDF content or API key, aborting');
        await logScraperResult(supabase, bench, listType, courtNo, 'error', 0, 'No PDF or API key');
        return;
      }

      // PHASE 2: PDF TO TEXT EXTRACTION (using Gemini - only model that supports PDF)
      console.log(`[TELEGRAM-BG] PHASE 2: PDF TO TEXT EXTRACTION`);
      const fullText = await extractPdfToText(pdfContent, lovableApiKey);
      
      if (!fullText || fullText.length < 100) {
        console.log('[TELEGRAM-BG] ✗ Failed to extract text from PDF');
        await logScraperResult(supabase, bench, listType, courtNo, 'error', 0, 'Text extraction failed');
        return;
      }
      
      console.log(`[TELEGRAM-BG] ✓ Extracted ${fullText.length} chars of text`);

      // PHASE 3: COURT STRUCTURE DETECTION (on text only)
      console.log(`[TELEGRAM-BG] PHASE 3: STRUCTURE DETECTION`);
      const pdfStructure = await detectCourtStructure(fullText, lovableApiKey);
      
      if (pdfStructure) {
        console.log(`[TELEGRAM-BG] ✓ Detected ${pdfStructure.total_courts_detected} courts, safe_split=${pdfStructure.safe_for_court_based_split}`);
      } else {
        console.log(`[TELEGRAM-BG] ⚠ Could not detect structure, will use single-shot`);
      }

      // PHASE 4: STRATEGY DECISION
      const useCortSplit = pdfStructure?.safe_for_court_based_split === true && 
                           pdfStructure.courts.length > 0 &&
                           !pdfStructure.courts_interleaved;
      
      console.log(`[TELEGRAM-BG] PHASE 4: STRATEGY = ${useCortSplit ? 'COURT_SPLIT' : 'SINGLE_SHOT'}`);
      parsingMetadata.parsing_strategy = useCortSplit ? 'court_split' : 'single_shot';

      let allCases: ParsedCase[] = [];
      let judgeNames = '';

      if (useCortSplit && pdfStructure) {
        // PATH A: COURT-BASED PARALLEL PARSING
        
        // PHASE 5A: COURT TEXT SPLITTING
        console.log(`[TELEGRAM-BG] PHASE 5A: SPLITTING TEXT BY COURT`);
        const courtsWithText = splitTextByCourt(fullText, pdfStructure.courts);
        
        judgeNames = pdfStructure.courts.map(c => c.judge_names).filter(Boolean).join('; ');
        
        // PHASE 6A: PARALLEL LLM DISPATCH (even=Gemini, odd=GPT-4o)
        console.log(`[TELEGRAM-BG] PHASE 6A: PARALLEL LLM DISPATCH`);
        
        // Process in batches of 4 (2 Gemini + 2 GPT-4o per batch)
        const BATCH_SIZE = 4;
        
        for (let batchStart = 0; batchStart < courtsWithText.length; batchStart += BATCH_SIZE) {
          const batch = courtsWithText.slice(batchStart, batchStart + BATCH_SIZE);
          const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(courtsWithText.length / BATCH_SIZE);
          
          console.log(`[TELEGRAM-BG] Batch ${batchNum}/${totalBatches}: Processing ${batch.length} courts...`);
          
          const batchPromises = batch.map((court, idx) => {
            const globalIdx = batchStart + idx;
            const provider: AIProvider = globalIdx % 2 === 0 ? 'gemini' : 'gpt4o';
            
            console.log(`[TELEGRAM-BG]   → ${court.court_identifier} → ${provider}`);
            
            return parseCourtText(
              court.court_text || '',
              court,
              provider,
              lovableApiKey,
              bench,
              listType
            ).then(cases => ({
              court,
              provider,
              cases,
              success: cases.length > 0,
            })).catch(err => {
              console.error(`[TELEGRAM-BG] ✗ ${court.court_identifier} failed:`, err?.message);
              return {
                court,
                provider,
                cases: [] as ParsedCase[],
                success: false,
              };
            });
          });
          
          const results = await Promise.all(batchPromises);
          
          // Retry failures with alternate provider
          for (const result of results) {
            if (result.success) {
              allCases.push(...result.cases);
              console.log(`[TELEGRAM-BG] ✓ ${result.court.court_identifier}: ${result.cases.length} cases via ${result.provider}`);
            } else {
              // Retry with alternate provider
              const altProvider: AIProvider = result.provider === 'gemini' ? 'gpt4o' : 'gemini';
              console.log(`[TELEGRAM-BG] ⟳ Retrying ${result.court.court_identifier} with ${altProvider}`);
              
              try {
                const retryCases = await parseCourtText(
                  result.court.court_text || '',
                  result.court,
                  altProvider,
                  lovableApiKey,
                  bench,
                  listType
                );
                allCases.push(...retryCases);
                console.log(`[TELEGRAM-BG] ✓ Retry ${result.court.court_identifier}: ${retryCases.length} cases via ${altProvider}`);
              } catch (retryErr) {
                console.error(`[TELEGRAM-BG] ✗✗ ${result.court.court_identifier} failed after retry`);
              }
            }
          }
          
          // Small delay between batches
          if (batchStart + BATCH_SIZE < courtsWithText.length) {
            await new Promise(r => setTimeout(r, 500));
          }
        }
        
      } else {
        // PATH B: SINGLE-SHOT FALLBACK
        console.log(`[TELEGRAM-BG] PHASE 5B: SINGLE-SHOT TEXT PARSING`);
        
        const singleShotCases = await parseSingleShot(fullText, lovableApiKey, bench, listType);
        allCases.push(...singleShotCases);
        
        console.log(`[TELEGRAM-BG] ✓ Single-shot extracted ${allCases.length} cases`);
      }

      // PHASE 8: MERGE, VALIDATE & INSERT
      console.log(`[TELEGRAM-BG] PHASE 8: VALIDATION & INSERT`);
      
      // Validate: filter out invalid rows
      const validCases = allCases.filter(c => 
        c.item_no > 0 && 
        c.case_number && 
        c.case_number !== 'Unknown'
      );
      
      console.log(`[TELEGRAM-BG] Validated ${validCases.length}/${allCases.length} cases`);
      
      parsingMetadata.cases_parsed_count = validCases.length;
      parsingMetadata.parsing_status = validCases.length > 0 ? 'complete' : 'partial';

      // Upload PDF to storage
      let storedPdfUrl = '';
      const storagePath = `causelists/${date}/${bench}/${courtNo}_${listType}_${message.message_id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('causelist-pdfs')
        .upload(storagePath, pdfContent, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (!uploadError) {
        const { data: publicUrl } = supabase.storage.from('causelist-pdfs').getPublicUrl(storagePath);
        storedPdfUrl = publicUrl.publicUrl;
      }

      // Insert cases with deduplication (UNIQUE: date, court_location, item_no)
      let insertedCount = 0;
      let skippedCount = 0;
      
      if (validCases.length > 0) {
        // Get existing items for deduplication
        const { data: existingCases } = await supabase
          .from('daily_court_docket')
          .select('item_no, court_room_no')
          .eq('date', date)
          .eq('court_location', bench)
          .eq('list_type', listType);
        
        const existingKeys = new Set((existingCases || []).map((c: any) => 
          `${c.item_no}_${c.court_room_no || ''}`
        ));
        
        const newCases = validCases.filter(c => 
          !existingKeys.has(`${c.item_no}_${c.court_room_no || ''}`)
        );
        skippedCount = validCases.length - newCases.length;
        
        if (newCases.length > 0) {
          const casesToInsert = newCases.map(c => ({
            date,
            court_location: bench,
            list_type: listType,
            court_room_no: c.court_room_no || courtNo,
            item_no: c.item_no,
            case_number: c.case_number,
            petitioner: c.petitioner,
            respondent: c.respondent,
            petitioner_lawyer: c.petitioner_lawyer,
            respondent_lawyer: c.respondent_lawyer,
            judge_names: c.judge_names || judgeNames,
            source_url: storedPdfUrl || fileUrl || `telegram:${message.message_id}`,
            status: 'pending',
          }));

          // Insert in batches of 100
          const BATCH_SIZE = 100;
          for (let i = 0; i < casesToInsert.length; i += BATCH_SIZE) {
            const batch = casesToInsert.slice(i, i + BATCH_SIZE);
            const { data, error } = await supabase
              .from('daily_court_docket')
              .insert(batch)
              .select();

            if (error) {
              console.error(`[TELEGRAM-BG] DB error batch ${i / BATCH_SIZE + 1}:`, error);
            } else {
              insertedCount += data?.length || 0;
            }
          }
        }
      }

      // Log success
      await logScraperResult(
        supabase, bench, listType, courtNo,
        validCases.length > 0 ? 'success' : 'partial',
        insertedCount,
        null,
        parsingMetadata
      );

      const totalTime = Date.now() - startTime;
      console.log(`[TELEGRAM-BG] ========== PIPELINE COMPLETE ==========`);
      console.log(`[TELEGRAM-BG] Strategy: ${parsingMetadata.parsing_strategy}`);
      console.log(`[TELEGRAM-BG] Status: ${parsingMetadata.parsing_status}`);
      console.log(`[TELEGRAM-BG] Parsed: ${validCases.length}, Inserted: ${insertedCount}, Skipped: ${skippedCount}`);
      console.log(`[TELEGRAM-BG] Duration: ${totalTime}ms`);
      
    } catch (error) {
      console.error('[TELEGRAM-BG] Pipeline error:', error);
      await logScraperResult(supabase, bench, listType, courtNo, 'error', 0, error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Use EdgeRuntime.waitUntil for background processing
  // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(backgroundTask());
    console.log('[TELEGRAM] Background task started, returning immediate response');
  } else {
    console.log('[TELEGRAM] EdgeRuntime not available, running synchronously');
    await backgroundTask();
  }

  return new Response(
    JSON.stringify({ ok: true, processing: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============================================================================
// PHASE 2: PDF TO TEXT EXTRACTION
// ============================================================================

async function extractPdfToText(pdfContent: Uint8Array, apiKey: string): Promise<string | null> {
  try {
    const base64Pdf = btoa(String.fromCharCode(...pdfContent));
    const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;
    
    const prompt = `Extract ALL text content from this PDF document EXACTLY as it appears.
Preserve:
- All court headers and bench names
- All item numbers (serial numbers)
- All case numbers
- All party names (petitioners, respondents)
- All lawyer/advocate names
- Line breaks between entries

DO NOT summarize or clean the text.
DO NOT skip any content.
Output the raw text content only.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Fast model for extraction
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: pdfDataUrl } }
          ]
        }],
        max_tokens: 100000, // Large output for full text
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error('[TELEGRAM-BG] Text extraction failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('[TELEGRAM-BG] Text extraction error:', error);
    return null;
  }
}

// ============================================================================
// PHASE 3: COURT STRUCTURE DETECTION
// ============================================================================

async function detectCourtStructure(fullText: string, apiKey: string): Promise<PdfStructure | null> {
  try {
    const prompt = `Analyze this causelist text to detect its STRUCTURE only.

TEXT TO ANALYZE:
${fullText.substring(0, 50000)}

TASK: Identify all court/bench sections in this document.

For each court section, determine:
- court_identifier: (Court No / Bench name as written)
- judge_names: (exact names, comma-separated)
- start_item_no: (first item number in this court)
- end_item_no: (last item number in this court)
- items_contiguous: (are all items for this court together?)

Also determine:
- Are courts interleaved? (items from different courts mixed)
- Is it safe to split by court for parallel parsing?

OUTPUT STRICT JSON ONLY (no markdown):
{
  "total_courts_detected": 3,
  "item_numbering_type_global": "continuous_global" or "resets_per_court",
  "courts": [
    {
      "court_identifier": "Court No. 1",
      "judge_names": "Hon'ble Justice A",
      "start_item_no": 1,
      "end_item_no": 150,
      "items_contiguous": true
    }
  ],
  "courts_interleaved": false,
  "safe_for_court_based_split": true,
  "notes": ""
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8000,
        temperature: 0,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    return JSON.parse(jsonMatch[0]) as PdfStructure;
  } catch (error) {
    console.error('[TELEGRAM-BG] Structure detection error:', error);
    return null;
  }
}

// ============================================================================
// PHASE 5A: COURT TEXT SPLITTING
// ============================================================================

function splitTextByCourt(fullText: string, courts: CourtSection[]): CourtSection[] {
  const courtsWithText: CourtSection[] = [];
  
  // Sort courts by start_item_no
  const sortedCourts = [...courts].sort((a, b) => a.start_item_no - b.start_item_no);
  
  for (let i = 0; i < sortedCourts.length; i++) {
    const court = sortedCourts[i];
    
    // Find court header in text
    const courtPattern = new RegExp(
      `(Court\\s*No\\.?\\s*:?\\s*${court.court_identifier.replace(/Court\s*No\.?\s*:?\s*/i, '')}|${court.court_identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'i'
    );
    
    const headerMatch = fullText.match(courtPattern);
    const startPos = headerMatch?.index || 0;
    
    // Find end position (start of next court or end of text)
    let endPos = fullText.length;
    if (i < sortedCourts.length - 1) {
      const nextCourt = sortedCourts[i + 1];
      const nextPattern = new RegExp(
        `(Court\\s*No\\.?\\s*:?\\s*${nextCourt.court_identifier.replace(/Court\s*No\.?\s*:?\s*/i, '')}|${nextCourt.court_identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
        'i'
      );
      const nextMatch = fullText.substring(startPos + 100).match(nextPattern);
      if (nextMatch?.index) {
        endPos = startPos + 100 + nextMatch.index;
      }
    }
    
    const courtText = fullText.substring(startPos, endPos);
    
    courtsWithText.push({
      ...court,
      court_text: courtText,
    });
  }
  
  return courtsWithText;
}

// ============================================================================
// PHASE 6A & 7A: PARSE COURT TEXT (TEXT ONLY - works with both Gemini & GPT-4o)
// ============================================================================

async function parseCourtText(
  courtText: string,
  court: CourtSection,
  provider: AIProvider,
  apiKey: string,
  bench: string,
  listType: string
): Promise<ParsedCase[]> {
  const allCases: ParsedCase[] = [];
  const expectedCount = court.end_item_no - court.start_item_no + 1;
  
  // Chunk large courts
  const CHUNK_SIZE = 50;
  const chunks = Math.ceil(expectedCount / CHUNK_SIZE);
  
  for (let chunk = 0; chunk < chunks; chunk++) {
    const startItem = court.start_item_no + chunk * CHUNK_SIZE;
    const endItem = Math.min(court.start_item_no + (chunk + 1) * CHUNK_SIZE - 1, court.end_item_no);
    
    const prompt = `Parse this causelist text and extract case data.

COURT: ${court.court_identifier}
JUDGES: ${court.judge_names}
EXTRACT ITEMS: ${startItem} to ${endItem}

TEXT:
${courtText}

For each case with item_no from ${startItem} to ${endItem}, extract:
- item_no: The serial/item number (integer)
- case_number: Full case number
- petitioner: Petitioner name(s)
- respondent: Respondent name(s)
- petitioner_lawyer: Advocate(s) for petitioner
- respondent_lawyer: Advocate(s) for respondent

Return STRICT JSON (no markdown, no explanation):
{
  "cases": [
    {"item_no": ${startItem}, "case_number": "...", "petitioner": "...", "respondent": "...", "petitioner_lawyer": "...", "respondent_lawyer": "..."}
  ]
}

IMPORTANT: Only extract items ${startItem}-${endItem}. Use null for missing fields.`;

    let content: string | null = null;
    
    if (provider === 'gemini') {
      content = await callGeminiText(apiKey, prompt);
    } else {
      content = await callOpenAIText(prompt);
    }
    
    if (content) {
      const cases = parseJsonResponse(content);
      // Enrich with court info
      const enriched = cases.map(c => ({
        ...c,
        judge_names: court.judge_names,
        court_room_no: court.court_identifier.replace(/Court\s*No\.?\s*:?\s*/i, '').trim(),
      }));
      allCases.push(...enriched);
    }
    
    // Small delay between chunks
    if (chunk < chunks - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  return allCases;
}

// ============================================================================
// PATH B: SINGLE-SHOT FALLBACK
// ============================================================================

async function parseSingleShot(
  fullText: string,
  apiKey: string,
  bench: string,
  listType: string
): Promise<ParsedCase[]> {
  const allCases: ParsedCase[] = [];
  
  // Estimate case count (rough heuristic)
  const itemMatches = fullText.match(/\b\d{1,4}\s*\.\s*[A-Z]/g) || [];
  const estimatedCases = Math.max(itemMatches.length, 100);
  
  const CHUNK_SIZE = 40;
  const chunks = Math.ceil(estimatedCases / CHUNK_SIZE);
  
  for (let chunk = 0; chunk < Math.min(chunks, 25); chunk++) { // Max 25 chunks to avoid timeout
    const startItem = chunk * CHUNK_SIZE + 1;
    const endItem = (chunk + 1) * CHUNK_SIZE;
    
    const prompt = `Parse this ${bench} Bench ${listType} causelist text.

Extract ONLY cases with item numbers from ${startItem} to ${endItem}.

TEXT (truncated):
${fullText.substring(0, 80000)}

For each case, extract:
- item_no, case_number, petitioner, respondent, petitioner_lawyer, respondent_lawyer

Return STRICT JSON:
{"cases": [{"item_no": ${startItem}, "case_number": "...", ...}]}

Only items ${startItem}-${endItem}. Use null for missing fields.`;

    const content = await callGeminiText(apiKey, prompt);
    
    if (content) {
      const cases = parseJsonResponse(content);
      allCases.push(...cases);
      
      // Stop if no more cases found
      if (cases.length === 0 && chunk > 0) {
        console.log(`[TELEGRAM-BG] Single-shot: No more cases at chunk ${chunk + 1}, stopping`);
        break;
      }
    }
    
    if (chunk < chunks - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  return allCases;
}

// ============================================================================
// AI PROVIDER CALLS (TEXT ONLY)
// ============================================================================

async function callGeminiText(apiKey: string, prompt: string): Promise<string | null> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 16000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error('[TELEGRAM-BG] Gemini text error:', response.status);
      return null;
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    return content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  } catch (error) {
    console.error('[TELEGRAM-BG] Gemini text error:', error);
    return null;
  }
}

async function callOpenAIText(prompt: string): Promise<string | null> {
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('[TELEGRAM-BG] OPENAI_API_KEY not configured');
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast and cheap for text
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 16000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error('[TELEGRAM-BG] GPT-4o-mini text error:', response.status);
      return null;
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    return content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  } catch (error) {
    console.error('[TELEGRAM-BG] GPT-4o-mini text error:', error);
    return null;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function parseJsonResponse(content: string): ParsedCase[] {
  const cases: ParsedCase[] = [];
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return cases;
  
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return (parsed.cases || []).map((c: any) => ({
      item_no: parseInt(c.item_no) || 0,
      case_number: c.case_number || 'Unknown',
      petitioner: c.petitioner || undefined,
      respondent: c.respondent || undefined,
      petitioner_lawyer: c.petitioner_lawyer || undefined,
      respondent_lawyer: c.respondent_lawyer || undefined,
    }));
  } catch {
    // Try regex extraction for partial JSON
    const caseMatches = content.matchAll(/"item_no"\s*:\s*(\d+)/g);
    for (const m of caseMatches) {
      cases.push({
        item_no: parseInt(m[1]) || 0,
        case_number: 'Partial',
      });
    }
    return cases;
  }
}

async function logScraperResult(
  supabase: any,
  bench: string,
  listType: string,
  courtNo: string,
  status: string,
  casesFound: number,
  errorMessage: string | null,
  metadata?: ParsingMetadata
) {
  await supabase.from('scraper_logs').insert({
    bench,
    status,
    cases_found: casesFound,
    list_type: listType,
    court_no: courtNo,
    error_message: errorMessage,
  });
}

// ============================================================================
// LEGACY HANDLER & HELPER FUNCTIONS
// ============================================================================

async function handleLegacyPayload(payload: LegacyPayload, supabase: any, req: Request, _lovableApiKey?: string) {
  const webhookSecret = req.headers.get('x-webhook-secret');
  const expectedSecret = Deno.env.get('TRIGGER_SECRET');
  
  if (expectedSecret && webhookSecret !== expectedSecret) {
    console.log('[TELEGRAM] Invalid webhook secret');
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid webhook secret' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (payload.action === 'test') {
    return new Response(
      JSON.stringify({ success: true, message: 'Webhook is working' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const messages = payload.messages || (payload.message ? [payload.message] : []);
  
  if (messages.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'No messages provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[TELEGRAM] Processing ${messages.length} legacy messages`);

  let processed = 0;
  let errors = 0;

  for (const msg of messages) {
    try {
      const isCauselist = 
        msg.text.toLowerCase().includes('causelist') ||
        msg.text.toLowerCase().includes('cause list') ||
        msg.text.toLowerCase().includes('वादसूची') ||
        (msg.file_name && msg.file_name.toLowerCase().includes('causelist'));

      if (!isCauselist) {
        console.log(`[TELEGRAM] Skipping non-causelist message: ${msg.message_id}`);
        continue;
      }

      const bench = determineBench(msg.text, msg.file_name || '');
      const listType = determineListType(msg.text, msg.file_name || '');
      const courtNo = extractCourtNumber(msg.text, msg.file_name || '');
      const date = extractDate(msg.text, msg.file_name || '', msg.date);

      const { data: existing } = await supabase
        .from('daily_court_docket')
        .select('id')
        .eq('date', date)
        .eq('court_location', bench)
        .eq('list_type', listType)
        .eq('court_room_no', courtNo)
        .maybeSingle();

      if (existing) {
        console.log(`[TELEGRAM] Entry already exists for ${bench}/${listType}/${courtNo}/${date}`);
        continue;
      }

      const { error: insertError } = await supabase
        .from('daily_court_docket')
        .insert({
          date,
          court_location: bench,
          list_type: listType,
          court_room_no: courtNo,
          source_url: msg.file_url || `telegram:${msg.message_id}`,
          status: 'pending',
          case_number: `AUTO_${msg.message_id}`,
          item_no: 0,
        });

      if (insertError) {
        console.error(`[TELEGRAM] Insert error:`, insertError);
        errors++;
      } else {
        processed++;
      }

    } catch (err) {
      console.error(`[TELEGRAM] Error processing message ${msg.message_id}:`, err);
      errors++;
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      processed,
      errors,
      total: messages.length 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function determineBench(text: string, fileName: string): string {
  const combined = `${text} ${fileName}`.toLowerCase();
  
  if (combined.includes('jaipur') || combined.includes('जयपुर')) return 'Jaipur';
  if (combined.includes('jodhpur') || combined.includes('जोधपुर')) return 'Jodhpur';
  if (combined.includes('delhi') || combined.includes('दिल्ली')) return 'Delhi';
  if (combined.includes('mumbai') || combined.includes('मुंबई')) return 'Mumbai';
  if (combined.includes('chennai') || combined.includes('चेन्नई')) return 'Chennai';
  if (combined.includes('kolkata') || combined.includes('कोलकाता')) return 'Kolkata';
  if (combined.includes('allahabad') || combined.includes('इलाहाबाद') || combined.includes('prayagraj')) return 'Allahabad';
  
  return 'Jodhpur'; // Default
}

function determineListType(text: string, fileName: string): string {
  const combined = `${text} ${fileName}`.toLowerCase();
  
  if (combined.includes('supplementary') || combined.includes('supp')) return 'Supplementary';
  if (combined.includes('daily') || combined.includes('regular')) return 'Daily';
  if (combined.includes('advance')) return 'Advance';
  if (combined.includes('weekly')) return 'Weekly';
  if (combined.includes('monthly')) return 'Monthly';
  
  return 'Daily';
}

function extractCourtNumber(text: string, fileName: string): string {
  const combined = `${text} ${fileName}`;
  
  const patterns = [
    /court\s*(?:no\.?|number)?\s*:?\s*(\d+)/i,
    /bench\s*(?:no\.?|number)?\s*:?\s*(\d+)/i,
    /court-?(\d+)/i,
    /^(\d{1,2})(?:_|\.)/,
  ];
  
  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return 'ALL';
}

function extractDate(text: string, fileName: string, fallbackDate: string): string {
  const combined = `${text} ${fileName}`;
  
  const patterns = [
    /(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/,
    /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/,
    /(\d{1,2})\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})/i,
  ];
  
  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match) {
      if (match[0].match(/^\d{4}/)) {
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else if (match[0].match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i)) {
        const months: { [key: string]: string } = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const monthStr = match[0].match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i)?.[0].toLowerCase() || 'jan';
        return `${match[2]}-${months[monthStr]}-${match[1].padStart(2, '0')}`;
      } else {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
      }
    }
  }
  
  return fallbackDate.split('T')[0];
}
