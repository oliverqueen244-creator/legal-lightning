import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ACCOUNT-WISE NAME SCAN (CRITICAL)
 * 
 * This function runs per profile per causelist:
 * 1. Extract plain text from PDF (Google AI primary, OpenAI fallback)
 * 2. Search for profile's aliases (case-insensitive string match)
 * 3. If match found: enqueue parsing task
 * 4. If no match: STOP, do nothing
 * 
 * ❌ NO case number extraction
 * ❌ NO party identification
 * ❌ NO inserts to daily_court_docket
 */

interface ScanRequest {
  profile_id?: string;
  causelist_id?: string;
}

// Extract text using Google AI Studio (primary)
async function extractWithGoogleAI(pdfBase64: string): Promise<string | null> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) {
    console.log('[SCAN-LAWYER-NAMES] GOOGLE_AI_API_KEY not configured');
    return null;
  }

  try {
    console.log('[SCAN-LAWYER-NAMES] Trying Google AI Studio (gemini-exp-1206)...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-exp-1206:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extract ALL text from this PDF. Return only raw text, preserve lawyer names and case numbers. No commentary.' },
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: pdfBase64
                }
              }
            ]
          }],
          generationConfig: {
            maxOutputTokens: 30000,
            temperature: 0.1
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SCAN-LAWYER-NAMES] Google AI error:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
      console.log('[SCAN-LAWYER-NAMES] Google AI extraction successful');
      return text;
    }
    return null;
  } catch (error) {
    console.error('[SCAN-LAWYER-NAMES] Google AI exception:', error);
    return null;
  }
}

