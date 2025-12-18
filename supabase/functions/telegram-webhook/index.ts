import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

interface PdfStructure {
  total_courts_detected: number;
  item_numbering_type_global: 'continuous_global' | 'resets_per_court' | 'unknown';
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
  console.log('[TELEGRAM] Full update:', JSON.stringify(update, null, 2));

  const message = update.message || update.channel_post;
  if (!message) {
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  const text = message.text || message.caption || '';
  const fileName = message.document?.file_name || '';
  
  console.log(`[TELEGRAM] Message from ${message.chat.title || message.chat.id}: ${text.substring(0, 100)}`);
  console.log(`[TELEGRAM] Has document: ${!!message.document}, file_id: ${message.document?.file_id || 'none'}`);
  console.log(`[TELEGRAM] Bot token available: ${!!botToken}, Lovable API key available: ${!!lovableApiKey}`);

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

  // Get file URL and download PDF if document exists
  let fileUrl = '';
  let pdfContent: Uint8Array | null = null;
  
  console.log(`[TELEGRAM] Checking PDF download: document=${!!message.document}, botToken=${!!botToken}`);
  
  if (message.document && botToken) {
    try {
      console.log(`[TELEGRAM] Getting file info for file_id: ${message.document.file_id}`);
      const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${message.document.file_id}`;
      console.log(`[TELEGRAM] Calling: ${getFileUrl.substring(0, 50)}...`);
      
      const fileResponse = await fetch(getFileUrl);
      const fileData = await fileResponse.json();
      
      console.log(`[TELEGRAM] getFile response:`, JSON.stringify(fileData));
      
      if (fileData.ok && fileData.result.file_path) {
        fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
        console.log(`[TELEGRAM] File URL obtained: ${fileUrl.substring(0, 60)}...`);
        
        // Download the PDF
        console.log(`[TELEGRAM] Downloading PDF...`);
        const pdfResponse = await fetch(fileUrl);
        console.log(`[TELEGRAM] PDF response status: ${pdfResponse.status}`);
        
        if (pdfResponse.ok) {
          pdfContent = new Uint8Array(await pdfResponse.arrayBuffer());
          console.log(`[TELEGRAM] PDF downloaded, size: ${pdfContent.length} bytes`);
        } else {
          console.error(`[TELEGRAM] PDF download failed: ${pdfResponse.status} ${pdfResponse.statusText}`);
        }
      } else {
        console.error(`[TELEGRAM] getFile failed:`, JSON.stringify(fileData));
      }
    } catch (err) {
      console.error('[TELEGRAM] Error getting/downloading file:', err);
    }
  } else {
    console.log(`[TELEGRAM] Skipping PDF download - no document or no botToken`);
  }

  // If we have PDF content and Lovable API key, parse with AI
  let parsedCases: ParsedCase[] = [];
  let judgeNames = '';
  
  if (pdfContent && lovableApiKey) {
    console.log('[TELEGRAM] Parsing PDF with AI...');
    const parseResult = await parsePdfWithAI(pdfContent, lovableApiKey, bench, listType);
    parsedCases = parseResult.cases;
    judgeNames = parseResult.judgeNames;
    console.log(`[TELEGRAM] AI extracted ${parsedCases.length} cases`);
  }

  // Upload PDF to Supabase storage
  let storedPdfUrl = '';
  if (pdfContent) {
    const storagePath = `causelists/${date}/${bench}/${courtNo}_${listType}_${message.message_id}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('causelist-pdfs')
      .upload(storagePath, pdfContent, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (!uploadError) {
      const { data: publicUrl } = supabase.storage.from('causelist-pdfs').getPublicUrl(storagePath);
      storedPdfUrl = publicUrl.publicUrl;
      console.log(`[TELEGRAM] PDF stored at: ${storedPdfUrl}`);
    } else {
      console.error('[TELEGRAM] Storage error:', uploadError);
    }
  }

  // Store cases in database with deduplication
  let insertedCount = 0;
  let skippedCount = 0;
  
  if (parsedCases.length > 0) {
    // Check for existing cases for this date/bench/list_type to prevent duplicates
    const { data: existingCases } = await supabase
      .from('daily_court_docket')
      .select('item_no')
      .eq('date', date)
      .eq('court_location', bench)
      .eq('list_type', listType);
    
    const existingItemNos = new Set((existingCases || []).map((c: { item_no: number }) => c.item_no));
    
    if (existingItemNos.size > 0) {
      console.log(`[TELEGRAM] Found ${existingItemNos.size} existing cases for ${date}/${bench}/${listType}`);
    }
    
    // Filter out cases that already exist
    const newCases = parsedCases.filter(c => !existingItemNos.has(c.item_no));
    skippedCount = parsedCases.length - newCases.length;
    
    if (skippedCount > 0) {
      console.log(`[TELEGRAM] Skipping ${skippedCount} duplicate cases`);
    }
    
    if (newCases.length > 0) {
      // Insert only new cases
      const casesToInsert = newCases.map(c => ({
        date,
        court_location: bench,
        list_type: listType,
        court_room_no: courtNo,
        item_no: c.item_no,
        case_number: c.case_number,
        petitioner: c.petitioner,
        respondent: c.respondent,
        petitioner_lawyer: c.petitioner_lawyer,
        respondent_lawyer: c.respondent_lawyer,
        judge_names: judgeNames || c.judge_names,
        source_url: storedPdfUrl || fileUrl || `telegram:${message.message_id}`,
        status: 'pending',
      }));

      const { data, error } = await supabase
        .from('daily_court_docket')
        .insert(casesToInsert)
        .select();

      if (error) {
        console.error('[TELEGRAM] Database error:', error);
      } else {
        insertedCount = data?.length || 0;
        console.log(`[TELEGRAM] Inserted ${insertedCount} new cases (skipped ${skippedCount} duplicates)`);
      }
    } else {
      console.log(`[TELEGRAM] All ${parsedCases.length} cases already exist, skipping insert`);
    }
  } else {
    // No parsed cases - check if placeholder already exists
    const { data: existingPlaceholder } = await supabase
      .from('daily_court_docket')
      .select('id')
      .eq('date', date)
      .eq('court_location', bench)
      .eq('list_type', listType)
      .eq('item_no', 0)
      .maybeSingle();
    
    if (existingPlaceholder) {
      console.log(`[TELEGRAM] Placeholder already exists for ${date}/${bench}/${listType}, skipping`);
    } else {
      const { data, error } = await supabase
        .from('daily_court_docket')
        .insert({
          date,
          court_location: bench,
          list_type: listType,
          court_room_no: courtNo,
          source_url: storedPdfUrl || fileUrl || `telegram:${message.message_id}`,
          status: 'pending_parse',
          case_number: `PENDING_${message.message_id}`,
          item_no: 0,
        })
        .select();

      if (error) {
        console.error('[TELEGRAM] Database error:', error);
      } else {
        insertedCount = 1;
        console.log(`[TELEGRAM] Created placeholder docket entry: ${data?.[0]?.id}`);
      }
    }
  }

  // Log to scraper_logs
  await supabase.from('scraper_logs').insert({
    bench,
    status: parsedCases.length > 0 ? 'success' : 'partial',
    cases_found: insertedCount,
    list_type: listType,
    court_no: courtNo,
  });

  return new Response(
    JSON.stringify({ 
      ok: true, 
      processed: true, 
      cases_parsed: parsedCases.length,
      cases_inserted: insertedCount 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function parsePdfWithAI(
  pdfContent: Uint8Array, 
  _apiKey: string, // Not used - using LOVABLE_API_KEY instead
  bench: string,
  listType: string
): Promise<{ cases: ParsedCase[], judgeNames: string }> {
  try {
    console.log(`[TELEGRAM] Starting AI parse, PDF size: ${pdfContent.length} bytes`);
    
    // Get Lovable API key (pre-configured)
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('[TELEGRAM] LOVABLE_API_KEY not configured');
      return { cases: [], judgeNames: '' };
    }
    
    // Convert PDF to base64 data URL
    const base64Pdf = encodeBase64(pdfContent);
    const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;
    console.log(`[TELEGRAM] Base64 encoded, length: ${base64Pdf.length}`);
    
    // Step 1: Detect PDF structure (courts, item ranges)
    console.log('[TELEGRAM] Step 1: Detecting PDF structure...');
    const structurePrompt = `You are analyzing a High Court causelist PDF ONLY to detect its STRUCTURE.

DO NOT extract individual case details.
DO NOT list petitioners, respondents, or lawyers.

Your task is to IDENTIFY COURT / BENCH SEGMENTS in the document.

---

STEP 1 — Detect Court / Bench Headers

Scan the document and identify every distinct court or bench section.
A court section usually includes:
- Court No / Court Number OR
- Bench name OR
- Judge name(s) heading a block of items

---

STEP 2 — For EACH detected court / bench, determine:

- court_identifier: (Court No / Bench name / exact header text as seen in PDF)
- judge_names: (exact names as written, comma-separated)
- start_item_no: (first item number appearing under this court)
- end_item_no: (last item number appearing under this court)
- item_numbering_type: One of:
  - "continuous_global" (item numbers continue across courts)
  - "resets_per_court" (item numbers restart at 1 for each court)
  - "unknown"

---

STEP 3 — Validate structure integrity

Determine:
- Are all items for a court CONTIGUOUS? (once a court starts, all its items appear together)
- Are courts INTERLEAVED? (items from different courts mixed together)

---

STEP 4 — Output SAFETY DECISION

Decide whether it is SAFE to split this PDF by court for parallel parsing.
Court-based splitting is SAFE ONLY IF:
- courts are clearly segmented
- item ranges do not overlap
- items are not interleaved

---

OUTPUT FORMAT (STRICT JSON — no markdown, no explanations):
{
  "total_courts_detected": 3,
  "item_numbering_type_global": "continuous_global",
  "courts": [
    {
      "court_identifier": "Court No. 1",
      "judge_names": "Hon'ble Justice A, Hon'ble Justice B",
      "start_item_no": 1,
      "end_item_no": 312,
      "items_contiguous": true
    }
  ],
  "courts_interleaved": false,
  "safe_for_court_based_split": true,
  "notes": ""
}`;

    const structureResponse = await callLovableAI(lovableApiKey, pdfDataUrl, structurePrompt);
    let pdfStructure: PdfStructure | null = null;
    let judgeNames = '';
    let totalCases = 0;
    
    if (structureResponse) {
      const structMatch = structureResponse.match(/\{[\s\S]*\}/);
      if (structMatch) {
        try {
          pdfStructure = JSON.parse(structMatch[0]) as PdfStructure;
          console.log(`[TELEGRAM] Structure detected: ${pdfStructure.total_courts_detected} courts, safe_split=${pdfStructure.safe_for_court_based_split}`);
          
          // Collect all judge names
          judgeNames = pdfStructure.courts.map(c => c.judge_names).filter(Boolean).join('; ');
          
          // Calculate total cases from structure
          if (pdfStructure.item_numbering_type_global === 'continuous_global') {
            totalCases = Math.max(...pdfStructure.courts.map(c => c.end_item_no));
          } else {
            totalCases = pdfStructure.courts.reduce((sum, c) => sum + (c.end_item_no - c.start_item_no + 1), 0);
          }
          
          console.log(`[TELEGRAM] Total cases from structure: ${totalCases}, judges: ${judgeNames.substring(0, 80)}...`);
        } catch (e) {
          console.log('[TELEGRAM] Could not parse structure, falling back to simple chunking');
        }
      }
    }
    
    const allCases: ParsedCase[] = [];
    
    // Step 2: Parse cases - use court-based or chunk-based approach
    if (pdfStructure && pdfStructure.safe_for_court_based_split && pdfStructure.courts.length > 0) {
      // Court-based parsing: parse each court section separately
      console.log(`[TELEGRAM] Step 2: Court-based parsing (${pdfStructure.courts.length} courts)...`);
      
      for (let courtIdx = 0; courtIdx < pdfStructure.courts.length; courtIdx++) {
        const court = pdfStructure.courts[courtIdx];
        const courtCaseCount = court.end_item_no - court.start_item_no + 1;
        
        console.log(`[TELEGRAM] Parsing ${court.court_identifier}: items ${court.start_item_no}-${court.end_item_no} (${courtCaseCount} cases)...`);
        
        // For large courts, chunk them; for small ones, parse in one go
        const CHUNK_SIZE = 50;
        
        if (courtCaseCount <= CHUNK_SIZE) {
          // Parse entire court section at once
          const courtCases = await parseCourtSection(
            lovableApiKey, pdfDataUrl, bench, listType,
            court.court_identifier, court.judge_names,
            court.start_item_no, court.end_item_no
          );
          allCases.push(...courtCases);
        } else {
          // Chunk within this court
          const chunks = Math.ceil(courtCaseCount / CHUNK_SIZE);
          for (let chunk = 0; chunk < chunks; chunk++) {
            const startItem = court.start_item_no + chunk * CHUNK_SIZE;
            const endItem = Math.min(court.start_item_no + (chunk + 1) * CHUNK_SIZE - 1, court.end_item_no);
            
            console.log(`[TELEGRAM]   Chunk ${chunk + 1}/${chunks}: items ${startItem}-${endItem}...`);
            
            const chunkCases = await parseCourtSection(
              lovableApiKey, pdfDataUrl, bench, listType,
              court.court_identifier, court.judge_names,
              startItem, endItem
            );
            allCases.push(...chunkCases);
            
            if (chunk < chunks - 1) {
              await new Promise(resolve => setTimeout(resolve, 800));
            }
          }
        }
        
        // Delay between courts
        if (courtIdx < pdfStructure.courts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else {
      // Fallback: Simple chunk-based parsing (original approach)
      if (totalCases === 0) totalCases = 200;
      
      const CHUNK_SIZE = 40;
      const chunks = Math.ceil(totalCases / CHUNK_SIZE);
      
      console.log(`[TELEGRAM] Step 2: Chunk-based parsing (${totalCases} cases in ${chunks} chunks)...`);
      
      for (let chunk = 0; chunk < chunks; chunk++) {
        const startItem = chunk * CHUNK_SIZE + 1;
        const endItem = Math.min((chunk + 1) * CHUNK_SIZE, totalCases);
        
        console.log(`[TELEGRAM] Parsing chunk ${chunk + 1}/${chunks}: items ${startItem}-${endItem}...`);
        
        const chunkPrompt = `You are a legal document parser for Indian High Court causelists.

Parse this ${bench} Bench ${listType} causelist PDF and extract ONLY cases with item numbers from ${startItem} to ${endItem}.

For each case, extract:
- item_no: The serial/item number
- case_number: Full case number
- petitioner: Name(s) of petitioner(s)
- respondent: Name(s) of respondent(s)  
- petitioner_lawyer: Name(s) of advocate(s) for petitioner
- respondent_lawyer: Name(s) of advocate(s) for respondent
- court_room_no: Court number if visible

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "cases": [
    {
      "item_no": ${startItem},
      "case_number": "...",
      "petitioner": "...",
      "respondent": "...",
      "petitioner_lawyer": "...",
      "respondent_lawyer": "...",
      "court_room_no": "..."
    }
  ]
}

IMPORTANT: Only extract items ${startItem} to ${endItem}. If a field is not available, use null.`;

        const chunkResponse = await callLovableAI(lovableApiKey, pdfDataUrl, chunkPrompt);
        
        if (chunkResponse) {
          const chunkCases = parseChunkResponse(chunkResponse);
          console.log(`[TELEGRAM] Chunk ${chunk + 1}: extracted ${chunkCases.length} cases`);
          allCases.push(...chunkCases);
        }
        
        if (chunk < chunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (allCases.length >= totalCases || (chunkResponse && parseChunkResponse(chunkResponse).length === 0)) {
          console.log(`[TELEGRAM] Stopping early: extracted ${allCases.length} cases`);
          break;
        }
      }
    }
    
    console.log(`[TELEGRAM] Total extracted: ${allCases.length} cases`);
    return { cases: allCases, judgeNames };
    
  } catch (error) {
    console.error('[TELEGRAM] AI parsing error:', error);
    return { cases: [], judgeNames: '' };
  }
}

// Parse a specific court section
async function parseCourtSection(
  apiKey: string,
  pdfDataUrl: string,
  bench: string,
  listType: string,
  courtIdentifier: string,
  courtJudges: string,
  startItem: number,
  endItem: number
): Promise<ParsedCase[]> {
  const prompt = `You are a legal document parser for Indian High Court causelists.

Parse this ${bench} Bench ${listType} causelist PDF.

FOCUS ONLY on: ${courtIdentifier}
Judge(s): ${courtJudges}

Extract ONLY cases with item numbers from ${startItem} to ${endItem}.

For each case, extract:
- item_no: The serial/item number
- case_number: Full case number (e.g., "S.B. Civil Writ Petition No. 12345/2024")
- petitioner: Name(s) of petitioner(s)
- respondent: Name(s) of respondent(s)
- petitioner_lawyer: Name(s) of advocate(s) for petitioner
- respondent_lawyer: Name(s) of advocate(s) for respondent

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "cases": [
    {
      "item_no": ${startItem},
      "case_number": "...",
      "petitioner": "...",
      "respondent": "...",
      "petitioner_lawyer": "...",
      "respondent_lawyer": "..."
    }
  ]
}

IMPORTANT: Only extract items ${startItem} to ${endItem} from ${courtIdentifier}. If a field is not available, use null.`;

  const response = await callLovableAI(apiKey, pdfDataUrl, prompt);
  
  if (!response) return [];
  
  const cases = parseChunkResponse(response);
  
  // Enrich with court info
  return cases.map(c => ({
    ...c,
    judge_names: courtJudges,
    court_room_no: courtIdentifier.replace(/Court\s*No\.?\s*/i, '').trim() || undefined,
  }));
}

// Call Lovable AI (Gemini) first, fallback to OpenAI GPT-4o if it fails
async function callLovableAI(apiKey: string, pdfDataUrl: string, prompt: string): Promise<string | null> {
  // Try Gemini first
  const geminiResult = await callGeminiAI(apiKey, pdfDataUrl, prompt);
  if (geminiResult) {
    return geminiResult;
  }
  
  // Fallback to OpenAI GPT-4o
  console.log('[TELEGRAM] Gemini failed, falling back to GPT-4o...');
  const openaiResult = await callOpenAIGPT4o(pdfDataUrl, prompt);
  return openaiResult;
}

async function callGeminiAI(apiKey: string, pdfDataUrl: string, prompt: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: pdfDataUrl } }
            ]
          }
        ],
        max_tokens: 16000,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TELEGRAM] Gemini AI error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    
    console.log(`[TELEGRAM] Gemini response length: ${content.length}`);
    return content;
  } catch (error: unknown) {
    const err = error as Error;
    if (err?.name === 'AbortError') {
      console.error('[TELEGRAM] Gemini request timed out');
    } else {
      console.error('[TELEGRAM] Gemini fetch error:', err?.message || error);
    }
    return null;
  }
}

async function callOpenAIGPT4o(pdfDataUrl: string, prompt: string): Promise<string | null> {
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('[TELEGRAM] OPENAI_API_KEY not configured, skipping GPT-4o fallback');
      return null;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout
    
    console.log('[TELEGRAM] Calling OpenAI GPT-4o...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: pdfDataUrl } }
            ]
          }
        ],
        max_tokens: 16000,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TELEGRAM] OpenAI GPT-4o error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    
    console.log(`[TELEGRAM] GPT-4o response length: ${content.length}`);
    return content;
  } catch (error: unknown) {
    const err = error as Error;
    if (err?.name === 'AbortError') {
      console.error('[TELEGRAM] GPT-4o request timed out');
    } else {
      console.error('[TELEGRAM] GPT-4o fetch error:', err?.message || error);
    }
    return null;
  }
}

