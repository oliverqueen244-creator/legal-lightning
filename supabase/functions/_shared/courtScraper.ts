/**
 * Court Scraper Utilities for Rajasthan High Court
 * 
 * ⚠️ CRITICAL LIMITATIONS:
 * - eCourts portal requires CAPTCHA for all queries
 * - Automated scraping requires CAPTCHA-solving service
 * - Rate limiting is essential to avoid IP blocks
 * - PDF availability may be delayed 24-72 hours after hearing
 */

// eCourts portal URLs for Rajasthan High Court
export const ECOURTS_CONFIG = {
  baseUrl: 'https://hcservices.ecourts.gov.in/ecourtindiaHC',
  stateCode: '9', // Rajasthan
  benches: {
    JAIPUR: { distCode: '1', courtCode: '1', name: 'High Court Bench at Jaipur' },
    JODHPUR: { distCode: '2', courtCode: '1', name: 'High Court Bench at Jodhpur' },
  },
  endpoints: {
    caseStatus: '/cases/case_no.php',
    caseOrders: '/cases/s_kiosk_order.php',
    causeList: '/cases/causelist.php',
  },
  // Rate limiting: max requests per minute per bench
  rateLimit: {
    requestsPerMinute: 5,
    delayBetweenRequests: 12000, // 12 seconds
  },
} as const;

export type Bench = keyof typeof ECOURTS_CONFIG.benches;

/**
 * Build URL for case orders query
 */
export function buildCaseOrdersUrl(bench: Bench): string {
  const benchConfig = ECOURTS_CONFIG.benches[bench];
  const params = new URLSearchParams({
    state_cd: ECOURTS_CONFIG.stateCode,
    dist_cd: benchConfig.distCode,
    court_code: benchConfig.courtCode,
    stateNm: 'Rajasthan',
  });
  return `${ECOURTS_CONFIG.baseUrl}${ECOURTS_CONFIG.endpoints.caseOrders}?${params}`;
}

/**
 * Detect if response contains CAPTCHA
 */
export function detectCaptcha(html: string): boolean {
  const captchaIndicators = [
    'captcha',
    'CAPTCHA',
    'Enter Captcha',
    'captcha_image',
    'captchaCode',
  ];
  return captchaIndicators.some(indicator => html.includes(indicator));
}

/**
 * Detect if IP is blocked or rate limited
 */
export function detectBlocking(html: string, status: number): { blocked: boolean; reason: string } {
  if (status === 403) {
    return { blocked: true, reason: 'HTTP 403 Forbidden - IP may be blocked' };
  }
  if (status === 429) {
    return { blocked: true, reason: 'HTTP 429 Too Many Requests - Rate limited' };
  }
  if (html.includes('Access Denied') || html.includes('blocked')) {
    return { blocked: true, reason: 'Access denied by server' };
  }
  if (html.includes('temporarily unavailable')) {
    return { blocked: true, reason: 'Service temporarily unavailable' };
  }
  return { blocked: false, reason: '' };
}

/**
 * Parse orders table from HTML response
 * 
 * NOTE: This is a placeholder. Actual parsing requires:
 * 1. Solving CAPTCHA first
 * 2. Submitting form with case details
 * 3. Parsing the response table
 */
export interface ParsedOrder {
  orderDate: string;        // YYYY-MM-DD format
  orderType: string;        // "Order", "Judgment", etc.
  pdfUrl: string | null;    // Direct URL to PDF
  judgeName: string | null;
}

export function parseOrdersTable(html: string): ParsedOrder[] {
  // ⚠️ LIMITATION: Cannot parse without solving CAPTCHA first
  // This function would parse the HTML table after successful form submission
  
  const orders: ParsedOrder[] = [];
  
  // Look for table rows containing order data
  // Pattern varies by court, this is a generic approach
  const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(tableRowRegex) || [];
  
  for (const row of rows) {
    // Skip header rows
    if (row.includes('<th') || row.includes('Order Date')) continue;
    
    // Extract cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let match;
    while ((match = cellRegex.exec(row)) !== null) {
      cells.push(match[1].replace(/<[^>]+>/g, '').trim());
    }
    
    // Extract PDF link
    const pdfLinkMatch = row.match(/href=["']([^"']*\.pdf[^"']*)["']/i);
    
    if (cells.length >= 2) {
      orders.push({
        orderDate: parseIndianDate(cells[0]) || cells[0],
        orderType: cells[1] || 'Order',
        pdfUrl: pdfLinkMatch ? pdfLinkMatch[1] : null,
        judgeName: cells[2] || null,
      });
    }
  }
  
  return orders;
}

/**
 * Parse Indian date format (DD-MM-YYYY or DD/MM/YYYY) to ISO
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
 * Generate SHA-256 hash of PDF content
 */
export async function hashPdfContent(pdfBytes: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', pdfBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Rate limiter state (in-memory, per worker instance)
 */
const rateLimitState: Record<Bench, { lastRequest: number; count: number }> = {
  JAIPUR: { lastRequest: 0, count: 0 },
  JODHPUR: { lastRequest: 0, count: 0 },
};

/**
 * Check if we can make a request (rate limiting)
 */
export function canMakeRequest(bench: Bench): { allowed: boolean; waitMs: number } {
  const now = Date.now();
  const state = rateLimitState[bench];
  const minDelay = ECOURTS_CONFIG.rateLimit.delayBetweenRequests;
  
  const timeSinceLastRequest = now - state.lastRequest;
  
  if (timeSinceLastRequest < minDelay) {
    return { allowed: false, waitMs: minDelay - timeSinceLastRequest };
  }
  
  return { allowed: true, waitMs: 0 };
}

/**
 * Record that a request was made (update rate limit state)
 */
export function recordRequest(bench: Bench): void {
  rateLimitState[bench].lastRequest = Date.now();
  rateLimitState[bench].count++;
}
