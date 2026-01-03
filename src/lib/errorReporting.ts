/**
 * Court-Critical Error Reporting System
 * 
 * This utility logs errors for admin visibility WITHOUT:
 * - Storing sensitive court data (case numbers, party names, judge names)
 * - Blocking user actions
 * - Exposing stack traces
 * 
 * All logs are admin-only and used for parsing intelligence diagnostics.
 */

import { supabase } from '@/integrations/supabase/client';

// Error severity levels
export type ErrorSeverity = 'P0' | 'P1' | 'P2';

// Error domains for categorization
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

// Environment detection
export type ErrorEnvironment = 'web' | 'pwa' | 'ios' | 'backend';

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
  
  // Matching errors
  MATCH_NO_ALIAS: 'MATCH_NO_ALIAS',
  MATCH_AMBIGUOUS: 'MATCH_AMBIGUOUS',
  MATCH_BENCH_MISMATCH: 'MATCH_BENCH_MISMATCH',
  MATCH_FINGERPRINT_COLLISION: 'MATCH_FINGERPRINT_COLLISION',
  
  // Docket errors
  DOCKET_EMPTY_AFTER_PARSE: 'DOCKET_EMPTY_AFTER_PARSE',
  BENCH_MISSING: 'BENCH_MISSING',
  ZERO_MATCH_DAY: 'ZERO_MATCH_DAY',
  
  // Auth errors
  AUTH_LOGIN_FAIL: 'AUTH_LOGIN_FAIL',
  AUTH_NETWORK_FAIL: 'AUTH_NETWORK_FAIL',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  
  // Network/Offline errors
  OFFLINE_ACTION_BLOCKED: 'OFFLINE_ACTION_BLOCKED',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  SYNC_CONFLICT: 'SYNC_CONFLICT',
  SYNC_FAIL: 'SYNC_FAIL',
  
  // Upload errors
  UPLOAD_FAIL: 'UPLOAD_FAIL',
  UPLOAD_OFFLINE: 'UPLOAD_OFFLINE',
  
  // PWA errors
  PWA_UPDATE_FAIL: 'PWA_UPDATE_FAIL',
  PWA_CACHE_FAIL: 'PWA_CACHE_FAIL',
  
  // Realtime errors
  REALTIME_DISCONNECT: 'REALTIME_DISCONNECT',
  REALTIME_SUBSCRIPTION_FAIL: 'REALTIME_SUBSCRIPTION_FAIL',
  
  // General
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

interface ReportErrorOptions {
  severity: ErrorSeverity;
  domain: ErrorDomain;
  errorCode: ErrorCode | string;
  message: string;
  route?: string;
  batchId?: string;
  benchCode?: string;
}

// Cached environment info
let cachedEnvInfo: {
  browser: string;
  os: string;
  device: string;
  environment: ErrorEnvironment;
} | null = null;

/**
 * Detect environment information (cached for performance)
 */
function getEnvironmentInfo() {
  if (cachedEnvInfo) return cachedEnvInfo;
  
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  
  // Detect browser
  let browser = 'unknown';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  // Detect OS
  let os = 'unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  // Detect device type
  let device = 'desktop';
  if (/Mobi|Android|iPhone|iPad|iPod/.test(ua)) {
    device = /iPad/.test(ua) ? 'tablet' : 'mobile';
  }
  
  // Detect environment
  let environment: ErrorEnvironment = 'web';
  if (typeof window !== 'undefined') {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      environment = 'pwa';
    } else if (os === 'iOS' && (window as any).webkit?.messageHandlers) {
      environment = 'ios';
    }
  }
  
  cachedEnvInfo = { browser, os, device, environment };
  return cachedEnvInfo;
}

/**
 * Get app version from package or build info
 */
