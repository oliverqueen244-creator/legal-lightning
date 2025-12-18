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

    const body = await req.json();
    
    if ('update_id' in body) {
      return await handleTelegramUpdate(body as TelegramUpdate, supabase, botToken!, lovableApiKey);
    }
    
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[TELEGRAM] Error:', error);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function handleTelegramUpdate(update: TelegramUpdate, supabase: any, botToken: string, lovableApiKey?: string) {
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

  const bench = determineBench(text, fileName);
  const listType = determineListType(text, fileName);
  const courtNo = extractCourtNumber(text, fileName);
  const date = extractDate(text, fileName, new Date(message.date * 1000).toISOString());

  console.log(`[TELEGRAM] Processing: bench=${bench}, type=${listType}, court=${courtNo}, date=${date}`);

  // Background task for PDF processing
  const backgroundTask = async () => {
    const startTime = Date.now();
    console.log(`[TELEGRAM-BG] ========== STARTING PIPELINE ==========`);
    
    try {
      // PHASE 1: Download PDF
      let pdfContent: Uint8Array | null = null;
      let fileUrl = '';
      
      if (message.document && botToken) {
        console.log(`[TELEGRAM-BG] PHASE 1: PDF INGESTION`);
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
      }

      if (!pdfContent || !lovableApiKey) {
        console.log('[TELEGRAM-BG] ✗ No PDF or API key');
        await logResult(supabase, bench, listType, courtNo, 'error', 0, 'No PDF or API key');
        return;
      }

      // Encode PDF to base64
      const base64Pdf = uint8ArrayToBase64(pdfContent);
      const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;
      console.log(`[TELEGRAM-BG] ✓ PDF encoded: ${base64Pdf.length} chars`);

      // PHASE 2: Structure Detection
      console.log(`[TELEGRAM-BG] PHASE 2: STRUCTURE DETECTION`);
      const pdfStructure = await detectStructure(pdfDataUrl, lovableApiKey);
      
      let judgeNames = '';
      if (pdfStructure) {
        console.log(`[TELEGRAM-BG] ✓ Detected ${pdfStructure.total_courts_detected} courts, safe_split=${pdfStructure.safe_for_court_based_split}`);
        judgeNames = pdfStructure.courts.map((c: CourtSection) => c.judge_names).filter(Boolean).join('; ');
      }

      // PHASE 3: Parse Cases
      const useCourtSplit = pdfStructure?.safe_for_court_based_split && pdfStructure.courts.length > 1;
      console.log(`[TELEGRAM-BG] PHASE 3: STRATEGY = ${useCourtSplit ? 'COURT_SPLIT' : 'SINGLE_SHOT'}`);

      let allCases: ParsedCase[] = [];

      if (useCourtSplit && pdfStructure) {
        // Court-based parallel parsing
        console.log(`[TELEGRAM-BG] PHASE 4: PARALLEL PARSING (${pdfStructure.courts.length} courts)`);
        
        const BATCH_SIZE = 4;
        for (let i = 0; i < pdfStructure.courts.length; i += BATCH_SIZE) {
          const batch = pdfStructure.courts.slice(i, i + BATCH_SIZE);
          console.log(`[TELEGRAM-BG] Batch ${Math.floor(i/BATCH_SIZE)+1}: ${batch.map((c: CourtSection) => c.court_identifier).join(', ')}`);
          
          const results = await Promise.all(
            batch.map((court: CourtSection) => parseCourt(pdfDataUrl, court, lovableApiKey, bench))
          );
          
          for (let j = 0; j < results.length; j++) {
            console.log(`[TELEGRAM-BG] ✓ ${batch[j].court_identifier}: ${results[j].length} cases`);
            allCases.push(...results[j]);
          }
          
          if (i + BATCH_SIZE < pdfStructure.courts.length) {
            await new Promise(r => setTimeout(r, 300));
          }
        }
      } else {
        // Single-shot parsing
        console.log(`[TELEGRAM-BG] PHASE 4: SINGLE-SHOT PARSING`);
        const CHUNK_SIZE = 50;
        const maxItems = 1000;
        
        for (let chunk = 0; chunk < Math.ceil(maxItems / CHUNK_SIZE); chunk++) {
          const startItem = chunk * CHUNK_SIZE + 1;
          const endItem = (chunk + 1) * CHUNK_SIZE;
          
          const chunkCases = await parseChunk(pdfDataUrl, startItem, endItem, lovableApiKey, bench, listType);
          console.log(`[TELEGRAM-BG] Chunk ${chunk+1}: ${chunkCases.length} cases`);
          allCases.push(...chunkCases);
          
          if (chunkCases.length === 0 && chunk > 2) break;
          if (chunk < 19) await new Promise(r => setTimeout(r, 300));
        }
      }

      // PHASE 5: Validate and Insert
      console.log(`[TELEGRAM-BG] PHASE 5: VALIDATION & INSERT`);
      const validCases = allCases.filter(c => c.item_no > 0 && c.case_number && c.case_number !== 'Unknown');
      console.log(`[TELEGRAM-BG] Validated ${validCases.length}/${allCases.length} cases`);

      // Upload PDF
      let storedPdfUrl = '';
      const storagePath = `causelists/${date}/${bench}/${courtNo}_${listType}_${message.message_id}.pdf`;
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
          .select('item_no, court_room_no').eq('date', date).eq('court_location', bench).eq('list_type', listType);
        
        const existingKeys = new Set((existing || []).map((c: any) => `${c.item_no}_${c.court_room_no || ''}`));
        const newCases = validCases.filter(c => !existingKeys.has(`${c.item_no}_${c.court_room_no || ''}`));
        
        if (newCases.length > 0) {
          const toInsert = newCases.map(c => ({
            date, court_location: bench, list_type: listType,
            court_room_no: c.court_room_no || courtNo, item_no: c.item_no,
            case_number: c.case_number, petitioner: c.petitioner, respondent: c.respondent,
            petitioner_lawyer: c.petitioner_lawyer, respondent_lawyer: c.respondent_lawyer,
            judge_names: c.judge_names || judgeNames,
            source_url: storedPdfUrl || fileUrl || `telegram:${message.message_id}`,
            status: 'pending',
          }));

          for (let i = 0; i < toInsert.length; i += 100) {
            const { data, error } = await supabase.from('daily_court_docket').insert(toInsert.slice(i, i + 100)).select();
            if (!error) insertedCount += data?.length || 0;
          }
        }
      }

      await logResult(supabase, bench, listType, courtNo, validCases.length > 0 ? 'success' : 'partial', insertedCount);
      
      console.log(`[TELEGRAM-BG] ========== COMPLETE ==========`);
      console.log(`[TELEGRAM-BG] Parsed: ${validCases.length}, Inserted: ${insertedCount}, Duration: ${Date.now() - startTime}ms`);
      
    } catch (error) {
      console.error('[TELEGRAM-BG] Error:', error);
      await logResult(supabase, bench, listType, courtNo, 'error', 0, error instanceof Error ? error.message : 'Unknown');
    }
  };

  // @ts-ignore
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(backgroundTask());
    console.log('[TELEGRAM] Background task started');
  } else {
    await backgroundTask();
  }

  return new Response(JSON.stringify({ ok: true, processing: true }), 
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ============================================================================
// AI FUNCTIONS
// ============================================================================

async function detectStructure(pdfDataUrl: string, apiKey: string): Promise<PdfStructure | null> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `Analyze this causelist PDF structure. Identify all courts/benches.
For each: court_identifier, judge_names, start_item_no, end_item_no, items_contiguous.
OUTPUT STRICT JSON:
{"total_courts_detected": N, "item_numbering_type_global": "continuous_global", "courts": [{"court_identifier": "Court No. 1", "judge_names": "...", "start_item_no": 1, "end_item_no": 150, "items_contiguous": true}], "courts_interleaved": false, "safe_for_court_based_split": true, "notes": ""}` },
            { type: 'image_url', image_url: { url: pdfDataUrl } }
          ]
        }],
        max_tokens: 8000,
        temperature: 0,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) {
    console.error('[TELEGRAM-BG] Structure error:', e);
    return null;
  }
}

