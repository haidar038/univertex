-- Fix RLS policy for profiles UPDATE to allow admins to update any profile
-- Currently only users can update their own profile, admins cannot update other users' profiles

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new UPDATE policy that allows:
-- 1. Users to update their own profile
-- 2. Admins to update any profile
CREATE POLICY "Users can update own profile, admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
