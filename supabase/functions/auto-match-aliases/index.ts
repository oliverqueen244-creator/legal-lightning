import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trigger-secret',
};

// Legal role labels to ignore during matching
const IGNORED_ROLE_LABELS = new Set([
  'aag', 'pp', 'asg', 'ga', 'app', 'advocate general', 'add ga', 'add aag',
  'add. g.a.', 'add g c', 'g c', 'gc', 'in person', 'p.p.', 'a.a.g.'
]);

interface RequestPayload {
  docket_id: string;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
}

interface LawyerAlias {
  id: string;
  profile_id: string;
  alias_name: string;
  is_primary: boolean;
}

interface MatchResult {
  profileId: string;
  role: 'petitioner' | 'respondent';
  method: 'exact' | 'fuzzy';
  confidence: number;
  matchedAlias: string;
}

/**
 * STEP 1: Normalize names for comparison
 * - lowercase
 * - remove punctuation: . , ( ) - /
 * - collapse multiple spaces
 * - trim
 */
function normalize(text: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,()\/\-]/g, ' ')  // Remove punctuation, replace with space
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .trim();
}

/**
 * Count words in a string
 */
function wordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Check if a token is an ignored legal role label
 */
function isIgnoredLabel(token: string): boolean {
  return IGNORED_ROLE_LABELS.has(token.toLowerCase().trim());
}

/**
 * STEP 3: Exact word-boundary match
 * An alias matches ONLY if it appears as a complete phrase surrounded by word boundaries
 * 
 * Example:
 * ✅ " B VYAS, VIGYAN SHAH, AAG " matches VIGYAN SHAH
 * ❌ " RAJESH SHARMA " does NOT match alias SHAH
 */
function exactWordBoundaryMatch(normalizedLawyerField: string, normalizedAlias: string): boolean {
  // Pad both strings with spaces to ensure word boundary matching
  const paddedField = ` ${normalizedLawyerField} `;
  const paddedAlias = ` ${normalizedAlias} `;
  
  return paddedField.includes(paddedAlias);
}

/**
 * Calculate Jaro-Winkler similarity between two strings
 * Returns a value between 0 and 1, where 1 is an exact match
 */
function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler modification - boost for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * STEP 4: Fuzzy match (SECONDARY, STRICT)
 * Only for aliases with 2+ words, threshold >= 0.92
 * Single-word aliases are NEVER fuzzy-matched
 */
function fuzzyMatch(normalizedLawyerField: string, normalizedAlias: string): number {
  // Single-word aliases are NEVER fuzzy-matched
  if (wordCount(normalizedAlias) < 2) {
    return 0;
  }

  // Check similarity against each potential name segment in the lawyer field
  // Split by common separators
  const segments = normalizedLawyerField.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
  
  let maxSimilarity = 0;
  
  for (const segment of segments) {
    // Skip if segment is an ignored label
    if (isIgnoredLabel(segment)) continue;
    
    const similarity = jaroWinklerSimilarity(segment, normalizedAlias);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
    }
  }

  // Also check against the full field
  const fullSimilarity = jaroWinklerSimilarity(normalizedLawyerField, normalizedAlias);
  if (fullSimilarity > maxSimilarity) {
    maxSimilarity = fullSimilarity;
  }

  return maxSimilarity;
}

/**
 * Attempt to match a lawyer field against sorted aliases
 * Returns the best match or null if no safe match found
 */