function getAppVersion(): string {
  // This could be injected at build time
  return import.meta.env.VITE_APP_VERSION || '1.0.0';
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
  
  // Remove any potential phone numbers
  sanitized = sanitized.replace(/\b\d{10,}\b/g, '[PHONE]');
  
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
 * Main error reporting function
 * 
 * IMPORTANT: This function NEVER throws or blocks user actions.
 * All failures are silent from the user's perspective.
 */
export async function reportError(options: ReportErrorOptions): Promise<void> {
  try {
    const envInfo = getEnvironmentInfo();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get user role if available
    let userRole: string | null = null;
    if (user) {
      const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: user.id });
      userRole = roleData as string | null;
    }
    
    // Call the security definer function to insert
    await supabase.rpc('log_error_event', {
      p_severity: options.severity,
      p_domain: options.domain,
      p_error_code: options.errorCode,
      p_message: sanitizeMessage(options.message),
      p_environment: envInfo.environment,
      p_user_id: user?.id || null,
      p_role: userRole,
      p_route: options.route || (typeof window !== 'undefined' ? window.location.pathname : null),
      p_is_online: typeof navigator !== 'undefined' ? navigator.onLine : null,
      p_app_version: getAppVersion(),
      p_browser: envInfo.browser,
      p_os: envInfo.os,
      p_device: envInfo.device,
      p_batch_id: options.batchId || null,
      p_bench_code: options.benchCode || null,
    });
  } catch {
    // CRITICAL: Never throw or log to console
    // Error logging must NEVER block user actions
  }
}

/**
 * Report a P0 critical error (system down, data loss risk)
 */
export function reportCriticalError(
  domain: ErrorDomain,
  errorCode: ErrorCode | string,
  message: string,
  context?: { batchId?: string; benchCode?: string; route?: string }
): void {
  reportError({
    severity: 'P0',
    domain,
    errorCode,
    message,
    ...context,
  });
}

/**
 * Report a P1 high-priority error (feature broken, user impact)
 */
export function reportHighError(
  domain: ErrorDomain,
  errorCode: ErrorCode | string,
  message: string,
  context?: { batchId?: string; benchCode?: string; route?: string }
): void {
  reportError({
    severity: 'P1',
    domain,
    errorCode,
    message,
    ...context,
  });
}

/**
 * Report a P2 warning (degraded experience, minor issue)
 */
export function reportWarning(
  domain: ErrorDomain,
  errorCode: ErrorCode | string,
  message: string,
  context?: { batchId?: string; benchCode?: string; route?: string }
): void {
  reportError({
    severity: 'P2',
    domain,
    errorCode,
    message,
    ...context,
  });
}

// ============================================
// PARSING INTELLIGENCE HELPERS
// ============================================

/**
 * Report ingestion stage errors
 */
export function reportIngestionError(
  errorCode: string,
  message: string,
  batchId: string,
  benchCode?: string
): void {
  reportError({
    severity: 'P1',
    domain: 'INGESTION',
    errorCode,
    message,
    batchId,
    benchCode,
  });
}

/**
 * Report parsing stage errors
 */
export function reportParsingError(
  errorCode: string,
  message: string,
  batchId: string,
  benchCode?: string
): void {
  reportError({
    severity: 'P1',
    domain: 'CAUSELIST_PARSING',
    errorCode,
    message,
    batchId,
    benchCode,
  });
}

/**
 * Report case matching errors
 */
export function reportMatchingError(
  errorCode: string,
  message: string,
  batchId?: string,
  benchCode?: string
): void {
  reportError({
    severity: 'P2',
    domain: 'CASE_MATCHING',
    errorCode,
    message,
    batchId,
    benchCode,
  });
}

/**
 * Report offline action blocked
 */
export function reportOfflineBlock(action: string): void {
  reportError({
    severity: 'P2',
    domain: 'OFFLINE_BLOCK',
    errorCode: ERROR_CODES.OFFLINE_ACTION_BLOCKED,
    message: `Action blocked while offline: ${action}`,
  });
}

/**
 * Report auth error
 */
export function reportAuthError(errorCode: string, message: string): void {
  reportError({
    severity: 'P1',
    domain: 'AUTH',
    errorCode,
    message,
  });
}
