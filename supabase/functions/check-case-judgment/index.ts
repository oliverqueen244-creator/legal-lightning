import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * check-case-judgment (now: Sync Case Documents)
 * 
 * Lawyer-scoped document sync for Rajasthan High Court cases.
 * Downloads ALL court documents from Case Status → Orders / Judgments table.
 * 
 * CRITICAL RULES:
 * - Downloads ALL documents (judgments, interim orders, orders, etc.)
 * - MUST be tied to a specific lawyer
 * - CAPTCHA usage is logged and attributed to lawyer
 * - All guards must pass before CAPTCHA is consumed
 * - Uses atomic database functions for counters
 * - Deduplicates by PDF hash
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

interface SyncRequest {
  case_id: string;
}

interface DocumentRow {
  court_label: string;
  order_date: string | null;
  pdf_url: string;
}

interface SyncResult {
  success: boolean;
  documents_found: number;
  documents_synced: number;
  documents_skipped: number;
  error?: string;
  next_sync_after?: string;
}

type DocSyncType = 'judgment' | 'interim_order' | 'order' | 'unknown';

serve(async (req) => {
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

  try {
    // Get auth header for lawyer identification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    const { case_id }: SyncRequest = await req.json();

    if (!case_id) {
      return new Response(
        JSON.stringify({ error: 'case_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-case-documents] Lawyer ${lawyerId} syncing case ${case_id}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Acquire atomic lock (prevents concurrent syncs)
    // This also runs all guards: ownership, cooldown, max attempts
    // ═══════════════════════════════════════════════════════════════
    const { data: lockResult, error: lockError } = await supabase
      .rpc('acquire_document_sync_lock', { 
        p_case_id: case_id, 
        p_lawyer_id: lawyerId 
      });

    if (lockError) {
      console.error('[sync-case-documents] Lock acquisition failed:', lockError);
      return new Response(
        JSON.stringify({ error: 'Failed to acquire sync lock', details: lockError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lockResult.acquired) {
      console.log(`[sync-case-documents] Lock rejected: ${lockResult.reason}`);
      
      const reasonMessages: Record<string, string> = {
        'case_not_found': 'Case not found',
        'not_owner': 'This case does not belong to you',
        'sync_in_progress': 'A sync is already in progress for this case',
        'cooldown_active': 'Please wait before syncing again',
        'max_attempts_exceeded': 'Maximum sync attempts reached for this case',
        'lock_held_by_another': 'Another process is syncing this case',
      };

      return new Response(
        JSON.stringify({ 
          error: reasonMessages[lockResult.reason] || lockResult.reason,
          reason: lockResult.reason,
          next_sync_after: lockResult.next_sync_after 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract case data from lock result
    const caseData = lockResult.case_data;
    console.log(`[sync-case-documents] Lock acquired for case: ${caseData.case_type}/${caseData.case_number}/${caseData.case_year}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Fetch case status page and extract CAPTCHA
    // ═══════════════════════════════════════════════════════════════
    const benchConfig = ECOURTS_CONFIG.benches[caseData.bench as keyof typeof ECOURTS_CONFIG.benches];
    if (!benchConfig) {
      await releaseLockOnFailure(supabase, case_id);
      return new Response(
        JSON.stringify({ error: 'Invalid bench configuration' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let captchaStartTime = Date.now();
    let captchaSolved = false;
    let captchaSolveTimeMs = 0;
    let documentsFound = 0;
    let documentsSynced = 0;
    let documentsSkipped = 0;

    try {
      // Fetch the case status page to get CAPTCHA
      const pageUrl = buildCaseStatusUrl(caseData.bench);
      console.log(`[sync-case-documents] Fetching: ${pageUrl}`);

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
        await releaseLockOnFailure(supabase, case_id);
        return new Response(
          JSON.stringify({ error: 'Service temporarily unavailable', retry_after: 3600 }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract CAPTCHA image URL
      const captchaMatch = html.match(/src=["']([^"']*captcha[^"']*)["']/i);
      if (!captchaMatch) {
        console.log('[sync-case-documents] No CAPTCHA detected - unusual, proceeding cautiously');
        await releaseLockOnFailure(supabase, case_id);
        return new Response(
          JSON.stringify({ error: 'eCourts page structure changed - no CAPTCHA found' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const captchaImageUrl = resolveCaptchaUrl(captchaMatch[1]);
      console.log(`[sync-case-documents] CAPTCHA found: ${captchaImageUrl}`);

      // ═══════════════════════════════════════════════════════════════
      // STEP 3: Solve CAPTCHA via 2Captcha (ONCE per sync)
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
        // CAPTCHA submit failed - log and exit WITHOUT updating timestamps
        await logCaptchaUsage(supabase, lawyerId, case_id, false, 0, `Submit failed: ${submitResult.request}`);
        await releaseLockOnFailure(supabase, case_id);
        return new Response(
          JSON.stringify({ error: 'CAPTCHA submission failed', details: submitResult.request }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const captchaId = submitResult.request;
      console.log(`[sync-case-documents] CAPTCHA submitted, ID: ${captchaId}`);

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
          console.log(`[sync-case-documents] CAPTCHA solved in ${captchaSolveTimeMs}ms`);
          break;
        } else if (pollResult.request !== 'CAPCHA_NOT_READY') {
          throw new Error(`2Captcha solve failed: ${pollResult.request}`);
        }
      }

      if (!solution) {
        await logCaptchaUsage(supabase, lawyerId, case_id, false, Date.now() - captchaStartTime, 'Timeout');
        await releaseLockOnFailure(supabase, case_id);
        return new Response(
          JSON.stringify({ error: 'CAPTCHA solve timeout' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ═══════════════════════════════════════════════════════════════
      // STEP 4: Log CAPTCHA usage (AFTER successful solve)
      // ═══════════════════════════════════════════════════════════════
      await logCaptchaUsage(supabase, lawyerId, case_id, true, captchaSolveTimeMs);

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
        console.log('[sync-case-documents] CAPTCHA was rejected by eCourts');
        await releaseLockOnFailure(supabase, case_id);
        return new Response(
          JSON.stringify({ error: 'CAPTCHA validation failed', retry: true }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ═══════════════════════════════════════════════════════════════
      // STEP 6: Parse ALL documents from Orders / Judgments table
      // ═══════════════════════════════════════════════════════════════
      const documents = parseAllDocumentsFromHtml(resultHtml);
      documentsFound = documents.length;
      
      console.log(`[sync-case-documents] Found ${documentsFound} documents in case status`);

      if (documentsFound === 0) {
        // No documents found - success but nothing to sync
        await supabase.rpc('release_document_sync_lock', {
          p_case_id: case_id,
          p_success: true,
          p_documents_added: 0
        });

        const nextSync = new Date();
        nextSync.setDate(nextSync.getDate() + 7);

        return new Response(
          JSON.stringify({
            success: true,
            documents_found: 0,
            documents_synced: 0,
            documents_skipped: 0,
            message: 'No documents available for download',
            next_sync_after: nextSync.toISOString(),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ═══════════════════════════════════════════════════════════════
      // STEP 7: Download and store each document
      // ═══════════════════════════════════════════════════════════════
      for (const doc of documents) {
        try {
          const result = await downloadAndStoreDocument(
            supabase,
            case_id,
            lawyerId,
            doc
          );

          if (result.stored) {
            documentsSynced++;
          } else if (result.skipped) {
            documentsSkipped++;
          }
        } catch (docError) {
          console.error(`[sync-case-documents] Failed to process document:`, docError);
          // Continue with other documents
        }
      }

      console.log(`[sync-case-documents] Sync complete: ${documentsSynced} stored, ${documentsSkipped} skipped`);

      // ═══════════════════════════════════════════════════════════════
      // STEP 8: Release lock and update stats
      // ═══════════════════════════════════════════════════════════════
      await supabase.rpc('release_document_sync_lock', {
        p_case_id: case_id,
        p_success: true,
        p_documents_added: documentsSynced
      });

      const nextSync = new Date();
      nextSync.setDate(nextSync.getDate() + 7);

      return new Response(
        JSON.stringify({
          success: true,
          documents_found: documentsFound,
          documents_synced: documentsSynced,
          documents_skipped: documentsSkipped,
          message: documentsSynced > 0 
            ? `Successfully synced ${documentsSynced} document(s)` 
            : 'All documents already synced',
          next_sync_after: nextSync.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[sync-case-documents] Error:', errorMessage);

      // Log failed CAPTCHA attempt if it started
      if (captchaStartTime && !captchaSolved) {
        await logCaptchaUsage(supabase, lawyerId, case_id, false, Date.now() - captchaStartTime, errorMessage);
      }

      await releaseLockOnFailure(supabase, case_id);

      return new Response(
        JSON.stringify({ error: 'Document sync failed', details: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[sync-case-documents] Unhandled error:', error);
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
 * Parse ALL documents from the Orders / Judgments table in the HTML.
 * Does NOT filter by type - trusts table rows + PDF presence.
 */
function parseAllDocumentsFromHtml(html: string): DocumentRow[] {
  const documents: DocumentRow[] = [];

  // Look for the Orders/Judgments section
  // The exact structure depends on eCourts HTML format
  // Pattern: table rows with order type, date, and PDF link

  // Match table rows containing PDF links
  const rowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowPattern) || [];

  for (const row of rows) {
    // Check if this row has a PDF link
    const pdfMatch = row.match(/href=["']([^"']*\.pdf[^"']*)["']/i);
    if (!pdfMatch) continue;

    // Extract the court label (first meaningful text in the row)
    const labelMatch = row.match(/<td[^>]*>([^<]+)<\/td>/i);
    const courtLabel = labelMatch ? labelMatch[1].trim() : 'Unknown';

    // Skip if it's a header row or navigation row
    if (courtLabel.toLowerCase().includes('sr') || 
        courtLabel.toLowerCase().includes('order type') ||
        courtLabel.toLowerCase().includes('date')) {
      continue;
    }

    // Extract date (look for DD-MM-YYYY or DD/MM/YYYY pattern)
    const dateMatch = row.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
    const orderDate = dateMatch ? parseIndianDate(dateMatch[1]) : null;

    // Resolve PDF URL
    let pdfUrl = pdfMatch[1];
    if (!pdfUrl.startsWith('http')) {
      pdfUrl = pdfUrl.startsWith('/') 
        ? `${ECOURTS_CONFIG.baseUrl}${pdfUrl}`
        : `${ECOURTS_CONFIG.baseUrl}/${pdfUrl}`;
    }

    documents.push({
      court_label: courtLabel,
      order_date: orderDate,
      pdf_url: pdfUrl,
    });
  }

  // Fallback: also try to find any PDF links in the document if table parsing fails
  if (documents.length === 0) {
    const allPdfLinks = html.match(/href=["']([^"']*\.pdf[^"']*)["']/gi) || [];
    for (const link of allPdfLinks) {
      const urlMatch = link.match(/href=["']([^"']+)["']/i);
      if (urlMatch) {
        let pdfUrl = urlMatch[1];
        if (!pdfUrl.startsWith('http')) {
          pdfUrl = pdfUrl.startsWith('/') 
            ? `${ECOURTS_CONFIG.baseUrl}${pdfUrl}`
            : `${ECOURTS_CONFIG.baseUrl}/${pdfUrl}`;
        }
        
        documents.push({
          court_label: 'Court Document',
          order_date: null,
          pdf_url: pdfUrl,
        });
      }
    }
  }

  return documents;
}

/**
 * Classify document type based on court label
 */
function classifyDocumentType(courtLabel: string): DocSyncType {
  const label = courtLabel.toLowerCase();
  
  if (label.includes('judgment') || label.includes('jmt') || label.includes('final')) {
    return 'judgment';
  }
  
  if (label.includes('interim')) {
    return 'interim_order';
  }
  
  if (label.includes('order') || label.includes('direction') || label.includes('procedural')) {
    return 'order';
  }
  
  return 'unknown';
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
 * Download a PDF and store it immutably
 */
async function downloadAndStoreDocument(
  supabase: any,
  caseId: string,
  lawyerId: string,
  doc: DocumentRow
): Promise<{ stored: boolean; skipped: boolean; error?: string }> {
  
  console.log(`[sync-case-documents] Processing: ${doc.court_label} from ${doc.pdf_url}`);

  // Download PDF
  const pdfResponse = await fetch(doc.pdf_url);
  if (!pdfResponse.ok) {
    return { stored: false, skipped: false, error: `Download failed: ${pdfResponse.status}` };
  }

  const pdfBuffer = await pdfResponse.arrayBuffer();
  const pdfSize = pdfBuffer.byteLength;

  // Hash the PDF for deduplication
  const hashBuffer = await crypto.subtle.digest('SHA-256', pdfBuffer);
  const pdfHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Check if this hash already exists for this case
  const { data: existing } = await supabase
    .from('synced_court_documents')
    .select('id')
    .eq('tracked_case_id', caseId)
    .eq('pdf_hash', pdfHash)
    .maybeSingle();

  if (existing) {
    console.log(`[sync-case-documents] Skipping duplicate (hash: ${pdfHash.slice(0, 8)})`);
    return { stored: false, skipped: true };
  }

  // Store PDF immutably: lawyers/{lawyer_id}/cases/{case_id}/documents/{hash}.pdf
  const storedPath = `lawyers/${lawyerId}/cases/${caseId}/documents/${pdfHash}.pdf`;
  
  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(storedPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false, // Immutable - never overwrite
    });

  if (uploadError && !uploadError.message.includes('already exists')) {
    console.error(`[sync-case-documents] Upload failed:`, uploadError);
    return { stored: false, skipped: false, error: uploadError.message };
  }

  // Insert document record
  const docType = classifyDocumentType(doc.court_label);
  
  const { error: insertError } = await supabase
    .from('synced_court_documents')
    .insert({
      tracked_case_id: caseId,
      lawyer_id: lawyerId,
      court_label: doc.court_label,
      doc_type: docType,
      order_date: doc.order_date,
      source_pdf_url: doc.pdf_url,
      stored_pdf_path: storedPath,
      pdf_hash: pdfHash,
      pdf_size_bytes: pdfSize,
    });

  if (insertError) {
    // Check if it's a duplicate constraint error (another process got it first)
    if (insertError.message.includes('unique') || insertError.message.includes('duplicate')) {
      return { stored: false, skipped: true };
    }
    console.error(`[sync-case-documents] Insert failed:`, insertError);
    return { stored: false, skipped: false, error: insertError.message };
  }

  console.log(`[sync-case-documents] Stored: ${doc.court_label} (${docType})`);
  return { stored: true, skipped: false };
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

/**
 * Release lock on failure (don't update last_sync_at)
 */
async function releaseLockOnFailure(supabase: any, caseId: string) {
  await supabase.rpc('release_document_sync_lock', {
    p_case_id: caseId,
    p_success: false,
    p_documents_added: 0
  });
}
