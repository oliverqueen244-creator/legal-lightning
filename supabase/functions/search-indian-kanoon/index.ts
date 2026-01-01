import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  court?: string;
  judges?: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, judgeName, court, maxResults = 10 } = await req.json();
    
    if (!query && !judgeName) {
      return new Response(
        JSON.stringify({ error: 'Query or judge name required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build search query for Indian Kanoon
    let searchQuery = query || '';
    if (judgeName) {
      // Add judge name to query, escape special characters
      const cleanJudgeName = judgeName.replace(/[^\w\s]/g, '').trim();
      searchQuery = searchQuery ? `${searchQuery} author:${cleanJudgeName}` : `author:${cleanJudgeName}`;
    }
    if (court) {
      // Map court names to Indian Kanoon court identifiers
      const courtMapping: Record<string, string> = {
        'JAIPUR': 'rajasthan',
        'JODHPUR': 'rajasthan',
        'Rajasthan High Court': 'rajasthan',
        'Rajasthan High Court - Jaipur': 'rajasthan',
        'Rajasthan High Court - Jodhpur': 'rajasthan',
        'Supreme Court of India': 'supremecourt',
        'Delhi High Court': 'delhi',
      };
      const courtId = courtMapping[court] || court.toLowerCase().replace(/\s+/g, '');
      searchQuery = `${searchQuery} court:${courtId}`;
    }

    console.log(`Searching Indian Kanoon: "${searchQuery}"`);

    // Indian Kanoon search API
    // Note: Indian Kanoon doesn't have a public API, so we use web scraping approach
    const searchUrl = `https://indiankanoon.org/search/?formInput=${encodeURIComponent(searchQuery)}&pagenum=0`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      console.error(`Indian Kanoon request failed: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Failed to search Indian Kanoon', results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    
    // Parse search results from HTML
    const results: SearchResult[] = [];
    
    // Extract result blocks - look for result divs
    const resultPattern = /<div class="result"[^>]*>([\s\S]*?)<\/div>\s*<div class="result_separator">/g;
    const titlePattern = /<a[^>]*href="([^"]*)"[^>]*class="result_title"[^>]*>([\s\S]*?)<\/a>/;
    const snippetPattern = /<div class="result_text"[^>]*>([\s\S]*?)<\/div>/;
    const datePattern = /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4})/i;
    
    let match;
    while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
      const resultHtml = match[1];
      
      // Extract title and URL
      const titleMatch = titlePattern.exec(resultHtml);
      if (!titleMatch) continue;
      
      const url = titleMatch[1].startsWith('http') 
        ? titleMatch[1] 
        : `https://indiankanoon.org${titleMatch[1]}`;
      const title = titleMatch[2]
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Extract snippet
      const snippetMatch = snippetPattern.exec(resultHtml);
      const snippet = snippetMatch 
        ? snippetMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)
        : '';
      
      // Extract date from snippet or title
      const dateMatch = datePattern.exec(resultHtml);
      const date = dateMatch ? dateMatch[1] : undefined;
      
      // Try to extract court info
      let resultCourt: string | undefined;
      if (resultHtml.includes('Supreme Court')) resultCourt = 'Supreme Court of India';
      else if (resultHtml.includes('Rajasthan') && resultHtml.includes('Jaipur')) resultCourt = 'Rajasthan High Court - Jaipur';
      else if (resultHtml.includes('Rajasthan') && resultHtml.includes('Jodhpur')) resultCourt = 'Rajasthan High Court - Jodhpur';
      else if (resultHtml.includes('Rajasthan')) resultCourt = 'Rajasthan High Court';
      else if (resultHtml.includes('Delhi')) resultCourt = 'Delhi High Court';
      
      results.push({
        title,
        url,
        snippet,
        date,
        court: resultCourt,
      });
    }

    // If pattern matching didn't work well, try simpler extraction
    if (results.length === 0) {
      // Fallback: Look for links to doc pages
      const docLinkPattern = /<a[^>]*href="(\/doc\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
      let docMatch;
      const seenUrls = new Set<string>();
      
      while ((docMatch = docLinkPattern.exec(html)) !== null && results.length < maxResults) {
        const url = `https://indiankanoon.org${docMatch[1]}`;
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        
        const title = docMatch[2]
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (title.length < 10) continue; // Skip very short titles
        
        results.push({
          title,
          url,
          snippet: '',
        });
      }
    }

    console.log(`Found ${results.length} results from Indian Kanoon`);

    return new Response(
      JSON.stringify({ 
        results,
        query: searchQuery,
        source: 'indiankanoon.org'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Indian Kanoon search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, results: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
