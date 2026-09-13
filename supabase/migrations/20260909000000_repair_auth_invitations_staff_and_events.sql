-- Repair authentication, invitations, staff access, and administration flows.
--
-- This migration is deliberately additive: it is safe for existing projects
-- that already contain users, invitations, and election assignments.

-- Supabase installs pgcrypto in the `extensions` schema.  Older application
-- code looked up crypt/gen_salt from `public`, causing seed and RPC account
-- creation to fail with `function gen_salt(unknown, integer) does not exist`.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Avoid RLS recursion when a committee chair reads the assignments for an
-- election.  The old policy queried election_committees from a policy on that
-- same table, which Postgres rejects with an internal-server-error.
CREATE OR REPLACE FUNCTION public.is_election_committee_chair(
  p_user_id UUID,
  p_election_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.election_committees
    WHERE user_id = p_user_id
      AND election_id = p_election_id
      AND committee_role = 'chair'::public.committee_role
      AND revoked_at IS NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_election_committee_chair(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_election_committee_chair(UUID, UUID)
  TO authenticated;

DROP POLICY IF EXISTS "Committee chairs see all committee of their events"
  ON public.election_committees;
CREATE POLICY "Committee chairs see all committee of their events"
  ON public.election_committees
  FOR SELECT
  TO authenticated
  USING (public.is_election_committee_chair(auth.uid(), election_id));

-- A staff assignment is election-scoped, but the application route is also
-- guarded by the global committee/observer role.  Keep that global marker in
-- sync with active assignments so an assigned person can actually open their
-- dashboard, and remove it only after their final assignment is revoked.
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'committee'::public.app_role
FROM public.election_committees
WHERE revoked_at IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'observer'::public.app_role
FROM public.election_observers
WHERE revoked_at IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_assign_committee(
  p_user_id     UUID,
  p_election_id UUID,
  p_role        public.committee_role
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_email TEXT;
BEGIN
  IF NOT public.caller_has_permission('committee.manage'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin committee.manage' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.election_events WHERE id = p_election_id) THEN
    RAISE EXCEPTION 'Pemilihan tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.election_committees (election_id, user_id, committee_role, appointed_by)
  VALUES (p_election_id, p_user_id, p_role, auth.uid())
  ON CONFLICT (election_id, user_id, committee_role) DO UPDATE
    SET revoked_at = NULL, revoked_by = NULL, revoked_reason = NULL,
        appointed_at = now(), appointed_by = auth.uid()
  RETURNING id INTO v_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'committee'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role, action, category, target_type, target_id,
    description, metadata, election_id, severity
  ) VALUES (
    auth.uid(), v_email, 'admin', 'committee.assign', 'admin', 'election_committees', v_id::TEXT,
    'Committee member appointed: ' || p_role::TEXT,
    jsonb_build_object('assigned_user', p_user_id, 'role', p_role::TEXT), p_election_id, 'info'
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_committee(
  p_committee_id UUID,
  p_reason       TEXT DEFAULT 'admin_revoke'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_election UUID;
  v_user UUID;
BEGIN
  IF NOT public.caller_has_permission('committee.manage'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin committee.manage' USING ERRCODE = '42501';
  END IF;
  SELECT election_id, user_id INTO v_election, v_user
  FROM public.election_committees WHERE id = p_committee_id;
  IF v_election IS NULL THEN
    RAISE EXCEPTION 'Penugasan panitia tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.election_committees
  SET revoked_at = now(), revoked_by = auth.uid(), revoked_reason = p_reason
  WHERE id = p_committee_id AND revoked_at IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM public.election_committees
    WHERE user_id = v_user AND revoked_at IS NULL
  ) THEN
    DELETE FROM public.user_roles
    WHERE user_id = v_user AND role = 'committee'::public.app_role;
  END IF;

  INSERT INTO public.audit_log (
    actor_id, action, category, target_type, target_id, description, election_id, severity
  ) VALUES (
    auth.uid(), 'committee.revoke', 'admin', 'election_committees', p_committee_id::TEXT,
    'Committee revoked: ' || COALESCE(p_reason, ''), v_election, 'warning'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_observer(
  p_user_id     UUID,
  p_election_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_email TEXT;
BEGIN
  IF NOT public.caller_has_permission('observer.manage'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin observer.manage' USING ERRCODE = '42501';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.election_events WHERE id = p_election_id) THEN
    RAISE EXCEPTION 'Pemilihan tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.election_observers (election_id, user_id, appointed_by)
  VALUES (p_election_id, p_user_id, auth.uid())
  ON CONFLICT (election_id, user_id) DO UPDATE
    SET revoked_at = NULL, revoked_by = NULL, revoked_reason = NULL,
        appointed_at = now(), appointed_by = auth.uid()
  RETURNING id INTO v_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'observer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role, action, category, target_type, target_id,
    description, metadata, election_id, severity
  ) VALUES (
    auth.uid(), v_email, 'admin', 'observer.assign', 'admin', 'election_observers', v_id::TEXT,
    'Observer appointed', jsonb_build_object('assigned_user', p_user_id), p_election_id, 'info'
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_observer(
  p_observer_id UUID,
  p_reason       TEXT DEFAULT 'admin_revoke'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_election UUID;
  v_user UUID;
BEGIN
  IF NOT public.caller_has_permission('observer.manage'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin observer.manage' USING ERRCODE = '42501';
  END IF;
  SELECT election_id, user_id INTO v_election, v_user
  FROM public.election_observers WHERE id = p_observer_id;
  IF v_election IS NULL THEN
    RAISE EXCEPTION 'Penugasan observer tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.election_observers
  SET revoked_at = now(), revoked_by = auth.uid(), revoked_reason = p_reason
  WHERE id = p_observer_id AND revoked_at IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM public.election_observers
    WHERE user_id = v_user AND revoked_at IS NULL
  ) THEN
    DELETE FROM public.user_roles
    WHERE user_id = v_user AND role = 'observer'::public.app_role;
  END IF;

  INSERT INTO public.audit_log (
    actor_id, action, category, target_type, target_id, description, election_id, severity
  ) VALUES (
    auth.uid(), 'observer.revoke', 'admin', 'election_observers', p_observer_id::TEXT,
    'Observer revoked: ' || COALESCE(p_reason, ''), v_election, 'warning'
  );
END;
$$;

-- Admin-only user directory.  Email remains inaccessible through normal
-- PostgREST queries; this narrow security-definer RPC is the monitored/admin
-- path and prevents one auth.users query per profile in the browser.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  student_id TEXT,
  email TEXT,
  department TEXT,
  class_id UUID,
  class_name TEXT,
  roles public.app_role[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.caller_has_permission('user.edit'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.edit' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.full_name, p.student_id, u.email, p.department, p.class_id, c.name,
    COALESCE(
      array_agg(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),
      ARRAY[]::public.app_role[]
    )
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.classes c ON c.id = p.class_id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  GROUP BY p.id, p.full_name, p.student_id, u.email, p.department, p.class_id, c.name, p.created_at
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Return only the invitation fields required by the unauthenticated accept
-- page.  A token is 256 bits and is the capability; granting a broad anon
-- SELECT policy would expose every invitation instead.
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  student_id TEXT,
  intent TEXT,
  event_id UUID,
  class_id UUID,
  roles TEXT[],
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id, i.email, i.full_name, i.student_id, i.intent, i.event_id, i.class_id,
    i.roles, i.expires_at, i.accepted_at, i.revoked_at
  FROM public.invitations i
  WHERE i.token = p_token
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) TO anon, authenticated;

-- Use RPCs for the admin invitation list and mutations.  This avoids the
-- existing RLS policy path that attempts to read auth.users as the client
-- role, while keeping the permission check at the database boundary.
CREATE OR REPLACE FUNCTION public.admin_list_invitations()
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  email TEXT,
  full_name TEXT,
  student_id TEXT,
  intent TEXT,
  event_id UUID,
  class_id UUID,
  roles TEXT[],
  token TEXT,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID,
  revoked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.caller_has_permission('user.create'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.create' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    i.id, i.created_at, i.email, i.full_name, i.student_id, i.intent, i.event_id,
    i.class_id, i.roles, i.token, i.expires_at, i.accepted_at, i.accepted_user_id, i.revoked_at
  FROM public.invitations i
  ORDER BY i.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_invitation(
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_student_id TEXT DEFAULT NULL,
  p_intent TEXT DEFAULT 'register',
  p_event_id UUID DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_roles TEXT[] DEFAULT ARRAY['voter']::TEXT[],
  p_expires_at TIMESTAMPTZ DEFAULT (now() + interval '14 days'),
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE (id UUID, token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  IF NOT public.caller_has_permission('user.create'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.create' USING ERRCODE = '42501';
  END IF;
  IF p_email IS NULL OR BTRIM(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Format email tidak valid' USING ERRCODE = 'P0001';
  END IF;
  IF p_intent NOT IN ('register', 'candidate', 'voter_group', 'committee', 'observer') THEN
    RAISE EXCEPTION 'Tujuan undangan tidak valid' USING ERRCODE = 'P0001';
  END IF;
  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'Waktu kedaluwarsa harus di masa depan' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_roles, ARRAY[]::TEXT[])) AS role_name
    WHERE role_name NOT IN ('voter', 'candidate', 'committee', 'observer')
  ) THEN
    RAISE EXCEPTION 'Role undangan tidak valid' USING ERRCODE = 'P0001';
  END IF;
  IF p_intent IN ('candidate', 'committee', 'observer') AND p_event_id IS NULL THEN
    RAISE EXCEPTION 'Pemilihan wajib dipilih untuk tujuan undangan ini' USING ERRCODE = 'P0001';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  RETURN QUERY
  INSERT INTO public.invitations (
    invited_by, email, full_name, student_id, intent, event_id, class_id,
    roles, token, expires_at, metadata
  ) VALUES (
    auth.uid(), lower(BTRIM(p_email)), NULLIF(BTRIM(p_full_name), ''),
    NULLIF(BTRIM(p_student_id), ''), p_intent, p_event_id, p_class_id,
    COALESCE(NULLIF(p_roles, ARRAY[]::TEXT[]), ARRAY['voter']::TEXT[]),
    v_token, p_expires_at, COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING invitations.id, invitations.token;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.caller_has_permission('user.create'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.create' USING ERRCODE = '42501';
  END IF;
  UPDATE public.invitations
  SET revoked_at = now()
  WHERE id = p_invitation_id AND accepted_at IS NULL AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Undangan tidak ditemukan atau tidak dapat dicabut' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_invitations() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_invitation(TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT[], TIMESTAMPTZ, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_invitation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_invitation(TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT[], TIMESTAMPTZ, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_invitation(UUID) TO authenticated;

-- Recreate users with the correct pgcrypto schema and an email identity.
-- auth.identities is required by GoTrue for password grants; inserting only
-- auth.users made both seeds and RPC-created accounts unable to sign in.
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
    email_change, email_change_token_new
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_new_uid, 'authenticated', 'authenticated',
    lower(BTRIM(p_email)), crypt(p_password, gen_salt('bf', 10)),
    CASE WHEN p_skip_confirmation THEN now() ELSE NULL END,
    '{"provider":"email","providers":["email"]}'::JSONB,
    jsonb_build_object(
      'full_name', p_full_name, 'student_id', p_student_id,
      'department', p_department, 'class_id', p_class_id::TEXT
    ), now(), now(), '', ''
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

-- The public accept flow needs the same identity record and must cast text
-- roles to app_role explicitly.  It also fulfils candidate/staff invitation
-- intent after a successful redemption.
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
    email_change, email_change_token_new
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_new_uid, 'authenticated', 'authenticated',
    lower(v_inv.email), crypt(p_password, gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::JSONB,
    jsonb_build_object('full_name', v_inv.full_name, 'student_id', v_inv.student_id),
    now(), now(), '', ''
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

CREATE OR REPLACE FUNCTION public.redeem_invitation(p_token TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  invitation_id UUID,
  intent TEXT,
  event_id UUID,
  class_id UUID,
  roles TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_uid UUID := auth.uid();
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_inv FROM public.invitations
  WHERE token = p_token AND accepted_at IS NULL AND revoked_at IS NULL LIMIT 1;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or already used' USING ERRCODE = 'P0002';
  END IF;
  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = 'P0001';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF lower(v_email) IS DISTINCT FROM lower(v_inv.email) THEN
    RAISE EXCEPTION 'This invitation is for a different email' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET full_name = COALESCE(v_inv.full_name, full_name),
      student_id = COALESCE(v_inv.student_id, student_id),
      class_id = COALESCE(v_inv.class_id, class_id)
  WHERE id = v_uid;
  INSERT INTO public.user_roles (user_id, role)
  SELECT v_uid, role_name::public.app_role
  FROM unnest(COALESCE(v_inv.roles, ARRAY['voter']::TEXT[])) AS role_name
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_inv.intent = 'candidate' AND v_inv.event_id IS NOT NULL THEN
    INSERT INTO public.candidates (user_id, event_id, status)
    VALUES (v_uid, v_inv.event_id, 'pending'::public.candidate_status)
    ON CONFLICT (user_id, event_id) DO NOTHING;
  ELSIF v_inv.intent = 'committee' AND v_inv.event_id IS NOT NULL THEN
    INSERT INTO public.election_committees (election_id, user_id, committee_role)
    VALUES (
      v_inv.event_id, v_uid,
      COALESCE((v_inv.metadata ->> 'committee_role')::public.committee_role, 'member'::public.committee_role)
    ) ON CONFLICT (election_id, user_id, committee_role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'committee'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF v_inv.intent = 'observer' AND v_inv.event_id IS NOT NULL THEN
    INSERT INTO public.election_observers (election_id, user_id)
    VALUES (v_inv.event_id, v_uid)
    ON CONFLICT (election_id, user_id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'observer'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  UPDATE public.invitations SET accepted_at = now(), accepted_user_id = v_uid WHERE id = v_inv.id;
  RETURN QUERY SELECT v_uid, v_email, v_inv.id, v_inv.intent, v_inv.event_id, v_inv.class_id, v_inv.roles;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;
