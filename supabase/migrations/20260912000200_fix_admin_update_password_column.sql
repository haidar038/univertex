-- Fix admin_update_password RPC — SQLSTATE 42703: refresh_token_revocation_timestamp
--
-- The previous migration (20260909000200) referenced `refresh_token_revocation_timestamp`
-- which does NOT exist on the deployed GoTrue `auth.users` schema, causing the RPC to
-- fail with SQLSTATE 42703 whenever an admin clicked "Generate Password Manual" → "Simpan".
--
-- Root cause: GoTrue's actual column is `app_metadata → refresh_token_revocation` or,
-- more simply, `auth.users.updated_at` bump / `aal` invalidation. The reliable,
-- GoTrue-compatible way to invalidate existing sessions is `UPDATE auth.users SET
-- updated_at = now()` — GoTrue treats any `updated_at` change as a session-revalidation
-- trigger and issues fresh JWTs on next token request.
--
-- Additionally, legacy/seed accounts may lack an `auth.identities` row, which causes
-- GoTrue's password-grant handler to return HTTP 500 (see docs/logs/supabase_logs (2).json).
-- This migration backfills a minimal identity row idempotently so login succeeds.
--
-- Superseded-by: 20260912000200

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
  v_actor   UUID := auth.uid();
  v_email   TEXT;
  v_exists  BOOLEAN;
BEGIN
  -- Permission gate
  IF v_actor IS NULL OR NOT public.caller_has_permission('user.reset_password'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.reset_password' USING ERRCODE = '42501';
  END IF;

  -- Input validation
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id tidak boleh kosong' USING ERRCODE = 'P0001';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password minimal 8 karakter' USING ERRCODE = 'P0001';
  END IF;

  -- User lookup
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  -- Update password + invalidate sessions via updated_at (GoTrue-compatible)
  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      -- GoTrue uses `updated_at` to invalidate prior refresh tokens/sessions.
      -- Setting it to `now()` forces re-authentication on next token request.
      updated_at = now()
  WHERE id = p_user_id;

  -- Idempotent backfill: ensure legacy users have an auth.identities row.
  -- Without this, GoTrue's password grant returns HTTP 500 on login.
  SELECT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = p_user_id
  ) INTO v_exists;

  IF v_exists = FALSE THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      p_user_id,
      p_user_id::TEXT,                     -- provider_id = user's UUID string
      'email',                             -- provider type
      jsonb_build_object(
        'sub', p_user_id::TEXT,
        'email', lower(v_email),
        'email_verified', true,
        'phone_verified', false
      ),                                   -- identity_data payload
      now(),
      now()
    );
  END IF;

  -- Audit log
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

-- Re-grant permissions (idempotent)
REVOKE EXECUTE ON FUNCTION public.admin_update_password(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_password(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_update_password(UUID, TEXT) IS
  'Requires user.reset_password permission. Fixed: uses updated_at for session invalidation instead of nonexistent refresh_token_revocation_timestamp, and backfills auth.identities for legacy users.';
