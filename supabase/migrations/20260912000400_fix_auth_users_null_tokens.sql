-- Fix GoTrue password grant 500: NULL token columns in auth.users
--
-- Symptom: after an admin resets a password via admin_update_password (RPC
-- returns 204, hash is updated), the user still cannot sign in. GoTrue logs:
--
--   error finding user: sql: Scan error on column index 3, name
--   "confirmation_token": converting NULL to string is unsupported
--   -> POST /auth/v1/token 500 (error_code: unexpected_failure)
--
-- Root cause: rows inserted directly into auth.users (admin_create_user,
-- accept_invitation_and_register, test seeds) leave the one-time token
-- columns as NULL. GoTrue scans these columns as non-nullable strings, so
-- ANY password grant for such a user crashes with a 500 regardless of the
-- password. Accounts created through the Supabase Dashboard / GoTrue API
-- store empty strings ('') in these columns and work fine.
--
-- Fix (three parts, all idempotent):
--   1) Normalize existing NULL token columns to '' for all auth.users rows.
--   2) Harden admin_update_password to normalize the same columns on every
--      reset, so a reset also self-heals a broken row.
--   3) Harden admin_create_user and accept_invitation_and_register to
--      explicitly insert '' for the token columns so new users are never
--      created with NULLs.

-- ============================================================
-- 1) Normalize existing rows
-- ============================================================
UPDATE auth.users
SET confirmation_token    = '',
    recovery_token        = '',
    email_change_token_new = '',
    email_change_token_current = '',
    reauthentication_token = '',
    phone_change_token    = ''
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR reauthentication_token IS NULL
   OR phone_change_token IS NULL;

-- ============================================================
-- 2) Harden admin_update_password (self-healing reset)
-- ============================================================
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
      -- Normalize one-time token columns: GoTrue scans them as non-nullable
      -- strings; a NULL here makes EVERY password grant for this user fail
      -- with 500 ("converting NULL to string is unsupported").
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      reauthentication_token = COALESCE(reauthentication_token, ''),
      phone_change_token = COALESCE(phone_change_token, '')
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
  'Requires user.reset_password permission. Admin-initiated password reset. Also repairs a missing GoTrue email identity and normalizes NULL one-time token columns (which otherwise make GoTrue password grant fail with 500).';

