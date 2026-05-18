import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const IDLE_MS = 30 * 60 * 1000; // 30 min — court complexes have shared devices
const WARNING_MS = 28 * 60 * 1000; // warn 2 min before
const EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export function useIdleLogout(enabled: boolean) {
  const idleTimer = useRef<number | null>(null);
  const warningTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const clearTimers = () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      if (warningTimer.current) window.clearTimeout(warningTimer.current);
    };

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

    EVENTS.forEach((e) => window.addEventListener(e, scheduleLogout, { passive: true }));
    scheduleLogout();

    return () => {
      clearTimers();
      EVENTS.forEach((e) => window.removeEventListener(e, scheduleLogout));
    };
  }, [enabled]);
}
