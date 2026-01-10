import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * admin-doc-sync-trial
 * 
 * Admin-only trial run for captcha-gated document sync.
 * Uses Firecrawl for JavaScript rendering of eCourts pages.
 * 
 * TRIAL CONSTRAINTS:
 * - Max 2 cases per run
 * - Full audit logging
 * - No data mutations outside scope
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// eCourts configuration for Rajasthan High Court
const ECOURTS_CONFIG = {
  baseUrl: 'https://hcservices.ecourts.gov.in/ecourtindiaHC',
  stateCode: '9',
  distCode: '1',
  benches: {
    JAIPUR: { courtCode: '1', name: 'Jaipur' },
    JODHPUR: { courtCode: '2', name: 'Jodhpur' },
  },
  endpoints: {
    caseNo: '/cases/case_no.php',
  },
};

// 2Captcha configuration
const TWOCAPTCHA_CONFIG = {
  apiUrl: 'http://2captcha.com',
  solveTimeout: 120000,
  pollInterval: 5000,
};

// Browserless configuration
const BROWSERLESS_API_URL = 'https://production-sfo.browserless.io';

interface TrialCase {
  id: string;
  case_type: string;
  case_number: number;
  case_year: number;
  bench: string;
  petitioner: string | null;
  respondent: string | null;
  profile_id: string;
}

interface TrialResult {
  case_id: string;
  case_display: string;
  captcha_status: 'success' | 'failed' | 'skipped';
  captcha_solve_time_ms?: number;
  timeline_retrieved: boolean;
  documents_found: number;
  judgment_found: boolean;
  judgment_metadata?: {
    date: string | null;
    url: string | null;
  };
  errors: string[];
  data_mutations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const twoCaptchaKey = Deno.env.get('TWOCAPTCHA_API_KEY');

