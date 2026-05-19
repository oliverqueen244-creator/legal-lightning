/**
 * Sentry initialisation stub. The real `@sentry/react` SDK is intentionally
 * not installed yet — the app reports critical errors to admin_error_events
 * via reportError, and we don't want to ship a second telemetry vendor until
 * the user provides a DSN and reviews the data-flow against the privacy
 * policy.
 *
 * When VITE_SENTRY_DSN is set, this module logs a one-time notice so it's
 * obvious during local dev that Sentry would have initialised. To actually
 * wire it up:
 *
 *   1. npm install @sentry/react
 *   2. Replace the body of initSentry() with:
 *        import * as Sentry from "@sentry/react";
 *        Sentry.init({ dsn, tracesSampleRate: 0.1, ... });
 *   3. Add the corresponding consent_type 'EXTERNAL_TELEMETRY' to the
 *      ConsentStep so users opt in before any event is sent.
 */

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  if (import.meta.env.DEV) {
    console.info("[sentry] DSN detected — install @sentry/react and wire up before going live.");
  }
}
