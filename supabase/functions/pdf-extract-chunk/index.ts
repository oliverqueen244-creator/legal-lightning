import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
// @ts-ignore - pdfjs-serverless types
import { getDocument } from "https://esm.sh/pdfjs-serverless";

import { getCorsHeaders } from "../_shared/cors.ts";
const PAGES_PER_CHUNK = 30;
const MAX_ERROR_COUNT = 3;
const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface ExtractionProgress {
  pages_done: number;
  total_pages: number;
  status: 'in_progress' | 'complete' | 'error';
  last_updated: string;
  error_count: number;
  error_message?: string;
}

interface ChunkRequest {
  causelist_id: string;
  start_page?: number;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[PDF-EXTRACT-CHUNK] Function started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ChunkRequest = await req.json();
    const { causelist_id, start_page = 0 } = body;

    if (!causelist_id) {
      return new Response(JSON.stringify({ error: 'causelist_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[PDF-EXTRACT-CHUNK] Processing causelist ${causelist_id}, start_page=${start_page}`);

    // Fetch causelist record
    const { data: causelist, error: fetchError } = await supabase
      .from('raw_causelists')
      .select('id, storage_path, text_content, extraction_progress, page_count')
      .eq('id', causelist_id)
      .single();

    if (fetchError || !causelist) {
      console.error(`[PDF-EXTRACT-CHUNK] Causelist not found: ${fetchError?.message}`);
      return new Response(JSON.stringify({ error: 'Causelist not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const progress = causelist.extraction_progress as ExtractionProgress | null;

    // Check if already complete
    if (progress?.status === 'complete') {
      console.log('[PDF-EXTRACT-CHUNK] Extraction already complete');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Already complete',
        pages_done: progress.pages_done 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check error count
    if (progress?.error_count && progress.error_count >= MAX_ERROR_COUNT) {
      console.error('[PDF-EXTRACT-CHUNK] Max errors reached, aborting');
      return new Response(JSON.stringify({ 
        error: 'Max extraction errors reached',
        error_count: progress.error_count 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Download PDF
    console.log(`[PDF-EXTRACT-CHUNK] Downloading PDF from ${causelist.storage_path}`);
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('causelist-pdfs')
      .download(causelist.storage_path);

    if (downloadError || !pdfData) {
      console.error(`[PDF-EXTRACT-CHUNK] Download failed: ${downloadError?.message}`);
      await updateProgress(supabase, causelist_id, progress, null, 'error', 
        `Download failed: ${downloadError?.message}`);
      return new Response(JSON.stringify({ error: 'PDF download failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Load PDF document
    const arrayBuffer = await pdfData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    console.log('[PDF-EXTRACT-CHUNK] Loading PDF document...');
    const doc = await getDocument({ data: uint8Array, useSystemFonts: true }).promise;
    const totalPages = doc.numPages;
    
    console.log(`[PDF-EXTRACT-CHUNK] PDF has ${totalPages} pages, extracting from page ${start_page + 1}`);

    // Calculate page range for this chunk
    const endPage = Math.min(start_page + PAGES_PER_CHUNK, totalPages);
    let chunkText = '';

    // Extract text from pages in this chunk
    for (let pageNum = start_page + 1; pageNum <= endPage; pageNum++) {
      try {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        chunkText += pageText + '\n\n';
      } catch (pageError) {
        console.warn(`[PDF-EXTRACT-CHUNK] Error on page ${pageNum}:`, pageError);
        chunkText += `[Page ${pageNum} extraction error]\n\n`;
      }
    }

    const pagesExtracted = endPage - start_page;
    console.log(`[PDF-EXTRACT-CHUNK] Extracted ${pagesExtracted} pages, ${chunkText.length} chars`);

    // Append text to existing content
    const existingText = causelist.text_content || '';
    const newText = existingText + chunkText;
    
    // Determine if we're done
    const isComplete = endPage >= totalPages;
    const newStatus = isComplete ? 'complete' : 'in_progress';

    // Update database with new text and progress
    const newProgress: ExtractionProgress = {
      pages_done: endPage,
      total_pages: totalPages,
      status: newStatus,
      last_updated: new Date().toISOString(),
      error_count: progress?.error_count || 0
    };

    const { error: updateError } = await supabase
      .from('raw_causelists')
      .update({
        text_content: newText.substring(0, 1000000), // 1MB limit
        extraction_progress: newProgress,
        page_count: totalPages,
        status: isComplete ? 'text_extracted' : 'extracting'
      })
      .eq('id', causelist_id);

    if (updateError) {
      console.error(`[PDF-EXTRACT-CHUNK] Update failed: ${updateError.message}`);
      return new Response(JSON.stringify({ error: 'Database update failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[PDF-EXTRACT-CHUNK] Chunk complete: pages ${start_page + 1}-${endPage}/${totalPages}, ${duration}ms`);

    // If not complete, trigger next chunk (non-blocking)
    if (!isComplete) {
      const nextStartPage = endPage;
      console.log(`[PDF-EXTRACT-CHUNK] Triggering next chunk from page ${nextStartPage + 1}`);
      
      // Use EdgeRuntime.waitUntil for background task
      const triggerNextChunk = async () => {
        try {
          await fetch(`${supabaseUrl}/functions/v1/pdf-extract-chunk`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              causelist_id,
              start_page: nextStartPage
            })
          });
          console.log(`[PDF-EXTRACT-CHUNK] Next chunk triggered successfully`);
        } catch (err) {
          console.error(`[PDF-EXTRACT-CHUNK] Failed to trigger next chunk:`, err);
        }
      };
      
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(triggerNextChunk());
      } else {
        // Fallback: fire and forget
        triggerNextChunk();
      }
    } else {
      console.log(`[PDF-EXTRACT-CHUNK] Extraction complete! Total: ${totalPages} pages, ${newText.length} chars`);
      
      // Trigger scan-lawyer-names to continue processing
      const triggerScan = async () => {
        try {
          await fetch(`${supabaseUrl}/functions/v1/scan-lawyer-names`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ causelist_id })
          });
          console.log(`[PDF-EXTRACT-CHUNK] Triggered scan-lawyer-names for completed extraction`);
        } catch (err) {
          console.error(`[PDF-EXTRACT-CHUNK] Failed to trigger scan-lawyer-names:`, err);
        }
      };
      
      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(triggerScan());
      } else {
        triggerScan();
      }
    }

    return new Response(JSON.stringify({
      success: true,
      pages_extracted: pagesExtracted,
      pages_done: endPage,
      total_pages: totalPages,
      is_complete: isComplete,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[PDF-EXTRACT-CHUNK] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function updateProgress(
  supabase: any,
  causelistId: string,
  currentProgress: ExtractionProgress | null,
  pagesDone: number | null,
  status: 'in_progress' | 'complete' | 'error',
  errorMessage?: string
) {
  const newProgress: ExtractionProgress = {
    pages_done: pagesDone ?? currentProgress?.pages_done ?? 0,
    total_pages: currentProgress?.total_pages ?? 0,
    status,
    last_updated: new Date().toISOString(),
    error_count: status === 'error' 
      ? (currentProgress?.error_count || 0) + 1 
      : (currentProgress?.error_count || 0),
    ...(errorMessage && { error_message: errorMessage })
  };

  await supabase
    .from('raw_causelists')
    .update({ 
      extraction_progress: newProgress,
      status: status === 'error' ? 'extract_error' : 'extracting'
    })
    .eq('id', causelistId);
}
