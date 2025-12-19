import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  document?: { file_id: string; file_name?: string; mime_type?: string };
  photo?: Array<{ file_id: string }>;
  chat: { id: number; title?: string; type: string };
  forward_from_chat?: { id: number; title?: string };
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
}

interface PdfStructure {
  total_courts_detected: number;
  item_numbering_type_global: string;
  courts: CourtSection[];
  courts_interleaved: boolean;
  safe_for_court_based_split: boolean;
  notes: string;
}

interface QueuedDocument {
  id: string;
  telegram_update_id: number;
  telegram_message_id: number;
  file_id: string;
  file_name: string | null;
  chat_id: number;
  bench: string;
  list_type: string;
  court_no: string | null;
  message_date: string;
  status: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const url = new URL(req.url);
    
    if (url.searchParams.get('action') === 'setup') {
      if (!botToken) {
        return new Response(JSON.stringify({ success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }), 
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;
      const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const result = await response.json();
      return new Response(JSON.stringify({ success: result.ok, result, webhook_url: webhookUrl }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (url.searchParams.get('action') === 'status') {
      if (!botToken) {
        return new Response(JSON.stringify({ success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const [botRes, webhookRes] = await Promise.all([
        fetch(`https://api.telegram.org/bot${botToken}/getMe`),
        fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
      ]);
      const [botInfo, webhookInfo] = await Promise.all([botRes.json(), webhookRes.json()]);
      return new Response(JSON.stringify({ success: true, bot: botInfo.result, webhook: webhookInfo.result }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Process queue action - called to process next item
    if (url.searchParams.get('action') === 'process-queue') {
      console.log('[TELEGRAM] Process queue triggered');
      await processNextInQueue(supabase, botToken!, googleApiKey, supabaseUrl);
      return new Response(JSON.stringify({ ok: true, action: 'process-queue' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    
    if ('update_id' in body) {
      return await handleTelegramUpdate(body as TelegramUpdate, supabase, botToken!, googleApiKey, supabaseUrl);
    }
    
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[TELEGRAM] Error:', error);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function handleTelegramUpdate(update: TelegramUpdate, supabase: any, botToken: string, googleApiKey?: string, supabaseUrl?: string) {
  console.log('[TELEGRAM] Received update:', update.update_id);

  const message = update.message || update.channel_post;
  if (!message) {
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const text = message.text || message.caption || '';
  const fileName = message.document?.file_name || '';
  
  console.log(`[TELEGRAM] Message from ${message.chat.title || message.chat.id}: ${text.substring(0, 100)}`);

  const isPdf = message.document?.mime_type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isCauselist = text.toLowerCase().includes('causelist') || 
    text.toLowerCase().includes('cause list') || 
    fileName.toLowerCase().includes('causelist') || isPdf;

  if (!isCauselist && !message.document) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // If no document, skip queuing
  if (!message.document) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_document' }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const bench = determineBench(text, fileName);
  const listType = determineListType(text, fileName);
  const courtNo = extractCourtNumber(text, fileName);
  const messageDate = new Date(message.date * 1000).toISOString();

  console.log(`[TELEGRAM] Queueing document: bench=${bench}, type=${listType}, court=${courtNo}`);

  // Add to queue instead of processing immediately
  const { data: queuedItem, error: queueError } = await supabase
    .from('document_processing_queue')
    .upsert({
      telegram_update_id: update.update_id,
      telegram_message_id: message.message_id,
      file_id: message.document.file_id,
      file_name: fileName || null,
      chat_id: message.chat.id,
      bench,
      list_type: listType,
      court_no: courtNo || null,
      message_date: messageDate,
      status: 'pending',
    }, {
      onConflict: 'telegram_update_id',
      ignoreDuplicates: true,
    })
    .select()
    .single();

  if (queueError) {
    // Check if it's a duplicate (already queued)
    if (queueError.code === '23505') {
      console.log('[TELEGRAM] Document already in queue, skipping');
      return new Response(JSON.stringify({ ok: true, queued: false, reason: 'duplicate' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    console.error('[TELEGRAM] Queue error:', queueError);
  } else {
    console.log(`[TELEGRAM] Document queued: ${queuedItem?.id}`);
  }

  // Check if any document is currently processing
  const { data: processingDoc } = await supabase
    .from('document_processing_queue')
    .select('id')
    .eq('status', 'processing')
    .limit(1)
    .maybeSingle();

  // If nothing is processing, start processing the queue
  if (!processingDoc) {
    console.log('[TELEGRAM] No document processing, starting queue processor');
    
    // Start background task to process queue
    const backgroundTask = async () => {
      await processNextInQueue(supabase, botToken, googleApiKey, supabaseUrl);
    };

    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundTask());
    } else {
      await backgroundTask();
    }
  } else {
    console.log(`[TELEGRAM] Document ${processingDoc.id} is already processing, will be picked up after`);
  }

  return new Response(JSON.stringify({ ok: true, queued: true }), 
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ============================================================================
// SEQUENTIAL QUEUE PROCESSOR
// ============================================================================

async function processNextInQueue(supabase: any, botToken: string, googleApiKey?: string, supabaseUrl?: string) {
  console.log('[TELEGRAM-QUEUE] Checking for next document to process...');

  // First, check if anything is already processing (safety check)
  const { data: currentlyProcessing } = await supabase
    .from('document_processing_queue')
    .select('id, started_at')
    .eq('status', 'processing')
    .limit(1)
    .maybeSingle();

  if (currentlyProcessing) {
    // Check if it's been processing for too long (stuck - more than 10 minutes)
    const startedAt = new Date(currentlyProcessing.started_at);
    const minutesProcessing = (Date.now() - startedAt.getTime()) / (1000 * 60);
    
    if (minutesProcessing > 10) {
      console.log(`[TELEGRAM-QUEUE] Document ${currentlyProcessing.id} stuck for ${minutesProcessing.toFixed(1)} min, marking as error`);
      await supabase
        .from('document_processing_queue')
        .update({ status: 'error', error_message: 'Processing timeout', completed_at: new Date().toISOString() })
        .eq('id', currentlyProcessing.id);
    } else {
      console.log(`[TELEGRAM-QUEUE] Document ${currentlyProcessing.id} still processing (${minutesProcessing.toFixed(1)} min), waiting...`);
      return;
    }
  }

  // Get next pending document (oldest first)
  const { data: nextDoc, error: fetchError } = await supabase
    .from('document_processing_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error('[TELEGRAM-QUEUE] Error fetching next document:', fetchError);
    return;
  }

  if (!nextDoc) {
    console.log('[TELEGRAM-QUEUE] No pending documents in queue');
    return;
  }

  console.log(`[TELEGRAM-QUEUE] Processing document: ${nextDoc.id} (update_id: ${nextDoc.telegram_update_id})`);

  // Mark as processing
  await supabase
    .from('document_processing_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', nextDoc.id);

  try {
    // Process the document
    await processDocument(nextDoc as QueuedDocument, supabase, botToken, googleApiKey);

    // Mark as completed
    await supabase
      .from('document_processing_queue')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', nextDoc.id);

    console.log(`[TELEGRAM-QUEUE] Document ${nextDoc.id} completed successfully`);

  } catch (error) {
    console.error(`[TELEGRAM-QUEUE] Document ${nextDoc.id} failed:`, error);
    
    await supabase
      .from('document_processing_queue')
      .update({ 
        status: 'error', 
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString() 
      })
      .eq('id', nextDoc.id);
  }

  // Check if there are more pending documents and process them
  const { count: pendingCount } = await supabase
    .from('document_processing_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (pendingCount && pendingCount > 0) {
    console.log(`[TELEGRAM-QUEUE] ${pendingCount} more documents pending, processing next...`);
    // Small delay before processing next
    await new Promise(r => setTimeout(r, 2000));
    // Continue processing in the same execution context
    await processNextInQueue(supabase, botToken, googleApiKey, supabaseUrl);
  } else {
    console.log('[TELEGRAM-QUEUE] All documents processed');
  }
}

async function processDocument(doc: QueuedDocument, supabase: any, botToken: string, googleApiKey?: string) {
  const startTime = Date.now();
  console.log(`[TELEGRAM-DOC] ========== STARTING PIPELINE ==========`);
  console.log(`[TELEGRAM-DOC] Document: ${doc.file_name || doc.file_id}`);
  
  const date = extractDate('', doc.file_name || '', doc.message_date);
  
  // PHASE 1: Download PDF
  let pdfContent: Uint8Array | null = null;
  let fileUrl = '';
  
  console.log(`[TELEGRAM-DOC] PHASE 1: PDF INGESTION`);
  const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${doc.file_id}`;
  const fileResponse = await fetch(getFileUrl);
  const fileData = await fileResponse.json();
  
  if (fileData.ok && fileData.result.file_path) {
    fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
    const pdfResponse = await fetch(fileUrl);
    if (pdfResponse.ok) {
      pdfContent = new Uint8Array(await pdfResponse.arrayBuffer());
      console.log(`[TELEGRAM-DOC] ✓ PDF downloaded: ${pdfContent.length} bytes`);
    }
  }

  if (!pdfContent || !googleApiKey) {
    console.log('[TELEGRAM-DOC] ✗ No PDF or API key');
    await logResult(supabase, doc.bench, doc.list_type, doc.court_no || 'ALL', 'error', 0, 'No PDF or API key');
    throw new Error('No PDF content or API key');
  }

  // Encode PDF to base64 (native PDF support in Google AI)
  const base64Pdf = uint8ArrayToBase64(pdfContent);
  console.log(`[TELEGRAM-DOC] ✓ PDF encoded: ${base64Pdf.length} chars`);

  // PHASE 2: Structure Detection
  console.log(`[TELEGRAM-DOC] PHASE 2: STRUCTURE DETECTION`);
  const pdfStructure = await detectStructure(base64Pdf, googleApiKey);
  
  let judgeNames = '';
  if (pdfStructure) {
    console.log(`[TELEGRAM-DOC] ✓ Detected ${pdfStructure.total_courts_detected} courts, safe_split=${pdfStructure.safe_for_court_based_split}`);
    judgeNames = pdfStructure.courts.map((c: CourtSection) => c.judge_names).filter(Boolean).join('; ');
  }

  // PHASE 3: Parse Cases
  const useCourtSplit = pdfStructure?.safe_for_court_based_split && pdfStructure.courts.length > 1;
  console.log(`[TELEGRAM-DOC] PHASE 3: STRATEGY = ${useCourtSplit ? 'COURT_SPLIT' : 'SINGLE_SHOT'}`);

  let allCases: ParsedCase[] = [];

  if (useCourtSplit && pdfStructure) {
    // Court-based parallel parsing
    console.log(`[TELEGRAM-DOC] PHASE 4: PARALLEL PARSING (${pdfStructure.courts.length} courts)`);
    
    const BATCH_SIZE = 4;
    for (let i = 0; i < pdfStructure.courts.length; i += BATCH_SIZE) {
      const batch = pdfStructure.courts.slice(i, i + BATCH_SIZE);
      console.log(`[TELEGRAM-DOC] Batch ${Math.floor(i/BATCH_SIZE)+1}: ${batch.map((c: CourtSection) => c.court_identifier).join(', ')}`);
      
      const results = await Promise.all(
        batch.map((court: CourtSection) => parseCourt(base64Pdf, court, googleApiKey, doc.bench))
      );
      
      for (let j = 0; j < results.length; j++) {
        console.log(`[TELEGRAM-DOC] ✓ ${batch[j].court_identifier}: ${results[j].length} cases`);
        allCases.push(...results[j]);
      }
      
      if (i + BATCH_SIZE < pdfStructure.courts.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
  } else {
    // Single-shot parsing
    console.log(`[TELEGRAM-DOC] PHASE 4: SINGLE-SHOT PARSING`);
    const CHUNK_SIZE = 50;
    const maxItems = 1000;
    
    for (let chunk = 0; chunk < Math.ceil(maxItems / CHUNK_SIZE); chunk++) {
      const startItem = chunk * CHUNK_SIZE + 1;
      const endItem = (chunk + 1) * CHUNK_SIZE;
      
      const chunkCases = await parseChunk(base64Pdf, startItem, endItem, googleApiKey, doc.bench, doc.list_type);
      console.log(`[TELEGRAM-DOC] Chunk ${chunk+1}: ${chunkCases.length} cases`);
      allCases.push(...chunkCases);
      
      if (chunkCases.length === 0 && chunk > 2) break;
      if (chunk < 19) await new Promise(r => setTimeout(r, 300));
    }
  }

  // PHASE 5: Validate and Insert
  console.log(`[TELEGRAM-DOC] PHASE 5: VALIDATION & INSERT`);
  const validCases = allCases.filter(c => c.item_no > 0 && c.case_number && c.case_number !== 'Unknown');
  console.log(`[TELEGRAM-DOC] Validated ${validCases.length}/${allCases.length} cases`);

  // Upload PDF
  let storedPdfUrl = '';
  const storagePath = `causelists/${date}/${doc.bench}/${doc.court_no || 'ALL'}_${doc.list_type}_${doc.telegram_message_id}.pdf`;
  const { error: uploadError } = await supabase.storage.from('causelist-pdfs')
    .upload(storagePath, pdfContent, { contentType: 'application/pdf', upsert: true });
  
  if (!uploadError) {
    const { data: publicUrl } = supabase.storage.from('causelist-pdfs').getPublicUrl(storagePath);
    storedPdfUrl = publicUrl.publicUrl;
  }

  // Insert with deduplication
  let insertedCount = 0;
  if (validCases.length > 0) {
    const { data: existing } = await supabase.from('daily_court_docket')
      .select('item_no, court_room_no').eq('date', date).eq('court_location', doc.bench).eq('list_type', doc.list_type);
    
    const existingKeys = new Set((existing || []).map((c: any) => `${c.item_no}_${c.court_room_no || ''}`));
    const newCases = validCases.filter(c => !existingKeys.has(`${c.item_no}_${c.court_room_no || ''}`));
    
    if (newCases.length > 0) {
      const toInsert = newCases.map(c => ({
        date, court_location: doc.bench, list_type: doc.list_type,
        court_room_no: c.court_room_no || doc.court_no || 'ALL', item_no: c.item_no,
        case_number: c.case_number, petitioner: c.petitioner, respondent: c.respondent,
        petitioner_lawyer: c.petitioner_lawyer, respondent_lawyer: c.respondent_lawyer,
        judge_names: c.judge_names || judgeNames,
        source_url: storedPdfUrl || fileUrl || `telegram:${doc.telegram_message_id}`,
        status: 'pending',
      }));

      for (let i = 0; i < toInsert.length; i += 100) {
        const { data, error } = await supabase.from('daily_court_docket').insert(toInsert.slice(i, i + 100)).select();
        if (!error) insertedCount += data?.length || 0;
      }
    }
  }

  await logResult(supabase, doc.bench, doc.list_type, doc.court_no || 'ALL', validCases.length > 0 ? 'success' : 'partial', insertedCount);
  
  console.log(`[TELEGRAM-DOC] ========== COMPLETE ==========`);
  console.log(`[TELEGRAM-DOC] Parsed: ${validCases.length}, Inserted: ${insertedCount}, Duration: ${Date.now() - startTime}ms`);
}

// ============================================================================
// AI FUNCTIONS - Google AI Studio Direct API
// ============================================================================

async function detectStructure(base64Pdf: string, apiKey: string): Promise<PdfStructure | null> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Analyze this causelist PDF structure. Identify all courts/benches.
For each: court_identifier, judge_names, start_item_no, end_item_no, items_contiguous.
OUTPUT STRICT JSON:
{"total_courts_detected": N, "item_numbering_type_global": "continuous_global", "courts": [{"court_identifier": "Court No. 1", "judge_names": "...", "start_item_no": 1, "end_item_no": 150, "items_contiguous": true}], "courts_interleaved": false, "safe_for_court_based_split": true, "notes": ""}` },
            { inline_data: { mime_type: 'application/pdf', data: base64Pdf } }
          ]
        }],
        generationConfig: {
          maxOutputTokens: 8000,
          temperature: 0,
        },
      }),
    });

    if (!response.ok) {
      console.error('[TELEGRAM-DOC] Structure API error:', response.status, await response.text());
      return null;
    }
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) {
    console.error('[TELEGRAM-DOC] Structure error:', e);
    return null;
  }
}

async function parseCourt(base64Pdf: string, court: CourtSection, apiKey: string, bench: string): Promise<ParsedCase[]> {
  const allCases: ParsedCase[] = [];
  const count = court.end_item_no - court.start_item_no + 1;
  const CHUNK = 50;
  
  for (let i = 0; i < Math.ceil(count / CHUNK); i++) {
    const start = court.start_item_no + i * CHUNK;
    const end = Math.min(court.start_item_no + (i + 1) * CHUNK - 1, court.end_item_no);
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Parse ${bench} causelist PDF. ONLY ${court.court_identifier}, items ${start}-${end}.
Extract: item_no, case_number, petitioner, respondent, petitioner_lawyer, respondent_lawyer.
JSON: {"cases": [{"item_no": N, "case_number": "...", "petitioner": "...", "respondent": "...", "petitioner_lawyer": "...", "respondent_lawyer": "..."}]}` },
              { inline_data: { mime_type: 'application/pdf', data: base64Pdf } }
            ]
          }],
          generationConfig: {
            maxOutputTokens: 16000,
            temperature: 0,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const cases = parseJson(content);
        allCases.push(...cases.map(c => ({
          ...c,
          judge_names: court.judge_names,
          court_room_no: court.court_identifier.replace(/Court\s*No\.?\s*:?\s*/i, '').trim(),
        })));
      } else {
        console.error('[TELEGRAM-DOC] Court parse error:', response.status);
      }
    } catch (e) {
      console.error(`[TELEGRAM-DOC] Court chunk error:`, e);
    }
    
    if (i < Math.ceil(count / CHUNK) - 1) await new Promise(r => setTimeout(r, 200));
  }
  
  return allCases;
}

async function parseChunk(base64Pdf: string, start: number, end: number, apiKey: string, bench: string, listType: string): Promise<ParsedCase[]> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Parse ${bench} ${listType} causelist PDF. Items ${start}-${end} ONLY.
Extract: item_no, case_number, petitioner, respondent, petitioner_lawyer, respondent_lawyer.
JSON: {"cases": [...]}` },
            { inline_data: { mime_type: 'application/pdf', data: base64Pdf } }
          ]
        }],
        generationConfig: {
          maxOutputTokens: 16000,
          temperature: 0,
        },
      }),
    });

    if (!response.ok) {
      console.error('[TELEGRAM-DOC] Chunk parse error:', response.status);
      return [];
    }
    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseJson(content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
  } catch (e) {
    console.error('[TELEGRAM-DOC] Chunk error:', e);
    return [];
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let result = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(result);
}

function parseJson(content: string): ParsedCase[] {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return (parsed.cases || []).map((c: any) => ({
      item_no: parseInt(c.item_no) || 0,
      case_number: c.case_number || 'Unknown',
      petitioner: c.petitioner || undefined,
      respondent: c.respondent || undefined,
      petitioner_lawyer: c.petitioner_lawyer || undefined,
      respondent_lawyer: c.respondent_lawyer || undefined,
    }));
  } catch {
    return [];
  }
}

async function logResult(supabase: any, bench: string, listType: string, courtNo: string, status: string, count: number, error?: string) {
  await supabase.from('scraper_logs').insert({
    bench, 
    status, 
    cases_found: count, 
    list_type: listType, 
    court_no: courtNo, 
    error_message: error || null,
  });
  console.log(`[TELEGRAM-DOC] Log created: bench=${bench}, status=${status}, cases=${count}`);
}

function determineBench(text: string, fileName: string): string {
  const combined = `${text} ${fileName}`.toLowerCase();
  if (combined.includes('jaipur')) return 'JAIPUR';
  if (combined.includes('jodhpur')) return 'JODHPUR';
  return 'JODHPUR';
}

function determineListType(text: string, fileName: string): string {
  const combined = `${text} ${fileName}`.toLowerCase();
  if (combined.includes('supplementary')) return 'SUPPLEMENTARY';
  return 'DAILY';
}

function extractCourtNumber(text: string, fileName: string): string {
  const match = `${text} ${fileName}`.match(/court\s*(?:no\.?|number)?\s*:?\s*(\d+)/i);
  return match ? match[1] : 'ALL';
}

function extractDate(text: string, fileName: string, fallback: string): string {
  const combined = `${text} ${fileName}`;
  const match = combined.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return fallback.split('T')[0];
}
