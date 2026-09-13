-- Migration: Add revoke_user_session_by_hash RPC
--
-- Problem: useAuth.signOut() passed the device fingerprint HASH to
-- revoke_user_session, whose parameter is a session row UUID. The UPDATE
-- silently matched 0 rows, so user_sessions.revoked_at was never set on
-- logout. This RPC accepts the hash directly.
--
-- Security: only the session owner may revoke it (the row is matched by the
-- client-known hash and must belong to auth.uid()).

CREATE OR REPLACE FUNCTION public.revoke_user_session_by_hash(
  p_refresh_token_hash TEXT,
  p_revoked_reason    TEXT DEFAULT 'user_logout'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_owner UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner
    FROM public.user_sessions
   WHERE refresh_token_hash = p_refresh_token_hash;

  IF v_owner IS NULL THEN
    -- Unknown hash (e.g. session row was never registered) - nothing to do.
    RETURN;
  END IF;

  IF v_owner <> v_uid THEN
    RAISE EXCEPTION 'Not authorised to revoke this session'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_sessions
     SET revoked_at = now(),
         revoked_reason = p_revoked_reason
   WHERE refresh_token_hash = p_refresh_token_hash
     AND user_id = v_uid
     AND revoked_at IS NULL;
END;
$$;

-- Narrow the default PUBLIC grant: only authenticated users may call this.
REVOKE EXECUTE ON FUNCTION public.revoke_user_session_by_hash(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_user_session_by_hash(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.revoke_user_session_by_hash(TEXT, TEXT) IS
  'Revoke the current user''s session row by device fingerprint hash. Used on logout where only the hash (not the row id) is known client-side.';
