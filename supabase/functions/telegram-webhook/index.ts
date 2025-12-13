import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface TelegramMessage {
  message_id: number;
  date: string;
  text: string;
  channel: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
}

interface WebhookPayload {
  action: 'new_message' | 'batch_messages' | 'test';
  messages?: TelegramMessage[];
  message?: TelegramMessage;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('TRIGGER_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify webhook secret (optional but recommended)
    const providedSecret = req.headers.get('x-webhook-secret');
    if (webhookSecret && providedSecret !== webhookSecret) {
      console.log('[telegram-webhook] Invalid webhook secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload: WebhookPayload = await req.json();
    console.log(`[telegram-webhook] Received action: ${payload.action}`);

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
      const result = await processMessage(payload.message, supabase);
      return new Response(JSON.stringify({
        success: true,
        processed: 1,
        cases_found: result.cases,
        duration_ms: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (payload.action === 'batch_messages' && payload.messages) {
      let totalCases = 0;
      const errors: string[] = [];

      for (const message of payload.messages) {
        try {
          const result = await processMessage(message, supabase);
          totalCases += result.cases;
        } catch (err) {
          errors.push(`Message ${message.message_id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Log the batch processing
      await supabase.from('scraper_logs').insert({
        bench: 'TELEGRAM',
        status: errors.length === 0 ? 'success' : (totalCases > 0 ? 'partial' : 'failed'),
        cases_found: totalCases,
        list_type: 'DAILY',
        error_message: errors.length > 0 ? errors.join('; ') : null
      });

      return new Response(JSON.stringify({
        success: true,
        processed: payload.messages.length,
        cases_found: totalCases,
        errors: errors.length > 0 ? errors : undefined,
        duration_ms: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Invalid action or missing data'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[telegram-webhook] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processMessage(message: TelegramMessage, supabase: any): Promise<{ cases: number }> {
  console.log(`[telegram-webhook] Processing message ${message.message_id}: ${message.text?.substring(0, 100)}`);

  // Check if this is a causelist message
  const lowerText = (message.text || '').toLowerCase();
  const isPdf = message.file_name?.toLowerCase().endsWith('.pdf') || 
                message.file_type?.includes('pdf') ||
                lowerText.includes('causelist') ||
                lowerText.includes('cause list') ||
                lowerText.includes('वादसूची');

  if (!isPdf && !message.file_url) {
    console.log('[telegram-webhook] Not a causelist message, skipping');
    return { cases: 0 };
  }

  // Extract metadata from message
  const bench = determineBench(message.text || '', message.file_name || '');
  const listType = determineListType(message.text || '', message.file_name || '');
  const courtNo = extractCourtNumber(message.text || '', message.file_name || '');
  const date = extractDate(message.text || '', message.file_name || '', message.date);

  console.log(`[telegram-webhook] Causelist: ${bench} Court ${courtNo}, ${listType}, Date: ${date}`);

  // If there's a PDF file, we need to parse it
  // For now, just log and store the reference
  if (message.file_url) {
    // Store the PDF reference for later processing
    console.log(`[telegram-webhook] PDF URL: ${message.file_url}`);
    
    // TODO: Download and parse the PDF
    // For now, just insert a placeholder
    const { error } = await supabase
      .from('daily_court_docket')
      .upsert({
        date,
        court_location: bench,
        court_room_no: courtNo,
        list_type: listType,
        item_no: 0,
        case_number: `PENDING_PARSE_${message.message_id}`,
        source_url: message.file_url,
        status: 'pending'
      }, {
        onConflict: 'date,court_location,court_room_no,item_no',
        ignoreDuplicates: true
      });

    if (error) {
      console.error('[telegram-webhook] Insert error:', error);
    }

    return { cases: 1 };
  }

  return { cases: 0 };
}

function determineBench(text: string, fileName: string): 'JAIPUR' | 'JODHPUR' {
  const combined = (text + ' ' + fileName).toLowerCase();
  if (combined.includes('jodhpur') || combined.includes('जोधपुर') || 
      combined.includes('jodh') || combined.includes('jdp')) {
    return 'JODHPUR';
  }
  return 'JAIPUR';
}

function determineListType(text: string, fileName: string): 'DAILY' | 'SUPPLEMENTARY' {
  const combined = (text + ' ' + fileName).toLowerCase();
  if (combined.includes('supp') || combined.includes('अनुपूरक')) {
    return 'SUPPLEMENTARY';
  }
  return 'DAILY';
}

function extractCourtNumber(text: string, fileName: string): string {
  const combined = text + ' ' + fileName;
  const match = combined.match(/court\s*(?:no\.?)?\s*[:\-]?\s*(\d+)/i) ||
                combined.match(/कोर्ट\s*(?:नं\.?)?\s*[:\-]?\s*(\d+)/i) ||
                combined.match(/[-_](\d+)\.pdf$/i) ||
                combined.match(/court[-_]?(\d+)/i);
  return match ? match[1] : '1';
}

function extractDate(text: string, fileName: string, messageDate: string): string {
  const combined = text + ' ' + fileName;
  
  // Try to extract date from text/filename
  const dateMatch = combined.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/) ||
                    combined.match(/(\d{2})(\d{2})(\d{4})/);
  
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // Fall back to message date
  return messageDate.split('T')[0];
}
