-- Fix: Admin should not auto-assign voter role
-- This migration updates the handle_new_user trigger to skip assigning
-- the default 'voter' role if the user is being created as an admin

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Insert profile with only full_name and student_id
  INSERT INTO public.profiles (id, full_name, student_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'student_id'
  );

  -- Get role from metadata, default to 'voter'
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'voter');

  -- Only assign voter role if user is not an admin
  -- If user_metadata contains role='admin', skip auto-assigning voter role
  IF user_role != 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'voter');
  END IF;

  RETURN NEW;
END;
$$;

-- Optional: Remove voter role from existing admin users
-- Uncomment the following lines if you want to clean up existing admin users

-- DELETE FROM public.user_roles
-- WHERE role = 'voter'
--   AND user_id IN (
--     SELECT user_id
--     FROM public.user_roles
--     WHERE role = 'admin'
--   );
