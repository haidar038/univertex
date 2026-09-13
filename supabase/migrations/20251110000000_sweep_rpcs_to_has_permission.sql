-- Migration: Fase 3 M2 — Sweep admin RPCs to caller_has_permission
--
-- Replaces has_role(auth.uid(), 'admin'::app_role) checks inside admin RPC
-- bodies with caller_has_permission('<perm>'). Admin continues to be allowed
-- via role_permissions seed (admin has all 31 permissions). Hybrid scope-
-- based checks (admin_transition_election_state) keep the existing
-- can_manage_election() fallback for committee chairs.
--
-- NOT swept (kept as-is):
--   - accept_invitation_and_register: called by anon pre-login
--   - add_election_observation:        uses can_access_election (scope)
--
-- Order is preserved: process each RPC individually for safe re-runs.

-- ============================================================
-- 1) admin_create_user  →  user.create
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_create_user(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN);
CREATE FUNCTION public.admin_create_user(
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
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_new_uid  UUID;
  v_existing UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.caller_has_permission('user.create'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.create'
      USING ERRCODE = '42501';
  END IF;

  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Format email tidak valid'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password minimal 8 karakter'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existing FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Email sudah terdaftar'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE student_id = p_student_id) THEN
    RAISE EXCEPTION 'NIM sudah digunakan'
      USING ERRCODE = '23505';
  END IF;

  v_new_uid := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, email_change, email_change_token_new
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_uid, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf', 10)),
    CASE WHEN p_skip_confirmation THEN now() ELSE NULL END,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', p_full_name, 'student_id', p_student_id,
      'department', p_department, 'class_id', p_class_id::TEXT
    ),
    now(), now(), '', ''
  );

  UPDATE public.profiles
     SET full_name  = COALESCE(p_full_name, full_name),
         student_id = COALESCE(p_student_id, student_id),
         department = COALESCE(p_department, department),
         class_id   = COALESCE(p_class_id, class_id)
   WHERE id = v_new_uid;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, category, target_type, target_id,
    description, metadata, severity
  ) VALUES (
    v_uid,
    (SELECT email FROM auth.users WHERE id = v_uid),
    'admin',
    'user.create', 'admin', 'auth.users', v_new_uid::TEXT,
    'Created user ' || p_full_name || ' (' || p_student_id || ')',
    jsonb_build_object(
      'email', lower(p_email),
      'student_id', p_student_id,
      'class_id', p_class_id
    ),
    'info'
  );

  RETURN v_new_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN) IS
  'Requires user.create permission. Admin user creation via direct auth.users insert.';

