import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchRequest {
  causelist_id?: string;
  date?: string;
  bench?: string;
  debug_sample?: number; // If set, log debug info for first N cases
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

// Split lawyer field by common delimiters to get individual lawyer names
function splitLawyerNames(lawyerText: string): string[] {
  // Split by comma, semicolon, or " AND " / " & "
  return lawyerText
    .split(/[,;]|\s+AND\s+|\s+&\s+/i)
    .map(name => name.trim())
    .filter(name => name.length > 2);
}

// Check if a single lawyer name matches the alias
// INSTRUMENTED for Phase 2 debugging
function matchSingleLawyer(
  lawyerName: string, 
  alias: string, 
  debug: boolean = false
): { matched: boolean; confidence: number; debugInfo?: any } {
  const normalizedLawyer = normalizeName(lawyerName);
  const normalizedAlias = normalizeName(alias);
  
  const debugInfo: any = debug ? {
    rawLawyer: lawyerName,
    rawAlias: alias,
    normalizedLawyer,
    normalizedAlias,
    checks: [],
  } : undefined;
  
  // Skip very short aliases
  if (normalizedAlias.length < 4) {
    if (debug) debugInfo.rejected = 'alias_too_short';
    return { matched: false, confidence: 0, debugInfo };
  }
  
  // Exact match
  if (normalizedLawyer === normalizedAlias) {
    if (debug) debugInfo.matchType = 'exact';
    return { matched: true, confidence: 0.95, debugInfo };
  }
  
  const aliasWords = normalizedAlias.split(' ').filter(w => w.length > 0);
  const lawyerWords = normalizedLawyer.split(' ').filter(w => w.length > 0);
  
  if (debug) {
    debugInfo.aliasTokens = aliasWords;
    debugInfo.lawyerTokens = lawyerWords;
  }
  
  // CRITICAL: First name must match exactly
  // This prevents "BRAJESH PUROHIT" from matching alias "Ramesh Purohit"
  const aliasFirstName = aliasWords[0];
  const hasFirstNameMatch = lawyerWords.some(word => word === aliasFirstName);
  
  if (!hasFirstNameMatch) {
    if (debug) debugInfo.rejected = `first_name_mismatch: alias_first="${aliasFirstName}" not in lawyer tokens`;
    return { matched: false, confidence: 0, debugInfo };
  }
  
  if (debug) debugInfo.firstNameMatched = true;
  
  // Check if all alias words appear consecutively in the lawyer name
  // This is stricter than "in order anywhere"
  for (let startIdx = 0; startIdx <= lawyerWords.length - aliasWords.length; startIdx++) {
    let consecutiveMatch = true;
    const comparisons: string[] = [];
    
    for (let i = 0; i < aliasWords.length; i++) {
      const lawyerWord = lawyerWords[startIdx + i];
      const aliasWord = aliasWords[i];
      const matches = lawyerWord === aliasWord;
      
      if (debug) {
        comparisons.push(`${lawyerWord}==${aliasWord}?${matches}`);
      }
      
      if (!matches) {
        consecutiveMatch = false;
        break;
      }
    }
    
    if (debug) {
      debugInfo.checks.push({ startIdx, comparisons, consecutiveMatch });
    }
    
    if (consecutiveMatch) {
      if (debug) debugInfo.matchType = 'consecutive_tokens';
      return { matched: true, confidence: 0.95, debugInfo };
    }
  }
  
  // Fallback: All alias words found (not necessarily consecutive)
  // but first name MUST match (already verified above)
  const allWordsFound = aliasWords.every(aliasWord => 
    lawyerWords.some(lawyerWord => lawyerWord === aliasWord)
  );
  
  if (allWordsFound) {
    if (debug) debugInfo.matchType = 'all_words_found';
    return { matched: true, confidence: 0.85, debugInfo };
  }
  
  // Check if lawyer name contains alias as substring (e.g., "Adv. Ramesh Purohit")
  if (normalizedLawyer.includes(normalizedAlias)) {
    if (debug) debugInfo.matchType = 'substring';
    return { matched: true, confidence: 0.80, debugInfo };
  }
  
  if (debug) debugInfo.rejected = 'no_match_found';
  return { matched: false, confidence: 0, debugInfo };
}

// Check if alias matches within lawyer text (splits by comma first)
function isAliasMatch(lawyerText: string, alias: string): { matched: boolean; confidence: number } {
  // Split the lawyer field into individual names
  const individualLawyers = splitLawyerNames(lawyerText);
  
  let bestMatch = { matched: false, confidence: 0 };
  
  for (const lawyerName of individualLawyers) {
    const result = matchSingleLawyer(lawyerName, alias);
    if (result.matched && result.confidence > bestMatch.confidence) {
      bestMatch = result;
    }
  }
  
  return bestMatch;
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

    // Fetch ALL unmatched cases using pagination
    const BATCH_SIZE = 1000;
    let allUnmatchedCases: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let docketQuery = supabase
        .from('daily_court_docket')
        .select('id, case_number, petitioner_lawyer, respondent_lawyer, court_location, court_room_no, date')
        .is('matched_profile_id', null)
        .or('petitioner_lawyer.not.is.null,respondent_lawyer.not.is.null')
        .range(offset, offset + BATCH_SIZE - 1);

      if (body.causelist_id) {
        docketQuery = docketQuery.eq('raw_causelist_id', body.causelist_id);
      }
      if (body.date) {
        docketQuery = docketQuery.eq('date', body.date);
      }
      if (body.bench) {
        docketQuery = docketQuery.eq('court_location', body.bench);
      }

      const { data: batch, error: docketError } = await docketQuery;

      if (docketError) {
        console.error('[MATCH-DOCKET-ALIASES] Failed to fetch unmatched cases:', docketError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch cases' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (batch && batch.length > 0) {
        allUnmatchedCases = allUnmatchedCases.concat(batch);
        console.log(`[MATCH-DOCKET-ALIASES] Fetched ${batch.length} cases (total: ${allUnmatchedCases.length})`);
        offset += BATCH_SIZE;
        hasMore = batch.length === BATCH_SIZE;
      } else {
        hasMore = false;
      }
    }

    if (!allUnmatchedCases.length) {
      console.log('[MATCH-DOCKET-ALIASES] No unmatched cases to process');
      return new Response(
        JSON.stringify({ success: true, matches: 0, message: 'No unmatched cases' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pre-fetch all aliases for all profiles once (optimization)
    const { data: allAliases } = await supabase
      .from('lawyer_aliases')
      .select('profile_id, alias_name')
      .in('profile_id', profiles.map(p => p.id));

    const aliasesByProfile = new Map<string, string[]>();
    for (const alias of (allAliases || [])) {
      if (!aliasesByProfile.has(alias.profile_id)) {
        aliasesByProfile.set(alias.profile_id, []);
      }
      aliasesByProfile.get(alias.profile_id)!.push(alias.alias_name);
    }

    console.log(`[MATCH-DOCKET-ALIASES] Processing ${allUnmatchedCases.length} unmatched cases against ${profiles.length} profiles (${allAliases?.length || 0} aliases)`);

    // For debug logging
    const debugSample = body.debug_sample || 0;
    const debugLogs: any[] = [];

    const matches: MatchResult[] = [];
    let updatedCount = 0;
    let caseIndex = 0;

    for (const caseData of allUnmatchedCases) {
      caseIndex++;
      const isDebugCase = caseIndex <= debugSample;
      const petLawyer = caseData.petitioner_lawyer || '';
      const respLawyer = caseData.respondent_lawyer || '';
      
      let bestMatch: { profileId: string; alias: string; role: 'petitioner' | 'respondent'; confidence: number } | null = null;
      const caseDebugInfo: any = isDebugCase ? {
        caseNumber: caseData.case_number,
        petitionerLawyer: petLawyer,
        respondentLawyer: respLawyer,
        aliasComparisons: [],
      } : null;

      for (const profile of profiles) {
        // Use pre-fetched aliases instead of querying each time
        const aliases = aliasesByProfile.get(profile.id) || [];
        if (!aliases.length) continue;

        for (const alias_name of aliases) {
          // Check petitioner lawyer
          if (petLawyer) {
            const individualLawyers = splitLawyerNames(petLawyer);
            for (const lawyerName of individualLawyers) {
              const result = matchSingleLawyer(lawyerName, alias_name, isDebugCase);
              
              if (isDebugCase && result.debugInfo) {
                caseDebugInfo.aliasComparisons.push({
                  side: 'petitioner',
                  ...result.debugInfo,
                });
              }
              
              if (result.matched && (!bestMatch || result.confidence > bestMatch.confidence)) {
                bestMatch = {
                  profileId: profile.id,
                  alias: alias_name,
                  role: 'petitioner',
                  confidence: result.confidence
                };
              }
            }
          }

          // Check respondent lawyer
          if (respLawyer) {
            const individualLawyers = splitLawyerNames(respLawyer);
            for (const lawyerName of individualLawyers) {
              const result = matchSingleLawyer(lawyerName, alias_name, isDebugCase);
              
              if (isDebugCase && result.debugInfo) {
                caseDebugInfo.aliasComparisons.push({
                  side: 'respondent',
                  ...result.debugInfo,
                });
              }
              
              if (result.matched && (!bestMatch || result.confidence > bestMatch.confidence)) {
                bestMatch = {
                  profileId: profile.id,
                  alias: alias_name,
                  role: 'respondent',
                  confidence: result.confidence
                };
              }
            }
          }
        }
      }
      
      if (isDebugCase) {
        caseDebugInfo.matchFound = !!bestMatch;
        if (bestMatch) {
          caseDebugInfo.matchedAlias = bestMatch.alias;
          caseDebugInfo.matchedRole = bestMatch.role;
          caseDebugInfo.confidence = bestMatch.confidence;
        }
        debugLogs.push(caseDebugInfo);
      }

      // Apply best match if found
      if (bestMatch) {
        // SAFETY: Only update if still unmatched (idempotent)
        const { error: updateError } = await supabase
          .from('daily_court_docket')
          .update({
            matched_profile_id: bestMatch.profileId,
            matched_role: bestMatch.role,
            match_method: 'alias_exact',
            match_confidence: bestMatch.confidence,
          })
          .eq('id', caseData.id)
          .is('matched_profile_id', null); // CRITICAL: Never overwrite existing match

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

    console.log(`[MATCH-DOCKET-ALIASES] Complete: ${updatedCount} cases matched out of ${allUnmatchedCases.length}`);

    // Mandatory metrics output
    const metricsTable = {
      total_unmatched_cases_processed: allUnmatchedCases.length,
      total_aliases: allAliases?.length || 0,
      total_matches_created: updatedCount,
      percent_matched: allUnmatchedCases.length > 0 
        ? `${((updatedCount / allUnmatchedCases.length) * 100).toFixed(2)}%`
        : '0%',
    };
    console.log(`[MATCH-DOCKET-ALIASES] METRICS:`, JSON.stringify(metricsTable));

    return new Response(
      JSON.stringify({
        success: true,
        metrics: metricsTable,
        matches: matches.slice(0, 50), // Return first 50 for debugging
        debug_logs: debugLogs.slice(0, 10), // First 10 debug samples
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
