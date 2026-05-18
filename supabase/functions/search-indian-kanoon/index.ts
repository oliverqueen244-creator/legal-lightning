import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  court?: string;
  judges?: string[];
  searchVector?: string;
  docId?: string;
}

interface SearchVector {
  type: 'judge' | 'court' | 'case-type' | 'sections' | 'advocate' | 'keywords';
  query: string;
  priority: number;
}

// Build multiple search vectors for comprehensive coverage
function buildSearchVectors(params: {
  judgeName?: string;
  court?: string;
  caseType?: string;
  category?: string;
  sections?: string[];
  advocateNames?: string[];
  keywords?: string[];
}): SearchVector[] {
  const vectors: SearchVector[] = [];
  
  // Court ID mapping for Indian Kanoon API
  const courtMapping: Record<string, string> = {
    'JAIPUR': 'rajasthan',
    'JODHPUR': 'rajasthan',
    'Rajasthan High Court': 'rajasthan',
    'Rajasthan High Court - Jaipur': 'rajasthan',
    'Rajasthan High Court - Jodhpur': 'rajasthan',
    'Supreme Court of India': 'supremecourt',
    'Supreme Court': 'supremecourt',
    'Delhi High Court': 'delhi',
  };
  
  const courtId = params.court ? (courtMapping[params.court] || params.court.toLowerCase().replace(/\s+/g, '')) : '';
  
  // 1. Judge-specific search (highest priority)
  if (params.judgeName) {
    const cleanJudgeName = params.judgeName
      .replace(/Hon'?ble\.?/gi, '')
      .replace(/Justice\.?/gi, '')
      .replace(/J\.?$/gi, '')
      .replace(/[^\w\s]/g, '')
      .trim();
    
    let query = `author:${cleanJudgeName}`;
    if (courtId) query += ` court:${courtId}`;
    
    vectors.push({
      type: 'judge',
      query,
      priority: 100,
    });
  }
  
  // 2. Court + Case Type search
  if (courtId && params.caseType) {
    vectors.push({
      type: 'case-type',
      query: `court:${courtId} ${params.caseType}`,
      priority: 80,
    });
  }
  
  // 3. Category-specific keywords with court
  if (courtId && params.category) {
    const categoryKeywords: Record<string, string[]> = {
      'criminal': ['bail', 'quashing FIR', 'anticipatory bail'],
      'civil-writ': ['writ petition', 'Article 226', 'mandamus'],
      'appeal': ['appeal dismissed', 'appeal allowed'],
      'mact': ['motor accident compensation', 'insurance claim'],
      'family': ['maintenance', 'custody child'],
      'labour': ['reinstatement', 'termination service'],
      'arbitration': ['Section 34 arbitration', 'arbitral award'],
    };
    
    const keywords = categoryKeywords[params.category] || [];
    if (keywords.length > 0) {
      vectors.push({
        type: 'case-type',
        query: `court:${courtId} ${keywords[0]}`,
        priority: 70,
      });
    }
  }
  
  // 4. Sections/Acts search
  if (params.sections && params.sections.length > 0) {
    for (const section of params.sections.slice(0, 2)) {
      let query = section;
      if (courtId) query = `court:${courtId} ${section}`;
      
      vectors.push({
        type: 'sections',
        query,
        priority: 60,
      });
    }
  }
  
  // 5. Advocate name search
  if (params.advocateNames && params.advocateNames.length > 0) {
    const primaryAdvocate = params.advocateNames[0]
      .replace(/[^\w\s]/g, '')
      .trim();
    
    if (primaryAdvocate.length > 5) {
      let query = `"${primaryAdvocate}"`;
      if (courtId) query += ` court:${courtId}`;
      
      vectors.push({
        type: 'advocate',
        query,
        priority: 50,
      });
    }
  }
  
  // 6. General keywords
  if (params.keywords && params.keywords.length > 0) {
    let query = params.keywords.slice(0, 3).join(' ');
    if (courtId) query = `court:${courtId} ${query}`;
    
    vectors.push({
      type: 'keywords',
      query,
      priority: 40,
    });
  }
  
  // Sort by priority
  vectors.sort((a, b) => b.priority - a.priority);
  
  return vectors;
}

// Perform search using Indian Kanoon API with authentication
async function performApiSearch(searchQuery: string, maxResults: number, apiKey: string): Promise<SearchResult[]> {
  // Indian Kanoon API endpoint
  const apiUrl = 'https://api.indiankanoon.org/search/';
  
  console.log(`API Search: ${searchQuery}`);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        formInput: searchQuery,
        pagenum: '0',
      }),
    });

    if (!response.ok) {
      console.error(`API search failed: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`Response: ${text.slice(0, 500)}`);
      return [];
    }

    const data = await response.json();
    const results: SearchResult[] = [];
    
    // Parse API response - structure varies but typically has docs array
    const docs = data.docs || data.results || [];
    
    for (const doc of docs.slice(0, maxResults)) {
      const docId = doc.tid || doc.docid || doc.id;
      const title = doc.title || doc.headline || 'Untitled';
      const snippet = doc.headline || doc.snippet || doc.docsource || '';
      
      // Build URL from doc ID
      const url = docId 
        ? `https://indiankanoon.org/doc/${docId}/`
        : doc.url || '';
      
      // Extract court info
      let court: string | undefined;
      const docsource = (doc.docsource || '').toLowerCase();
      if (docsource.includes('supreme court')) court = 'Supreme Court of India';
      else if (docsource.includes('rajasthan') && docsource.includes('jaipur')) court = 'Rajasthan High Court - Jaipur';
      else if (docsource.includes('rajasthan') && docsource.includes('jodhpur')) court = 'Rajasthan High Court - Jodhpur';
      else if (docsource.includes('rajasthan')) court = 'Rajasthan High Court';
      else if (docsource.includes('delhi')) court = 'Delhi High Court';
      else if (doc.docsource) court = doc.docsource;
      
      // Parse date
      const date = doc.publishdate || doc.date;
      
      // Extract judges
      const judges: string[] = [];
      if (doc.author) {
        const authorStr = Array.isArray(doc.author) ? doc.author.join(', ') : doc.author;
        const judgePattern = /(?:Justice\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
        let judgeMatch;
        while ((judgeMatch = judgePattern.exec(authorStr)) !== null) {
          judges.push(judgeMatch[1]);
        }
      }
      
      results.push({
        title: title.replace(/<[^>]*>/g, '').trim(),
        url,
        snippet: snippet.replace(/<[^>]*>/g, '').trim().slice(0, 400),
        date,
        court,
        judges: judges.length > 0 ? judges : undefined,
        docId: docId?.toString(),
      });
    }
    
    console.log(`API returned ${results.length} results`);
    return results;
    
  } catch (error) {
    console.error('API search error:', error);
    return [];
  }
}

