-- Fix admin-initiated password reset.
--
-- ResetPasswordDialog.tsx generates a strong password and lets the admin
-- share it manually with the user.  However there was no RPC that actually
-- persisted the new password into auth.users.encrypted_password, so the
-- generated password never worked at login.
--
-- This migration adds admin_update_password(p_user_id, p_password) which:
--   * Requires caller_has_permission('user.reset_password')
--   * Hashes with pgcrypto crypt/gen_salt (search_path = extensions, public)
--   * Invalidates existing refresh tokens by bumping the user's
--     refresh_token_revocation_timestamp — forces a clean re-login
--   * Writes an audit_log entry
--
-- The admin_list_users permission set already grants 'user.reset_password'
-- to the admin role (migration 20251109000100).

CREATE OR REPLACE FUNCTION public.admin_update_password(
  p_user_id UUID,
  p_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_email TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.caller_has_permission('user.reset_password'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.reset_password' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id tidak boleh kosong' USING ERRCODE = 'P0001';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password minimal 8 karakter' USING ERRCODE = 'P0001';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf', 10)),
      updated_at = now(),
      -- Force all existing refresh tokens / sessions to become invalid so the
      -- user must sign in with the new password rather than an old session.
      refresh_token_revocation_timestamp = now()
  WHERE id = p_user_id;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role, action, category, target_type, target_id,
    description, metadata, severity
  ) VALUES (
    v_actor, (SELECT email FROM auth.users WHERE id = v_actor), 'admin',
    'user.reset_password', 'admin', 'auth.users', p_user_id::TEXT,
    'Reset password for user ' || v_email,
    jsonb_build_object('user_id', p_user_id, 'email', lower(v_email)),
    'info'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_password(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_password(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_update_password(UUID, TEXT) IS
  'Requires user.reset_password permission. Admin-initiated password reset for a specific user.';
