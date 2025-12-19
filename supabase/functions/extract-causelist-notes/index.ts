import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractText } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Note patterns to extract from causelist PDFs
const NOTE_PATTERNS = [
  { pattern: /NOTE\s*[:\-]\s*([^\n]+(?:\n(?![A-Z]{2,})[^\n]+)*)/gi, type: 'NOTE' },
  { pattern: /IMPORTANT\s*[:\-]\s*([^\n]+(?:\n(?![A-Z]{2,})[^\n]+)*)/gi, type: 'IMPORTANT' },
  { pattern: /DIRECTION\s*[:\-]\s*([^\n]+(?:\n(?![A-Z]{2,})[^\n]+)*)/gi, type: 'DIRECTION' },
  { pattern: /N\.B\.\s*[:\-]?\s*([^\n]+(?:\n(?![A-Z]{2,})[^\n]+)*)/gi, type: 'NOTE' },
  { pattern: /NOTICE\s*[:\-]\s*([^\n]+(?:\n(?![A-Z]{2,})[^\n]+)*)/gi, type: 'NOTE' },
];

// Extract text using unpdf library (fast, free, no API limits)
async function extractTextFromPDF(pdfArrayBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log('[EXTRACT-NOTES] Extracting text with unpdf...');
    const startTime = Date.now();
    
    const { text, totalPages } = await extractText(pdfArrayBuffer);
    
    // Join text array into single string
    const fullText = Array.isArray(text) ? text.join('\n') : text;
    
    const elapsed = Date.now() - startTime;
    console.log(`[EXTRACT-NOTES] Extracted ${fullText.length} chars from ${totalPages} pages in ${elapsed}ms`);
    
    return fullText;
  } catch (error) {
    console.error('[EXTRACT-NOTES] unpdf extraction error:', error);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[EXTRACT-NOTES] Function started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { causelist_id } = await req.json();

    if (!causelist_id) {
      throw new Error('causelist_id is required');
    }

    console.log(`[EXTRACT-NOTES] Processing causelist: ${causelist_id}`);

    // Get causelist metadata
    const { data: causelist, error: fetchError } = await supabase
      .from('raw_causelists')
      .select('storage_path, text_content')
      .eq('id', causelist_id)
      .single();

    if (fetchError || !causelist) {
      throw new Error(`Causelist not found: ${fetchError?.message}`);
    }

    let textContent = causelist.text_content;

    // If no cached text, download and extract
    if (!textContent) {
      console.log('[EXTRACT-NOTES] Downloading PDF for text extraction...');
      
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from('causelist-pdfs')
        .download(causelist.storage_path);

      if (downloadError || !pdfData) {
        throw new Error(`Failed to download PDF: ${downloadError?.message}`);
      }

      // Extract text using unpdf
      const arrayBuffer = await pdfData.arrayBuffer();
      textContent = await extractTextFromPDF(arrayBuffer);

      // Cache the extracted text (limit to 500KB for storage)
      if (textContent) {
        await supabase
          .from('raw_causelists')
          .update({ text_content: textContent.substring(0, 500000) })
          .eq('id', causelist_id);
        console.log('[EXTRACT-NOTES] Text cached successfully');
      } else {
        console.log('[EXTRACT-NOTES] No text extracted from PDF');
      }
    }

    // Extract notes using regex patterns
    const extractedNotes: { note_type: string; note_text: string }[] = [];

    for (const { pattern, type } of NOTE_PATTERNS) {
      const matches = textContent.matchAll(pattern);
      for (const match of matches) {
        const noteText = match[1]?.trim();
        if (noteText && noteText.length > 10 && noteText.length < 2000) {
          extractedNotes.push({
            note_type: type,
            note_text: noteText
          });
        }
      }
    }

    console.log(`[EXTRACT-NOTES] Found ${extractedNotes.length} notes`);

    // Insert notes
    if (extractedNotes.length > 0) {
      const notesToInsert = extractedNotes.map(note => ({
        raw_causelist_id: causelist_id,
        note_type: note.note_type,
        note_text: note.note_text
      }));

      const { error: insertError } = await supabase
        .from('cause_list_notes')
        .insert(notesToInsert);

      if (insertError) {
        console.error('[EXTRACT-NOTES] Failed to insert notes:', insertError);
      }
    }

    // Update status
    await supabase
      .from('raw_causelists')
      .update({ status: 'notes_extracted' })
      .eq('id', causelist_id);

    console.log('[EXTRACT-NOTES] Completed successfully');

    return new Response(JSON.stringify({
      success: true,
      notes_count: extractedNotes.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[EXTRACT-NOTES] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
