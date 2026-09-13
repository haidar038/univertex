import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { registerCurrentDeviceSession, touchCurrentDeviceSession, isCurrentSessionRevoked } from '@/lib/sessions';
import { toast } from 'sonner';

/**
 * Invisible component that keeps the device session in sync.
 *
 * - On mount while authenticated, registers the current device in public.user_sessions.
 * - Every 5 minutes, touches the session so it appears "active" in the admin/user
 *   session panel.
 * - P0-03: on mount + every 5 min, checks is_session_revoked via
 *   isCurrentSessionRevoked(); if revoked -> signOut() + toast. Best-effort:
 *   never throws if the RPC does not exist yet (migration not applied).
 *
 * Place this once near the top of the React tree.
 */
export function AppBootstrap() {
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Initial registration - best effort, never throws.
    registerCurrentDeviceSession();

    // P0-03: immediate revoke check on mount (<=5 mnt enforcement).
    let cancelled = false;
    isCurrentSessionRevoked()
      .then((revoked) => {
        if (!cancelled && revoked) {
          toast.error('Sesi dicabut, silakan login ulang.');
          void signOut();
        }
      })
      .catch(() => undefined);

    const id = window.setInterval(() => {
      touchCurrentDeviceSession();
      // P0-03: periodic revoke check.
      isCurrentSessionRevoked()
        .then((revoked) => {
          if (!cancelled && revoked) {
            toast.error('Sesi dicabut, silakan login ulang.');
            void signOut();
          }
        })
        .catch(() => undefined);
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user, signOut]);

  return null;
}