// Fallback: scrape search (if API fails)
async function performScrapedSearch(searchQuery: string, maxResults: number): Promise<SearchResult[]> {
  const searchUrl = `https://indiankanoon.org/search/?formInput=${encodeURIComponent(searchQuery)}&pagenum=0`;
  
  console.log(`Fallback scrape search: ${searchQuery}`);
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      console.error(`Scrape search failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const results: SearchResult[] = [];
    
    // Pattern for result divs
    const resultPattern = /<div class="result"[^>]*>([\s\S]*?)<\/div>\s*<div class="result_separator">/g;
    const titlePattern = /<a[^>]*href="([^"]*)"[^>]*class="result_title"[^>]*>([\s\S]*?)<\/a>/;
    const snippetPattern = /<div class="result_text"[^>]*>([\s\S]*?)<\/div>/;
    const datePattern = /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4})/i;
    
    let match;
    while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
      const resultHtml = match[1];
      
      const titleMatch = titlePattern.exec(resultHtml);
      if (!titleMatch) continue;
      
      const url = titleMatch[1].startsWith('http') 
        ? titleMatch[1] 
        : `https://indiankanoon.org${titleMatch[1]}`;
      const title = titleMatch[2]
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      const snippetMatch = snippetPattern.exec(resultHtml);
      const snippet = snippetMatch 
        ? snippetMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)
        : '';
      
      const dateMatch = datePattern.exec(resultHtml);
      const date = dateMatch ? dateMatch[1] : undefined;
      
      let resultCourt: string | undefined;
      if (resultHtml.includes('Supreme Court')) resultCourt = 'Supreme Court of India';
      else if (resultHtml.includes('Rajasthan') && resultHtml.includes('Jaipur')) resultCourt = 'Rajasthan High Court - Jaipur';
      else if (resultHtml.includes('Rajasthan') && resultHtml.includes('Jodhpur')) resultCourt = 'Rajasthan High Court - Jodhpur';
      else if (resultHtml.includes('Rajasthan')) resultCourt = 'Rajasthan High Court';
      
      // Extract doc ID from URL
      const docIdMatch = url.match(/\/doc\/(\d+)/);
      const docId = docIdMatch ? docIdMatch[1] : undefined;
      
      results.push({
        title,
        url,
        snippet,
        date,
        court: resultCourt,
        docId,
      });
    }

    return results;
  } catch (error) {
    console.error('Scrape search error:', error);
    return [];
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('INDIAN_KANOON_API_KEY');
    
    const { 
      query,
      judgeName, 
      court, 
      caseType,
      category,
      sections,
      advocateNames,
      keywords,
      maxResults = 15,
      multiVector = true,
    } = await req.json();
    
    // Select search function based on API key availability
    const searchFn = apiKey 
      ? (q: string, n: number) => performApiSearch(q, n, apiKey)
      : performScrapedSearch;
    
    const searchMode = apiKey ? 'api' : 'scrape';
    console.log(`Using ${searchMode} mode`);
    
    // If legacy single query mode
    if (query && !multiVector) {
      let searchQuery = query;
      if (judgeName) {
        const cleanJudgeName = judgeName.replace(/[^\w\s]/g, '').trim();
        searchQuery = searchQuery ? `${searchQuery} author:${cleanJudgeName}` : `author:${cleanJudgeName}`;
      }
      
      const results = await searchFn(searchQuery, maxResults);
      
      return new Response(
        JSON.stringify({ 
          results,
          query: searchQuery,
          source: 'indiankanoon.org',
          mode: searchMode,
          vectors: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Multi-vector search mode
    const vectors = buildSearchVectors({
      judgeName,
      court,
      caseType,
      category,
      sections,
      advocateNames,
      keywords,
    });
    
    if (vectors.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No search criteria provided', results: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Executing ${vectors.length} search vectors`);
    
    // Execute searches (limit to top 3 vectors to avoid rate limiting)
    const searchPromises = vectors.slice(0, 3).map(async (vector) => {
      const results = await searchFn(vector.query, Math.ceil(maxResults / vectors.length));
      return results.map(r => ({
        ...r,
        searchVector: vector.type,
      }));
    });
    
    const allResults = await Promise.all(searchPromises);
    
    // Merge and deduplicate results
    const seenUrls = new Set<string>();
    const mergedResults: SearchResult[] = [];
    
    for (const resultSet of allResults) {
      for (const result of resultSet) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          mergedResults.push(result);
        }
      }
    }
    
    console.log(`Found ${mergedResults.length} unique results from ${vectors.length} vectors`);

    return new Response(
      JSON.stringify({ 
        results: mergedResults.slice(0, maxResults),
        vectors: vectors.map(v => ({ type: v.type, query: v.query })),
        source: 'indiankanoon.org',
        mode: searchMode,
        lastChecked: new Date().toISOString(),
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
