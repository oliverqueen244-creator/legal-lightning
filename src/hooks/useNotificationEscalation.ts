import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCourtMode } from './useCourtMode';
import { useCourtNotifications, CourtNotification } from './useCourtNotifications';
import { toast } from 'sonner';

interface EscalationResult {
  success: boolean;
  error?: string;
}

export function useNotificationEscalation() {
  const { user, profile } = useAuth();
  const { settings: courtModeSettings, isWithinCourtHours } = useCourtMode();
  const { criticalUnacknowledged } = useCourtNotifications();

  // Track escalation timers
  const escalationTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Track already escalated notifications
  const escalatedNotifications = useRef<Set<string>>(new Set());

  // Escalate notification via WhatsApp
  const escalateNotification = useCallback(async (
    notification: CourtNotification
  ): Promise<EscalationResult> => {
    if (!user?.id || !profile?.whatsapp_number) {
      return { success: false, error: 'No WhatsApp number configured' };
    }

    // Safety checks (NON-NEGOTIABLE)
    if (!courtModeSettings?.court_mode_enabled) {
      return { success: false, error: 'Court Mode is disabled' };
    }

    if (!courtModeSettings?.whatsapp_escalation_enabled) {
      return { success: false, error: 'WhatsApp escalation is disabled' };
    }

    if (!isWithinCourtHours()) {
      return { success: false, error: 'Outside court hours' };
    }

    if (notification.severity !== 'critical') {
      return { success: false, error: 'Only critical notifications can be escalated' };
    }

    // Check if already escalated
    if (escalatedNotifications.current.has(notification.id)) {
      return { success: false, error: 'Already escalated' };
    }

    try {
      // Call edge function to send WhatsApp
      const { data, error } = await supabase.functions.invoke('escalate-whatsapp', {
        body: {
          notificationId: notification.id,
          userId: user.id,
          phoneNumber: profile.whatsapp_number,
          caseTitle: notification.title.replace('Case Approaching: ', '').replace('Case Skipped: ', ''),
          message: notification.message,
          caseFingerprint: notification.docket_id, // For daily limit check
        },
      });

      if (error) throw error;

      // Mark as escalated locally
      escalatedNotifications.current.add(notification.id);

      // Update notification status
      await supabase
        .from('notifications')
        .update({ status: 'escalated' })
        .eq('id', notification.id);

      console.log('[Escalation] WhatsApp sent for notification:', notification.id);
      return { success: true };
    } catch (error) {
      console.error('[Escalation] Failed to send WhatsApp:', error);
      return { success: false, error: String(error) };
    }
  }, [user?.id, profile?.whatsapp_number, courtModeSettings, isWithinCourtHours]);

  // Schedule escalation for a notification
  const scheduleEscalation = useCallback((notification: CourtNotification) => {
    // Don't schedule if already has a timer or already escalated
    if (escalationTimers.current.has(notification.id)) return;
    if (escalatedNotifications.current.has(notification.id)) return;

    // Determine acknowledgement window based on threshold
    let windowMs: number;
    switch (notification.threshold_crossed) {
      case 'exception': // Skipped - immediate escalation
        windowMs = 0;
        break;
      case 'immediate': // 0-2 items
        windowMs = 1 * 60 * 1000; // 1 minute
        break;
      case 'imminent': // 3-5 items
        windowMs = 3 * 60 * 1000; // 3 minutes
        break;
      default:
        return; // Don't escalate for early_warning or null
    }

    // If immediate (skipped), escalate right away
    if (windowMs === 0) {
      escalateNotification(notification);
      return;
    }

    // Schedule escalation
    const timer = setTimeout(async () => {
      // Re-check if notification is still unacknowledged
      const { data: current } = await supabase
        .from('notifications')
        .select('status')
        .eq('id', notification.id)
        .maybeSingle();

      if (current?.status === 'sent') {
        // Still unacknowledged, escalate
        const result = await escalateNotification(notification);
        if (result.success) {
          toast.info('Alert escalated via WhatsApp', {
            description: 'A critical court alert was sent to your WhatsApp.',
          });
        }
      }

      escalationTimers.current.delete(notification.id);
    }, windowMs);

    escalationTimers.current.set(notification.id, timer);
    console.log(`[Escalation] Scheduled for notification ${notification.id} in ${windowMs / 1000}s`);
  }, [escalateNotification]);

  // Cancel escalation timer
  const cancelEscalation = useCallback((notificationId: string) => {
    const timer = escalationTimers.current.get(notificationId);
    if (timer) {
      clearTimeout(timer);
      escalationTimers.current.delete(notificationId);
      console.log(`[Escalation] Cancelled for notification ${notificationId}`);
    }
  }, []);

  // Monitor critical unacknowledged notifications and schedule escalations
  useEffect(() => {
    if (!courtModeSettings?.court_mode_enabled) return;
    if (!courtModeSettings?.whatsapp_escalation_enabled) return;
    if (!isWithinCourtHours()) return;

    criticalUnacknowledged.forEach((notification) => {
      scheduleEscalation(notification);
    });

    const currentTimers = escalationTimers.current;
    // Cleanup: cancel timers for acknowledged notifications
    return () => {
      currentTimers.forEach((timer, id) => {
        const stillUnacked = criticalUnacknowledged.some(n => n.id === id);
        if (!stillUnacked) {
          clearTimeout(timer);
          currentTimers.delete(id);
        }
      });
    };
  }, [criticalUnacknowledged, courtModeSettings, isWithinCourtHours, scheduleEscalation]);

  // Cleanup all timers on unmount
  useEffect(() => {
    const currentTimers = escalationTimers.current;
    return () => {
      currentTimers.forEach((timer) => clearTimeout(timer));
      currentTimers.clear();
    };
  }, []);

  return {
    escalateNotification,
    cancelEscalation,
    pendingEscalations: escalationTimers.current.size,
  };
}