function parseChunkResponse(content: string): ParsedCase[] {
  const cases: ParsedCase[] = [];
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return cases;
  
  const jsonStr = jsonMatch[0];
  
  try {
    const parsed = JSON.parse(jsonStr);
    return (parsed.cases || []).map((c: any) => ({
      item_no: parseInt(c.item_no) || 0,
      case_number: c.case_number || 'Unknown',
      petitioner: c.petitioner || undefined,
      respondent: c.respondent || undefined,
      petitioner_lawyer: c.petitioner_lawyer || undefined,
      respondent_lawyer: c.respondent_lawyer || undefined,
      judge_names: undefined,
    }));
  } catch {
    // Try to salvage partial data
    const caseMatches = jsonStr.matchAll(/\{\s*"item_no"\s*:\s*(\d+)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
    
    for (const m of caseMatches) {
      try {
        const caseObj = JSON.parse(m[0]);
        cases.push({
          item_no: caseObj.item_no || 0,
          case_number: caseObj.case_number || 'Unknown',
          petitioner: caseObj.petitioner || undefined,
          respondent: caseObj.respondent || undefined,
          petitioner_lawyer: caseObj.petitioner_lawyer || undefined,
          respondent_lawyer: caseObj.respondent_lawyer || undefined,
          judge_names: undefined,
        });
      } catch {
        const itemNo = parseInt(m[1]) || 0;
        const caseNumMatch = m[0].match(/"case_number"\s*:\s*"([^"]*)"/);
        if (caseNumMatch) {
          const petMatch = m[0].match(/"petitioner"\s*:\s*"([^"]*)"/);
          const respMatch = m[0].match(/"respondent"\s*:\s*"([^"]*)"/);
          const petLawMatch = m[0].match(/"petitioner_lawyer"\s*:\s*"([^"]*)"/);
          const respLawMatch = m[0].match(/"respondent_lawyer"\s*:\s*"([^"]*)"/);
          
          cases.push({
            item_no: itemNo,
            case_number: caseNumMatch[1] || 'Unknown',
            petitioner: petMatch?.[1] || undefined,
            respondent: respMatch?.[1] || undefined,
            petitioner_lawyer: petLawMatch?.[1] || undefined,
            respondent_lawyer: respLawMatch?.[1] || undefined,
            judge_names: undefined,
          });
        }
      }
    }
  }
  
  return cases;
}