-- ============================================================
-- 3) Harden user creation paths: never insert NULL token columns
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email             TEXT,
  p_full_name         TEXT,
  p_password          TEXT,
  p_student_id        TEXT,
  p_class_id          UUID DEFAULT NULL,
  p_department        TEXT DEFAULT NULL,
  p_skip_confirmation BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_new_uid UUID := gen_random_uuid();
  v_existing UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.caller_has_permission('user.create'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.create' USING ERRCODE = '42501';
  END IF;
  IF p_email IS NULL OR BTRIM(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Format email tidak valid' USING ERRCODE = 'P0001';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password minimal 8 karakter' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(BTRIM(p_email))) THEN
    RAISE EXCEPTION 'Email sudah terdaftar' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE student_id = p_student_id) THEN
    RAISE EXCEPTION 'NIM sudah digunakan' USING ERRCODE = '23505';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    email_change, email_change_token_new,
    -- GoTrue scans these as non-nullable strings; NULL breaks password grant.
    confirmation_token, recovery_token, reauthentication_token,
    email_change_token_current, phone_change_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_new_uid, 'authenticated', 'authenticated',
    lower(BTRIM(p_email)), crypt(p_password, gen_salt('bf', 10)),
    CASE WHEN p_skip_confirmation THEN now() ELSE NULL END,
    '{"provider":"email","providers":["email"]}'::JSONB,
    jsonb_build_object(
      'full_name', p_full_name, 'student_id', p_student_id,
      'department', p_department, 'class_id', p_class_id::TEXT
    ), now(), now(), '', '',
    '', '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_new_uid, v_new_uid::TEXT, 'email',
    jsonb_build_object(
      'sub', v_new_uid::TEXT, 'email', lower(BTRIM(p_email)),
      'email_verified', p_skip_confirmation, 'phone_verified', false
    ), now(), now()
  ) ON CONFLICT (provider_id, provider) DO UPDATE
    SET user_id = EXCLUDED.user_id, identity_data = EXCLUDED.identity_data, updated_at = now();

  UPDATE public.profiles
  SET full_name = COALESCE(NULLIF(BTRIM(p_full_name), ''), full_name),
      student_id = p_student_id,
      department = NULLIF(BTRIM(p_department), ''),
      class_id = p_class_id
  WHERE id = v_new_uid;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role, action, category, target_type, target_id,
    description, metadata, severity
  ) VALUES (
    v_uid, (SELECT email FROM auth.users WHERE id = v_uid), 'admin',
    'user.create', 'admin', 'auth.users', v_new_uid::TEXT,
    'Created user ' || p_full_name || ' (' || p_student_id || ')',
    jsonb_build_object('email', lower(BTRIM(p_email)), 'student_id', p_student_id, 'class_id', p_class_id),
    'info'
  );
  RETURN v_new_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_invitation_and_register(
  p_token TEXT,
  p_password TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_new_uid UUID := gen_random_uuid();
  v_existing UUID;
BEGIN
  SELECT * INTO v_inv FROM public.invitations
  WHERE token = p_token AND accepted_at IS NULL AND revoked_at IS NULL LIMIT 1;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Undangan tidak ditemukan atau sudah digunakan' USING ERRCODE = 'P0002';
  END IF;
  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Undangan sudah kedaluwarsa' USING ERRCODE = 'P0001';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password minimal 8 karakter' USING ERRCODE = 'P0001';
  END IF;
  IF p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'Password harus mengandung huruf dan angka' USING ERRCODE = 'P0001';
  END IF;
  SELECT id INTO v_existing FROM auth.users WHERE lower(email) = lower(v_inv.email) LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Akun dengan email ini sudah terdaftar. Silakan login terlebih dahulu.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    email_change, email_change_token_new,
    -- GoTrue scans these as non-nullable strings; NULL breaks password grant.
    confirmation_token, recovery_token, reauthentication_token,
    email_change_token_current, phone_change_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_new_uid, 'authenticated', 'authenticated',
    lower(v_inv.email), crypt(p_password, gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::JSONB,
    jsonb_build_object('full_name', v_inv.full_name, 'student_id', v_inv.student_id),
    now(), now(), '', '',
    '', '', '', '', ''
  );
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_new_uid, v_new_uid::TEXT, 'email',
    jsonb_build_object(
      'sub', v_new_uid::TEXT, 'email', lower(v_inv.email),
      'email_verified', true, 'phone_verified', false
    ), now(), now()
  );

  UPDATE public.profiles
  SET full_name = COALESCE(v_inv.full_name, full_name),
      student_id = COALESCE(v_inv.student_id, student_id),
      class_id = COALESCE(v_inv.class_id, class_id)
  WHERE id = v_new_uid;

  INSERT INTO public.user_roles (user_id, role)
  SELECT v_new_uid, role_name::public.app_role
  FROM unnest(COALESCE(v_inv.roles, ARRAY['voter']::TEXT[])) AS role_name
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_inv.intent = 'candidate' AND v_inv.event_id IS NOT NULL THEN
    INSERT INTO public.candidates (user_id, event_id, status)
    VALUES (v_new_uid, v_inv.event_id, 'pending'::public.candidate_status)
    ON CONFLICT (user_id, event_id) DO NOTHING;
  ELSIF v_inv.intent = 'committee' AND v_inv.event_id IS NOT NULL THEN
    INSERT INTO public.election_committees (election_id, user_id, committee_role)
    VALUES (
      v_inv.event_id, v_new_uid,
      COALESCE((v_inv.metadata ->> 'committee_role')::public.committee_role, 'member'::public.committee_role)
    )
    ON CONFLICT (election_id, user_id, committee_role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_new_uid, 'committee'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF v_inv.intent = 'observer' AND v_inv.event_id IS NOT NULL THEN
    INSERT INTO public.election_observers (election_id, user_id)
    VALUES (v_inv.event_id, v_new_uid)
    ON CONFLICT (election_id, user_id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_new_uid, 'observer'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  UPDATE public.invitations
  SET accepted_at = now(), accepted_user_id = v_new_uid
  WHERE id = v_inv.id;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role, action, category, target_type, target_id,
    description, metadata, severity
  ) VALUES (
    v_new_uid, lower(v_inv.email), NULL, 'invitation.register', 'auth', 'invitations', v_inv.id::TEXT,
    'User registered via invitation',
    jsonb_build_object('email', lower(v_inv.email), 'intent', v_inv.intent), 'info'
  );
  RETURN v_new_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation_and_register(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation_and_register(TEXT, TEXT) TO anon;