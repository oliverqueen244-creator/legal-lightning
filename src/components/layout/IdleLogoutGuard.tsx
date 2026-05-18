import { useAuth } from '@/hooks/useAuth';
import { useIdleLogout } from '@/hooks/useIdleLogout';

/**
 * Auto-signs out an authenticated user after 30 minutes of inactivity.
 * Critical for shared courtroom devices.
 */
export function IdleLogoutGuard() {
  const { session } = useAuth();
  useIdleLogout(Boolean(session));
  return null;
}
