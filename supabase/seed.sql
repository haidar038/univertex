-- UniVertex local development and test seed
--
-- This file is intended for `supabase db reset` against a local/disposable
-- database. It creates only synthetic accounts under the reserved `.test`
-- domain. Never run it against a production project.
--
-- All seeded accounts use the password: TestOnly!2026
--   admin@univertex.test     -> admin
--   voter@univertex.test     -> voter
--   candidate@univertex.test -> voter + candidate
--   committee@univertex.test -> voter + committee
--   observer@univertex.test  -> voter + observer

BEGIN;

-- Reference data used by the test accounts and election setup flows.
INSERT INTO public.classes (name, faculty) VALUES
  ('Teknik Informatika 2021', 'Fakultas Teknik'),
  ('Sistem Informasi 2021', 'Fakultas Teknik'),
  ('Teknik Elektro 2021', 'Fakultas Teknik'),
  ('Manajemen 2021', 'Fakultas Ekonomi'),
  ('Akuntansi 2021', 'Fakultas Ekonomi')
ON CONFLICT (name) DO NOTHING;

-- Deterministic UUIDs make fixtures and end-to-end tests reproducible. The
-- auth-user trigger creates the initial profile and voter role; the upserts
-- below complete the profile and assign each account's intended role.
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
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'admin@univertex.test',
    extensions.crypt('TestOnly!2026', extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Test Administrator","student_id":"TEST-ADM-001","role":"admin"}'::jsonb,
    now(), now(), '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'voter@univertex.test',
    extensions.crypt('TestOnly!2026', extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Test Voter","student_id":"TEST-VOT-001","role":"voter"}'::jsonb,
    now(), now(), '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'candidate@univertex.test',
    extensions.crypt('TestOnly!2026', extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Test Candidate","student_id":"TEST-CAN-001","role":"candidate"}'::jsonb,
    now(), now(), '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated', 'committee@univertex.test',
    extensions.crypt('TestOnly!2026', extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Test Committee","student_id":"TEST-COM-001","role":"committee"}'::jsonb,
    now(), now(), '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'observer@univertex.test',
    extensions.crypt('TestOnly!2026', extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Test Observer","student_id":"TEST-OBS-001","role":"observer"}'::jsonb,
    now(), now(), '', ''
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

-- GoTrue password grants require a matching email identity. Inserting only
-- auth.users leaves the account unable to sign in and results in an Auth 500.
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  created_at,
  updated_at
) VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001', 'email',
    '{"sub":"10000000-0000-0000-0000-000000000001","email":"admin@univertex.test","email_verified":true,"phone_verified":false}'::jsonb,
    now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002', 'email',
    '{"sub":"10000000-0000-0000-0000-000000000002","email":"voter@univertex.test","email_verified":true,"phone_verified":false}'::jsonb,
    now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003', 'email',
    '{"sub":"10000000-0000-0000-0000-000000000003","email":"candidate@univertex.test","email_verified":true,"phone_verified":false}'::jsonb,
    now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000004', 'email',
    '{"sub":"10000000-0000-0000-0000-000000000004","email":"committee@univertex.test","email_verified":true,"phone_verified":false}'::jsonb,
    now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000005', 'email',
    '{"sub":"10000000-0000-0000-0000-000000000005","email":"observer@univertex.test","email_verified":true,"phone_verified":false}'::jsonb,
    now(), now()
  )
ON CONFLICT (provider_id, provider) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  identity_data = EXCLUDED.identity_data,
  updated_at = now();

WITH seed_profiles (id, full_name, student_id, class_name, department) AS (
  VALUES
    ('10000000-0000-0000-0000-000000000001'::uuid, 'Test Administrator', 'TEST-ADM-001', 'Teknik Informatika 2021', 'Platform'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'Test Voter',         'TEST-VOT-001', 'Teknik Informatika 2021', 'Informatika'),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'Test Candidate',     'TEST-CAN-001', 'Sistem Informasi 2021',   'Sistem Informasi'),
    ('10000000-0000-0000-0000-000000000004'::uuid, 'Test Committee',     'TEST-COM-001', 'Teknik Elektro 2021',     'Teknik Elektro'),
    ('10000000-0000-0000-0000-000000000005'::uuid, 'Test Observer',      'TEST-OBS-001', 'Manajemen 2021',          'Manajemen')
)
INSERT INTO public.profiles (id, full_name, student_id, class_id, department)
SELECT sp.id, sp.full_name, sp.student_id, c.id, sp.department
FROM seed_profiles sp
JOIN public.classes c ON c.name = sp.class_name
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  student_id = EXCLUDED.student_id,
  class_id = EXCLUDED.class_id,
  department = EXCLUDED.department;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin'),
  ('10000000-0000-0000-0000-000000000002', 'voter'),
  ('10000000-0000-0000-0000-000000000003', 'candidate'),
  ('10000000-0000-0000-0000-000000000004', 'committee'),
  ('10000000-0000-0000-0000-000000000005', 'observer')
ON CONFLICT (user_id, role) DO NOTHING;

-- The reset migration intentionally clears mutable application data. Restore
-- the role-to-permission baseline so permission tests match a fresh project.
INSERT INTO public.role_permissions (role, permission)
SELECT 'admin'::public.app_role, permission
FROM unnest(enum_range(NULL::public.permission_key)) AS permission
ON CONFLICT (role, permission) DO NOTHING;

INSERT INTO public.role_permissions (role, permission) VALUES
  ('committee', 'election.view'), ('committee', 'candidate.view'),
  ('committee', 'vote.view'), ('committee', 'voter.view'),
  ('committee', 'voter.verify'), ('committee', 'committee.view'),
  ('committee', 'audit.view'),
  ('observer', 'election.view'), ('observer', 'candidate.view'),
  ('observer', 'vote.view'), ('observer', 'committee.view'),
  ('observer', 'observer.view'), ('observer', 'audit.view'),
  ('voter', 'election.view'), ('voter', 'vote.cast'),
  ('candidate', 'election.view'), ('candidate', 'candidate.create')
ON CONFLICT (role, permission) DO NOTHING;

COMMIT;