-- ============================================================
-- 2) admin_assign_committee  →  committee.manage
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_assign_committee(UUID, UUID, public.committee_role);
CREATE FUNCTION public.admin_assign_committee(
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
    RAISE EXCEPTION 'Tidak memiliki izin committee.manage'
      USING ERRCODE = '42501';
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
    SET revoked_at      = NULL,
        revoked_by      = NULL,
        revoked_reason  = NULL,
        appointed_at    = now(),
        appointed_by    = auth.uid()
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, category, target_type, target_id,
    description, metadata, election_id, severity
  ) VALUES (
    auth.uid(), v_email, 'admin',
    'committee.assign', 'admin', 'election_committees', v_id::TEXT,
    'Committee member appointed: ' || p_role::TEXT,
    jsonb_build_object('assigned_user', p_user_id, 'role', p_role::TEXT),
    p_election_id, 'info'
  );

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assign_committee(UUID, UUID, public.committee_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_committee(UUID, UUID, public.committee_role) TO authenticated;

COMMENT ON FUNCTION public.admin_assign_committee(UUID, UUID, public.committee_role) IS
  'Requires committee.manage. Assigns a user to a committee role on an election.';

-- ============================================================
-- 3) admin_revoke_committee  →  committee.manage
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_revoke_committee(UUID, TEXT);
CREATE FUNCTION public.admin_revoke_committee(
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
  v_role  public.committee_role;
BEGIN
  IF NOT public.caller_has_permission('committee.manage'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin committee.manage'
      USING ERRCODE = '42501';
  END IF;

  SELECT election_id, user_id, committee_role
    INTO v_election, v_user, v_role
    FROM public.election_committees
   WHERE id = p_committee_id;

  IF v_election IS NULL THEN
    RAISE EXCEPTION 'Penugasan panitia tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.election_committees
     SET revoked_at     = now(),
         revoked_by     = auth.uid(),
         revoked_reason = p_reason
   WHERE id = p_committee_id
     AND revoked_at IS NULL;

  INSERT INTO public.audit_log (
    actor_id, action, category, target_type, target_id,
    description, election_id, severity
  ) VALUES (
    auth.uid(), 'committee.revoke', 'admin', 'election_committees', p_committee_id::TEXT,
    'Committee revoked: ' || COALESCE(p_reason, ''), v_election, 'warning'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_revoke_committee(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_committee(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_revoke_committee(UUID, TEXT) IS
  'Requires committee.manage. Revokes a committee assignment with a reason.';

-- ============================================================
-- 4) admin_assign_observer  →  observer.manage
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_assign_observer(UUID, UUID);
CREATE FUNCTION public.admin_assign_observer(
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
    RAISE EXCEPTION 'Tidak memiliki izin observer.manage'
      USING ERRCODE = '42501';
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
    SET revoked_at     = NULL,
        revoked_by     = NULL,
        revoked_reason = NULL,
        appointed_at   = now(),
        appointed_by   = auth.uid()
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, category, target_type, target_id,
    description, metadata, election_id, severity
  ) VALUES (
    auth.uid(), v_email, 'admin',
    'observer.assign', 'admin', 'election_observers', v_id::TEXT,
    'Observer appointed', jsonb_build_object('assigned_user', p_user_id),
    p_election_id, 'info'
  );

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assign_observer(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_observer(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.admin_assign_observer(UUID, UUID) IS
  'Requires observer.manage. Assigns a user as observer on an election.';

-- ============================================================
-- 5) admin_revoke_observer  →  observer.manage
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_revoke_observer(UUID, TEXT);
CREATE FUNCTION public.admin_revoke_observer(
  p_observer_id UUID,
  p_reason      TEXT DEFAULT 'admin_revoke'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_election UUID;
  v_user     UUID;
BEGIN
  IF NOT public.caller_has_permission('observer.manage'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin observer.manage'
      USING ERRCODE = '42501';
  END IF;

  SELECT election_id, user_id
    INTO v_election, v_user
    FROM public.election_observers
   WHERE id = p_observer_id;

  IF v_election IS NULL THEN
    RAISE EXCEPTION 'Penugasan observer tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.election_observers
     SET revoked_at     = now(),
         revoked_by     = auth.uid(),
         revoked_reason = p_reason
   WHERE id = p_observer_id
     AND revoked_at IS NULL;

  INSERT INTO public.audit_log (
    actor_id, action, category, target_type, target_id,
    description, election_id, severity
  ) VALUES (
    auth.uid(), 'observer.revoke', 'admin', 'election_observers', p_observer_id::TEXT,
    'Observer revoked: ' || COALESCE(p_reason, ''), v_election, 'warning'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_revoke_observer(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_observer(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_revoke_observer(UUID, TEXT) IS
  'Requires observer.manage. Revokes an observer assignment with a reason.';

-- ============================================================
-- 6) admin_lookup_user_id_by_email  →  user.create
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_lookup_user_id_by_email(TEXT);
CREATE FUNCTION public.admin_lookup_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.caller_has_permission('user.create'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.create'
      USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_lookup_user_id_by_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_lookup_user_id_by_email(TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_lookup_user_id_by_email(TEXT) IS
  'Requires user.create. Lookups auth.users.id by email (used by ElectionStaff invite flow).';

-- ============================================================
-- 7) admin_add_eligibility_rule  →  eligibility.manage
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_add_eligibility_rule(UUID, TEXT, TEXT, TEXT);
CREATE FUNCTION public.admin_add_eligibility_rule(
  p_election_id  UUID,
  p_rule_type    TEXT,
  p_rule_value   TEXT,
  p_description  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.caller_has_permission('eligibility.manage'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin eligibility.manage'
      USING ERRCODE = '42501';
  END IF;
  IF p_rule_type NOT IN ('class_id','profile_id','department','cohort','organization','custom') THEN
    RAISE EXCEPTION 'rule_type tidak valid' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.election_eligibility_rules (election_id, rule_type, rule_value, description, created_by)
  VALUES (p_election_id, p_rule_type, p_rule_value, p_description, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_id, action, category, target_type, target_id, description, election_id, metadata, severity)
  VALUES (auth.uid(), 'eligibility.add', 'admin', 'election_eligibility_rules', v_id::TEXT,
          'Eligibility rule added', p_election_id,
          jsonb_build_object('rule_type', p_rule_type, 'rule_value', p_rule_value),
          'info');
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_add_eligibility_rule(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_eligibility_rule(UUID, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_add_eligibility_rule(UUID, TEXT, TEXT, TEXT) IS
  'Requires eligibility.manage. Adds a per-election eligibility rule.';

-- ============================================================
-- 8) admin_remove_eligibility_rule  →  eligibility.manage
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_remove_eligibility_rule(UUID);
CREATE FUNCTION public.admin_remove_eligibility_rule(p_rule_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_election UUID;
BEGIN
  IF NOT public.caller_has_permission('eligibility.manage'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin eligibility.manage'
      USING ERRCODE = '42501';
  END IF;
  SELECT election_id INTO v_election FROM public.election_eligibility_rules WHERE id = p_rule_id;
  IF v_election IS NULL THEN
    RAISE EXCEPTION 'Rule tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.election_eligibility_rules WHERE id = p_rule_id;
  INSERT INTO public.audit_log (actor_id, action, category, target_type, target_id, description, election_id, severity)
  VALUES (auth.uid(), 'eligibility.remove', 'admin', 'election_eligibility_rules', p_rule_id::TEXT,
          'Eligibility rule removed', v_election, 'info');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_remove_eligibility_rule(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_eligibility_rule(UUID) TO authenticated;

COMMENT ON FUNCTION public.admin_remove_eligibility_rule(UUID) IS
  'Requires eligibility.manage. Removes a per-election eligibility rule.';

-- ============================================================
-- 9) admin_transition_election_state  →  election.transition (admin)
--                                       OR can_manage_election (chair)
-- Hybrid: admin passes via permission; committee chair passes via
-- scope. Non-admin non-chair callers get 42501.
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_transition_election_state(UUID, TEXT, TEXT);
CREATE FUNCTION public.admin_transition_election_state(
  p_election_id UUID,
  p_to_status   TEXT,
  p_reason      TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from TEXT;
BEGIN
  IF NOT (
    public.caller_has_permission('election.transition'::public.permission_key)
    OR public.can_manage_election(auth.uid(), p_election_id)
  ) THEN
    RAISE EXCEPTION 'Tidak berhak' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_from FROM public.election_events WHERE id = p_election_id;
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'Pemilihan tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.election_events SET status = p_to_status WHERE id = p_election_id;

  INSERT INTO public.election_state_transitions
    (election_id, from_status, to_status, triggered_by, actor_id, reason)
  VALUES (p_election_id, v_from, p_to_status, 'admin', auth.uid(), p_reason);

  INSERT INTO public.audit_log
    (actor_id, action, category, target_type, target_id, description, election_id, metadata, severity)
  VALUES (auth.uid(), 'election.transition', 'admin', 'election_events', p_election_id::TEXT,
            'Election state: ' || v_from || ' -> ' || p_to_status,
            p_election_id, jsonb_build_object('from', v_from, 'to', p_to_status, 'reason', p_reason),
            'info');

  RETURN p_to_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_transition_election_state(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_transition_election_state(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_transition_election_state(UUID, TEXT, TEXT) IS
  'Hybrid permission check: election.transition (admin via role_permissions) OR can_manage_election (committee chair via per-election scope). The trigger still enforces the transition map.';