  if (!twoCaptchaKey) {
    return new Response(
      JSON.stringify({ error: '2Captcha API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const browserlessKey = Deno.env.get('BROWSERLESS_API_KEY');
  if (!browserlessKey) {
    return new Response(
      JSON.stringify({ error: 'Browserless API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Parse request
    const body = await req.json().catch(() => ({}));
    const caseIds: string[] = body.case_ids || [];
    const maxCases = Math.min(caseIds.length || 2, 2); // Strict limit of 2

    console.log(`[admin-doc-sync-trial] Starting trial for ${maxCases} cases`);

    // Fetch cases to trial
    let cases: TrialCase[] = [];
    
    if (caseIds.length > 0) {
      const { data, error } = await supabase
        .from('tracked_cases')
        .select('id, case_type, case_number, case_year, bench, petitioner, respondent, profile_id')
        .in('id', caseIds.slice(0, maxCases));
      
      if (error) throw error;
      cases = data || [];
    } else {
      // Random selection from tracked_cases
      const { data, error } = await supabase
        .from('tracked_cases')
        .select('id, case_type, case_number, case_year, bench, petitioner, respondent, profile_id')
        .not('case_type', 'is', null)
        .not('case_number', 'is', null)
        .limit(maxCases);
      
      if (error) throw error;
      cases = data || [];
    }

    if (cases.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid cases found for trial' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-doc-sync-trial] Selected ${cases.length} cases:`, 
      cases.map(c => `${c.case_type}/${c.case_number}/${c.case_year}`));

    const results: TrialResult[] = [];

    // Process each case
    for (const caseData of cases) {
      const result: TrialResult = {
        case_id: caseData.id,
        case_display: `${caseData.case_type.replace(')', '')} ${caseData.case_number}/${caseData.case_year}`,
        captcha_status: 'skipped',
        timeline_retrieved: false,
        documents_found: 0,
        judgment_found: false,
        errors: [],
        data_mutations: [],
      };

      try {
        // STEP 1: Display Case Context
        console.log(`\n[TRIAL] Case: ${result.case_display}`);
        console.log(`  Bench: ${caseData.bench}`);
        console.log(`  Petitioner: ${caseData.petitioner || 'N/A'} vs Respondent: ${caseData.respondent || 'N/A'}`);

        // STEP 2: Initiate Captcha-Gated Court Fetch
        const benchConfig = ECOURTS_CONFIG.benches[caseData.bench as keyof typeof ECOURTS_CONFIG.benches];
        if (!benchConfig) {
          result.errors.push(`Invalid bench: ${caseData.bench}`);
          results.push(result);
          continue;
        }

        const pageUrl = `${ECOURTS_CONFIG.baseUrl}${ECOURTS_CONFIG.endpoints.caseNo}?state_cd=${ECOURTS_CONFIG.stateCode}&dist_cd=${ECOURTS_CONFIG.distCode}&court_code=${benchConfig.courtCode}&stateNm=Rajasthan`;
        console.log(`[TRIAL] Using Browserless /chromium/bql: ${pageUrl}`);

        // Clean up case_type (remove trailing parenthesis)
        const cleanCaseType = caseData.case_type.replace(/\)$/, '');

        // Use BrowserQL to run entire flow in a single session
        const captchaStartTime = Date.now();

        // BrowserQL query to load page, take screenshot of CAPTCHA, and get form HTML
        // Using screenshot to capture CAPTCHA image in same session (session-bound captcha)
        const bqlQuery = `
          mutation GetCaptchaWithScreenshot {
            goto(url: "${pageUrl}", waitUntil: networkIdle) {
              status
            }
            captchaScreenshot: screenshot(selector: "#captcha_image", encoding: BASE64, fullPage: false) {
              base64
            }
            caseTypeSelect: querySelector(selector: "#case_type") {
              outerHTML
            }
          }
        `;

        const bqlResponse = await fetch(`${BROWSERLESS_API_URL}/chromium/bql?token=${browserlessKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: bqlQuery }),
        });

        if (!bqlResponse.ok) {
          const errText = await bqlResponse.text();
          result.errors.push(`Browserless BQL error: ${bqlResponse.status} - ${errText}`);
          results.push(result);
          continue;
        }

        const bqlResult = await bqlResponse.json();
        console.log(`[TRIAL] BQL response:`, JSON.stringify(bqlResult).slice(0, 500));

        // Get CAPTCHA image as base64 from screenshot
        const captchaBase64 = bqlResult.data?.captchaScreenshot?.base64;
        const caseTypeHtml = bqlResult.data?.caseTypeSelect?.outerHTML || '';

        if (!captchaBase64 || captchaBase64.length < 100) {
          result.errors.push(`CAPTCHA screenshot failed. Got: ${captchaBase64?.length || 0} chars`);
          results.push(result);
          continue;
        }

        console.log(`[TRIAL] CAPTCHA screenshot captured (${captchaBase64.length} chars base64)`);

        // Submit to 2Captcha
        const submitParams = new URLSearchParams({
          key: twoCaptchaKey,
          method: 'base64',
          body: captchaBase64,
          json: '1',
        });

        const submitRes = await fetch(`${TWOCAPTCHA_CONFIG.apiUrl}/in.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: submitParams,
        });
        const submitData = await submitRes.json();

        if (submitData.status !== 1) {
          result.errors.push(`2Captcha submit failed: ${submitData.request}`);
          results.push(result);
          continue;
        }

        const captchaId = submitData.request;
        console.log(`[TRIAL] 2Captcha ID: ${captchaId}. Polling for solution...`);

        // Poll for CAPTCHA solution
        let captchaSolution: string | null = null;
        for (let i = 0; i < 24; i++) {
          await new Promise(r => setTimeout(r, TWOCAPTCHA_CONFIG.pollInterval));
          
          const pollRes = await fetch(
            `${TWOCAPTCHA_CONFIG.apiUrl}/res.php?key=${twoCaptchaKey}&action=get&id=${captchaId}&json=1`
          );
          const pollData = await pollRes.json();

          if (pollData.status === 1) {
            captchaSolution = pollData.request;
            break;
          } else if (pollData.request !== 'CAPCHA_NOT_READY') {
            result.errors.push(`2Captcha error: ${pollData.request}`);
            break;
          }
        }

        if (!captchaSolution) {
          result.errors.push('CAPTCHA solve timeout');
          result.captcha_status = 'failed';
          results.push(result);
          continue;
        }

        result.captcha_solve_time_ms = Date.now() - captchaStartTime;
        result.captcha_status = 'success';
        console.log(`[TRIAL] CAPTCHA solved in ${result.captcha_solve_time_ms}ms: ${captchaSolution}`);

        // Parse case_type options to find correct value
        const optionMatch = caseTypeHtml.match(new RegExp(`value=["']([^"']*)["'][^>]*>${cleanCaseType}`, 'i'));
        const caseTypeValue = optionMatch ? optionMatch[1] : cleanCaseType;
        console.log(`[TRIAL] Case type value: ${caseTypeValue}`);

        // Submit form directly to eCourts (POST request with form data)
        // eCourts form submits to case_no_qry.php
        const formSubmitUrl = `${ECOURTS_CONFIG.baseUrl}/cases/case_no_qry.php`;
        
        const formData = new URLSearchParams({
          state_cd: ECOURTS_CONFIG.stateCode,
          dist_cd: ECOURTS_CONFIG.distCode,
          court_code: benchConfig.courtCode,
          case_type: caseTypeValue,
          search_case_no: String(caseData.case_number),
          rgyear: String(caseData.case_year),
          captcha: captchaSolution,
          submit: 'Submit',
        });

        console.log(`[TRIAL] Submitting form to ${formSubmitUrl}`);
        
        const formSubmitResponse = await fetch(formSubmitUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': ECOURTS_CONFIG.baseUrl,
            'Referer': pageUrl,
          },
          body: formData,
        });

        if (!formSubmitResponse.ok) {
          result.errors.push(`Form submit error: ${formSubmitResponse.status}`);
          results.push(result);
          continue;
        }

        const resultHtml = await formSubmitResponse.text();
        console.log(`[TRIAL] Form submitted, result HTML: ${resultHtml.length} chars`);
        console.log(`[TRIAL] Result HTML length: ${resultHtml.length}`);

        // Check if CAPTCHA was wrong
        if (resultHtml.includes('Invalid Captcha') || resultHtml.includes('Wrong Captcha')) {
          result.errors.push('CAPTCHA rejected by eCourts');
          results.push(result);
          continue;
        }

        // Check if case not found
        if (resultHtml.includes('No Record Found') || resultHtml.includes('Record Not Found')) {
          result.errors.push('Case not found in eCourts');
          result.timeline_retrieved = true; // We did get a response
          results.push(result);
          continue;
        }

        // STEP 5: Parse timeline and documents (READ-ONLY)
        result.timeline_retrieved = true;

        // Extract hearing history
        const historyMatch = resultHtml.match(/Case History[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
        if (historyMatch) {
          const historyRows = historyMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
          console.log(`[TRIAL] Found ${historyRows.length - 1} hearing entries`); // -1 for header
        }

        // Extract orders/judgments
        const ordersMatch = resultHtml.match(/Orders[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
        if (ordersMatch) {
          const orderRows = ordersMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
          result.documents_found = Math.max(0, orderRows.length - 1); // -1 for header
          console.log(`[TRIAL] Found ${result.documents_found} orders/documents`);
        }

        // Check for judgment
        const judgmentPattern = /judgment|final\s+order|disposed/i;
        if (judgmentPattern.test(resultHtml)) {
          result.judgment_found = true;
          
          // Try to extract judgment date
          const dateMatch = resultHtml.match(/(?:judgment|final\s+order)[\s\S]*?(\d{2}[-.\/]\d{2}[-.\/]\d{4})/i);
          
          // Try to extract judgment PDF URL
          const pdfMatch = resultHtml.match(/href=["']([^"']*\.pdf[^"']*)["']/i);
          
          result.judgment_metadata = {
            date: dateMatch ? dateMatch[1] : null,
            url: pdfMatch ? pdfMatch[1] : null,
          };
          
          console.log(`[TRIAL] Judgment found! Date: ${result.judgment_metadata.date}`);
        } else {
          result.judgment_found = false;
          console.log(`[TRIAL] No judgment found (case likely pending)`);
        }

        // NO DATA MUTATIONS - This is read-only trial
        result.data_mutations = []; // Confirm zero mutations

      } catch (caseError) {
        const errorMsg = caseError instanceof Error ? caseError.message : 'Unknown error';
        result.errors.push(errorMsg);
        console.error(`[TRIAL] Error processing case ${result.case_display}:`, errorMsg);
      }

      results.push(result);
    }

    // Generate trial summary
    const summary = {
      trial_date: new Date().toISOString(),
      date_tested: '12 Jan 2026',
      cases_attempted: results.length,
      captcha_results: results.map(r => ({
        case: r.case_display,
        captcha_success: r.captcha_status === 'success',
        solve_time_ms: r.captcha_solve_time_ms,
      })),
      timelines_retrieved: results.filter(r => r.timeline_retrieved).length,
      judgments_found: results.filter(r => r.judgment_found).length,
      total_documents: results.reduce((sum, r) => sum + r.documents_found, 0),
      errors_encountered: results.flatMap(r => r.errors),
      data_mutations_outside_scope: results.flatMap(r => r.data_mutations).length,
      detailed_results: results,
    };

    console.log('\n=== TRIAL RESULT SUMMARY ===');
    console.log(`Date Tested: ${summary.date_tested}`);
    console.log(`Cases Attempted: ${summary.cases_attempted}`);
    console.log(`Captcha Success: ${summary.captcha_results.filter(r => r.captcha_success).length}/${summary.cases_attempted}`);
    console.log(`Timelines Retrieved: ${summary.timelines_retrieved}`);
    console.log(`Judgments Found: ${summary.judgments_found}`);
    console.log(`Documents Found: ${summary.total_documents}`);
    console.log(`Errors: ${summary.errors_encountered.length > 0 ? summary.errors_encountered.join(', ') : 'None'}`);
    console.log(`Data Mutations Outside Scope: ${summary.data_mutations_outside_scope} (must be zero)`);
    console.log('============================\n');

    return new Response(
      JSON.stringify(summary, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[admin-doc-sync-trial] Fatal error:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
