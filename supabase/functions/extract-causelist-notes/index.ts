import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

      // Use Lovable AI for text extraction from first few pages
      const apiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!apiKey) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      // Convert PDF to base64 for AI processing
      const pdfBase64 = btoa(
        new Uint8Array(await pdfData.arrayBuffer())
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      console.log('[EXTRACT-NOTES] Extracting text from PDF using AI...');
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'You are a document text extractor. Extract ALL text content from the provided PDF document. Focus on the first 3 pages. Return ONLY the raw text, no formatting or commentary.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from the first 3 pages of this PDF document. Return only the raw text.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:application/pdf;base64,${pdfBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 4000
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('[EXTRACT-NOTES] AI extraction failed:', errorText);
        // Don't fail completely, just skip notes extraction
        textContent = '';
      } else {
        const aiResult = await aiResponse.json();
        textContent = aiResult.choices?.[0]?.message?.content || '';
      }

      // Cache the extracted text
      if (textContent) {
        await supabase
          .from('raw_causelists')
          .update({ text_content: textContent.substring(0, 50000) }) // Limit storage
          .eq('id', causelist_id);
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
