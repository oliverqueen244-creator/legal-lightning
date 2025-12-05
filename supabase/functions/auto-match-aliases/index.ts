import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trigger-secret',
};

interface RequestPayload {
  docket_id: string;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
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
      console.error('[auto-match-aliases] Unauthorized: Invalid or missing trigger secret');
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

    console.log(`[auto-match-aliases] Processing docket ${docket_id}`);
    console.log(`[auto-match-aliases] Petitioner: ${petitioner_lawyer}, Respondent: ${respondent_lawyer}`);

    if (!docket_id) {
      return new Response(
        JSON.stringify({ error: 'Missing docket_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all lawyer aliases
    const { data: aliases, error: aliasError } = await supabase
      .from('lawyer_aliases')
      .select('id, profile_id, alias_name, is_primary');

    if (aliasError) {
      console.error('[auto-match-aliases] Error fetching aliases:', aliasError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch aliases', details: aliasError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-match-aliases] Found ${aliases?.length || 0} aliases to check`);

    let matchedProfileId: string | null = null;
    let matchedAs: 'petitioner' | 'respondent' | null = null;
    let matchedAlias: string | null = null;

    // Check each alias against both petitioner and respondent lawyer names
    for (const alias of aliases || []) {
      const aliasLower = alias.alias_name.toLowerCase().trim();
      
      // Check petitioner lawyer
      if (petitioner_lawyer) {
        const petitionerLower = petitioner_lawyer.toLowerCase().trim();
        if (petitionerLower.includes(aliasLower) || aliasLower.includes(petitionerLower)) {
          matchedProfileId = alias.profile_id;
          matchedAs = 'petitioner';
          matchedAlias = alias.alias_name;
          console.log(`[auto-match-aliases] Matched as petitioner via alias: ${alias.alias_name}`);
          break;
        }
      }
      
      // Check respondent lawyer
      if (respondent_lawyer) {
        const respondentLower = respondent_lawyer.toLowerCase().trim();
        if (respondentLower.includes(aliasLower) || aliasLower.includes(respondentLower)) {
          matchedProfileId = alias.profile_id;
          matchedAs = 'respondent';
          matchedAlias = alias.alias_name;
          console.log(`[auto-match-aliases] Matched as respondent via alias: ${alias.alias_name}`);
          break;
        }
      }
    }

    // Update the docket entry if we found a match
    if (matchedProfileId) {
      const { error: updateError } = await supabase
        .from('daily_court_docket')
        .update({ matched_profile_id: matchedProfileId })
        .eq('id', docket_id);

      if (updateError) {
        console.error('[auto-match-aliases] Error updating docket:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update docket', details: updateError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[auto-match-aliases] Successfully matched docket ${docket_id} to profile ${matchedProfileId}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          matched: true,
          docket_id,
          matched_profile_id: matchedProfileId,
          matched_as: matchedAs,
          matched_alias: matchedAlias
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-match-aliases] No match found for docket ${docket_id}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        matched: false,
        docket_id,
        message: 'No matching alias found'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[auto-match-aliases] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
