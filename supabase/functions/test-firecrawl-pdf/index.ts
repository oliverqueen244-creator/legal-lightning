import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storage_path } = await req.json().catch(() => ({}));
    
    // Default to the test PDF we know exists
    const pdfPath = storage_path || 'causelists/2025-12-19/JODHPUR/DAILY_92.pdf';
    
    // Build public URL for the PDF
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const pdfUrl = `${supabaseUrl}/storage/v1/object/public/causelist-pdfs/${pdfPath}`;
    
    console.log('Testing Firecrawl PDF extraction');
    console.log('PDF URL:', pdfUrl);

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Firecrawl scrape API
    console.log('Calling Firecrawl API...');
    const startTime = Date.now();
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: pdfUrl,
        formats: ['markdown'],
        onlyMainContent: false,
      }),
    });

    const elapsed = Date.now() - startTime;
    console.log(`Firecrawl response received in ${elapsed}ms`);

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.error || `Request failed with status ${response.status}`,
          firecrawl_response: data 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract the text content
    const markdown = data.data?.markdown || data.markdown || '';
    const textLength = markdown.length;
    
    // Search for "Ramesh Purohit" (case insensitive)
    const foundRameshPurohit = markdown.toLowerCase().includes('ramesh purohit');
    
    // Count occurrences of "Purohit" to see if we're getting lawyer names
    const purohitMatches = markdown.match(/purohit/gi) || [];
    
    // Look for page indicators to verify full extraction
    const pageMatches = markdown.match(/page\s+\d+\s+(of\s+)?\d+/gi) || [];
    const lastPageMatch = pageMatches.length > 0 ? pageMatches[pageMatches.length - 1] : null;

    const result = {
      success: true,
      pdf_url: pdfUrl,
      extraction_time_ms: elapsed,
      text_length: textLength,
      text_length_kb: (textLength / 1024).toFixed(2) + ' KB',
      found_ramesh_purohit: foundRameshPurohit,
      purohit_occurrences: purohitMatches.length,
      page_indicators: pageMatches.slice(0, 5),
      last_page_indicator: lastPageMatch,
      text_preview_start: markdown.substring(0, 2000),
      text_preview_end: markdown.substring(Math.max(0, textLength - 2000)),
      firecrawl_metadata: data.data?.metadata || data.metadata,
    };

    console.log('Extraction complete:', {
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
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