async function parseCourt(pdfDataUrl: string, court: CourtSection, apiKey: string, bench: string): Promise<ParsedCase[]> {
  const allCases: ParsedCase[] = [];
  const count = court.end_item_no - court.start_item_no + 1;
  const CHUNK = 50;
  
  for (let i = 0; i < Math.ceil(count / CHUNK); i++) {
    const start = court.start_item_no + i * CHUNK;
    const end = Math.min(court.start_item_no + (i + 1) * CHUNK - 1, court.end_item_no);
    
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: `Parse ${bench} causelist PDF. ONLY ${court.court_identifier}, items ${start}-${end}.
Extract: item_no, case_number, petitioner, respondent, petitioner_lawyer, respondent_lawyer.
JSON: {"cases": [{"item_no": N, "case_number": "...", "petitioner": "...", "respondent": "...", "petitioner_lawyer": "...", "respondent_lawyer": "..."}]}` },
              { type: 'image_url', image_url: { url: pdfDataUrl } }
            ]
          }],
          max_tokens: 16000,
          temperature: 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || '';
        content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const cases = parseJson(content);
        allCases.push(...cases.map(c => ({
          ...c,
          judge_names: court.judge_names,
          court_room_no: court.court_identifier.replace(/Court\s*No\.?\s*:?\s*/i, '').trim(),
        })));
      }
    } catch (e) {
      console.error(`[TELEGRAM-BG] Court chunk error:`, e);
    }
    
    if (i < Math.ceil(count / CHUNK) - 1) await new Promise(r => setTimeout(r, 200));
  }
  
  return allCases;
}

async function parseChunk(pdfDataUrl: string, start: number, end: number, apiKey: string, bench: string, listType: string): Promise<ParsedCase[]> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `Parse ${bench} ${listType} causelist PDF. Items ${start}-${end} ONLY.
Extract: item_no, case_number, petitioner, respondent, petitioner_lawyer, respondent_lawyer.
JSON: {"cases": [...]}` },
            { type: 'image_url', image_url: { url: pdfDataUrl } }
          ]
        }],
        max_tokens: 16000,
        temperature: 0,
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    return parseJson(content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
  } catch (e) {
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
    bench, status, cases_found: count, list_type: listType, court_no: courtNo, error_message: error || null,
  });
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
