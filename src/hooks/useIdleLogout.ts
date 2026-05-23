import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const IDLE_MS = 30 * 60 * 1000;
const WARNING_MS = 28 * 60 * 1000;
const DEBOUNCE_MS = 2_000;
const EVENTS: Array<keyof WindowEventMap> = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export function useIdleLogout(enabled: boolean) {
  const idleTimer = useRef<number | null>(null);
  const warningTimer = useRef<number | null>(null);
  const debounceTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (warningTimer.current) window.clearTimeout(warningTimer.current);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const scheduleLogout = () => {
      clearTimers();
      warningTimer.current = window.setTimeout(() => {
        toast.warning('Signing you out in 2 minutes due to inactivity.', {
          duration: 10_000,
        });
      }, WARNING_MS);
      idleTimer.current = window.setTimeout(async () => {
        await supabase.auth.signOut();
        toast.info('Signed out due to inactivity.');
      }, IDLE_MS);
    };

    const onActivity = () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
      debounceTimer.current = window.setTimeout(scheduleLogout, DEBOUNCE_MS);
    };

    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    scheduleLogout();

    return () => {
      clearTimers();
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [enabled, clearTimers]);
}
