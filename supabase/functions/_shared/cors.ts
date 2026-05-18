/**
 * Shared CORS helper.
 *
 * Configure ALLOWED_ORIGINS as a comma-separated list in the edge function
 * environment (e.g. "https://app.example.com,https://staging.example.com").
 *
 * If ALLOWED_ORIGINS is unset, requests fall back to the first configured
 * origin (or 'null') — never a wildcard.
 */

const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowed(origin: string): boolean {
  return envOrigins.includes(origin);
}

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin = requestOrigin && isAllowed(requestOrigin)
    ? requestOrigin
    : (envOrigins[0] ?? 'null');

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}
