import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
/**
 * check-case-judgment
 * 
 * Captcha-gated edge function for checking if a judgment exists for a tracked case.
 * Fetches case status from eCourts portal (Rajasthan High Court) after CAPTCHA verification.
 * 
 * CRITICAL CONSTRAINTS:
 * - ❌ No scraping without captcha completion
 * - ❌ No bypassing or automating captcha (uses 2Captcha service)
 * - ❌ No AI interpretation of judgment content
 * - ❌ No bulk fetch (single case per request)
 * - ❌ No mutation of existing case ownership or status
 * 
 * FLOW:
 * 1. Authenticate lawyer
 * 2. Verify case ownership + guards (cooldown, attempts)
 * 3. Fetch eCourts page
 * 4. Solve CAPTCHA via 2Captcha
 * 5. Submit form and parse response
 * 6. Check for judgment presence
 * 7. Store metadata only (no auto-download)
 * 8. Update tracked_case status
 */

// eCourts configuration for Rajasthan High Court
const ECOURTS_CONFIG = {
  baseUrl: 'https://hcservices.ecourts.gov.in/ecourtindiaHC',
  stateCode: '9',
  benches: {
    JAIPUR: { distCode: '1', courtCode: '1' },
    JODHPUR: { distCode: '2', courtCode: '1' },
  },
  endpoints: {
    caseStatus: '/cases/s_kiosk_case_status.php',
  },
};

// 2Captcha configuration
const TWOCAPTCHA_CONFIG = {
  apiUrl: 'http://2captcha.com',
  solveTimeout: 120000, // 2 minutes max
  pollInterval: 5000,   // Check every 5 seconds
  costPerSolve: 0.003,  // ~$0.003 per image CAPTCHA
};

interface CheckRequest {
  case_id: string;
}

interface JudgmentInfo {
  found: boolean;
  judgment_date: string | null;
  source_pdf_url: string | null;
  court_label: string | null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  // CORS preflight
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

  const supabase = createClient(supabaseUrl, supabaseKey);

  let caseId: string | null = null;
  let lawyerId: string | null = null;

