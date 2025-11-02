-- Create a function to get user email from auth.users
-- This function uses SECURITY DEFINER to access auth schema
CREATE OR REPLACE FUNCTION public.get_user_email(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Only allow admins to call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can access user emails';
  END IF;

  -- Fetch email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;

  RETURN user_email;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_user_email(UUID) IS 'Allows admins to fetch user email from auth.users table';
