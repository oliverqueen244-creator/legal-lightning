import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * HTML Text Extraction Function
 * 
 * Extracts plain text from HTML causelist files and triggers scanning.
 * For HTML files, we can extract text directly without external PDF parsing.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { causelist_id } = await req.json();

    if (!causelist_id) {
      return new Response(
        JSON.stringify({ error: 'Missing causelist_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing HTML extraction for causelist: ${causelist_id}`);

    // Fetch causelist record
    const { data: causelist, error: fetchError } = await supabase
      .from('raw_causelists')
      .select('*')
      .eq('id', causelist_id)
      .single();

    if (fetchError || !causelist) {
      console.error('Causelist not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Causelist not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download HTML file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('causelist-pdfs')
      .download(causelist.storage_path);

    if (downloadError || !fileData) {
      console.error('Failed to download HTML file:', downloadError);
      
      // Update status to failed
      await supabase
        .from('raw_causelists')
        .update({ status: 'extraction_failed' })
        .eq('id', causelist_id);

      return new Response(
        JSON.stringify({ error: 'Failed to download file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read HTML content
    const htmlContent = await fileData.text();
    console.log(`Downloaded HTML file, size: ${htmlContent.length} chars`);

    // Extract text from HTML
    const textContent = extractTextFromHtml(htmlContent);
    console.log(`Extracted text, size: ${textContent.length} chars`);

    // Update causelist with extracted text
    const { error: updateError } = await supabase
      .from('raw_causelists')
      .update({
        text_content: textContent,
        status: 'text_extracted',
        extraction_progress: {
          status: 'complete',
          total_pages: 1,
          extracted_pages: 1,
          completed_at: new Date().toISOString(),
        },
      })
      .eq('id', causelist_id);

    if (updateError) {
      console.error('Failed to update causelist:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save extracted text' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Trigger scan-lawyer-names
    console.log('Triggering lawyer name scan...');
    const { error: scanError } = await supabase.functions.invoke('scan-lawyer-names', {
      body: { causelist_id },
    });

    if (scanError) {
      console.error('Scan trigger error:', scanError);
      // Don't fail, just log
    }

      return new Response(
        JSON.stringify({
          success: true,
          causelist_id,
          text_length: textContent.length,
          status: 'text_extracted',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

  } catch (error) {
    console.error('HTML extraction error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Extract plain text from HTML content
 * Removes scripts, styles, and HTML tags while preserving structure
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags with their content
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Replace common block elements with newlines for structure
  text = text
    .replace(/<\/?(div|p|br|tr|li|h[1-6]|table|thead|tbody)[^>]*>/gi, '\n')
    .replace(/<\/?(td|th)[^>]*>/gi, ' | ');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Clean up whitespace
  text = text
    .replace(/[ \t]+/g, ' ')           // Multiple spaces to single
    .replace(/\n\s*\n/g, '\n\n')       // Multiple newlines to double
    .replace(/^\s+|\s+$/gm, '')        // Trim lines
    .trim();

  return text;
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&ndash;': '-',
    '&mdash;': '--',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&copy;': '(c)',
    '&reg;': '(R)',
    '&trade;': '(TM)',
    '&hellip;': '...',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

  return result;
}
