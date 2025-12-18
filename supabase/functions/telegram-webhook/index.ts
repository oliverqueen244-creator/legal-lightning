import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Telegram Bot API types
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

// Legacy Python script types
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
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
      return await handleTelegramUpdate(body as TelegramUpdate, supabase, botToken!);
    }
    
    // Otherwise treat as legacy Python script payload
    return await handleLegacyPayload(body as LegacyPayload, supabase, req);

  } catch (error) {
    console.error('[TELEGRAM] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleTelegramUpdate(update: TelegramUpdate, supabase: any, botToken: string) {
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

  // Check if this is a causelist
  const lowerText = text.toLowerCase();
  const lowerFile = fileName.toLowerCase();
  const isCauselist = 
    lowerText.includes('causelist') ||
    lowerText.includes('cause list') ||
    lowerText.includes('वादसूची') ||
    lowerFile.includes('causelist') ||
    lowerFile.endsWith('.pdf');

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

  // Get file URL if document exists
  let fileUrl = '';
  if (message.document && botToken) {
    try {
      const fileResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${message.document.file_id}`
      );
      const fileData = await fileResponse.json();
      
      if (fileData.ok && fileData.result.file_path) {
        fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
        console.log(`[TELEGRAM] File URL obtained`);
      }
    } catch (err) {
      console.error('[TELEGRAM] Error getting file:', err);
    }
  }

  // Store in database
  const { data, error } = await supabase
    .from('daily_court_docket')
    .insert({
      date: date,
      court_location: bench,
      list_type: listType,
      court_room_no: courtNo,
      source_url: fileUrl || `telegram:${message.message_id}`,
      status: 'pending',
      case_number: `TELEGRAM_${message.message_id}`,
      item_no: 0,
    })
    .select();

  if (error) {
    console.error('[TELEGRAM] Database error:', error);
  } else {
    console.log(`[TELEGRAM] Created docket entry: ${data?.[0]?.id}`);
  }

  // Log to scraper_logs
  await supabase.from('scraper_logs').insert({
    bench: bench,
    status: 'success',
    cases_found: 1,
    list_type: listType,
    court_no: courtNo,
  });

  return new Response(
    JSON.stringify({ ok: true, processed: true, docket_id: data?.[0]?.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleLegacyPayload(payload: LegacyPayload, supabase: any, req: Request) {
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
    const result = await processLegacyMessage(payload.message, supabase);
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
      const result = await processLegacyMessage(message, supabase);
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

async function processLegacyMessage(message: LegacyMessage, supabase: any): Promise<{ cases: number }> {
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
