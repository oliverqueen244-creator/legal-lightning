/**
 * Backend Error Reporting Utility for Edge Functions
 * 
 * CRITICAL: This utility logs errors for admin visibility WITHOUT:
 * - Storing sensitive court data (case numbers, party names, judge names)
 * - Blocking job processing
 * - Exposing stack traces
 * 
 * All logs are admin-only and used for parsing intelligence diagnostics.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ErrorSeverity = 'P0' | 'P1' | 'P2';

export type ErrorDomain = 
  | 'AUTH'
  | 'NETWORK'
  | 'OFFLINE_BLOCK'
  | 'SYNC'
  | 'UPLOAD'
  | 'PWA'
  | 'REALTIME'
  | 'CAUSELIST_PARSING'
  | 'CASE_MATCHING'
  | 'INGESTION'
  | 'UNKNOWN';

// Error codes for parsing intelligence
export const ERROR_CODES = {
  // Ingestion errors
  INGEST_EMPTY_FILE: 'INGEST_EMPTY_FILE',
  INGEST_FORMAT_CHANGE: 'INGEST_FORMAT_CHANGE',
  INGEST_TIMEOUT: 'INGEST_TIMEOUT',
  INGEST_DOWNLOAD_FAIL: 'INGEST_DOWNLOAD_FAIL',
  
  // Parsing errors
  PARSE_ITEM_NO_FAIL: 'PARSE_ITEM_NO_FAIL',
  PARSE_PARTY_BLOCK_FAIL: 'PARSE_PARTY_BLOCK_FAIL',
  PARSE_ADVOCATE_SECTION_MISSING: 'PARSE_ADVOCATE_SECTION_MISSING',
  PARSE_UNKNOWN_PATTERN: 'PARSE_UNKNOWN_PATTERN',
  PARSE_COURT_NO_MISSING: 'PARSE_COURT_NO_MISSING',
  PARSE_AI_RESPONSE_INVALID: 'PARSE_AI_RESPONSE_INVALID',
  PARSE_ALL_PROVIDERS_FAILED: 'PARSE_ALL_PROVIDERS_FAILED',
  
  // Matching errors
  MATCH_NO_ALIAS: 'MATCH_NO_ALIAS',
  MATCH_AMBIGUOUS: 'MATCH_AMBIGUOUS',
  MATCH_BENCH_MISMATCH: 'MATCH_BENCH_MISMATCH',
  MATCH_FINGERPRINT_COLLISION: 'MATCH_FINGERPRINT_COLLISION',
  
  // Docket errors
  DOCKET_EMPTY_AFTER_PARSE: 'DOCKET_EMPTY_AFTER_PARSE',
  BENCH_MISSING: 'BENCH_MISSING',
  ZERO_MATCH_DAY: 'ZERO_MATCH_DAY',
  DOCKET_INSERT_FAIL: 'DOCKET_INSERT_FAIL',
  
  // AI Worker errors
  AI_WORKER_ALL_FAILED: 'AI_WORKER_ALL_FAILED',
  AI_WORKER_RATE_LIMITED: 'AI_WORKER_RATE_LIMITED',
  AI_WORKER_TOKEN_BUDGET: 'AI_WORKER_TOKEN_BUDGET',
  AI_WORKER_JOB_FAILED: 'AI_WORKER_JOB_FAILED',
  
  // Extraction errors
  EXTRACT_PDF_FAIL: 'EXTRACT_PDF_FAIL',
  EXTRACT_TEXT_EMPTY: 'EXTRACT_TEXT_EMPTY',
  EXTRACT_STALLED: 'EXTRACT_STALLED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

interface ReportErrorParams {
  severity: ErrorSeverity;
  domain: ErrorDomain;
  errorCode: string;
  message: string;
  batchId?: string;
  benchCode?: string;
}

/**
 * Sanitize message to remove any potentially sensitive data
 * CRITICAL: Never store case numbers, party names, or judge names
 */
function sanitizeMessage(message: string): string {
  // Remove patterns that look like case numbers
  let sanitized = message.replace(/\b[A-Z]{2,}\/\d+\/\d+\b/g, '[CASE_REF]');
  sanitized = sanitized.replace(/\b\d{4}\/\d+\b/g, '[CASE_REF]');
  
  // Remove patterns that look like names (Title Case words)
  sanitized = sanitized.replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME]');
  
  // Remove any URLs that might contain sensitive params
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL]');
  
  // Truncate to 500 chars max
  return sanitized.slice(0, 500);
}

/**
 * Convert bench identifier to abstract code
 * e.g., "JODHPUR" -> "RJ-JODH", court 12 -> "RJ-JODH-12"
 */
export function abstractBenchCode(bench?: string, courtNo?: string): string | undefined {
  if (!bench) return undefined;
  
  const benchMap: Record<string, string> = {
    'JODHPUR': 'RJ-JODH',
    'JAIPUR': 'RJ-JAIP',
  };
  
  const code = benchMap[bench.toUpperCase()] || bench.slice(0, 4).toUpperCase();
  return courtNo ? `${code}-${courtNo}` : code;
}

/**
 * Report error to admin_error_events table
 * 
 * IMPORTANT: This function NEVER throws or blocks processing.
 * All failures are silent - error logging must never affect job processing.
 */
export async function reportBackendError(params: ReportErrorParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      // Can't log, but don't throw
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Use the security definer function to insert
    await supabase.rpc('log_error_event', {
      p_severity: params.severity,
      p_domain: params.domain,
      p_error_code: params.errorCode,
      p_message: sanitizeMessage(params.message),
      p_environment: 'backend',
      p_batch_id: params.batchId || null,
      p_bench_code: params.benchCode || null,
      p_is_online: true,
      p_app_version: '1.0.0',
    });
  } catch {
    // CRITICAL: Never throw - error logging must never block processing
  }
}

// Convenience functions for common error types

export function reportIngestionError(
  errorCode: string,
  message: string,
  batchId?: string,
  benchCode?: string
): void {
  reportBackendError({
    severity: 'P1',
    domain: 'INGESTION',
    errorCode,
    message,
    batchId,
    benchCode,
  });
}

export function reportParsingError(
  errorCode: string,
  message: string,
  batchId?: string,
  benchCode?: string
): void {
  reportBackendError({
    severity: 'P1',
    domain: 'CAUSELIST_PARSING',
    errorCode,
    message,
    batchId,
    benchCode,
  });
}

export function reportMatchingError(
  errorCode: string,
  message: string,
  batchId?: string,
  benchCode?: string
): void {
  reportBackendError({
    severity: 'P2',
    domain: 'CASE_MATCHING',
    errorCode,
    message,
    batchId,
    benchCode,
  });
}

export function reportCriticalError(
  domain: ErrorDomain,
  errorCode: string,
  message: string,
  batchId?: string,
  benchCode?: string
): void {
  reportBackendError({
    severity: 'P0',
    domain,
    errorCode,
    message,
    batchId,
    benchCode,
  });
}
