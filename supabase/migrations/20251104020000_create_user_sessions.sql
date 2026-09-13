-- Migration: Create user_sessions table
-- Tracks each "device"/browser that is currently signed in to a given account.
-- Used for:
--   * Showing "active sessions" to admins (and to the user)
--   * Detecting concurrent logins from different devices
--   * Revoking individual sessions
--
-- Note: Supabase Auth issues refresh tokens per device. We do not store the raw
-- token; we store a SHA-256 hash of the device fingerprint plus metadata so that
-- we can revoke a session without holding a plaintext secret.
--
-- NOTE (fix): the GRANT statement in the original file used the wrong argument
-- type list - (TEXT, INET, TEXT, TEXT, TIMESTAMPTZ) - which did not match the
-- actual function signature (TEXT, TEXT, INET, TEXT, TIMESTAMPTZ) and failed
-- with ERROR 42883. register_user_session also now UPSERTs so re-login from
-- the same device refreshes the row instead of hitting the UNIQUE constraint.

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token_hash  TEXT NOT NULL UNIQUE,    -- SHA-256 of the device fingerprint
  user_agent          TEXT,
  ip_address          INET,
  device_label        TEXT,                    -- best-effort: 'Chrome on Windows', 'iPhone Safari', etc.
  is_current          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ,             -- mirrors refresh-token expiry if known
  revoked_at          TIMESTAMPTZ,             -- non-null means revoked
  revoked_reason      TEXT                     -- 'user_logout' | 'admin_revoke' | 'expired'
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user        ON public.user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active      ON public.user_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen    ON public.user_sessions (last_seen_at DESC);

COMMENT ON TABLE public.user_sessions IS
  'One row per active device fingerprint. Used for concurrent-device detection and session revocation.';

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- A user can see their own sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
CREATE POLICY "Users can view their own sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all sessions (for audit / support purposes)
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.user_sessions;
CREATE POLICY "Admins can view all sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Inserts: allowed only for the session owner (client inserts via RPC below)
DROP POLICY IF EXISTS "Service can insert sessions" ON public.user_sessions;
CREATE POLICY "Service can insert sessions"
  ON public.user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- A user can revoke their own sessions; admins can revoke any session
DROP POLICY IF EXISTS "Users can revoke own sessions" ON public.user_sessions;
CREATE POLICY "Users can revoke own sessions"
  ON public.user_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can revoke any session" ON public.user_sessions;
CREATE POLICY "Admins can revoke any session"
  ON public.user_sessions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- Helper RPCs
-- ============================================================

-- Register (or refresh) a session for the currently-authenticated user.
-- The hash is computed client-side; we just store it. If the same device
-- registers again (re-login / app restart) we refresh the existing row
-- instead of failing on the UNIQUE constraint.
CREATE OR REPLACE FUNCTION public.register_user_session(
  p_refresh_token_hash TEXT,
  p_user_agent         TEXT DEFAULT NULL,
  p_ip_address         INET DEFAULT NULL,
  p_device_label       TEXT DEFAULT NULL,
  p_expires_at         TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_sessions (
    user_id, refresh_token_hash, user_agent, ip_address, device_label, expires_at
  ) VALUES (
    v_uid, p_refresh_token_hash, p_user_agent, p_ip_address, p_device_label, p_expires_at
  )
  ON CONFLICT (refresh_token_hash) DO UPDATE
    SET user_id       = EXCLUDED.user_id,
        user_agent    = EXCLUDED.user_agent,
        ip_address    = EXCLUDED.ip_address,
        device_label  = EXCLUDED.device_label,
        expires_at    = EXCLUDED.expires_at,
        last_seen_at  = now(),
        revoked_at    = NULL,
        revoked_reason = NULL
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- GRANT signature MUST match the function definition above exactly:
-- (TEXT, TEXT, INET, TEXT, TIMESTAMPTZ)
GRANT EXECUTE ON FUNCTION public.register_user_session(TEXT, TEXT, INET, TEXT, TIMESTAMPTZ) TO authenticated;

-- Touch last_seen_at for a session (called periodically by the client)
CREATE OR REPLACE FUNCTION public.touch_user_session(p_refresh_token_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_sessions
     SET last_seen_at = now()
   WHERE refresh_token_hash = p_refresh_token_hash
     AND revoked_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_user_session(TEXT) TO authenticated;

-- Revoke a session (user themselves or admin)
CREATE OR REPLACE FUNCTION public.revoke_user_session(
  p_session_id      UUID,
  p_revoked_reason  TEXT DEFAULT 'user_logout'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_owner UUID;
  v_is_admin BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner FROM public.user_sessions WHERE id = p_session_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  IF v_owner <> v_uid AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorised to revoke this session';
  END IF;

  UPDATE public.user_sessions
     SET revoked_at = now(),
         revoked_reason = p_revoked_reason
   WHERE id = p_session_id
     AND revoked_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_user_session(UUID, TEXT) TO authenticated;
