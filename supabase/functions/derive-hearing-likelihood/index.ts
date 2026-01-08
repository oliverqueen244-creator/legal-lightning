import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Derive Hearing Likelihood
 * 
 * This function derives (NOT predicts) hearing likelihood based on:
 * 1. Execution policies from NOTEs
 * 2. List type (supplementary vs main)
 * 3. Serial number position
 * 
 * IMPORTANT: This is an EXPLAINABLE derivation, not a prediction.
 * The system mirrors judicial intent, it does not decide.
 */

type HearingLikelihood = 'LIKELY' | 'CONDITIONAL' | 'LOW_PROBABILITY' | 'UNKNOWN';

interface Policy {
  id: string;
  policy_text: string;
  policy_scope: string;
  priority_rule: string;
  time_condition: string;
  confidence: number;
  court_no: string | null;
  bench: string | null;
}

interface DocketItem {
  id: string;
  court_room_no: string;
  list_type: string;
  item_no: number | null;
  raw_causelist_id: string | null;
}

interface LikelihoodResult {
  likelihood: HearingLikelihood;
  reason: string;
}

function deriveLikelihood(
  docketItem: DocketItem,
  policies: Policy[],
  totalItemsInCourt: number
): LikelihoodResult {
  // Filter policies applicable to this case
  const applicablePolicies = policies.filter(p => {
    if (p.policy_scope === 'GLOBAL') return true;
    if (p.policy_scope === 'COURT' && p.court_no === docketItem.court_room_no) return true;
    if (p.policy_scope === 'UNKNOWN') return true; // Conservative: include unknown scope
    return false;
  });

  // Default: UNKNOWN with no policies
  if (applicablePolicies.length === 0) {
    // Still derive based on list type and position
    return deriveFromPosition(docketItem, totalItemsInCourt);
  }

  // Sort by confidence (highest first)
  applicablePolicies.sort((a, b) => b.confidence - a.confidence);
  const primaryPolicy = applicablePolicies[0];

  // Derive based on policy rules
  const isSupplementary = docketItem.list_type === 'SUPPLEMENTARY';
  const itemNo = docketItem.item_no || 999;

  // Rule 1: SUPPLEMENTARY_FIRST policy
  if (primaryPolicy.priority_rule === 'SUPPLEMENTARY_FIRST') {
    if (isSupplementary) {
      return {
        likelihood: 'LIKELY',
        reason: `Per court note: supplementary list has priority. "${primaryPolicy.policy_text.substring(0, 100)}..."`
      };
    } else {
      return {
        likelihood: 'CONDITIONAL',
        reason: `Per court note: supplementary cases will be heard first. Main list cases subject to availability. "${primaryPolicy.policy_text.substring(0, 80)}..."`
      };
    }
  }

  // Rule 2: MAIN_ONLY policy
  if (primaryPolicy.priority_rule === 'MAIN_ONLY') {
    if (!isSupplementary) {
      return {
        likelihood: 'LIKELY',
        reason: `Per court note: only main list cases scheduled. "${primaryPolicy.policy_text.substring(0, 100)}..."`
      };
    } else {
      return {
        likelihood: 'LOW_PROBABILITY',
        reason: `Per court note: main list only today. Supplementary cases may not be reached. "${primaryPolicy.policy_text.substring(0, 80)}..."`
      };
    }
  }

  // Rule 3: TIME_BOUND policy
  if (primaryPolicy.priority_rule === 'TIME_BOUND') {
    return {
      likelihood: 'CONDITIONAL',
      reason: `Per court note: time-bound scheduling applies. Hearing depends on preceding matters. "${primaryPolicy.policy_text.substring(0, 80)}..."`
    };
  }

  // Rule 4: IF_TIME_PERMITS condition
  if (primaryPolicy.time_condition === 'IF_TIME_PERMITS') {
    // Late serial numbers are LOW_PROBABILITY
    const positionRatio = itemNo / Math.max(totalItemsInCourt, 1);
    if (positionRatio > 0.7) {
      return {
        likelihood: 'LOW_PROBABILITY',
        reason: `Per court note: subject to time. Item ${itemNo} of ${totalItemsInCourt} in court - hearing uncertain. "${primaryPolicy.policy_text.substring(0, 60)}..."`
      };
    } else if (positionRatio > 0.4) {
      return {
        likelihood: 'CONDITIONAL',
        reason: `Per court note: subject to time. Item ${itemNo} of ${totalItemsInCourt} - conditional on earlier matters. "${primaryPolicy.policy_text.substring(0, 60)}..."`
      };
    }
  }

  // Rule 5: FIXED_ORDER condition - position matters
  if (primaryPolicy.time_condition === 'FIXED_ORDER') {
    if (itemNo <= 5) {
      return {
        likelihood: 'LIKELY',
        reason: `Per court note: serial order followed. Item ${itemNo} in queue. "${primaryPolicy.policy_text.substring(0, 80)}..."`
      };
    } else if (itemNo <= 15) {
      return {
        likelihood: 'CONDITIONAL',
        reason: `Per court note: serial order followed. Item ${itemNo} - depends on time taken by preceding matters.`
      };
    }
  }

  // Fallback to position-based derivation
  return deriveFromPosition(docketItem, totalItemsInCourt);
}

