-- Harden admin_update_password so the generated password actually works at
-- login.
--
-- Symptom: after an admin resets a password in the admin panel, the user
-- cannot sign in with the generated password at all.
--
-- Two root causes addressed here:
--
-- 1) Accounts created before 20260909000000 (legacy seeds and the older
--    admin_create_user / invitation flows) inserted rows into auth.users
--    without a matching auth.identities row. GoTrue's password grant
--    requires an email identity; without one the auth API returns 500 for
--    ANY password, so no reset can ever succeed for those accounts.
--
-- 2) Accounts with email_confirmed_at IS NULL cannot sign in when the
--    project requires email confirmation.
--
-- The fix inserts the missing email identity (idempotent) and marks the
-- email confirmed, then updates the password hash as before. This also
-- self-heals any pre-existing broken account at the moment an admin
-- resets its password.

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

  -- Ensure the GoTrue email identity exists so the password grant can
  -- succeed. Accounts created before the 20260909 repair migration lack
  -- this row, which made every login attempt fail with auth API 500.
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, created_at, updated_at
  )
  SELECT
    gen_random_uuid(), u.id, u.id::TEXT, 'email',
    jsonb_build_object(
      'sub', u.id::TEXT,
      'email', u.email,
      'email_verified', true,
      'phone_verified', false
    ),
    now(), now()
  FROM auth.users u
  WHERE u.id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM auth.identities i
      WHERE i.user_id = p_user_id AND i.provider = 'email'
    );

  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf', 10)),
      updated_at = now(),
      -- An admin-set password implies the email is valid; a NULL
      -- email_confirmed_at would block sign-in on projects that require
      -- confirmation.
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
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
  'Requires user.reset_password permission. Admin-initiated password reset for a specific user. Also repairs a missing GoTrue email identity so the new password can actually be used to sign in.';
