-- Migration to create default admin user
-- This migration creates a helper function and seed data for the admin user

-- Helper function to grant admin role to a user
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;

  -- Insert admin role if not exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Admin role granted to user %', user_email;
END;
$$;

-- Helper function to create admin user (requires auth.users insert)
-- Note: This function is for reference. In production, create users via Supabase Dashboard or API
CREATE OR REPLACE FUNCTION public.create_admin_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_student_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Note: Direct insertion into auth.users requires service_role privileges
  -- This is typically done via Supabase Admin API
  -- This function serves as documentation for the expected user structure

  -- In practice, create user via Supabase CLI:
  -- supabase auth users create admin@univertex.com --password UniVertex.02025

  RAISE NOTICE 'To create admin user, use Supabase CLI or Dashboard:';
  RAISE NOTICE 'Email: %', p_email;
  RAISE NOTICE 'Then run: SELECT public.make_user_admin(%);', p_email;

  RETURN NULL;
END;
$$;

-- Instructions for creating the default admin user
COMMENT ON FUNCTION public.create_admin_user IS
'Create admin user with the following steps:
1. Via Supabase Dashboard: Authentication > Users > Add User
   Email: admin@univertex.com
   Password: UniVertex.02025

2. Via Supabase CLI:
   supabase auth users create admin@univertex.com --password UniVertex.02025

3. Then run:
   SELECT public.make_user_admin(''admin@univertex.com'');

4. Update profile:
   UPDATE public.profiles
   SET full_name = ''Administrator'', student_id = ''admin''
   WHERE id = (SELECT id FROM auth.users WHERE email = ''admin@univertex.com'');
';

-- For local development: If you have service_role access, you can manually insert
-- Otherwise, follow the instructions above

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.make_user_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;
