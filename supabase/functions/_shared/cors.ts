/**
 * Shared CORS helper.
 *
 * Configure ALLOWED_ORIGINS as a comma-separated list in the edge function
 * environment (e.g. "https://app.example.com,https://staging.example.com").
 * Lovable preview domains matching *.lovable.app are accepted by pattern.
 *
 * If ALLOWED_ORIGINS is unset, requests from non-Lovable origins receive
 * the first configured origin (or 'null') — never a wildcard.
 */

const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const LOVABLE_PATTERN = /^https:\/\/[a-z0-9-]+\.lovable\.app$/i;

function isAllowed(origin: string): boolean {
  if (envOrigins.includes(origin)) return true;
  if (LOVABLE_PATTERN.test(origin)) return true;
  return false;
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
