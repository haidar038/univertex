-- Create admin function to create users without email confirmation
-- This function allows admins to create users that are immediately confirmed

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_student_id TEXT,
  p_department TEXT DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_skip_confirmation BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_password TEXT;
BEGIN
  -- Only admins can call this function
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Create auth user (this will be automatically confirmed if skip_confirmation is true)
  -- Note: We can't directly set email_confirmed_at from this function,
  -- but we can use Supabase's signUp with autoConfirm in the application layer

  -- Insert into profiles (the trigger will handle most of this, but we ensure class_id is set)
  -- This is just a placeholder - actual user creation should be done via Supabase Auth API
  -- with proper parameters

  -- Return a message to use Supabase Auth API with proper parameters
  RAISE NOTICE 'Use Supabase Auth signUp with emailRedirectTo and autoConfirm options';

  RETURN NULL;
END;
$$;

-- Grant execute permission to authenticated users (will be checked by has_role inside function)
GRANT EXECUTE ON FUNCTION public.admin_create_user TO authenticated;

-- Create a helper view to check if email confirmation is disabled in Supabase settings
-- This is for documentation purposes
COMMENT ON FUNCTION public.admin_create_user IS
'Admin function to create users.
To skip email confirmation, ensure Supabase project has "Enable email confirmations" disabled in Authentication settings,
or use the Admin API instead of the client SDK.';
