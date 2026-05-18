import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText } from "https://esm.sh/unpdf@0.12.1";

import { getCorsHeaders } from "../_shared/cors.ts";
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storage_path } = await req.json().catch(() => ({}));
    const pdfPath = storage_path || 'causelists/2025-12-19/JODHPUR/DAILY_92.pdf';

    console.log('Testing unpdf text extraction');
    console.log('PDF path:', pdfPath);

    // Download PDF from storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: pdfData, error: downloadError } = await supabase
      .storage
      .from('causelist-pdfs')
      .download(pdfPath);

    if (downloadError || !pdfData) {
      console.error('Download error:', downloadError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to download PDF: ${downloadError?.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PDF downloaded, size:', pdfData.size, 'bytes');

    // Convert to ArrayBuffer
    const arrayBuffer = await pdfData.arrayBuffer();

    console.log('Extracting text with unpdf...');
    const startTime = Date.now();

    // Extract text using unpdf
    const { text, totalPages } = await extractText(arrayBuffer);

    const elapsed = Date.now() - startTime;
    console.log(`Text extraction complete in ${elapsed}ms, pages: ${totalPages}`);

    // Join text array into single string
    const fullText = Array.isArray(text) ? text.join('\n') : text;

    // Search for "Ramesh Purohit"
    const foundRameshPurohit = fullText.toLowerCase().includes('ramesh purohit');
    const purohitMatches = fullText.match(/purohit/gi) || [];

    const result = {
      success: true,
      pages: totalPages,
      extraction_time_ms: elapsed,
      text_length: fullText.length,
      text_length_kb: (fullText.length / 1024).toFixed(2) + ' KB',
      found_ramesh_purohit: foundRameshPurohit,
      purohit_occurrences: purohitMatches.length,
      text_preview_start: fullText.substring(0, 2000),
      text_preview_end: fullText.substring(Math.max(0, fullText.length - 2000)),
    };

    console.log('Result:', {
      pages: result.pages,
      text_length_kb: result.text_length_kb,
      found_ramesh_purohit: foundRameshPurohit,
      purohit_occurrences: purohitMatches.length,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, stack: error instanceof Error ? error.stack : undefined }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
