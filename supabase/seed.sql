-- Seed data for UniVertex E-Voting Platform
-- This file contains initial data for development and testing

-- Note: Admin user creation requires Supabase Auth API
-- Run the setup-admin.ts script or use Supabase Dashboard to create:
-- Email: admin@univertex.com
-- Password: UniVertex.02025

-- Sample Classes (Faculties/Departments)
INSERT INTO public.classes (name, faculty) VALUES
  ('Teknik Informatika 2021', 'Fakultas Teknik'),
  ('Sistem Informasi 2021', 'Fakultas Teknik'),
  ('Teknik Elektro 2021', 'Fakultas Teknik'),
  ('Manajemen 2021', 'Fakultas Ekonomi'),
  ('Akuntansi 2021', 'Fakultas Ekonomi')
ON CONFLICT (name) DO NOTHING;

-- After creating the admin user via Supabase Auth, run this to grant admin role:
-- (Replace the user_id with the actual UUID from auth.users)
--
-- Example (run after admin user is created):
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin'::app_role
-- FROM auth.users
-- WHERE email = 'admin@univertex.com'
-- ON CONFLICT (user_id, role) DO NOTHING;
--
-- UPDATE public.profiles
-- SET full_name = 'Administrator', student_id = 'admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@univertex.com');
