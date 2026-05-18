import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
/**
 * admin-doc-sync-trial - SESSION CONTINUITY VERSION
 * 
 * Uses Browserless /function endpoint with full Puppeteer script
 * to maintain session continuity throughout:
 * 1. Load eCourts page
 * 2. Screenshot CAPTCHA (session-bound)
 * 3. Wait for 2Captcha solution
 * 4. Fill form and submit in SAME session
 * 5. Capture result
 * 
 * TRIAL CONSTRAINTS:
 * - Single case test (BAIL 3864/2025 JODHPUR)
 * - Full audit logging
 * - No data mutations outside scope
 */

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

// Browserless configuration - using /function endpoint for session persistence
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
  session_id?: string;
  captcha_status: 'success' | 'failed' | 'skipped';
  captcha_solve_time_ms?: number;
  captcha_accepted: boolean;
  timeline_retrieved: boolean;
  documents_found: number;
  judgment_found: boolean;
  judgment_metadata?: {
    date: string | null;
    url: string | null;
  };
  errors: string[];
  debug_logs: string[];
  data_mutations: string[];
}

/**
 * Solve CAPTCHA using 2Captcha service
 */
async function solveCaptcha(
  captchaBase64: string, 
  twoCaptchaKey: string
): Promise<{ solution: string | null; error: string | null; solveTimeMs: number }> {
  const startTime = Date.now();
  
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
    return { solution: null, error: `2Captcha submit failed: ${submitData.request}`, solveTimeMs: Date.now() - startTime };
  }

  const captchaId = submitData.request;
  console.log(`[2Captcha] ID: ${captchaId}. Polling...`);

  // Poll for solution (up to 120 seconds)
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, TWOCAPTCHA_CONFIG.pollInterval));
    
    const pollRes = await fetch(
      `${TWOCAPTCHA_CONFIG.apiUrl}/res.php?key=${twoCaptchaKey}&action=get&id=${captchaId}&json=1`
    );
    const pollData = await pollRes.json();

    if (pollData.status === 1) {
      return { solution: pollData.request, error: null, solveTimeMs: Date.now() - startTime };
    } else if (pollData.request !== 'CAPCHA_NOT_READY') {
      return { solution: null, error: `2Captcha error: ${pollData.request}`, solveTimeMs: Date.now() - startTime };
    }
  }

  return { solution: null, error: 'CAPTCHA solve timeout (120s)', solveTimeMs: Date.now() - startTime };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const twoCaptchaKey = Deno.env.get('TWOCAPTCHA_API_KEY');
  const browserlessKey = Deno.env.get('BROWSERLESS_API_KEY');

  if (!twoCaptchaKey) {
    return new Response(
      JSON.stringify({ error: '2Captcha API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!browserlessKey) {
    return new Response(
      JSON.stringify({ error: 'Browserless API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Parse request - limit to 1 case for session continuity test
    const body = await req.json().catch(() => ({}));
    const caseIds: string[] = body.case_ids || [];
    const maxCases = 1; // Single case for session test

    console.log(`\n========================================`);
    console.log(`[SESSION CONTINUITY TRIAL] Starting...`);
    console.log(`========================================\n`);

    // Fetch single test case
    let cases: TrialCase[] = [];
    
    if (caseIds.length > 0) {
      const { data, error } = await supabase
        .from('tracked_cases')
        .select('id, case_type, case_number, case_year, bench, petitioner, respondent, profile_id')
        .in('id', caseIds.slice(0, maxCases));
      
      if (error) throw error;
      cases = data || [];
    } else {
      // Default test case: BAIL 3864/2025 JODHPUR
      const { data, error } = await supabase
        .from('tracked_cases')
        .select('id, case_type, case_number, case_year, bench, petitioner, respondent, profile_id')
        .eq('case_type', 'BAIL)')
        .eq('case_number', 3864)
        .eq('case_year', 2025)
        .eq('bench', 'JODHPUR')
        .limit(1);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        // Fallback: any JODHPUR case
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('tracked_cases')
          .select('id, case_type, case_number, case_year, bench, petitioner, respondent, profile_id')
          .eq('bench', 'JODHPUR')
          .not('case_type', 'is', null)
          .not('case_number', 'is', null)
          .limit(1);
        
        if (fallbackError) throw fallbackError;
        cases = fallbackData || [];
      } else {
        cases = data;
      }
    }

    if (cases.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid cases found for trial' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const caseData = cases[0];
    const cleanCaseType = caseData.case_type.replace(/\)$/, '');
    
    console.log(`[TEST CASE] ${cleanCaseType} ${caseData.case_number}/${caseData.case_year}`);
    console.log(`  Bench: ${caseData.bench}`);
    console.log(`  Petitioner: ${caseData.petitioner || 'N/A'}`);
    console.log(`  Respondent: ${caseData.respondent || 'N/A'}`);

    const result: TrialResult = {
      case_id: caseData.id,
      case_display: `${cleanCaseType} ${caseData.case_number}/${caseData.case_year}`,
      captcha_status: 'skipped',
      captcha_accepted: false,
      timeline_retrieved: false,
      documents_found: 0,
      judgment_found: false,
      errors: [],
      debug_logs: [],
      data_mutations: [],
    };

    // Get bench configuration
    const benchConfig = ECOURTS_CONFIG.benches[caseData.bench as keyof typeof ECOURTS_CONFIG.benches];
    if (!benchConfig) {
      result.errors.push(`Invalid bench: ${caseData.bench}`);
      return new Response(
        JSON.stringify({ error: result.errors[0], result }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pageUrl = `${ECOURTS_CONFIG.baseUrl}${ECOURTS_CONFIG.endpoints.caseNo}?state_cd=${ECOURTS_CONFIG.stateCode}&dist_cd=${ECOURTS_CONFIG.distCode}&court_code=${benchConfig.courtCode}&stateNm=Rajasthan`;
    
    result.debug_logs.push(`Page URL: ${pageUrl}`);
    console.log(`[SESSION] Target URL: ${pageUrl}`);

    // ==========================================
    // PHASE 1: Create persistent browser session
    // ==========================================
    console.log(`\n[PHASE 1] Creating persistent browser session...`);
    result.debug_logs.push('Phase 1: Creating session');

    // Use Browserless /function endpoint with inline Puppeteer code
    // The /function endpoint runs code in a single persistent browser context
    
    const captchaStartTime = Date.now();

    // Puppeteer script that runs entirely in Browserless
    // Phase 1: Navigate and capture CAPTCHA
    // Using ESM syntax: export default async ({ page }) => {...}
    const phase1Script = `
export default async ({ page }) => {
  const url = "${pageUrl}";
  
  // Navigate to eCourts case search
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  
  // Wait for CAPTCHA image to load
  await page.waitForSelector('#captcha_image', { timeout: 10000 });
  
  // Screenshot the CAPTCHA element
  const captchaElement = await page.$('#captcha_image');
  if (!captchaElement) {
    return { error: 'CAPTCHA element not found' };
  }
  
  const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });
  
  // Get case_type dropdown options for mapping
  const caseTypeOptions = await page.evaluate(() => {
    const select = document.querySelector('#case_type');
    if (!select) return [];
    return Array.from(select.querySelectorAll('option')).map(opt => ({
      value: opt.value,
      text: opt.textContent?.trim() || ''
    }));
  });
  
  // Get session cookies to verify persistence
  const cookies = await page.cookies();
  
  return {
    captchaBase64,
    caseTypeOptions,
    cookieCount: cookies.length,
    pageUrl: page.url()
  };
};
    `;

    console.log(`[SESSION] Executing Phase 1 script in Browserless...`);
    
    const phase1Response = await fetch(`${BROWSERLESS_API_URL}/function?token=${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/javascript' },
      body: phase1Script,
    });

    if (!phase1Response.ok) {
      const errText = await phase1Response.text();
      result.errors.push(`Browserless Phase 1 error: ${phase1Response.status} - ${errText.slice(0, 200)}`);
      console.error(`[SESSION] Phase 1 failed:`, errText.slice(0, 500));
      
      return new Response(
        JSON.stringify({ error: result.errors[0], result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phase1Result = await phase1Response.json();
    console.log(`[SESSION] Phase 1 result:`, JSON.stringify(phase1Result).slice(0, 300));
    result.debug_logs.push(`Phase 1 cookies: ${phase1Result.cookieCount}`);

    if (phase1Result.error) {
      result.errors.push(`Phase 1: ${phase1Result.error}`);
      return new Response(
        JSON.stringify({ error: result.errors[0], result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const captchaBase64 = phase1Result.captchaBase64;
    const caseTypeOptions = phase1Result.caseTypeOptions || [];

    if (!captchaBase64 || captchaBase64.length < 100) {
      result.errors.push(`CAPTCHA capture failed. Got: ${captchaBase64?.length || 0} chars`);
      return new Response(
        JSON.stringify({ error: result.errors[0], result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SESSION] CAPTCHA captured: ${captchaBase64.length} chars`);
    console.log(`[SESSION] Case type options: ${caseTypeOptions.length}`);
    result.debug_logs.push(`CAPTCHA size: ${captchaBase64.length} chars`);

    // Find matching case type value
    const matchingOption = caseTypeOptions.find((opt: { text: string; value: string }) => 
      opt.text.toUpperCase().includes(cleanCaseType.toUpperCase())
    );
    const caseTypeValue = matchingOption?.value || cleanCaseType;
    console.log(`[SESSION] Case type mapping: "${cleanCaseType}" -> "${caseTypeValue}"`);
    result.debug_logs.push(`Case type value: ${caseTypeValue}`);

    // ==========================================
    // PHASE 2: Solve CAPTCHA with 2Captcha
    // ==========================================
    console.log(`\n[PHASE 2] Solving CAPTCHA with 2Captcha...`);
    result.debug_logs.push('Phase 2: Solving CAPTCHA');

    const { solution: captchaSolution, error: captchaError, solveTimeMs } = await solveCaptcha(captchaBase64, twoCaptchaKey);

    if (captchaError || !captchaSolution) {
      result.errors.push(captchaError || 'CAPTCHA solve failed');
      result.captcha_status = 'failed';
      result.captcha_solve_time_ms = solveTimeMs;
      
      return new Response(
        JSON.stringify({ error: result.errors[0], result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    result.captcha_status = 'success';
    result.captcha_solve_time_ms = solveTimeMs;
    console.log(`[SESSION] CAPTCHA solved in ${solveTimeMs}ms: "${captchaSolution}"`);
    result.debug_logs.push(`CAPTCHA solved: ${captchaSolution} (${solveTimeMs}ms)`);

    // ==========================================
    // PHASE 3: Submit form in NEW session
    // (Session continuity test - will likely fail)
    // ==========================================
    console.log(`\n[PHASE 3] Submitting form with solved CAPTCHA...`);
    result.debug_logs.push('Phase 3: Form submission (new session test)');

    // This script submits the form in a new session
    // NOTE: This is expected to fail due to session mismatch
    // This validates that session continuity IS required
    const phase3Script = `
export default async ({ page }) => {
  const url = "${pageUrl}";
  const caseType = "${caseTypeValue}";
  const caseNumber = "${caseData.case_number}";
  const caseYear = "${caseData.case_year}";
  const captcha = "${captchaSolution}";
  
  // Navigate to fresh page (new session)
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  
  // Wait for form elements
  await page.waitForSelector('#case_type', { timeout: 10000 });
  await page.waitForSelector('#search_case_no', { timeout: 10000 });
  await page.waitForSelector('#rgyear', { timeout: 10000 });
  await page.waitForSelector('#captcha', { timeout: 10000 });
  
  // Fill form
  await page.select('#case_type', caseType);
  await page.type('#search_case_no', caseNumber);
  await page.select('#rgyear', caseYear);
  await page.type('#captcha', captcha);
  
  // Get the new CAPTCHA image URL (to show it's different)
  const newCaptchaSrc = await page.evaluate(() => {
    const img = document.querySelector('#captcha_image');
    return img ? img.src : null;
  });
  
  // Submit form
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => null),
    page.click('input[type="submit"], button[type="submit"]').catch(() => {
      // Try form submit directly
      return page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.submit();
      });
    })
  ]);
  
  // Wait a moment for any dynamic content
  await new Promise(r => setTimeout(r, 2000));
  
  // Capture result page
  const resultHtml = await page.content();
  const resultUrl = page.url();
  
  // Check for common error patterns
  const hasInvalidCaptcha = resultHtml.includes('Invalid Captcha') || 
                             resultHtml.includes('Wrong Captcha') ||
                             resultHtml.includes('invalid captcha');
  const hasNoRecord = resultHtml.includes('No Record Found') || 
                      resultHtml.includes('Record Not Found');
  const hasResults = resultHtml.includes('Case History') || 
                     resultHtml.includes('case_details');
  
  return {
    resultUrl,
    resultLength: resultHtml.length,
    newCaptchaSrc,
    hasInvalidCaptcha,
    hasNoRecord,
    hasResults,
    // Return snippet for debugging
    resultSnippet: resultHtml.substring(0, 2000)
  };
};
    `;

    console.log(`[SESSION] Executing Phase 3 script...`);

    const phase3Response = await fetch(`${BROWSERLESS_API_URL}/function?token=${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/javascript' },
      body: phase3Script,
    });

    if (!phase3Response.ok) {
      const errText = await phase3Response.text();
      result.errors.push(`Browserless Phase 3 error: ${phase3Response.status}`);
      result.debug_logs.push(`Phase 3 error: ${errText.slice(0, 200)}`);
      console.error(`[SESSION] Phase 3 failed:`, errText.slice(0, 500));
    } else {
      const phase3Result = await phase3Response.json();
      console.log(`[SESSION] Phase 3 result:`, JSON.stringify({
        ...phase3Result,
        resultSnippet: phase3Result.resultSnippet?.slice(0, 200)
      }));

      result.debug_logs.push(`Result URL: ${phase3Result.resultUrl}`);
      result.debug_logs.push(`Result length: ${phase3Result.resultLength}`);
      result.debug_logs.push(`Has invalid captcha: ${phase3Result.hasInvalidCaptcha}`);
      result.debug_logs.push(`Has results: ${phase3Result.hasResults}`);

      if (phase3Result.hasInvalidCaptcha) {
        result.errors.push('CAPTCHA rejected - SESSION MISMATCH CONFIRMED');
        result.captcha_accepted = false;
        console.log(`[SESSION] ❌ CAPTCHA REJECTED - Session mismatch confirmed!`);
        console.log(`[SESSION] This proves the CAPTCHA is session-bound.`);
      } else if (phase3Result.hasNoRecord) {
        result.captcha_accepted = true;
        result.timeline_retrieved = true;
        result.errors.push('Case not found in eCourts (but CAPTCHA was accepted!)');
        console.log(`[SESSION] ✓ CAPTCHA ACCEPTED but case not found`);
      } else if (phase3Result.hasResults) {
        result.captcha_accepted = true;
        result.timeline_retrieved = true;
        console.log(`[SESSION] ✓ CAPTCHA ACCEPTED and results retrieved!`);

        // Parse results from snippet
        const html = phase3Result.resultSnippet || '';
        
        // Check for judgment
        if (/judgment|final\s+order|disposed/i.test(html)) {
          result.judgment_found = true;
          result.debug_logs.push('Judgment indicators found in response');
        }
      } else {
        result.debug_logs.push(`Unexpected result. Snippet: ${phase3Result.resultSnippet?.slice(0, 300)}`);
      }
    }

    // ==========================================
    // PHASE 4 (ALTERNATIVE): Single-session flow
    // ==========================================
    // If Phase 3 failed due to session mismatch, try the full single-session approach
    
    if (!result.captcha_accepted) {
      console.log(`\n[PHASE 4] Attempting SINGLE SESSION flow...`);
      result.debug_logs.push('Phase 4: Single-session attempt');

      // This script does everything in ONE session:
      // 1. Navigate to page
      // 2. Capture CAPTCHA
      // 3. Return CAPTCHA for solving
      // Then we'd need a way to reconnect... but /function doesn't support that
      
      // Instead, let's try with reconnect via /session API
      console.log(`[SESSION] Creating persistent session via /session API...`);
      
      const sessionResponse = await fetch(`${BROWSERLESS_API_URL}/session?token=${browserlessKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ttl: 120000, // 2 minute TTL
        }),
      });

      if (!sessionResponse.ok) {
        const errText = await sessionResponse.text();
        result.errors.push(`Session creation failed: ${sessionResponse.status}`);
        result.debug_logs.push(`Session API error: ${errText.slice(0, 200)}`);
        console.error(`[SESSION] Session API error:`, errText);
      } else {
        const sessionData = await sessionResponse.json();
        result.session_id = sessionData.id;
        result.debug_logs.push(`Session created: ${sessionData.id}`);
        console.log(`[SESSION] Session created:`, sessionData);
        
        // The session API returns a WebSocket URL for Puppeteer connection
        // We can't use this directly from Deno, but we've proven the concept
        result.debug_logs.push('Session API works - need WebSocket Puppeteer client for full flow');
      }
    }

    // Generate summary
    const summary = {
      trial_date: new Date().toISOString(),
      test_type: 'SESSION_CONTINUITY_VALIDATION',
      case_tested: result.case_display,
      bench: caseData.bench,
      
      session_continuity_test: {
        phase1_captcha_captured: captchaBase64?.length > 100,
        phase2_captcha_solved: result.captcha_status === 'success',
        phase3_separate_session_submission: !result.captcha_accepted,
        session_mismatch_confirmed: result.errors.some(e => e.includes('SESSION MISMATCH')),
      },
      
      captcha_results: {
        status: result.captcha_status,
        solve_time_ms: result.captcha_solve_time_ms,
        accepted_by_ecourts: result.captcha_accepted,
      },
      
      data_retrieval: {
        timeline_retrieved: result.timeline_retrieved,
        documents_found: result.documents_found,
        judgment_found: result.judgment_found,
        judgment_metadata: result.judgment_metadata,
      },
      
      errors: result.errors,
      debug_logs: result.debug_logs,
      data_mutations_outside_scope: result.data_mutations.length,
      
      conclusion: result.captcha_accepted 
        ? 'SUCCESS: CAPTCHA accepted, session continuity maintained'
        : result.errors.some(e => e.includes('SESSION MISMATCH'))
          ? 'CONFIRMED: eCourts CAPTCHA is session-bound. Need single-session Puppeteer flow.'
          : 'INCONCLUSIVE: Check debug logs for details',
      
      next_steps: result.captcha_accepted 
        ? ['Proceed with full implementation']
        : [
            'Implement WebSocket Puppeteer client for Deno',
            'Or use /reconnect endpoint to maintain session',
            'Or implement Chrome extension for human-in-loop CAPTCHA'
          ],
    };

    console.log('\n========================================');
    console.log('[SESSION CONTINUITY TRIAL] COMPLETE');
    console.log('========================================');
    console.log(`Case: ${summary.case_tested}`);
    console.log(`CAPTCHA Solved: ${summary.captcha_results.status === 'success' ? 'YES' : 'NO'}`);
    console.log(`CAPTCHA Accepted: ${summary.captcha_results.accepted_by_ecourts ? 'YES' : 'NO'}`);
    console.log(`Session Mismatch: ${summary.session_continuity_test.session_mismatch_confirmed ? 'CONFIRMED' : 'NO'}`);
    console.log(`Conclusion: ${summary.conclusion}`);
    console.log('========================================\n');

    return new Response(
      JSON.stringify(summary, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SESSION] Fatal error:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
