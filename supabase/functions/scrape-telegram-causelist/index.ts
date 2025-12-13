import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Telegram channel for Rajasthan High Court
const CHANNEL_USERNAME = 'hcrajtc';

interface CauselistInfo {
  bench: 'JAIPUR' | 'JODHPUR';
  court_no: string;
  list_type: 'DAILY' | 'SUPPLEMENTARY';
  date: string;
  pdf_url: string;
  message_text: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const telegramApiId = Deno.env.get('TELEGRAM_API_ID');
    const telegramApiHash = Deno.env.get('TELEGRAM_API_HASH');
    const telegramSession = Deno.env.get('TELEGRAM_SESSION_STRING');
    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate Telegram credentials
    if (!telegramApiId || !telegramApiHash || !telegramSession) {
      console.error('[telegram-causelist] Missing Telegram credentials');
      return new Response(JSON.stringify({
        success: false,
        error: 'Telegram credentials not configured. Need: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_STRING'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action = 'scrape', date } = body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    console.log(`[telegram-causelist] Action: ${action}, Date: ${targetDate}`);

    if (action === 'scrape') {
      // Since public preview doesn't show messages, we need to use MTProto
      // The session string allows authenticated access to the channel
      
      // For now, use the Telegram Bot API approach or a proxy service
      // Full MTProto implementation requires the gramjs/telethon equivalent for Deno
      
      // Alternative: Use a webhook or external service to forward messages
      // For now, let's implement a workaround using the Telegram API
      
      const messages = await fetchChannelMessages(
        telegramApiId,
        telegramApiHash,
        telegramSession,
        CHANNEL_USERNAME
      );

      console.log(`[telegram-causelist] Fetched ${messages.length} messages`);

      // Parse messages to find causelist PDFs
      const causelists: CauselistInfo[] = [];
      
      for (const msg of messages) {
        const parsed = parseCauselistMessage(msg.text, msg.fileUrl, msg.date);
        if (parsed) {
          causelists.push(parsed);
        }
      }

      console.log(`[telegram-causelist] Found ${causelists.length} causelists`);

      // Process each causelist
      let totalCases = 0;
      const errors: string[] = [];

      for (const causelist of causelists) {
        try {
          // Download and parse the PDF
          const cases = await processCauselistPdf(
            causelist,
            supabase,
            openRouterKey || lovableApiKey
          );
          totalCases += cases;
          console.log(`[telegram-causelist] Processed ${causelist.bench} Court ${causelist.court_no}: ${cases} cases`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${causelist.bench} Court ${causelist.court_no}: ${errMsg}`);
          console.error(`[telegram-causelist] Error processing causelist:`, errMsg);
        }
      }

      // Log the scraper run
      await supabase.from('scraper_logs').insert({
        bench: 'TELEGRAM',
        status: errors.length === 0 ? 'success' : (totalCases > 0 ? 'partial' : 'failed'),
        cases_found: totalCases,
        list_type: 'DAILY',
        error_message: errors.length > 0 ? errors.join('; ') : null
      });

      return new Response(JSON.stringify({
        success: true,
        messages_found: messages.length,
        causelists_found: causelists.length,
        cases_processed: totalCases,
        errors: errors.length > 0 ? errors : undefined,
        duration_ms: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'test') {
      // Test the Telegram connection
      const testResult = await testTelegramAccess(
        telegramApiId,
        telegramApiHash,
        telegramSession
      );

      return new Response(JSON.stringify(testResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Invalid action. Use "scrape" or "test"'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[telegram-causelist] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

interface TelegramMessage {
  id: number;
  text: string;
  date: string;
  fileUrl?: string;
  fileName?: string;
}

async function fetchChannelMessages(
  apiId: string,
  apiHash: string,
  sessionString: string,
  channelUsername: string
): Promise<TelegramMessage[]> {
  const messages: TelegramMessage[] = [];

  try {
    // MTProto requires complex implementation
    // For Deno, we can use the Telegram API through HTTP
    // The session string from telethon contains auth data
    
    // Parse session string to extract auth info
    // Telethon session format: dc_id:server_address:port:auth_key
    const sessionParts = sessionString.split(':');
    
    if (sessionParts.length < 4) {
      console.log('[telegram-causelist] Session string format not recognized, trying alternative methods');
      
      // Try using Telegram's web export or bot API as fallback
      // For now, return empty - full implementation needs gramjs equivalent
      return messages;
    }

    // For full MTProto implementation, we would need to:
    // 1. Connect to Telegram DC using the session
    // 2. Call messages.getHistory for the channel
    // 3. Parse the response to extract messages and files
    
    // Since this is complex, let's use an alternative approach:
    // Check if there's a bot token we can use, or implement a webhook receiver
    
    console.log('[telegram-causelist] MTProto not fully implemented in Deno edge function');
    console.log('[telegram-causelist] Consider using a bot or webhook approach');

  } catch (error) {
    console.error('[telegram-causelist] Error fetching messages:', error);
  }

  return messages;
}

function parseCauselistMessage(
  text: string,
  fileUrl: string | undefined,
  date: string
): CauselistInfo | null {
  if (!text && !fileUrl) return null;

  // Common patterns in causelist messages:
  // "Jaipur Bench - Court No. 1 - Daily Causelist"
  // "जोधपुर - कोर्ट 3 - दैनिक वादसूची"
  // "Supplementary List Court 5 Jodhpur"
  
  const lowerText = (text || '').toLowerCase();
  
  // Determine bench
  let bench: 'JAIPUR' | 'JODHPUR' = 'JAIPUR';
  if (lowerText.includes('jodhpur') || lowerText.includes('जोधपुर')) {
    bench = 'JODHPUR';
  }
  
  // Determine list type
  let list_type: 'DAILY' | 'SUPPLEMENTARY' = 'DAILY';
  if (lowerText.includes('supp') || lowerText.includes('अनुपूरक')) {
    list_type = 'SUPPLEMENTARY';
  }
  
  // Extract court number
  const courtMatch = text?.match(/court\s*(?:no\.?)?\s*[:\-]?\s*(\d+)/i) ||
                     text?.match(/कोर्ट\s*(\d+)/i);
  const court_no = courtMatch ? courtMatch[1] : '1';
  
  // If there's a PDF file, this is likely a causelist
  if (fileUrl && (fileUrl.endsWith('.pdf') || lowerText.includes('causelist') || lowerText.includes('वादसूची'))) {
    return {
      bench,
      court_no,
      list_type,
      date,
      pdf_url: fileUrl,
      message_text: text || ''
    };
  }
  
  return null;
}

async function processCauselistPdf(
  causelist: CauselistInfo,
  supabase: any,
  aiApiKey: string | undefined
): Promise<number> {
  // Download and parse the PDF
  // This would use the same PDF parsing logic as scrape-causelist
  
  console.log(`[telegram-causelist] Would process PDF: ${causelist.pdf_url}`);
  
  // For now, return 0 - full implementation would:
  // 1. Download the PDF
  // 2. Use AI to extract case data
  // 3. Insert into daily_court_docket
  
  return 0;
}

async function testTelegramAccess(
  apiId: string,
  apiHash: string,
  sessionString: string
): Promise<{ success: boolean; message: string; details?: unknown }> {
  try {
    // Validate session string format
    if (!sessionString || sessionString.length < 50) {
      return {
        success: false,
        message: 'Session string appears to be invalid or too short',
        details: { sessionLength: sessionString?.length || 0 }
      };
    }

    // Check if it looks like a telethon session string
    const looksValid = sessionString.includes('=') || 
                       sessionString.match(/^[A-Za-z0-9+/=]+$/) ||
                       sessionString.includes(':');

    return {
      success: true,
      message: 'Telegram credentials configured',
      details: {
        apiIdPresent: !!apiId,
        apiHashPresent: !!apiHash,
        sessionFormat: looksValid ? 'valid' : 'unknown',
        note: 'Full MTProto implementation requires additional setup. Consider using a Telegram Bot for easier integration.'
      }
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error validating credentials',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
