import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { registerCurrentDeviceSession, touchCurrentDeviceSession } from '@/lib/sessions';

/**
 * Invisible component that keeps the device session in sync.
 *
 * - On mount while authenticated, registers the current device in public.user_sessions.
 * - Every 5 minutes, touches the session so it appears "active" in the admin/user
 *   session panel.
 *
 * Place this once near the top of the React tree.
 */
export function AppBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Initial registration - best effort, never throws.
    registerCurrentDeviceSession();

    const id = window.setInterval(() => {
      touchCurrentDeviceSession();
    }, 5 * 60 * 1000);

    return () => window.clearInterval(id);
  }, [user]);

  return null;
}
