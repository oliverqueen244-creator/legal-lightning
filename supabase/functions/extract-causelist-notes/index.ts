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
  { pattern: /SUPPLEMENTARY\s+(?:LIST|CAUSE\s*LIST)\s*[:\-]?\s*([^\n]+(?:\n(?![A-Z]{2,})[^\n]+)*)/gi, type: 'SUPPLEMENTARY_NOTE' },
];

// Policy classification rules - derive execution policy attributes from NOTE text
interface PolicyClassification {
  policy_scope: 'GLOBAL' | 'COURT' | 'BENCH' | 'UNKNOWN';
  priority_rule: 'SUPPLEMENTARY_FIRST' | 'MAIN_ONLY' | 'TIME_BOUND' | 'UNSPECIFIED';
  time_condition: 'IF_TIME_PERMITS' | 'FIXED_ORDER' | 'UNKNOWN';
  confidence: number;
  court_no: string | null;
}

function classifyPolicy(noteText: string, noteType: string): PolicyClassification {
  const textLower = noteText.toLowerCase();
  
  let policy_scope: PolicyClassification['policy_scope'] = 'UNKNOWN';
  let priority_rule: PolicyClassification['priority_rule'] = 'UNSPECIFIED';
  let time_condition: PolicyClassification['time_condition'] = 'UNKNOWN';
  let confidence = 0.8;
  let court_no: string | null = null;
  
  // Detect scope
  const courtMatch = noteText.match(/court\s*(?:no\.?|number)?\s*:?\s*(\d+)/i);
  if (courtMatch) {
    policy_scope = 'COURT';
    court_no = courtMatch[1];
    confidence = 0.9;
  } else if (textLower.includes('all courts') || textLower.includes('all benches')) {
    policy_scope = 'GLOBAL';
    confidence = 0.95;
  } else if (textLower.includes('bench') || textLower.includes('hon\'ble') || textLower.includes('justice')) {
    policy_scope = 'BENCH';
    confidence = 0.85;
  }
  
  // Detect priority rule
  if (textLower.includes('supplementary') && (textLower.includes('first') || textLower.includes('priority') || textLower.includes('before'))) {
    priority_rule = 'SUPPLEMENTARY_FIRST';
    confidence = Math.max(confidence, 0.9);
  } else if (textLower.includes('main list only') || textLower.includes('daily list only')) {
    priority_rule = 'MAIN_ONLY';
    confidence = Math.max(confidence, 0.9);
  } else if (textLower.includes('time bound') || textLower.includes('fixed time') || noteText.match(/\d{1,2}[:\.\s]?\d{2}\s*(?:am|pm|AM|PM)/)) {
    priority_rule = 'TIME_BOUND';
    confidence = Math.max(confidence, 0.85);
  }
  
  // Detect time condition
  if (textLower.includes('if time permits') || textLower.includes('time permitting') || textLower.includes('subject to time')) {
    time_condition = 'IF_TIME_PERMITS';
    confidence = Math.max(confidence, 0.95);
  } else if (textLower.includes('fixed order') || textLower.includes('serial order') || textLower.includes('strict order')) {
    time_condition = 'FIXED_ORDER';
    confidence = Math.max(confidence, 0.9);
  }
  
  // High confidence for IMPORTANT or DIRECTION types
  if (noteType === 'IMPORTANT' || noteType === 'DIRECTION') {
    confidence = Math.min(confidence + 0.05, 0.99);
  }
  
  return { policy_scope, priority_rule, time_condition, confidence, court_no };
}

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
      .select('storage_path, text_content, bench, list_type')
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
    const extractedNotes: { note_type: string; note_text: string; page_number?: number }[] = [];

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

    // Insert notes into cause_list_notes
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

    // NEW: Create execution policies from notes
    const policiesToInsert = extractedNotes.map(note => {
      const classification = classifyPolicy(note.note_text, note.note_type);
      return {
        raw_causelist_id: causelist_id,
        policy_text: note.note_text,
        policy_scope: classification.policy_scope,
        priority_rule: classification.priority_rule,
        time_condition: classification.time_condition,
        confidence: classification.confidence,
        court_no: classification.court_no,
        bench: causelist.bench,
        authority_level: 'JUDICIAL_NOTE',
      };
    });

    if (policiesToInsert.length > 0) {
      const { error: policyError } = await supabase
        .from('daily_execution_policies')
        .insert(policiesToInsert);

      if (policyError) {
        console.error('[EXTRACT-NOTES] Failed to insert execution policies:', policyError);
      } else {
        console.log(`[EXTRACT-NOTES] Created ${policiesToInsert.length} execution policies`);
      }
    }

    // Update status
    await supabase
      .from('raw_causelists')
      .update({ status: 'notes_extracted' })
      .eq('id', causelist_id);

    // Trigger hearing likelihood derivation
    try {
      console.log('[EXTRACT-NOTES] Triggering hearing likelihood derivation...');
      await supabase.functions.invoke('derive-hearing-likelihood', {
        body: { causelist_id }
      });
    } catch {
      console.log('[EXTRACT-NOTES] Hearing likelihood derivation deferred');
    }

    console.log('[EXTRACT-NOTES] Completed successfully');

    return new Response(JSON.stringify({
      success: true,
      notes_count: extractedNotes.length,
      policies_created: policiesToInsert.length
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
