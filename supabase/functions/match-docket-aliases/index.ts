import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchRequest {
  causelist_id?: string;
  date?: string;
  bench?: string;
}

interface MatchResult {
  docket_id: string;
  case_number: string;
  matched_profile_id: string;
  matched_alias: string;
  matched_as: 'petitioner' | 'respondent';
  confidence: number;
}

// Normalize lawyer name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

// Check if alias matches within lawyer text (fuzzy but conservative)
function isAliasMatch(lawyerText: string, alias: string): { matched: boolean; confidence: number } {
  const normalizedLawyer = normalizeName(lawyerText);
  const normalizedAlias = normalizeName(alias);
  
  // Skip very short aliases
  if (normalizedAlias.length < 4) {
    return { matched: false, confidence: 0 };
  }
  
  // Exact match
  if (normalizedLawyer === normalizedAlias) {
    return { matched: true, confidence: 0.95 };
  }
  
  // Contains full alias (as a complete word/phrase)
  const aliasWords = normalizedAlias.split(' ');
  const lawyerWords = normalizedLawyer.split(' ');
  
  // Check if all alias words appear in order
  let matchIndex = 0;
  for (const word of lawyerWords) {
    if (matchIndex < aliasWords.length && word === aliasWords[matchIndex]) {
      matchIndex++;
    }
  }
  
  if (matchIndex === aliasWords.length) {
    // All alias words found in order
    return { matched: true, confidence: 0.85 };
  }
  
  // Check if lawyer text contains alias as substring
  if (normalizedLawyer.includes(normalizedAlias)) {
    return { matched: true, confidence: 0.75 };
  }
  
  return { matched: false, confidence: 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: MatchRequest = await req.json().catch(() => ({}));
    
    console.log(`[MATCH-DOCKET-ALIASES] Starting post-processing match`, body);

    // Get all profiles with aliases
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('onboarding_completed', true);

    if (profilesError || !profiles?.length) {
      console.log('[MATCH-DOCKET-ALIASES] No profiles to match');
      return new Response(
        JSON.stringify({ success: true, matches: 0, message: 'No profiles to match' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query for unmatched cases
    let docketQuery = supabase
      .from('daily_court_docket')
      .select('id, case_number, petitioner_lawyer, respondent_lawyer, court_location, court_room_no, date')
      .is('matched_profile_id', null)
      .or('petitioner_lawyer.not.is.null,respondent_lawyer.not.is.null')
      .limit(500);

    if (body.causelist_id) {
      docketQuery = docketQuery.eq('raw_causelist_id', body.causelist_id);
    }
    if (body.date) {
      docketQuery = docketQuery.eq('date', body.date);
    }
    if (body.bench) {
      docketQuery = docketQuery.eq('court_location', body.bench);
    }

    const { data: unmatchedCases, error: docketError } = await docketQuery;

    if (docketError) {
      console.error('[MATCH-DOCKET-ALIASES] Failed to fetch unmatched cases:', docketError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch cases' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!unmatchedCases?.length) {
      console.log('[MATCH-DOCKET-ALIASES] No unmatched cases to process');
      return new Response(
        JSON.stringify({ success: true, matches: 0, message: 'No unmatched cases' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MATCH-DOCKET-ALIASES] Processing ${unmatchedCases.length} unmatched cases against ${profiles.length} profiles`);

    const matches: MatchResult[] = [];
    let updatedCount = 0;

    for (const caseData of unmatchedCases) {
      const petLawyer = caseData.petitioner_lawyer || '';
      const respLawyer = caseData.respondent_lawyer || '';
      
      let bestMatch: { profileId: string; alias: string; role: 'petitioner' | 'respondent'; confidence: number } | null = null;

      for (const profile of profiles) {
        // Get profile's aliases
        const { data: aliases } = await supabase
          .from('lawyer_aliases')
          .select('alias_name')
          .eq('profile_id', profile.id);

        if (!aliases?.length) continue;

        for (const { alias_name } of aliases) {
          // Check petitioner lawyer
          if (petLawyer) {
            const petMatch = isAliasMatch(petLawyer, alias_name);
            if (petMatch.matched && (!bestMatch || petMatch.confidence > bestMatch.confidence)) {
              bestMatch = {
                profileId: profile.id,
                alias: alias_name,
                role: 'petitioner',
                confidence: petMatch.confidence
              };
            }
          }

          // Check respondent lawyer
          if (respLawyer) {
            const respMatch = isAliasMatch(respLawyer, alias_name);
            if (respMatch.matched && (!bestMatch || respMatch.confidence > bestMatch.confidence)) {
              bestMatch = {
                profileId: profile.id,
                alias: alias_name,
                role: 'respondent',
                confidence: respMatch.confidence
              };
            }
          }
        }
      }

      // Apply best match if found
      if (bestMatch) {
        const { error: updateError } = await supabase
          .from('daily_court_docket')
          .update({
            matched_profile_id: bestMatch.profileId,
            matched_role: bestMatch.role,
            match_method: 'post_process_alias',
            match_confidence: bestMatch.confidence,
          })
          .eq('id', caseData.id);

        if (!updateError) {
          updatedCount++;
          matches.push({
            docket_id: caseData.id,
            case_number: caseData.case_number,
            matched_profile_id: bestMatch.profileId,
            matched_alias: bestMatch.alias,
            matched_as: bestMatch.role,
            confidence: bestMatch.confidence,
          });
          console.log(`[MATCH-DOCKET-ALIASES] Matched ${caseData.case_number} to profile ${bestMatch.profileId} via "${bestMatch.alias}" (${bestMatch.confidence})`);
        }
      }
    }

    console.log(`[MATCH-DOCKET-ALIASES] Complete: ${updatedCount} cases matched out of ${unmatchedCases.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        cases_processed: unmatchedCases.length,
        matches_made: updatedCount,
        matches: matches.slice(0, 50), // Return first 50 for debugging
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[MATCH-DOCKET-ALIASES] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
