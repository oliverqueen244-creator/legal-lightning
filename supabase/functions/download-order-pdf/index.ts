/**
 * Edge Function: download-order-pdf
 * 
 * Downloads a court order PDF, hashes it, and stores it in blob storage.
 * 
 * Features:
 * - Deduplication via SHA-256 hash
 * - Rate limiting
 * - Immutable storage (never re-download same PDF)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashPdfContent, canMakeRequest, recordRequest, type Bench } from "../_shared/courtScraper.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
interface DownloadPdfRequest {
  court_order_id: string;
  source_pdf_url: string;
  bench: Bench;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: DownloadPdfRequest = await req.json();
    const { court_order_id, source_pdf_url, bench } = body;

    console.log(`[download-order-pdf] Starting download for order ${court_order_id}`);

    // 1. Check if already downloaded (by URL)
    const { data: existingOrder } = await supabase
      .from('court_orders')
      .select('pdf_hash, stored_pdf_path')
      .eq('id', court_order_id)
      .single();

    if (existingOrder?.stored_pdf_path) {
      console.log(`[download-order-pdf] Already downloaded: ${existingOrder.stored_pdf_path}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'already_exists',
          stored_path: existingOrder.stored_pdf_path 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check rate limits
    const rateCheck = canMakeRequest(bench);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'rate_limited',
          retry_after_ms: rateCheck.waitMs 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Download PDF
    console.log(`[download-order-pdf] Downloading from: ${source_pdf_url}`);
    recordRequest(bench);

    const pdfResponse = await fetch(source_pdf_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }

    const contentType = pdfResponse.headers.get('content-type');
    if (!contentType?.includes('pdf') && !contentType?.includes('octet-stream')) {
      console.warn(`[download-order-pdf] Unexpected content-type: ${contentType}`);
    }

    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfSize = pdfBytes.byteLength;

    console.log(`[download-order-pdf] Downloaded ${pdfSize} bytes`);

    // 4. Hash the PDF
    const pdfHash = await hashPdfContent(pdfBytes);
    console.log(`[download-order-pdf] Hash: ${pdfHash}`);

    // 5. Check for duplicate by hash
    const { data: duplicateOrder } = await supabase
      .from('court_orders')
      .select('id, stored_pdf_path')
      .eq('pdf_hash', pdfHash)
      .neq('id', court_order_id)
      .limit(1)
      .single();

    if (duplicateOrder?.stored_pdf_path) {
      console.log(`[download-order-pdf] Duplicate found, reusing: ${duplicateOrder.stored_pdf_path}`);
      
      // Update our order to point to existing file
      await supabase
        .from('court_orders')
        .update({
          pdf_hash: pdfHash,
          stored_pdf_path: duplicateOrder.stored_pdf_path,
          pdf_size_bytes: pdfSize,
        })
        .eq('id', court_order_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'deduplicated',
          stored_path: duplicateOrder.stored_pdf_path 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Store in blob storage
    const storagePath = `orders/${bench}/${pdfHash.substring(0, 8)}/${pdfHash}.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from('case-documents')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,  // Immutable - never overwrite
      });

    if (uploadError && !uploadError.message.includes('already exists')) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // 7. Update order record
    await supabase
      .from('court_orders')
      .update({
        pdf_hash: pdfHash,
        stored_pdf_path: storagePath,
        pdf_size_bytes: pdfSize,
      })
      .eq('id', court_order_id);

    console.log(`[download-order-pdf] Stored at: ${storagePath}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'downloaded',
        stored_path: storagePath,
        hash: pdfHash,
        size_bytes: pdfSize
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[download-order-pdf] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
