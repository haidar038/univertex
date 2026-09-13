-- Ensure auth.users inserts without user metadata can still create a profile.
--
-- The Supabase Authentication dashboard does not send full_name or student_id
-- in raw_user_meta_data. Both columns remain NOT NULL in public.profiles to
-- preserve the DPT/RBAC data contract; this trigger therefore assigns clearly
-- identifiable, unique placeholders until an administrator completes the
-- user's profile through the application.
--
-- Normal application flows are unchanged:
--   - admin_create_user supplies full_name and student_id;
--   - invitation registration supplies them when the invitation contains them;
--   - new non-admin users continue to receive the voter role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name      TEXT := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), '');
  v_student_id     TEXT := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'student_id'), '');
  v_requested_role TEXT := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'role'), ''),
    'voter'
  );
BEGIN
  -- Dashboard/API-created users can have empty metadata. Do not make
  -- profiles nullable: a deterministic pending NIM is unique and makes the
  -- incomplete DPT record visible for an administrator to complete.
  v_full_name := COALESCE(v_full_name, 'Pengguna Baru');
  v_student_id := COALESCE(v_student_id, 'PENDING-' || NEW.id::TEXT);

  INSERT INTO public.profiles (id, full_name, student_id)
  VALUES (NEW.id, v_full_name, v_student_id);

  -- Preserve the existing bootstrap convention: users explicitly created as
  -- admins are promoted by the privileged creation path, not auto-assigned
  -- the voter role. All other new users begin as voters.
  IF v_requested_role <> 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'voter')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates the required public profile and default voter role for each auth user. Empty auth metadata receives a unique pending student ID that must be completed by an administrator.';