function matchLawyerField(
  lawyerField: string | null,
  role: 'petitioner' | 'respondent',
  sortedAliases: LawyerAlias[]
): MatchResult | null {
  if (!lawyerField) return null;
  
  const normalizedField = normalize(lawyerField);
  if (!normalizedField) return null;

  // Skip if the entire field is just an ignored label
  if (isIgnoredLabel(normalizedField)) return null;

  // STEP 3: Try exact word-boundary match first (PRIMARY)
  for (const alias of sortedAliases) {
    const normalizedAlias = normalize(alias.alias_name);
    
    // Skip very short aliases (less than 3 chars)
    if (normalizedAlias.length < 3) continue;
    
    // Skip if alias is an ignored label
    if (isIgnoredLabel(normalizedAlias)) continue;

    if (exactWordBoundaryMatch(normalizedField, normalizedAlias)) {
      console.log(`[auto-match] EXACT match: "${alias.alias_name}" in "${lawyerField}"`);
      return {
        profileId: alias.profile_id,
        role,
        method: 'exact',
        confidence: 1.0,
        matchedAlias: alias.alias_name
      };
    }
  }

  // STEP 4: Try fuzzy match (SECONDARY, STRICT) - only if no exact match
  for (const alias of sortedAliases) {
    const normalizedAlias = normalize(alias.alias_name);
    
    // Skip single-word aliases for fuzzy matching
    if (wordCount(normalizedAlias) < 2) continue;
    
    // Skip if alias is an ignored label
    if (isIgnoredLabel(normalizedAlias)) continue;

    const similarity = fuzzyMatch(normalizedField, normalizedAlias);
    
    // Strict threshold: >= 0.92
    if (similarity >= 0.92) {
      console.log(`[auto-match] FUZZY match: "${alias.alias_name}" ~ "${lawyerField}" (${similarity.toFixed(3)})`);
      return {
        profileId: alias.profile_id,
        role,
        method: 'fuzzy',
        confidence: similarity,
        matchedAlias: alias.alias_name
      };
    }
  }

  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate trigger secret to ensure only database trigger can call this
    const triggerSecret = req.headers.get('x-trigger-secret');
    const expectedSecret = Deno.env.get('TRIGGER_SECRET');
    
    if (!expectedSecret || triggerSecret !== expectedSecret) {
      console.error('[auto-match] Unauthorized: Invalid or missing trigger secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: RequestPayload = await req.json();
    const { docket_id, petitioner_lawyer, respondent_lawyer } = payload;

    console.log(`[auto-match] Processing docket ${docket_id}`);
    console.log(`[auto-match] Petitioner: ${petitioner_lawyer}`);
    console.log(`[auto-match] Respondent: ${respondent_lawyer}`);

    if (!docket_id) {
      return new Response(
        JSON.stringify({ error: 'Missing docket_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already matched with high confidence (idempotency)
    const { data: existingDocket } = await supabase
      .from('daily_court_docket')
      .select('matched_profile_id, match_confidence')
      .eq('id', docket_id)
      .maybeSingle();

    if (existingDocket?.matched_profile_id && existingDocket?.match_confidence >= 0.95) {
      console.log(`[auto-match] Skipping - already matched with confidence ${existingDocket.match_confidence}`);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Already matched with high confidence'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all lawyer aliases
    const { data: aliases, error: aliasError } = await supabase
      .from('lawyer_aliases')
      .select('id, profile_id, alias_name, is_primary');

    if (aliasError) {
      console.error('[auto-match] Error fetching aliases:', aliasError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch aliases', details: aliasError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-match] Found ${aliases?.length || 0} aliases to check`);

    // STEP 2: Sort aliases by word count DESCENDING (longer aliases = higher priority)
    const sortedAliases = [...(aliases || [])].sort((a, b) => {
      const wordsA = wordCount(normalize(a.alias_name));
      const wordsB = wordCount(normalize(b.alias_name));
      return wordsB - wordsA; // Descending
    });

    console.log(`[auto-match] Alias priority order: ${sortedAliases.slice(0, 5).map(a => a.alias_name).join(', ')}...`);

    // STEP 5: Match resolution
    // Try petitioner first, then respondent
    let match: MatchResult | null = null;

    match = matchLawyerField(petitioner_lawyer, 'petitioner', sortedAliases);
    
    if (!match) {
      match = matchLawyerField(respondent_lawyer, 'respondent', sortedAliases);
    }

    // Update the docket entry if we found a safe match
    if (match) {
      const needsReview = match.confidence < 0.95;
      
      const { error: updateError } = await supabase
        .from('daily_court_docket')
        .update({
          matched_profile_id: match.profileId,
          matched_role: match.role,
          match_method: match.method,
          match_confidence: match.confidence,
          needs_review: needsReview
        })
        .eq('id', docket_id);

      if (updateError) {
        console.error('[auto-match] Error updating docket:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update docket', details: updateError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[auto-match] ✅ Matched docket ${docket_id} → profile ${match.profileId}`);
      console.log(`[auto-match]    Role: ${match.role}, Method: ${match.method}, Confidence: ${match.confidence}`);
      if (needsReview) {
        console.log(`[auto-match]    ⚠️ Marked for review (confidence < 0.95)`);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          matched: true,
          docket_id,
          matched_profile_id: match.profileId,
          matched_role: match.role,
          match_method: match.method,
          match_confidence: match.confidence,
          matched_alias: match.matchedAlias,
          needs_review: needsReview
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No safe match found - DO NOTHING (false negatives are acceptable)
    console.log(`[auto-match] ❌ No safe match found for docket ${docket_id}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        matched: false,
        docket_id,
        message: 'No safe match found - leaving unmatched'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[auto-match] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});