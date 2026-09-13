-- Migration: Add accept_invitation_and_register RPC
--
-- Problem (invite Catch-22): a NEW user (no account yet) received an
-- invitation, but AcceptInvite required them to be logged in first - and
-- there was no way to create an account (public signup is disabled). The
-- invitation could never be accepted.
--
-- This RPC lets the invitee set a password and register directly. The
-- 64-hex unguessable token IS the authorisation, so the RPC is granted to
-- `anon`.
--
-- Implementation note: creating the auth user via direct INSERT into
-- auth.users (encrypted_password = crypt(...)) is a known Supabase pattern
-- for service-less setups. The on_auth_user_created trigger still fires and
-- creates the profile + default voter role. If Supabase changes auth.users
-- internals in the future this must be revisited (see plan risk table).

CREATE OR REPLACE FUNCTION public.accept_invitation_and_register(
  p_token    TEXT,
  p_password TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv       public.invitations%ROWTYPE;
  v_new_uid   UUID;
  v_existing  UUID;
BEGIN
  -- 1) Validate the invitation token
  SELECT * INTO v_inv
    FROM public.invitations
   WHERE token = p_token
     AND accepted_at IS NULL
     AND revoked_at IS NULL
   LIMIT 1;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Undangan tidak ditemukan atau sudah digunakan'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Undangan sudah kedaluwarsa'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2) Server-side password validation: min 8 chars, letters + numbers
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password minimal 8 karakter'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'Password harus mengandung huruf dan angka'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) The email must not already be a registered user
  SELECT id INTO v_existing FROM auth.users WHERE lower(email) = lower(v_inv.email) LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Akun dengan email ini sudah terdaftar. Silakan login terlebih dahulu.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4) Create the auth user. The on_auth_user_created trigger creates the
  --    profile row and the default 'voter' role automatically.
  v_new_uid := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    email_change,
    email_change_token_new
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_uid,
    'authenticated',
    'authenticated',
    lower(v_inv.email),
    crypt(p_password, gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', v_inv.full_name,
      'student_id', v_inv.student_id
    ),
    now(),
    now(),
    '',
    ''
  );

  -- 5) Fill the profile from the invitation
  UPDATE public.profiles
     SET full_name  = COALESCE(v_inv.full_name, full_name),
         student_id = COALESCE(v_inv.student_id, student_id),
         class_id   = COALESCE(v_inv.class_id, class_id)
   WHERE id = v_new_uid;

  -- 6) Assign the requested roles (voter is already there from the trigger)
  IF v_inv.roles IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT v_new_uid, UNNEST(v_inv.roles)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- 7) Mark the invitation as accepted
  UPDATE public.invitations
     SET accepted_at = now(),
         accepted_user_id = v_new_uid
   WHERE id = v_inv.id;

  -- 8) Audit trail (actor = the new user)
  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, category, target_type, target_id,
    description, metadata, severity
  ) VALUES (
    v_new_uid, lower(v_inv.email), NULL,
    'invitation.register', 'auth', 'invitations', v_inv.id::TEXT,
    'User registered via invitation',
    jsonb_build_object('email', lower(v_inv.email), 'intent', v_inv.intent),
    'info'
  );

  RETURN v_new_uid;
END;
$$;

-- Narrow the default PUBLIC grant; anon needs access (new users have no session).
REVOKE EXECUTE ON FUNCTION public.accept_invitation_and_register(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation_and_register(TEXT, TEXT) TO anon;

COMMENT ON FUNCTION public.accept_invitation_and_register(TEXT, TEXT) IS
  'Lets an invited user without an account set a password and register in one step. The invitation token (64 hex, unguessable) is the authorisation.';