  try {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Authenticate lawyer
    // ═══════════════════════════════════════════════════════════════
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    lawyerId = user.id;
    const body: CheckRequest = await req.json();
    caseId = body.case_id;

    if (!caseId) {
      return new Response(
        JSON.stringify({ error: 'case_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate-limit: 5 judgment checks per hour per lawyer (B-5)
    const { data: rateOk, error: rateErr } = await supabase.rpc('check_rate_limit', {
      p_user_id: lawyerId,
      p_action: 'judgment_check',
      p_max_requests: 5,
      p_window_minutes: 60,
    });
    if (rateErr) {
      console.error('[check-case-judgment] rate limit RPC failed:', rateErr);
    } else if (rateOk === false) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again in an hour.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-case-judgment] Lawyer ${lawyerId} checking case ${caseId}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Verify ownership + guards via can_check_judgment RPC
    // ═══════════════════════════════════════════════════════════════
    const { data: guardResult, error: guardError } = await supabase
      .rpc('can_check_judgment', { 
        p_case_id: caseId, 
        p_lawyer_id: lawyerId 
      });

    if (guardError) {
      console.error('[check-case-judgment] Guard check failed:', guardError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify case access', details: guardError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!guardResult.allowed) {
      console.log(`[check-case-judgment] Guard rejected: ${guardResult.reason}`);
      
      const reasonMessages: Record<string, string> = {
        'case_not_found': 'Case not found',
        'not_owner': 'This case does not belong to you',
        'judgment_already_found': 'Judgment has already been found for this case',
        'check_in_progress': 'A check is already in progress for this case',
        'cooldown_active': 'Please wait before checking again',
        'max_attempts_exceeded': 'Maximum check attempts reached for this case',
      };

      return new Response(
        JSON.stringify({ 
          error: reasonMessages[guardResult.reason] || guardResult.reason,
          reason: guardResult.reason,
          next_check_after: guardResult.next_check_after 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract case data
    const caseData = guardResult.case_data;
    console.log(`[check-case-judgment] Checking: ${caseData.case_type}/${caseData.case_number}/${caseData.case_year} at ${caseData.bench}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Fetch eCourts page
    // ═══════════════════════════════════════════════════════════════
    const benchConfig = ECOURTS_CONFIG.benches[caseData.bench as keyof typeof ECOURTS_CONFIG.benches];
    if (!benchConfig) {
      return new Response(
        JSON.stringify({ error: 'Invalid bench configuration' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let captchaStartTime = Date.now();
    let captchaSolved = false;
    let captchaSolveTimeMs = 0;

    try {
      const pageUrl = buildCaseStatusUrl(caseData.bench);
      console.log(`[check-case-judgment] Fetching: ${pageUrl}`);

      const pageResponse = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        }
      });

      if (!pageResponse.ok) {
        throw new Error(`eCourts returned ${pageResponse.status}`);
      }

      const html = await pageResponse.text();

      // Check for IP blocking
      if (html.includes('Access Denied') || html.includes('blocked')) {
        return new Response(
          JSON.stringify({ error: 'Service temporarily unavailable', retry_after: 3600 }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract CAPTCHA image URL
      const captchaMatch = html.match(/src=["']([^"']*captcha[^"']*)["']/i);
      if (!captchaMatch) {
        console.log('[check-case-judgment] No CAPTCHA found - page structure may have changed');
        return new Response(
          JSON.stringify({ error: 'eCourts page structure changed - no CAPTCHA found' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const captchaImageUrl = resolveCaptchaUrl(captchaMatch[1]);
      console.log(`[check-case-judgment] CAPTCHA found: ${captchaImageUrl}`);

      // ═══════════════════════════════════════════════════════════════
      // STEP 4: Solve CAPTCHA via 2Captcha
      // ═══════════════════════════════════════════════════════════════
      captchaStartTime = Date.now();
      
      // Download CAPTCHA image
      const captchaImageResponse = await fetch(captchaImageUrl);
      const captchaImageBuffer = await captchaImageResponse.arrayBuffer();
      const captchaBase64 = btoa(Array.from(new Uint8Array(captchaImageBuffer), (b) => String.fromCharCode(b)).join(''));

      // Submit to 2Captcha
      const submitResponse = await fetch(`${TWOCAPTCHA_CONFIG.apiUrl}/in.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          key: twoCaptchaKey,
          method: 'base64',
          body: captchaBase64,
          json: '1',
        }),
      });

      const submitResult = await submitResponse.json();
      
      if (submitResult.status !== 1) {
        await logCaptchaUsage(supabase, lawyerId, caseId, false, 0, `Submit failed: ${submitResult.request}`);
        return new Response(
          JSON.stringify({ error: 'CAPTCHA submission failed', details: submitResult.request }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const captchaId = submitResult.request;
      console.log(`[check-case-judgment] CAPTCHA submitted, ID: ${captchaId}`);

      // Poll for solution
      let solution: string | null = null;
      const pollStart = Date.now();

      while (Date.now() - pollStart < TWOCAPTCHA_CONFIG.solveTimeout) {
        await new Promise(resolve => setTimeout(resolve, TWOCAPTCHA_CONFIG.pollInterval));

        const pollResponse = await fetch(
          `${TWOCAPTCHA_CONFIG.apiUrl}/res.php?key=${twoCaptchaKey}&action=get&id=${captchaId}&json=1`
        );
        const pollResult = await pollResponse.json();

        if (pollResult.status === 1) {
          solution = pollResult.request;
          captchaSolved = true;
          captchaSolveTimeMs = Date.now() - captchaStartTime;
          console.log(`[check-case-judgment] CAPTCHA solved in ${captchaSolveTimeMs}ms`);
          break;
        } else if (pollResult.request !== 'CAPCHA_NOT_READY') {
          throw new Error(`2Captcha solve failed: ${pollResult.request}`);
        }
      }

      if (!solution) {
        await logCaptchaUsage(supabase, lawyerId, caseId, false, Date.now() - captchaStartTime, 'Timeout');
        return new Response(
          JSON.stringify({ error: 'CAPTCHA solve timeout' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log CAPTCHA usage
      await logCaptchaUsage(supabase, lawyerId, caseId, true, captchaSolveTimeMs);

      // ═══════════════════════════════════════════════════════════════
      // STEP 5: Submit form with CAPTCHA solution
      // ═══════════════════════════════════════════════════════════════
      const formData = new URLSearchParams({
        state_cd: ECOURTS_CONFIG.stateCode,
        dist_cd: benchConfig.distCode,
        court_code: benchConfig.courtCode,
        case_type: caseData.case_type,
        case_no: String(caseData.case_number),
        case_year: String(caseData.case_year),
        captcha: solution,
        submit: 'Submit',
      });

      const searchResponse = await fetch(
        `${ECOURTS_CONFIG.baseUrl}${ECOURTS_CONFIG.endpoints.caseStatus}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          body: formData,
        }
      );

      const resultHtml = await searchResponse.text();

      // Check if CAPTCHA was wrong
      if (resultHtml.includes('Invalid Captcha') || resultHtml.includes('Wrong Captcha')) {
        console.log('[check-case-judgment] CAPTCHA was rejected by eCourts');
        
        // Increment attempt count but don't update last_check timestamp
        await supabase
          .from('tracked_cases')
          .update({ 
            judgment_check_attempts: (caseData.judgment_check_attempts || 0) + 1 
          })
          .eq('id', caseId);
        
        return new Response(
          JSON.stringify({ error: 'CAPTCHA validation failed', retry: true }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ═══════════════════════════════════════════════════════════════
      // STEP 6: Check for judgment presence
      // ═══════════════════════════════════════════════════════════════
      const judgmentInfo = extractJudgmentInfo(resultHtml);
      console.log(`[check-case-judgment] Judgment found: ${judgmentInfo.found}`);

      // ═══════════════════════════════════════════════════════════════
      // STEP 7: Update tracked_case status via server-side RPC so all
      // timestamps come from Postgres NOW() (no edge-runtime clock skew).
      // ═══════════════════════════════════════════════════════════════
      await supabase.rpc('record_judgment_check_result', {
        p_case_id: caseId,
        p_judgment_found: judgmentInfo.found,
        p_cooldown_days: 7,
      });

      // ═══════════════════════════════════════════════════════════════
      // STEP 8: Store judgment metadata (if found)
      // ═══════════════════════════════════════════════════════════════
      if (judgmentInfo.found && judgmentInfo.source_pdf_url) {
        // Check if judgment already stored
        const { data: existing } = await supabase
          .from('case_judgments')
          .select('id')
          .eq('tracked_case_id', caseId)
          .maybeSingle();

        if (!existing) {
          // Store judgment metadata only - NO auto-download
          await supabase
            .from('case_judgments')
            .insert({
              tracked_case_id: caseId,
              lawyer_id: lawyerId,
              judgment_date: judgmentInfo.judgment_date || new Date().toISOString().split('T')[0],
              source_pdf_url: judgmentInfo.source_pdf_url,
              // stored_pdf_path and pdf_hash will be populated when lawyer confirms download
            });
        }
      }

      // Return result
      return new Response(
        JSON.stringify({
          found: judgmentInfo.found,
          judgment_date: judgmentInfo.judgment_date,
          pdf_url: judgmentInfo.source_pdf_url,
          court_label: judgmentInfo.court_label,
          stored: judgmentInfo.found,
          message: judgmentInfo.found 
            ? 'Judgment found on eCourts portal' 
            : 'No judgment uploaded yet',
          next_check_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          captcha_solved: true,
          retrieved_via: 'captcha_2captcha',
          source: 'official_court',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[check-case-judgment] Error:', errorMessage);

      // Log failed CAPTCHA attempt
      if (captchaStartTime && !captchaSolved && lawyerId && caseId) {
        await logCaptchaUsage(supabase, lawyerId, caseId, false, Date.now() - captchaStartTime, errorMessage);
      }

      return new Response(
        JSON.stringify({ error: 'Judgment check failed', details: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[check-case-judgment] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function buildCaseStatusUrl(bench: string): string {
  const benchConfig = ECOURTS_CONFIG.benches[bench as keyof typeof ECOURTS_CONFIG.benches];
  const params = new URLSearchParams({
    state_cd: ECOURTS_CONFIG.stateCode,
    dist_cd: benchConfig.distCode,
    court_code: benchConfig.courtCode,
  });
  return `${ECOURTS_CONFIG.baseUrl}${ECOURTS_CONFIG.endpoints.caseStatus}?${params}`;
}

function resolveCaptchaUrl(captchaSrc: string): string {
  if (captchaSrc.startsWith('http')) return captchaSrc;
  if (captchaSrc.startsWith('/')) return `${ECOURTS_CONFIG.baseUrl}${captchaSrc}`;
  return `${ECOURTS_CONFIG.baseUrl}/${captchaSrc}`;
}

/**
 * Extract judgment information from eCourts HTML response.
 * 
 * RULES:
 * - Only look for explicit "Judgment" or "Final Order" labels
 * - Do NOT interpret or classify ambiguous documents
 * - Return only metadata, not content
 */
function extractJudgmentInfo(html: string): JudgmentInfo {
  const result: JudgmentInfo = {
    found: false,
    judgment_date: null,
    source_pdf_url: null,
    court_label: null,
  };

  // Look for judgment-specific indicators
  const judgmentPatterns = [
    /judgment/i,
    /final\s*order/i,
    /jmt\s*date/i,
    /pronounced/i,
    /disposed/i,
  ];

  // Check if any judgment pattern exists in the HTML
  const hasJudgmentText = judgmentPatterns.some(pattern => pattern.test(html));
  if (!hasJudgmentText) {
    return result;
  }

  // Look for PDF links in judgment rows
  const rowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowPattern) || [];

  for (const row of rows) {
    const lowerRow = row.toLowerCase();
    
    // Check if this row contains judgment-related text
    const isJudgmentRow = 
      lowerRow.includes('judgment') ||
      lowerRow.includes('final order') ||
      lowerRow.includes('jmt') ||
      lowerRow.includes('pronounced');

    if (!isJudgmentRow) continue;

    // Check for PDF link
    const pdfMatch = row.match(/href=["']([^"']*\.pdf[^"']*)["']/i);
    if (!pdfMatch) continue;

    // Found a judgment with PDF
    result.found = true;
    
    // Resolve PDF URL
    let pdfUrl = pdfMatch[1];
    if (!pdfUrl.startsWith('http')) {
      pdfUrl = pdfUrl.startsWith('/') 
        ? `${ECOURTS_CONFIG.baseUrl}${pdfUrl}`
        : `${ECOURTS_CONFIG.baseUrl}/${pdfUrl}`;
    }
    result.source_pdf_url = pdfUrl;

    // Extract date
    const dateMatch = row.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
    if (dateMatch) {
      result.judgment_date = parseIndianDate(dateMatch[1]);
    }

    // Extract label
    const labelMatch = row.match(/<td[^>]*>([^<]*(?:judgment|final)[^<]*)<\/td>/i);
    if (labelMatch) {
      result.court_label = labelMatch[1].trim();
    } else {
      result.court_label = 'Judgment';
    }

    break; // Found one judgment, stop looking
  }

  return result;
}

/**
 * Parse Indian date format (DD-MM-YYYY or DD/MM/YYYY) to ISO date
 */
function parseIndianDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Log CAPTCHA usage for attribution
 */
async function logCaptchaUsage(
  supabase: any,
  lawyerId: string,
  caseId: string,
  success: boolean,
  solveTimeMs: number,
  errorReason?: string
) {
  await supabase.from('captcha_usage_log').insert({
    lawyer_id: lawyerId,
    tracked_case_id: caseId,
    provider: '2captcha',
    cost_credits: success ? TWOCAPTCHA_CONFIG.costPerSolve : 0,
    success,
    solve_time_ms: solveTimeMs,
    error_reason: errorReason,
    captcha_type: 'image',
  });
}
