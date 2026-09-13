-- P0-03: cek revoke sesi dari client (dipakai AppBootstrap + useAuth).
--
-- Masalah: revoke_user_session_by_hash hanya set revoked_at — JWT di device
-- tetap valid sampai expiry. Client tidak pernah cek revoked_at, jadi revoke
-- hanya kosmetik. RPC ini memberi client cara murah cek "apakah sesi device
-- ini sudah dicabut" via fingerprint hash.

CREATE OR REPLACE FUNCTION public.is_session_revoked(p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM public.user_sessions
     WHERE refresh_token_hash = p_hash
       AND user_id = v_uid
       AND revoked_at IS NOT NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_session_revoked(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_session_revoked(TEXT) TO authenticated;

COMMENT ON FUNCTION public.is_session_revoked(TEXT) IS
  'P0-03: TRUE jika sesi device (fingerprint hash) milik auth.uid() sudah revoked_at. Dipakai AppBootstrap/useAuth untuk paksa logout <=5 mnt setelah revoke.';
