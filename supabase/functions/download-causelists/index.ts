import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramDocument {
  file_id: string;
  file_name?: string;
  file_size?: number;
}

interface DownloadRequest {
  document: TelegramDocument;
  message_id: number;
  bench: 'JAIPUR' | 'JODHPUR';
  list_type: 'DAILY' | 'SUPPLEMENTARY';
  list_date: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[DOWNLOAD-CAUSELISTS] Function started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { document, message_id, bench, list_type, list_date }: DownloadRequest = await req.json();

    console.log(`[DOWNLOAD-CAUSELISTS] Processing: ${bench} ${list_type} for ${list_date}, message_id: ${message_id}`);

    // Check if already downloaded
    const { data: existing } = await supabase
      .from('raw_causelists')
      .select('id')
      .eq('telegram_message_id', message_id)
      .single();

    if (existing) {
      console.log(`[DOWNLOAD-CAUSELISTS] Already downloaded: ${existing.id}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Already downloaded',
        causelist_id: existing.id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Get file path from Telegram
    console.log('[DOWNLOAD-CAUSELISTS] Getting file path from Telegram...');
    const fileInfoRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${document.file_id}`
    );
    const fileInfo = await fileInfoRes.json();

    if (!fileInfo.ok || !fileInfo.result?.file_path) {
      throw new Error(`Failed to get file info: ${JSON.stringify(fileInfo)}`);
    }

    // Step 2: Download PDF from Telegram
    console.log('[DOWNLOAD-CAUSELISTS] Downloading PDF from Telegram...');
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
    const pdfResponse = await fetch(fileUrl);

    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
    }

    const pdfBytes = await pdfResponse.arrayBuffer();
    console.log(`[DOWNLOAD-CAUSELISTS] Downloaded ${pdfBytes.byteLength} bytes`);

    // Step 3: Store in Supabase Storage
    const storagePath = `causelists/${list_date}/${bench}/${list_type}_${message_id}.pdf`;
    console.log(`[DOWNLOAD-CAUSELISTS] Uploading to storage: ${storagePath}`);

    const { error: uploadError } = await supabase.storage
      .from('causelist-pdfs')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Step 4: Insert metadata into raw_causelists
    console.log('[DOWNLOAD-CAUSELISTS] Inserting metadata...');
    const { data: causelist, error: insertError } = await supabase
      .from('raw_causelists')
      .insert({
        telegram_message_id: message_id,
        file_name: document.file_name || `${list_type}_${list_date}.pdf`,
        bench,
        list_type,
        list_date,
        storage_path: storagePath,
        file_size_bytes: pdfBytes.byteLength,
        status: 'downloaded'
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to insert metadata: ${insertError.message}`);
    }

    console.log(`[DOWNLOAD-CAUSELISTS] Created raw_causelist: ${causelist.id}`);

    // Step 5: Trigger notes extraction (fire and forget)
    const extractUrl = `${supabaseUrl}/functions/v1/extract-causelist-notes`;
    fetch(extractUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ causelist_id: causelist.id })
    }).catch(err => console.error('[DOWNLOAD-CAUSELISTS] Failed to trigger notes extraction:', err));

    const duration = Date.now() - startTime;
    console.log(`[DOWNLOAD-CAUSELISTS] Completed in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      causelist_id: causelist.id,
      storage_path: storagePath,
      file_size: pdfBytes.byteLength,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DOWNLOAD-CAUSELISTS] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
