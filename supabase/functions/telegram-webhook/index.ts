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

  // Get file URL and download PDF if document exists
  let fileUrl = '';
  let pdfContent: Uint8Array | null = null;
  
  if (message.document && botToken) {
    try {
      const fileResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${message.document.file_id}`
      );
      const fileData = await fileResponse.json();
      
      if (fileData.ok && fileData.result.file_path) {
        fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
        console.log(`[TELEGRAM] File URL obtained, downloading PDF...`);
        
        // Download the PDF
        const pdfResponse = await fetch(fileUrl);
        if (pdfResponse.ok) {
          pdfContent = new Uint8Array(await pdfResponse.arrayBuffer());
          console.log(`[TELEGRAM] PDF downloaded, size: ${pdfContent.length} bytes`);
        }
      }
    } catch (err) {
      console.error('[TELEGRAM] Error getting/downloading file:', err);
    }
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

  // Store cases in database
  let insertedCount = 0;
  
  if (parsedCases.length > 0) {
    // Insert all parsed cases
    const casesToInsert = parsedCases.map(c => ({
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
      console.log(`[TELEGRAM] Inserted ${insertedCount} cases`);
    }
  } else {
    // No parsed cases - store a placeholder entry
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
  apiKey: string,
  bench: string,
  listType: string
): Promise<{ cases: ParsedCase[], judgeNames: string }> {
  try {
    console.log(`[TELEGRAM] Starting AI parse, PDF size: ${pdfContent.length} bytes`);
    
    // Convert PDF to base64 using Deno's standard library approach
    // btoa doesn't work well with large binary data
    const base64Pdf = encodeBase64(pdfContent);
    console.log(`[TELEGRAM] Base64 encoded, length: ${base64Pdf.length}`);
    
    const systemPrompt = `You are a legal document parser specialized in Indian High Court causelists.
Extract ALL cases from the PDF causelist. For each case, extract:
- item_no: The serial/item number
- case_number: Full case number (e.g., "S.B. Civil Writ Petition No. 1234/2024")
- petitioner: Name(s) of petitioner(s)
- respondent: Name(s) of respondent(s)
- petitioner_lawyer: Name(s) of advocate(s) for petitioner
- respondent_lawyer: Name(s) of advocate(s) for respondent

Also extract the judge names presiding over this court.

Be thorough - extract EVERY case listed in the document.`;

    const userPrompt = `Parse this ${bench} Bench ${listType} causelist PDF and extract all case details.
Return the data as a JSON object with this structure:
{
  "judge_names": "Name of presiding judge(s)",
  "cases": [
    {
      "item_no": 1,
      "case_number": "...",
      "petitioner": "...",
      "respondent": "...",
      "petitioner_lawyer": "...",
      "respondent_lawyer": "..."
    }
  ]
}

Extract ALL cases from the document. If a field is not available, use null.`;

    console.log('[TELEGRAM] Calling Lovable AI...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              { 
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64Pdf}`
                }
              }
            ]
          }
        ],
        max_tokens: 16000,
      }),
    });

    console.log(`[TELEGRAM] AI response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TELEGRAM] AI API error:', response.status, errorText);
      return { cases: [], judgeNames: '' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('[TELEGRAM] AI response length:', content.length);
    console.log('[TELEGRAM] AI response preview:', content.substring(0, 500));
    
    // Parse the JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const cases: ParsedCase[] = (parsed.cases || []).map((c: any) => ({
        item_no: parseInt(c.item_no) || 0,
        case_number: c.case_number || 'Unknown',
        petitioner: c.petitioner || null,
        respondent: c.respondent || null,
        petitioner_lawyer: c.petitioner_lawyer || null,
        respondent_lawyer: c.respondent_lawyer || null,
        judge_names: c.judge_names || null,
      }));
      
      console.log(`[TELEGRAM] Successfully parsed ${cases.length} cases`);
      return { 
        cases, 
        judgeNames: parsed.judge_names || '' 
      };
    }
    
    console.error('[TELEGRAM] Could not parse AI response as JSON');
    console.log('[TELEGRAM] Full response:', content);
    return { cases: [], judgeNames: '' };
    
  } catch (error) {
    console.error('[TELEGRAM] AI parsing error:', error);
    return { cases: [], judgeNames: '' };
  }
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