// Helper function for base64 encoding
function encodeBase64(data: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  let result = '';
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.subarray(i, Math.min(i + CHUNK_SIZE, data.length));
    result += String.fromCharCode(...chunk);
  }
  return btoa(result);
}

async function handleLegacyPayload(payload: LegacyPayload, supabase: any, req: Request, lovableApiKey?: string) {
  const webhookSecret = Deno.env.get('TRIGGER_SECRET');
  const providedSecret = req.headers.get('x-webhook-secret');
  
  if (webhookSecret && providedSecret !== webhookSecret) {
    console.log('[TELEGRAM] Invalid webhook secret');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log(`[TELEGRAM] Legacy action: ${payload.action}`);

  if (payload.action === 'test') {
    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook is working!',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (payload.action === 'new_message' && payload.message) {
    const result = await processLegacyMessage(payload.message, supabase, lovableApiKey);
    return new Response(JSON.stringify({
      success: true,
      processed: 1,
      cases_found: result.cases
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (payload.action === 'batch_messages' && payload.messages) {
    let totalCases = 0;
    for (const message of payload.messages) {
      const result = await processLegacyMessage(message, supabase, lovableApiKey);
      totalCases += result.cases;
    }

    await supabase.from('scraper_logs').insert({
      bench: 'TELEGRAM',
      status: 'success',
      cases_found: totalCases,
      list_type: 'DAILY'
    });

    return new Response(JSON.stringify({
      success: true,
      processed: payload.messages.length,
      cases_found: totalCases
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function processLegacyMessage(message: LegacyMessage, supabase: any, lovableApiKey?: string): Promise<{ cases: number }> {
  const lowerText = (message.text || '').toLowerCase();
  const isPdf = message.file_name?.toLowerCase().endsWith('.pdf') || 
                lowerText.includes('causelist');

  if (!isPdf && !message.file_url) {
    return { cases: 0 };
  }

  const bench = determineBench(message.text || '', message.file_name || '');
  const listType = determineListType(message.text || '', message.file_name || '');
  const courtNo = extractCourtNumber(message.text || '', message.file_name || '');
  const date = extractDate(message.text || '', message.file_name || '', message.date);

  // Try to download and parse PDF if URL is available
  if (message.file_url && lovableApiKey) {
    try {
      const pdfResponse = await fetch(message.file_url);
      if (pdfResponse.ok) {
        const pdfContent = new Uint8Array(await pdfResponse.arrayBuffer());
        console.log(`[TELEGRAM] Legacy: Downloaded PDF, size: ${pdfContent.length} bytes`);
        
        const parseResult = await parsePdfWithAI(pdfContent, lovableApiKey, bench, listType);
        
        if (parseResult.cases.length > 0) {
          const casesToInsert = parseResult.cases.map(c => ({
            date,
            court_location: bench,
            list_type: listType,
            court_room_no: courtNo,
            item_no: c.item_no,
            case_number: c.case_number,
            petitioner: c.petitioner,
            respondent: c.respondent,
            petitioner_lawyer: c.petitioner_lawyer,
            respondent_lawyer: c.respondent_lawyer,
            judge_names: parseResult.judgeNames || c.judge_names,
            source_url: message.file_url,
            status: 'pending',
          }));

          const { data, error } = await supabase
            .from('daily_court_docket')
            .insert(casesToInsert)
            .select();

          if (!error) {
            return { cases: data?.length || 0 };
          }
        }
      }
    } catch (err) {
      console.error('[TELEGRAM] Legacy PDF parse error:', err);
    }
  }

  // Fallback: just store the file reference
  if (message.file_url) {
    await supabase.from('daily_court_docket').insert({
      date,
      court_location: bench,
      court_room_no: courtNo,
      list_type: listType,
      item_no: 0,
      case_number: `PENDING_PARSE_${message.message_id}`,
      source_url: message.file_url,
      status: 'pending'
    });
    return { cases: 1 };
  }

  return { cases: 0 };
}

function determineBench(text: string, fileName: string): 'JAIPUR' | 'JODHPUR' {
  const combined = (text + ' ' + fileName).toLowerCase();
  if (combined.includes('jodhpur') || combined.includes('जोधपुर') || combined.includes('jdp')) {
    return 'JODHPUR';
  }
  return 'JAIPUR';
}

function determineListType(text: string, fileName: string): 'DAILY' | 'SUPPLEMENTARY' {
  const combined = (text + ' ' + fileName).toLowerCase();
  if (combined.includes('supp') || combined.includes('अनुपूरक') || combined.includes('1002')) {
    return 'SUPPLEMENTARY';
  }
  return 'DAILY';
}

function extractCourtNumber(text: string, fileName: string): string {
  const combined = text + ' ' + fileName;
  const match = combined.match(/court\s*(?:no\.?)?\s*[:\-]?\s*(\d+)/i) ||
                combined.match(/[-_](\d+)\.pdf$/i);
  return match ? match[1] : '1';
}

function extractDate(text: string, fileName: string, messageDate: string): string {
  const combined = text + ' ' + fileName;
  const dateMatch = combined.match(/(\d{2})(\d{2})(\d{4})/) ||
                    combined.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  return messageDate.split('T')[0];
}