function deriveFromPosition(
  docketItem: DocketItem,
  totalItemsInCourt: number
): LikelihoodResult {
  const itemNo = docketItem.item_no || 999;
  const isSupplementary = docketItem.list_type === 'SUPPLEMENTARY';
  
  // Early items in main list
  if (!isSupplementary && itemNo <= 10) {
    return {
      likelihood: 'LIKELY',
      reason: `Item ${itemNo} in daily list - typically reached in normal proceedings.`
    };
  }
  
  // Supplementary items without policy guidance
  if (isSupplementary) {
    return {
      likelihood: 'CONDITIONAL',
      reason: `Supplementary item ${itemNo} - listed subject to court convenience, no policy guidance available.`
    };
  }
  
  // Late items in main list
  if (itemNo > 30) {
    return {
      likelihood: 'LOW_PROBABILITY',
      reason: `Item ${itemNo} of ${totalItemsInCourt} - hearing uncertain given position in list.`
    };
  }
  
  // Default
  return {
    likelihood: 'UNKNOWN',
    reason: 'No execution policy found for this case. Hearing subject to court proceedings.'
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[DERIVE-LIKELIHOOD] Function started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { causelist_id, date, bench } = body;

    if (!causelist_id && !date) {
      throw new Error('Either causelist_id or date is required');
    }

    console.log(`[DERIVE-LIKELIHOOD] Processing: causelist=${causelist_id}, date=${date}, bench=${bench}`);

    // Get all applicable execution policies
    let policiesQuery = supabase
      .from('daily_execution_policies')
      .select('*');
    
    if (causelist_id) {
      policiesQuery = policiesQuery.eq('raw_causelist_id', causelist_id);
    }

    const { data: policies, error: policiesError } = await policiesQuery;

    if (policiesError) {
      console.error('[DERIVE-LIKELIHOOD] Failed to fetch policies:', policiesError);
    }

    console.log(`[DERIVE-LIKELIHOOD] Found ${policies?.length || 0} execution policies`);

    // Get docket items to update - paginate to handle >1000 items
    const allDocketItems: DocketItem[] = [];
    let offset = 0;
    const PAGE_SIZE = 1000;
    
    while (true) {
      let docketQuery = supabase
        .from('daily_court_docket')
        .select('id, court_room_no, list_type, item_no, raw_causelist_id')
        .range(offset, offset + PAGE_SIZE - 1);
      
      if (causelist_id) {
        docketQuery = docketQuery.eq('raw_causelist_id', causelist_id);
      } else if (date) {
        docketQuery = docketQuery.eq('date', date);
        if (bench) {
          docketQuery = docketQuery.eq('court_location', bench);
        }
      }

      const { data: docketItems, error: docketError } = await docketQuery;

      if (docketError) {
        throw new Error(`Failed to fetch docket items: ${docketError.message}`);
      }

      if (!docketItems || docketItems.length === 0) break;
      
      allDocketItems.push(...docketItems);
      console.log(`[DERIVE-LIKELIHOOD] Fetched ${docketItems.length} items (total: ${allDocketItems.length})`);
      
      if (docketItems.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    console.log(`[DERIVE-LIKELIHOOD] Processing ${allDocketItems.length} docket items`);

    if (allDocketItems.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        items_processed: 0,
        message: 'No docket items found to process'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate total items per court for position-based logic
    const itemsPerCourt: Record<string, number> = {};
    for (const item of allDocketItems) {
      const courtKey = item.court_room_no || 'UNKNOWN';
      itemsPerCourt[courtKey] = (itemsPerCourt[courtKey] || 0) + 1;
    }

    // Process each docket item
    let updatedCount = 0;
    const errors: string[] = [];

    // Batch updates for efficiency
    const BATCH_SIZE = 50;
    for (let i = 0; i < allDocketItems.length; i += BATCH_SIZE) {
      const batch = allDocketItems.slice(i, i + BATCH_SIZE);
      
      const updates = batch.map((item: DocketItem) => {
        const totalInCourt = itemsPerCourt[item.court_room_no || 'UNKNOWN'] || 0;
        const result = deriveLikelihood(item, policies || [], totalInCourt);
        
        return {
          id: item.id,
          hearing_likelihood: result.likelihood,
          likelihood_reason: result.reason,
          likelihood_derived_at: new Date().toISOString()
        };
      });

      // Update in parallel within batch
      const updatePromises = updates.map((update: { id: string; hearing_likelihood: string; likelihood_reason: string; likelihood_derived_at: string }) =>
        supabase
          .from('daily_court_docket')
          .update({
            hearing_likelihood: update.hearing_likelihood,
            likelihood_reason: update.likelihood_reason,
            likelihood_derived_at: update.likelihood_derived_at
          })
          .eq('id', update.id)
      );

      const results = await Promise.allSettled(updatePromises);
      
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled' && !result.value.error) {
          updatedCount++;
        } else if (result.status === 'rejected' || result.value.error) {
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          errors.push(`${batch[j].id}: ${error?.message || 'Unknown error'}`);
        }
      }
    }

    console.log(`[DERIVE-LIKELIHOOD] Complete: ${updatedCount} updated, ${errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      items_processed: allDocketItems.length,
      items_updated: updatedCount,
      policies_applied: policies?.length || 0,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DERIVE-LIKELIHOOD] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
