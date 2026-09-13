-- Migration: Implement admin_create_user for real
--
-- Problem: admin_create_user was a placeholder that returned NULL. The
-- frontend therefore used supabase.auth.signUp() from the ADMIN's browser to
-- create accounts - which replaces the admin's own session with the new
-- user's session (session hijack by design). This migration provides the
-- real implementation so the browser never calls signUp for account
-- creation.
--
-- The signature matches src/integrations/supabase/types.ts:
--   (p_email, p_full_name, p_password, p_student_id, p_class_id?, p_department?, p_skip_confirmation?)
--
-- Note: the pre-existing GRANT used the function name without an argument
-- list, which does not pin the signature; we re-grant explicitly below.
-- The old placeholder is fully replaced via CREATE OR REPLACE, but the
-- placeholder had a different parameter ORDER, so we drop it first.
-- Both drops make the migration safe to re-run.

DROP FUNCTION IF EXISTS public.admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN);
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
  -- 1) Admin guard
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can create users'
      USING ERRCODE = '42501';
  END IF;

  -- 2) Validate email format
  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Format email tidak valid'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) Validate password (min 8 chars)
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password minimal 8 karakter'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4) Duplicate email check with a stable error code the client can map
  SELECT id INTO v_existing FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Email sudah terdaftar'
      USING ERRCODE = '23505';
  END IF;

  -- 5) Duplicate student_id check (profiles.student_id is expected unique)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE student_id = p_student_id) THEN
    RAISE EXCEPTION 'NIM sudah digunakan'
      USING ERRCODE = '23505';
  END IF;

  -- 6) Create the auth user (trigger creates profile + voter role)
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
    lower(p_email),
    crypt(p_password, gen_salt('bf', 10)),
    CASE WHEN p_skip_confirmation THEN now() ELSE NULL END,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', p_full_name,
      'student_id', p_student_id,
      'department', p_department,
      'class_id', p_class_id::TEXT
    ),
    now(),
    now(),
    '',
    ''
  );

  -- 7) Upsert profile details not covered by the trigger
  UPDATE public.profiles
     SET full_name  = COALESCE(p_full_name, full_name),
         student_id = COALESCE(p_student_id, student_id),
         department = COALESCE(p_department, department),
         class_id   = COALESCE(p_class_id, class_id)
   WHERE id = v_new_uid;

  -- 8) Audit trail
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

-- Narrow the default PUBLIC grant: admins (authenticated) only.
REVOKE EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN) IS
  'Admin-only user creation via direct auth.users insert, so the admin browser never calls supabase.auth.signUp (which would hijack the admin session).';
