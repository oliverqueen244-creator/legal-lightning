import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
// Legal role labels to ignore during matching
const IGNORED_ROLE_LABELS = new Set([
  'aag', 'pp', 'asg', 'ga', 'app', 'advocate general', 'add ga', 'add aag',
  'add. g.a.', 'add g c', 'g c', 'gc', 'in person', 'p.p.', 'a.a.g.'
]);

interface RequestPayload {
  profile_id: string;
  alias_name: string;
  alias_id: string;
}

/**
 * Normalize names for comparison
 */
function normalize(text: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,()\/\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function isIgnoredLabel(token: string): boolean {
  return IGNORED_ROLE_LABELS.has(token.toLowerCase().trim());
}

/**
 * Exact word-boundary match
 */
function exactWordBoundaryMatch(normalizedLawyerField: string, normalizedAlias: string): boolean {
  const paddedField = ` ${normalizedLawyerField} `;
  const paddedAlias = ` ${normalizedAlias} `;
  return paddedField.includes(paddedAlias);
}

/**
 * Calculate Jaro-Winkler similarity
 */
function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

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

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Fuzzy match for multi-word aliases
 */
function fuzzyMatch(normalizedLawyerField: string, normalizedAlias: string): number {
  if (wordCount(normalizedAlias) < 2) return 0;

  const segments = normalizedLawyerField.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
  
  let maxSimilarity = 0;
  
  for (const segment of segments) {
    if (isIgnoredLabel(segment)) continue;
    const similarity = jaroWinklerSimilarity(segment, normalizedAlias);
    if (similarity > maxSimilarity) maxSimilarity = similarity;
  }

  const fullSimilarity = jaroWinklerSimilarity(normalizedLawyerField, normalizedAlias);
  if (fullSimilarity > maxSimilarity) maxSimilarity = fullSimilarity;

  return maxSimilarity;
}

const MAX_LAWYER_FIELD_LENGTH = 500;

function matchesAlias(
  lawyerField: string | null,
  normalizedAlias: string
): { matched: boolean; method: 'exact' | 'fuzzy'; confidence: number } {
  if (!lawyerField) return { matched: false, method: 'exact', confidence: 0 };
  
  let sanitizedField = lawyerField;
  if (sanitizedField.length > MAX_LAWYER_FIELD_LENGTH) {
    sanitizedField = sanitizedField.substring(0, MAX_LAWYER_FIELD_LENGTH);
  }
  
  const normalizedField = normalize(sanitizedField);
  if (!normalizedField || normalizedField.length > 400) {
    return { matched: false, method: 'exact', confidence: 0 };
  }

  if (isIgnoredLabel(normalizedField)) {
    return { matched: false, method: 'exact', confidence: 0 };
  }

  // Skip very short aliases
  if (normalizedAlias.length < 3) {
    return { matched: false, method: 'exact', confidence: 0 };
  }

  // Try exact match first
  if (exactWordBoundaryMatch(normalizedField, normalizedAlias)) {
    return { matched: true, method: 'exact', confidence: 1.0 };
  }

  // Try fuzzy match for multi-word aliases
  if (wordCount(normalizedAlias) >= 2) {
    const similarity = fuzzyMatch(normalizedField, normalizedAlias);
    if (similarity >= 0.92) {
      return { matched: true, method: 'fuzzy', confidence: similarity };
    }
  }

  return { matched: false, method: 'exact', confidence: 0 };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate trigger secret
    const triggerSecret = req.headers.get('x-trigger-secret');
    const expectedSecret = Deno.env.get('TRIGGER_SECRET');
    
    if (!expectedSecret || triggerSecret !== expectedSecret) {
      console.error('[backfill-alias] Unauthorized: Invalid or missing trigger secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: RequestPayload = await req.json();
    const { profile_id, alias_name, alias_id } = payload;

    console.log(`[backfill-alias] Processing new alias: "${alias_name}" for profile ${profile_id}`);

    if (!profile_id || !alias_name) {
      return new Response(
        JSON.stringify({ error: 'Missing profile_id or alias_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedAlias = normalize(alias_name);
    if (!normalizedAlias || normalizedAlias.length < 3) {
      console.log(`[backfill-alias] Alias too short after normalization, skipping`);
      return new Response(
        JSON.stringify({ success: true, matched_count: 0, reason: 'Alias too short' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query unmatched cases from last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const fromDate = ninetyDaysAgo.toISOString().split('T')[0];

    const { data: unmatchedCases, error: queryError } = await supabase
      .from('daily_court_docket')
      .select('id, petitioner_lawyer, respondent_lawyer, date')
      .is('matched_profile_id', null)
      .gte('date', fromDate)
      .order('date', { ascending: false })
      .limit(500); // Query more, but match fewer

    if (queryError) {
      console.error('[backfill-alias] Error fetching unmatched cases:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch cases', details: queryError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[backfill-alias] Found ${unmatchedCases?.length || 0} unmatched cases to scan`);

    const matches: { id: string; role: string; method: string; confidence: number }[] = [];
    const MAX_MATCHES = 100;

    for (const docket of (unmatchedCases || [])) {
      if (matches.length >= MAX_MATCHES) break;

      // Try petitioner
      const petMatch = matchesAlias(docket.petitioner_lawyer, normalizedAlias);
      if (petMatch.matched) {
        matches.push({
          id: docket.id,
          role: 'petitioner',
          method: petMatch.method,
          confidence: petMatch.confidence
        });
        continue;
      }

      // Try respondent
      const resMatch = matchesAlias(docket.respondent_lawyer, normalizedAlias);
      if (resMatch.matched) {
        matches.push({
          id: docket.id,
          role: 'respondent',
          method: resMatch.method,
          confidence: resMatch.confidence
        });
      }
    }

    console.log(`[backfill-alias] Found ${matches.length} matches for alias "${alias_name}"`);

    // Batch update all matches
    let successCount = 0;
    for (const match of matches) {
      const needsReview = match.confidence < 0.95;
      
      const { error: updateError } = await supabase
        .from('daily_court_docket')
        .update({
          matched_profile_id: profile_id,
          matched_role: match.role,
          match_method: match.method,
          match_confidence: match.confidence,
          needs_review: needsReview
        })
        .eq('id', match.id)
        .is('matched_profile_id', null); // Double-check still unmatched

      if (!updateError) {
        successCount++;
      } else {
        console.warn(`[backfill-alias] Failed to update docket ${match.id}:`, updateError);
      }
    }

    console.log(`[backfill-alias] ✅ Successfully matched ${successCount} cases for alias "${alias_name}"`);

    return new Response(
      JSON.stringify({
        success: true,
        alias_name,
        profile_id,
        scanned_count: unmatchedCases?.length || 0,
        matched_count: successCount,
        matches: matches.slice(0, 10) // Return first 10 for debugging
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[backfill-alias] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
