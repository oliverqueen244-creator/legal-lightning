import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LiveBoardData {
  court_no: string;
  current_item: number;
  status: 'hearing' | 'passover' | 'lunch' | 'adjourned';
  is_supplementary_running: boolean;
  source_timestamp: string;
}

interface TelegramMessage {
  id: number;
  date: number;
  message: string;
  peer_id?: {
    channel_id?: number;
  };
}

// Telegram channel for Rajasthan High Court live boards
const MAIN_CHANNEL = 'hcrajtc';

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate Telegram credentials
    if (!telegramApiId || !telegramApiHash || !telegramSession) {
      console.error('[telegram-scraper] Missing Telegram credentials');
      return new Response(JSON.stringify({
        success: false,
        error: 'Telegram credentials not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { bench = 'JAIPUR', action = 'scrape' } = body;

    console.log(`[telegram-scraper] Action: ${action}, Bench: ${bench}`);

    if (action === 'scrape') {
      // Use Telegram Bot API to fetch recent messages
      // Note: For user accounts with session strings, we need to use MTProto
      // For now, we'll implement a webhook-based approach or use Telegram Bot API
      
      const liveBoardData = await fetchTelegramUpdates(
        bench,
        telegramApiId,
        telegramApiHash,
        telegramSession
      );

      console.log(`[telegram-scraper] Parsed ${liveBoardData.length} court updates`);

      // Update live_board_cache for each court
      for (const data of liveBoardData) {
        const { error: upsertError } = await supabase
          .from('live_board_cache')
          .upsert({
            court_location: bench,
            court_no: data.court_no,
            current_item: data.current_item,
            status: data.status,
            is_supplementary_running: data.is_supplementary_running,
            last_updated: new Date().toISOString(),
            source_timestamp: data.source_timestamp
          }, { 
            onConflict: 'court_location,court_no' 
          });

        if (upsertError) {
          console.error(`[telegram-scraper] Error upserting court ${data.court_no}:`, upsertError);
        } else {
          console.log(`[telegram-scraper] Updated Court ${data.court_no}: Item ${data.current_item}, Status: ${data.status}`);
        }
      }

      // Log sync status
      await supabase.from('sync_status').insert({
        source_name: `telegram_${bench.toLowerCase()}`,
        last_sync_at: new Date().toISOString(),
        sync_latency_ms: Date.now() - startTime,
        status: liveBoardData.length > 0 ? 'healthy' : 'warning',
        error_message: liveBoardData.length === 0 ? 'No updates found' : null
      });

      return new Response(JSON.stringify({
        success: true,
        bench,
        courts_updated: liveBoardData.length,
        data: liveBoardData,
        duration_ms: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'test') {
      // Test connection to Telegram
      const testResult = await testTelegramConnection(
        telegramApiId,
        telegramApiHash, 
        telegramSession
      );

      return new Response(JSON.stringify({
        success: testResult.success,
        message: testResult.message,
        details: testResult.details
      }), {
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
    console.error('[telegram-scraper] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function fetchTelegramUpdates(
  bench: string,
  apiId: string,
  apiHash: string,
  sessionString: string
): Promise<LiveBoardData[]> {
  const liveBoardData: LiveBoardData[] = [];

  try {
    // Fetch from the main channel
    const publicUrl = `https://t.me/s/${MAIN_CHANNEL}`;
    console.log(`[telegram-scraper] Fetching from public preview: ${publicUrl}`);
    
    const response = await fetch(publicUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.ok) {
      const html = await response.text();
      const parsed = parsePublicChannelMessages(html);
      liveBoardData.push(...parsed);
      console.log(`[telegram-scraper] Parsed ${parsed.length} updates from main channel`);
    } else {
      console.log(`[telegram-scraper] Public preview fetch failed: ${response.status}`);
    }


  } catch (error) {
    console.error('[telegram-scraper] Error fetching updates:', error);
  }

  // Deduplicate by court_no, keeping the most recent
  const deduped = new Map<string, LiveBoardData>();
  for (const data of liveBoardData) {
    const existing = deduped.get(data.court_no);
    if (!existing || new Date(data.source_timestamp) > new Date(existing.source_timestamp)) {
      deduped.set(data.court_no, data);
    }
  }

  return Array.from(deduped.values());
}

function parsePublicChannelMessages(html: string): LiveBoardData[] {
  const results: LiveBoardData[] = [];

  // Extract message text from Telegram public preview HTML
  // Messages are in <div class="tgme_widget_message_text">
  const messageRegex = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const timeRegex = /<time[^>]*datetime="([^"]+)"[^>]*>/gi;
  
  let messageMatch;
  const messages: { text: string; timestamp: string }[] = [];
  
  // Get all messages with their timestamps
  const messageBlocks = html.match(/<div class="tgme_widget_message[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];
  
  for (const block of messageBlocks) {
    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const timeMatch = block.match(/<time[^>]*datetime="([^"]+)"[^>]*>/i);
    
    if (textMatch) {
      const text = textMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      
      const timestamp = timeMatch ? timeMatch[1] : new Date().toISOString();
      messages.push({ text, timestamp });
    }
  }

  console.log(`[telegram-scraper] Found ${messages.length} messages in channel`);

  // Parse each message for live board data
  for (const msg of messages) {
    const parsed = parseLiveBoardMessage(msg.text, msg.timestamp);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

function parseLiveBoardMessage(text: string, timestamp: string): LiveBoardData | null {
  // Common patterns for court live board updates:
  // "Court 1: Item 15 - Hearing"
  // "Court No. 2 | Current Item: 23"
  // "कोर्ट 3 - मद 12"
  // "COURT-5 NOW HEARING ITEM NO. 45"
  
  const patterns = [
    // English patterns
    /court\s*(?:no\.?)?\s*[:\-]?\s*(\d+)[:\s\-|]+(?:item|current\s*item|now\s*hearing\s*item)\s*(?:no\.?)?\s*[:\-]?\s*(\d+)/i,
    /court\s*[:\-]?\s*(\d+)\s*[:\-|]+\s*item\s*(\d+)/i,
    /court\s*(\d+)\s*(?:hearing|passover|lunch|adjourned)\s*item\s*(\d+)/i,
    
    // Hindi patterns
    /कोर्ट\s*(\d+)\s*[-:।]+\s*(?:मद|आइटम)\s*(\d+)/i,
    
    // Simple patterns
    /ct\.?\s*(\d+)\s*[-:]\s*(\d+)/i,
    /c(\d+)\s*[-:]\s*i(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const court_no = match[1];
      const current_item = parseInt(match[2], 10);
      
      // Determine status from text
      let status: LiveBoardData['status'] = 'hearing';
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes('passover') || lowerText.includes('passed over') || lowerText.includes('पासओवर')) {
        status = 'passover';
      } else if (lowerText.includes('lunch') || lowerText.includes('recess') || lowerText.includes('लंच')) {
        status = 'lunch';
      } else if (lowerText.includes('adjourn') || lowerText.includes('स्थगित')) {
        status = 'adjourned';
      }
      
      // Check for supplementary
      const is_supplementary_running = lowerText.includes('supp') || 
        lowerText.includes('supplementary') || 
        lowerText.includes('अनुपूरक');

      return {
        court_no,
        current_item,
        status,
        is_supplementary_running,
        source_timestamp: timestamp
      };
    }
  }

  return null;
}

async function testTelegramConnection(
  apiId: string,
  apiHash: string,
  sessionString: string
): Promise<{ success: boolean; message: string; details?: unknown }> {
  try {
    // Test by fetching a known public channel
    const testUrl = 'https://t.me/s/telegram';
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Telegram connection successful',
        details: {
          apiId: apiId.substring(0, 4) + '****',
          sessionPresent: !!sessionString,
          publicAccessWorking: true
        }
      };
    }

    return {
      success: false,
      message: 'Failed to connect to Telegram',
      details: { status: response.status }
    };

  } catch (error) {
    return {
      success: false,
      message: 'Connection error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