// Extract text using OpenRouter (second fallback - supports PDFs via Gemini)
async function extractWithOpenRouter(pdfBase64: string): Promise<string | null> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.log('[SCAN-LAWYER-NAMES] OPENROUTER_API_KEY not configured');
    return null;
  }

  try {
    console.log('[SCAN-LAWYER-NAMES] Trying OpenRouter fallback...');
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Causelist Parser'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract ALL text from this PDF. Return only raw text, preserve lawyer names and case numbers. No commentary.' },
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` }
              }
            ]
          }
        ],
        max_tokens: 30000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SCAN-LAWYER-NAMES] OpenRouter error:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content;
    
    if (text) {
      console.log('[SCAN-LAWYER-NAMES] OpenRouter extraction successful');
      return text;
    }
    return null;
  } catch (error) {
    console.error('[SCAN-LAWYER-NAMES] OpenRouter exception:', error);
    return null;
  }
}

// Main extraction with fallback chain
async function extractTextFromPDF(pdfBase64: string): Promise<string> {
  // Try Google AI first
  let text = await extractWithGoogleAI(pdfBase64);
  
  // Fallback to OpenRouter if Google fails
  if (!text) {
    text = await extractWithOpenRouter(pdfBase64);
  }
  
  return text || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[SCAN-LAWYER-NAMES] Function started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ScanRequest = await req.json().catch(() => ({}));

    // Get causelists to scan
    let causelistQuery = supabase
      .from('raw_causelists')
      .select('id, storage_path, text_content, bench, list_type, list_date')
      .in('status', ['notes_extracted', 'scanning'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (body.causelist_id) {
      causelistQuery = supabase
        .from('raw_causelists')
        .select('id, storage_path, text_content, bench, list_type, list_date')
        .eq('id', body.causelist_id);
    }

    const { data: causelists, error: causelistError } = await causelistQuery;

    if (causelistError) {
      throw new Error(`Failed to fetch causelists: ${causelistError.message}`);
    }

    if (!causelists?.length) {
      console.log('[SCAN-LAWYER-NAMES] No causelists to scan');
      return new Response(JSON.stringify({ success: true, message: 'No causelists to scan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get profiles with aliases
    let profilesQuery = supabase
      .from('profiles')
      .select('id')
      .eq('onboarding_completed', true);

    if (body.profile_id) {
      profilesQuery = supabase
        .from('profiles')
        .select('id')
        .eq('id', body.profile_id);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles?.length) {
      console.log('[SCAN-LAWYER-NAMES] No profiles with completed onboarding');
      return new Response(JSON.stringify({ success: true, message: 'No profiles to scan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalScans = 0;
    let totalMatches = 0;
    let totalEnqueued = 0;

    for (const causelist of causelists) {
      console.log(`[SCAN-LAWYER-NAMES] Processing causelist: ${causelist.id} (${causelist.bench} ${causelist.list_type})`);

      // Get or extract text content
      let textContent = causelist.text_content;

      if (!textContent) {
        console.log('[SCAN-LAWYER-NAMES] No cached text, extracting from PDF...');
        
        const { data: pdfData, error: downloadError } = await supabase.storage
          .from('causelist-pdfs')
          .download(causelist.storage_path);

        if (downloadError || !pdfData) {
          console.error(`[SCAN-LAWYER-NAMES] Failed to download PDF: ${downloadError?.message}`);
          continue;
        }

        // Convert PDF to base64
        const pdfBase64 = btoa(
          new Uint8Array(await pdfData.arrayBuffer())
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        textContent = await extractTextFromPDF(pdfBase64);

        // Cache the text
        if (textContent) {
          await supabase
            .from('raw_causelists')
            .update({ text_content: textContent.substring(0, 100000), status: 'scanning' })
            .eq('id', causelist.id);
          console.log('[SCAN-LAWYER-NAMES] Text cached successfully');
        } else {
          console.error('[SCAN-LAWYER-NAMES] Failed to extract text from PDF');
          continue;
        }
      }

      const textLower = textContent.toLowerCase();

      // Scan for each profile's aliases
      for (const profile of profiles) {
        // Check if already scanned
        const { data: existingScan } = await supabase
          .from('profile_scan_log')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('raw_causelist_id', causelist.id)
          .single();

        if (existingScan) {
          console.log(`[SCAN-LAWYER-NAMES] Profile ${profile.id} already scanned for causelist ${causelist.id}`);
          continue;
        }

        // Get profile's aliases ONLY
        const { data: aliases } = await supabase
          .from('lawyer_aliases')
          .select('alias_name')
          .eq('profile_id', profile.id);

        if (!aliases?.length) {
          continue;
        }

        totalScans++;

        // Simple case-insensitive string matching - NO AI
        const matchedAliases: string[] = [];
        for (const { alias_name } of aliases) {
          const aliasLower = alias_name.toLowerCase().trim();
          if (textLower.includes(aliasLower)) {
            matchedAliases.push(alias_name);
          }
        }

        // Log the scan
        await supabase.from('profile_scan_log').insert({
          profile_id: profile.id,
          raw_causelist_id: causelist.id,
          aliases_searched: aliases.map(a => a.alias_name),
          matches_found: matchedAliases.length
        });

        if (matchedAliases.length > 0) {
          totalMatches += matchedAliases.length;
          console.log(`[SCAN-LAWYER-NAMES] Profile ${profile.id}: Found ${matchedAliases.length} matches: ${matchedAliases.join(', ')}`);

          // Enqueue parsing tasks for each matched alias
          for (const alias of matchedAliases) {
            const { error: queueError } = await supabase
              .from('case_parse_queue')
              .insert({
                profile_id: profile.id,
                raw_causelist_id: causelist.id,
                matched_alias: alias,
                status: 'pending'
              });

            if (!queueError) {
              totalEnqueued++;
            }
          }
        } else {
          console.log(`[SCAN-LAWYER-NAMES] Profile ${profile.id}: No matches, STOPPING`);
        }
      }

      // Update causelist status
      await supabase
        .from('raw_causelists')
        .update({ status: 'scanned' })
        .eq('id', causelist.id);
    }

    const duration = Date.now() - startTime;
    console.log(`[SCAN-LAWYER-NAMES] Completed: ${totalScans} scans, ${totalMatches} matches, ${totalEnqueued} enqueued, ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      scans_performed: totalScans,
      matches_found: totalMatches,
      tasks_enqueued: totalEnqueued,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[SCAN-LAWYER-NAMES] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
