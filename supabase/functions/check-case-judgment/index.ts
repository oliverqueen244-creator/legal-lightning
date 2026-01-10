import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * check-case-judgment
 * 
 * Lawyer-scoped judgment checking for Rajasthan High Court cases.
 * 
 * CRITICAL RULES:
 * - ONLY checks for FINAL JUDGMENTS
 * - MUST be tied to a specific lawyer
 * - CAPTCHA usage is logged and attributed to lawyer
 * - All guards must pass before CAPTCHA is consumed
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// eCourts configuration for Rajasthan High Court
const ECOURTS_CONFIG = {
  baseUrl: 'https://hcservices.ecourts.gov.in/ecourtindiaHC',
  stateCode: '9',
  benches: {
    JAIPUR: { distCode: '1', courtCode: '1' },
    JODHPUR: { distCode: '2', courtCode: '1' },
  },
  endpoints: {
    judgmentSearch: '/cases/s_kiosk_case_status.php',
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

interface JudgmentResult {
  found: boolean;
  judgment_date?: string;
  pdf_url?: string;
  error?: string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twoCaptchaKey = Deno.env.get('TWOCAPTCHA_API_KEY');

    if (!twoCaptchaKey) {
      return new Response(
        JSON.stringify({ error: '2Captcha API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth header for lawyer identification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify lawyer identity
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lawyerId = user.id;
    const { case_id }: CheckRequest = await req.json();

    if (!case_id) {
      return new Response(
        JSON.stringify({ error: 'case_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-case-judgment] Lawyer ${lawyerId} requesting check for case ${case_id}`);

    // ═══════════════════════════════════════════════════════════════
    // GUARD 1: Run all pre-check guards via database function
    // ═══════════════════════════════════════════════════════════════
    const { data: guardResult, error: guardError } = await supabase
      .rpc('can_check_judgment', { p_case_id: case_id, p_lawyer_id: lawyerId });

    if (guardError) {
      console.error('[check-case-judgment] Guard check failed:', guardError);
      return new Response(
        JSON.stringify({ error: 'Failed to validate request', details: guardError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!guardResult.allowed) {
      console.log(`[check-case-judgment] Guard rejected: ${guardResult.reason}`);
      return new Response(
        JSON.stringify({ 
          error: 'Check not allowed',
          reason: guardResult.reason,
          next_check_after: guardResult.next_check_after 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // GUARD 2: Fetch case details and verify ownership again
    // ═══════════════════════════════════════════════════════════════
    const { data: caseData, error: caseError } = await supabase
      .from('tracked_cases')
      .select('*')
      .eq('id', case_id)
      .single();

    if (caseError || !caseData) {
      return new Response(
        JSON.stringify({ error: 'Case not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Double-check ownership (defense in depth)
    if (caseData.profile_id !== lawyerId) {
      console.error(`[check-case-judgment] OWNERSHIP MISMATCH: case belongs to ${caseData.profile_id}, not ${lawyerId}`);
      return new Response(
        JSON.stringify({ error: 'Case does not belong to you' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // UPDATE: Mark case as "checking"
    // ═══════════════════════════════════════════════════════════════
    await supabase
      .from('tracked_cases')
      .update({ 
        judgment_status: 'checking',
        last_judgment_check_at: new Date().toISOString()
      })
      .eq('id', case_id);

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Fetch eCourts page and extract CAPTCHA
    // ═══════════════════════════════════════════════════════════════
    const benchConfig = ECOURTS_CONFIG.benches[caseData.bench as keyof typeof ECOURTS_CONFIG.benches];
    if (!benchConfig) {
      await markCheckFailed(supabase, case_id, 'Invalid bench configuration');
      return new Response(
        JSON.stringify({ error: 'Invalid bench' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let captchaStartTime = Date.now();
    let captchaSolved = false;
    let captchaError: string | null = null;
    let captchaSolveTimeMs = 0;

    try {
      // Fetch the case status page to get CAPTCHA
      const pageUrl = buildCaseStatusUrl(caseData.bench, caseData.case_type, caseData.case_number, caseData.case_year);
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
        await markCheckFailed(supabase, case_id, 'IP blocked by eCourts');
        return new Response(
          JSON.stringify({ error: 'Service temporarily unavailable', retry_after: 3600 }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract CAPTCHA image URL
      const captchaMatch = html.match(/src=["']([^"']*captcha[^"']*)["']/i);
      if (!captchaMatch) {
        // No CAPTCHA? Unusual, but try to parse anyway
        console.log('[check-case-judgment] No CAPTCHA detected, parsing directly');
        const result = await parseJudgmentFromHtml(html);
        return handleJudgmentResult(supabase, case_id, lawyerId, result, null);
      }

      const captchaImageUrl = resolveCaptchaUrl(captchaMatch[1]);
      console.log(`[check-case-judgment] CAPTCHA found: ${captchaImageUrl}`);

      // ═══════════════════════════════════════════════════════════════
      // STEP 2: Solve CAPTCHA via 2Captcha
      // ═══════════════════════════════════════════════════════════════
      captchaStartTime = Date.now();
      
      // Download CAPTCHA image
      const captchaImageResponse = await fetch(captchaImageUrl);
      const captchaImageBuffer = await captchaImageResponse.arrayBuffer();
      const captchaBase64 = btoa(String.fromCharCode(...new Uint8Array(captchaImageBuffer)));

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
        throw new Error(`2Captcha submit failed: ${submitResult.request}`);
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
        throw new Error('CAPTCHA solve timeout');
      }

      // ═══════════════════════════════════════════════════════════════
      // STEP 3: Log CAPTCHA usage (BEFORE using the solution)
      // ═══════════════════════════════════════════════════════════════
      await supabase.from('captcha_usage_log').insert({
        lawyer_id: lawyerId,
        tracked_case_id: case_id,
        provider: '2captcha',
        cost_credits: TWOCAPTCHA_CONFIG.costPerSolve,
        success: true,
        solve_time_ms: captchaSolveTimeMs,
        captcha_type: 'image',
      });

      // ═══════════════════════════════════════════════════════════════
      // STEP 4: Submit form with CAPTCHA solution
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
        `${ECOURTS_CONFIG.baseUrl}${ECOURTS_CONFIG.endpoints.judgmentSearch}`,
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

      // ═══════════════════════════════════════════════════════════════
      // STEP 5: Parse for FINAL JUDGMENT only
      // ═══════════════════════════════════════════════════════════════
      const result = await parseJudgmentFromHtml(resultHtml);
      return handleJudgmentResult(supabase, case_id, lawyerId, result, captchaSolveTimeMs);

    } catch (error) {
      captchaError = error instanceof Error ? error.message : 'Unknown error';
      console.error('[check-case-judgment] Error:', captchaError);

      // Log failed CAPTCHA attempt
      if (captchaStartTime) {
        await supabase.from('captcha_usage_log').insert({
          lawyer_id: lawyerId,
          tracked_case_id: case_id,
          provider: '2captcha',
          cost_credits: captchaSolved ? TWOCAPTCHA_CONFIG.costPerSolve : 0,
          success: false,
          solve_time_ms: Date.now() - captchaStartTime,
          error_reason: captchaError,
          captcha_type: 'image',
        });
      }

      await markCheckFailed(supabase, case_id, captchaError);

      return new Response(
        JSON.stringify({ error: 'Judgment check failed', details: captchaError }),
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

function buildCaseStatusUrl(bench: string, caseType: string, caseNumber: number, caseYear: number): string {
  const benchConfig = ECOURTS_CONFIG.benches[bench as keyof typeof ECOURTS_CONFIG.benches];
  const params = new URLSearchParams({
    state_cd: ECOURTS_CONFIG.stateCode,
    dist_cd: benchConfig.distCode,
    court_code: benchConfig.courtCode,
  });
  return `${ECOURTS_CONFIG.baseUrl}${ECOURTS_CONFIG.endpoints.judgmentSearch}?${params}`;
}

function resolveCaptchaUrl(captchaSrc: string): string {
  if (captchaSrc.startsWith('http')) return captchaSrc;
  if (captchaSrc.startsWith('/')) return `${ECOURTS_CONFIG.baseUrl}${captchaSrc}`;
  return `${ECOURTS_CONFIG.baseUrl}/${captchaSrc}`;
}

interface JudgmentParseResult {
  found: boolean;
  judgment_date?: string;
  pdf_url?: string;
  error?: string;
}

async function parseJudgmentFromHtml(html: string): Promise<JudgmentParseResult> {
  // Look specifically for JUDGMENT or FINAL JUDGMENT
  // NOT interim orders, NOT misc orders
  
  const judgmentPatterns = [
    /final\s*judgment/i,
    /judgment\s*dated/i,
    /<td[^>]*>judgment<\/td>/i,
  ];

  const hasJudgment = judgmentPatterns.some(pattern => pattern.test(html));

  if (!hasJudgment) {
    // Check if case exists but no judgment
    if (html.includes('Case not found') || html.includes('No record found')) {
      return { found: false, error: 'case_not_found' };
    }
    return { found: false };
  }

  // Extract judgment date
  const dateMatch = html.match(/judgment\s*(?:dated|on)?\s*[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i);
  const judgmentDate = dateMatch ? parseIndianDate(dateMatch[1]) : undefined;

  // Extract PDF URL - look for judgment-specific PDF links
  const pdfMatch = html.match(/href=["']([^"']*(?:judgment|jud)[^"']*\.pdf[^"']*)["']/i) ||
                   html.match(/href=["']([^"']*\.pdf[^"']*)["']/i);
  
  let pdfUrl: string | undefined;
  if (pdfMatch) {
    pdfUrl = pdfMatch[1].startsWith('http') 
      ? pdfMatch[1] 
      : `${ECOURTS_CONFIG.baseUrl}/${pdfMatch[1].replace(/^\//, '')}`;
  }

  return {
    found: true,
    judgment_date: judgmentDate,
    pdf_url: pdfUrl,
  };
}

function parseIndianDate(dateStr: string): string | undefined {
  const match = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return undefined;
}

async function markCheckFailed(supabase: any, caseId: string, errorMessage: string) {
  await supabase
    .from('tracked_cases')
    .update({
      judgment_status: 'not_found',
      judgment_check_attempts: supabase.raw('judgment_check_attempts + 1'),
    })
    .eq('id', caseId);
}

async function handleJudgmentResult(
  supabase: any,
  caseId: string,
  lawyerId: string,
  result: JudgmentParseResult,
  captchaSolveTimeMs: number | null
) {
  // Increment attempt counter
  await supabase.rpc('', {}).catch(() => {}); // Placeholder for atomic increment

  if (!result.found) {
    // No judgment found - update status and set cooldown
    const nextCheckAfter = new Date();
    nextCheckAfter.setDate(nextCheckAfter.getDate() + 7); // 7 day cooldown

    await supabase
      .from('tracked_cases')
      .update({
        judgment_status: 'not_found',
        judgment_check_attempts: supabase.sql`judgment_check_attempts + 1`,
        next_judgment_check_after: nextCheckAfter.toISOString(),
      })
      .eq('id', caseId);

    return new Response(
      JSON.stringify({ 
        found: false,
        message: 'No final judgment uploaded yet',
        next_check_after: nextCheckAfter.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // JUDGMENT FOUND! 
  console.log(`[check-case-judgment] JUDGMENT FOUND for case ${caseId}`);

  // Download and store PDF if URL available
  let storedPdfPath: string | null = null;
  let pdfHash: string | null = null;
  let pdfSize: number | null = null;

  if (result.pdf_url) {
    try {
      const pdfResponse = await fetch(result.pdf_url);
      const pdfBuffer = await pdfResponse.arrayBuffer();
      pdfSize = pdfBuffer.byteLength;

      // Hash the PDF
      const hashBuffer = await crypto.subtle.digest('SHA-256', pdfBuffer);
      pdfHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Store in Supabase Storage
      const fileName = `${caseId}/judgment_${pdfHash.slice(0, 8)}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false, // Immutable - never overwrite
        });

      if (!uploadError) {
        storedPdfPath = fileName;
      }
    } catch (pdfError) {
      console.error('[check-case-judgment] PDF download/storage failed:', pdfError);
    }
  }

  // Insert judgment record
  const { data: judgment, error: judgmentError } = await supabase
    .from('case_judgments')
    .insert({
      tracked_case_id: caseId,
      lawyer_id: lawyerId,
      judgment_date: result.judgment_date,
      source_pdf_url: result.pdf_url,
      stored_pdf_path: storedPdfPath,
      pdf_hash: pdfHash,
      pdf_size_bytes: pdfSize,
    })
    .select()
    .single();

  if (judgmentError) {
    console.error('[check-case-judgment] Failed to insert judgment:', judgmentError);
  }

  // Update case status to FOUND (stops all future checks)
  await supabase
    .from('tracked_cases')
    .update({
      judgment_status: 'found',
      judgment_found_at: new Date().toISOString(),
    })
    .eq('id', caseId);

  return new Response(
    JSON.stringify({
      found: true,
      judgment_date: result.judgment_date,
      pdf_url: result.pdf_url,
      stored: !!storedPdfPath,
      message: 'Final judgment found and stored',
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}