-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'voter', 'candidate');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Drop all policies that depend on profiles.role column
DROP POLICY IF EXISTS "Only admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert candidates" ON public.candidates;
DROP POLICY IF EXISTS "Only admins can delete candidates" ON public.candidates;
DROP POLICY IF EXISTS "Only admins can manage classes" ON public.classes;
DROP POLICY IF EXISTS "Everyone can view active and closed events" ON public.election_events;
DROP POLICY IF EXISTS "Only admins can manage events" ON public.election_events;
DROP POLICY IF EXISTS "Only admins can manage event voter groups" ON public.event_voter_groups;
DROP POLICY IF EXISTS "Admins can view all votes" ON public.votes;

-- Add department column to profiles
ALTER TABLE public.profiles ADD COLUMN department TEXT;

-- Remove role column from profiles (will be in user_roles now)
ALTER TABLE public.profiles DROP COLUMN role;

-- Update trigger function to assign default voter role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, student_id, class_id, department)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'student_id',
    (new.raw_user_meta_data->>'class_id')::uuid,
    new.raw_user_meta_data->>'department'
  );
  
  -- Assign default voter role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'voter');
  
  RETURN new;
END;
$$;

-- Recreate RLS policies using has_role function

-- Profiles policies
CREATE POLICY "Only admins can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Candidates policies
CREATE POLICY "Admins can insert candidates"
ON public.candidates FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete candidates"
ON public.candidates FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Classes policies
CREATE POLICY "Only admins can manage classes"
ON public.classes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Election events policies
CREATE POLICY "Everyone can view active and closed events"
ON public.election_events FOR SELECT
TO authenticated
USING (
  status IN ('active', 'closed') OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Only admins can manage events"
ON public.election_events FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Event voter groups policies
CREATE POLICY "Only admins can manage event voter groups"
ON public.event_voter_groups FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Votes policies
CREATE POLICY "Admins can view all votes"
ON public.votes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Only admins can manage user roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));