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

// Extract text using Google AI Studio (primary)
async function extractWithGoogleAI(pdfBase64: string): Promise<string | null> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) {
    console.log('[EXTRACT-NOTES] GOOGLE_AI_API_KEY not configured');
    return null;
  }

  try {
    console.log('[EXTRACT-NOTES] Trying Google AI Studio...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extract ALL text content from the first 3 pages of this PDF document. Return ONLY the raw text, no formatting or commentary.' },
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: pdfBase64
                }
              }
            ]
          }],
          generationConfig: {
            maxOutputTokens: 4000,
            temperature: 0.1
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EXTRACT-NOTES] Google AI error:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
      console.log('[EXTRACT-NOTES] Google AI extraction successful');
      return text;
    }
    return null;
  } catch (error) {
    console.error('[EXTRACT-NOTES] Google AI exception:', error);
    return null;
  }
}

// Extract text using OpenAI (fallback)
async function extractWithOpenAI(pdfBase64: string): Promise<string | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.log('[EXTRACT-NOTES] OPENAI_API_KEY not configured');
    return null;
  }

  try {
    console.log('[EXTRACT-NOTES] Trying OpenAI fallback...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a document text extractor. Extract ALL text content from the provided PDF document. Focus on the first 3 pages. Return ONLY the raw text, no formatting or commentary.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all text from the first 3 pages of this PDF document. Return only the raw text.' },
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` }
              }
            ]
          }
        ],
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EXTRACT-NOTES] OpenAI error:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content;
    
    if (text) {
      console.log('[EXTRACT-NOTES] OpenAI extraction successful');
      return text;
    }
    return null;
  } catch (error) {
    console.error('[EXTRACT-NOTES] OpenAI exception:', error);
    return null;
  }
}

// Main extraction with fallback chain
async function extractTextFromPDF(pdfBase64: string): Promise<string> {
  // Try Google AI first
  let text = await extractWithGoogleAI(pdfBase64);
  
  // Fallback to OpenAI if Google fails
  if (!text) {
    text = await extractWithOpenAI(pdfBase64);
  }
  
  return text || '';
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

      // Convert PDF to base64
      const pdfBase64 = btoa(
        new Uint8Array(await pdfData.arrayBuffer())
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      console.log('[EXTRACT-NOTES] Extracting text from PDF...');
      textContent = await extractTextFromPDF(pdfBase64);

      // Cache the extracted text
      if (textContent) {
        await supabase
          .from('raw_causelists')
          .update({ text_content: textContent.substring(0, 50000) }) // Limit storage
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
