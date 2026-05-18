/**
 * C-3: P0 error alerting.
 *
 * Scans admin_error_events for unresolved P0 entries in the last hour
 * and posts a summary to Telegram. Scheduled via pg_cron — see
 * 20260518000002_alert_p0_errors_cron.sql.
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *               TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_CHAT_ID
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: errors, error } = await supabase
    .from('admin_error_events')
    .select('error_code, message, domain, created_at')
    .eq('severity', 'P0')
    .eq('resolved', false)
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[alert-p0-errors] query failed', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const count = errors?.length ?? 0;

  if (count > 0) {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('ADMIN_TELEGRAM_CHAT_ID');

    if (botToken && chatId) {
      const message =
        `🚨 NyayHub P0 alert\n${count} unresolved P0 errors in last hour:\n\n` +
        errors.slice(0, 5).map((e) =>
          `• ${e.domain}: ${e.error_code}\n  ${(e.message ?? '').slice(0, 120)}`,
        ).join('\n\n');

      const tgResp = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message }),
        },
      );

      if (!tgResp.ok) {
        console.error('[alert-p0-errors] telegram send failed', await tgResp.text());
      }
    } else {
      console.warn('[alert-p0-errors] TELEGRAM_BOT_TOKEN or ADMIN_TELEGRAM_CHAT_ID not set; skipping send');
    }
  }

  return new Response(
    JSON.stringify({ checked: true, p0_count: count }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
