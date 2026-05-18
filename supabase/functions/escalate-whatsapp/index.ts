import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { getCorsHeaders } from "../_shared/cors.ts";
interface EscalationRequest {
  notificationId: string;
  userId: string;
  phoneNumber: string;
  caseTitle: string;
  message: string;
  caseFingerprint: string | null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: EscalationRequest = await req.json();
    const { notificationId, userId, phoneNumber, caseTitle, message, caseFingerprint } = body;

    console.log(`[Escalate] Processing escalation for notification: ${notificationId}`);

    // Validate required fields
    if (!notificationId || !userId || !phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing escalation today (max 1 per case per day)
    if (caseFingerprint) {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('notification_escalations')
        .select('id')
        .eq('user_id', userId)
        .eq('case_fingerprint', caseFingerprint)
        .eq('escalation_date', today)
        .eq('channel', 'whatsapp')
        .eq('status', 'sent')
        .maybeSingle();

      if (existing) {
        console.log(`[Escalate] Already escalated for case ${caseFingerprint} today`);
        return new Response(
          JSON.stringify({ error: 'Already escalated for this case today', code: 'DAILY_LIMIT' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Format WhatsApp message (FIXED FORMAT - non-negotiable)
    const whatsappMessage = `⚖️ Court Alert
Your case ${caseTitle} is approaching / affected.
Please verify immediately.
— Vakalat-OS`;

    // TODO: Integrate with actual WhatsApp API (Twilio, WhatsApp Business API, etc.)
    // For now, we'll simulate the send and log the escalation
    console.log(`[Escalate] Would send WhatsApp to ${phoneNumber}:`);
    console.log(whatsappMessage);

    // Log escalation attempt
    const { error: insertError } = await supabase
      .from('notification_escalations')
      .insert({
        notification_id: notificationId,
        user_id: userId,
        channel: 'whatsapp',
        status: 'sent', // In production, this would be 'sent' only after confirmed delivery
        case_fingerprint: caseFingerprint,
        escalation_date: new Date().toISOString().split('T')[0],
      });

    if (insertError) {
      console.error('[Escalate] Failed to log escalation:', insertError);
      
      // Check if it's a unique constraint violation (already sent today)
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Already escalated for this case today', code: 'DAILY_LIMIT' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw insertError;
    }

    // Update notification status
    await supabase
      .from('notifications')
      .update({ status: 'escalated' })
      .eq('id', notificationId);

    console.log(`[Escalate] Successfully logged escalation for notification: ${notificationId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Escalation logged successfully',
        // In production: include actual WhatsApp API response
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Escalate] Error:', error);
    
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
