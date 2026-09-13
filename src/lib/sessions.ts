/**
 * Device session tracking.
 *
 * After login (or on app start while authenticated) we register a row in
 * public.user_sessions. The "refresh_token_hash" identifies the device - we
 * hash a device fingerprint client-side so the server never sees anything
 * that would let it impersonate a session on its own.
 */

import { supabase } from '@/integrations/supabase/client';
import { buildDeviceFingerprint } from './device';

export interface UserSessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  user_agent: string | null;
  ip_address: string | null;
  device_label: string | null;
  is_current: boolean;
  created_at: string;
  last_seen_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
}

/** Register the current device's session. Safe to call multiple times. */
export async function registerCurrentDeviceSession(): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return null;

    const fp = await buildDeviceFingerprint();
    const { data, error } = await supabase.rpc('register_user_session', {
      p_refresh_token_hash: fp.hash,
      p_user_agent: navigator.userAgent.slice(0, 500),
      p_device_label: fp.label,
      p_expires_at: sessionData.session.expires_at
        ? new Date(sessionData.session.expires_at * 1000).toISOString()
        : null,
    });

    if (error) {
      console.warn('[sessions] register_user_session failed:', error.message);
      return null;
    }
    return data as string;
  } catch (e) {
    console.warn('[sessions] unexpected error:', e);
    return null;
  }
}

/** Update last_seen for the current device. */
export async function touchCurrentDeviceSession(): Promise<void> {
  try {
    const fp = await buildDeviceFingerprint();
    await supabase.rpc('touch_user_session', { p_refresh_token_hash: fp.hash });
  } catch {
    // Best-effort.
  }
}

export async function listMySessions(): Promise<UserSessionRow[]> {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .order('last_seen_at', { ascending: false });
  if (error) {
    console.error('[sessions] listMySessions:', error);
    return [];
  }
  return (data || []) as UserSessionRow[];
}

export async function listUserSessions(userId: string): Promise<UserSessionRow[]> {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false });
  if (error) {
    console.error('[sessions] listUserSessions:', error);
    return [];
  }
  return (data || []) as UserSessionRow[];
}

export async function revokeSession(
  sessionId: string,
  reason: 'user_logout' | 'admin_revoke' = 'admin_revoke'
): Promise<boolean> {
  const { error } = await supabase.rpc('revoke_user_session', {
    p_session_id: sessionId,
    p_revoked_reason: reason,
  });
  return !error;
}

/**
 * Revoke a session by its device-fingerprint hash (used on logout, where
 * only the hash is known client-side - not the session row id).
 */
export async function revokeSessionByHash(
  hash: string,
  reason: 'user_logout' | 'admin_revoke' = 'user_logout'
): Promise<boolean> {
  const { error } = await supabase.rpc('revoke_user_session_by_hash', {
    p_refresh_token_hash: hash,
    p_revoked_reason: reason,
  });
  return !error;
}

/**
 * P0-03: cek apakah sesi device ini sudah dicabut (via RPC is_session_revoked).
 * Best-effort: return false jika RPC belum ada (404) atau network gagal —
 * jangan crash AppBootstrap/useAuth karena migration belum apply.
 */
export async function isCurrentSessionRevoked(): Promise<boolean> {
  try {
    const fp = await buildDeviceFingerprint();
    const { data, error } = await supabase.rpc('is_session_revoked', {
      p_hash: fp.hash,
    } as never);
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/** Keluar dari semua device lain: revoke tiap sesi aktif kecuali sesi ini. */
export async function revokeAllMySessions(): Promise<number> {
  const fp = await buildDeviceFingerprint().catch(() => null);
  const rows = await listMySessions();
  let revoked = 0;
  for (const row of rows) {
    if (row.revoked_at) continue;
    // Jangan cabut sesi device ini — user tetap login di sini.
    if (fp && row.refresh_token_hash === fp.hash) continue;
    const ok = await revokeSession(row.id, 'user_logout');
    if (ok) revoked += 1;
  }
  return revoked;
}
