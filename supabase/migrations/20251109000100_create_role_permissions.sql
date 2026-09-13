-- Migration: Fase 3 M1.1 — role_permissions table + default seed
--
-- Maps app_role -> set of permission_keys. Drives the new permission-based
-- RBAC system. Default mappings:
--   admin:     ALL 30 permissions
--   committee: scoped reads (election.view, candidate.view, vote.view,
--              voter.view, voter.verify, committee.view, audit.view)
--   observer:  scoped reads (election.view, candidate.view, vote.view,
--              committee.view, observer.view, audit.view)
--   voter:     election.view + vote.cast
--   candidate: election.view + candidate.create
--
-- The has_permission() helper (M1.2) short-circuits to TRUE for admins, so
-- admin policy rows are an optimization, not a hard requirement.

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role          public.app_role   NOT NULL,
  permission    public.permission_key NOT NULL,
  granted_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
  granted_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (role, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role
  ON public.role_permissions(role);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Direct SELECT allowed for admins only. Non-admins go through
-- has_permission() / caller_has_permission() which are SECURITY DEFINER
-- and bypass RLS.
DROP POLICY IF EXISTS "Admins can read role_permissions" ON public.role_permissions;
CREATE POLICY "Admins can read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.role_permissions (role, permission) VALUES
  -- admin: ALL 30
  ('admin','election.view'),('admin','election.update'),('admin','election.publish'),
  ('admin','election.delete'),('admin','election.transition'),
  ('admin','candidate.view'),('admin','candidate.create'),('admin','candidate.review'),
  ('admin','candidate.approve'),('admin','candidate.reject'),('admin','candidate.edit'),
  ('admin','vote.cast'),('admin','vote.view'),('admin','vote.count'),('admin','vote.export'),
  ('admin','voter.view'),('admin','voter.verify'),('admin','voter.manage'),
  ('admin','committee.manage'),('admin','committee.view'),
  ('admin','observer.manage'),('admin','observer.view'),
  ('admin','audit.view'),('admin','audit.export'),
  ('admin','user.create'),('admin','user.edit'),('admin','user.delete'),('admin','user.reset_password'),
  ('admin','system.manage'),('admin','system.settings'),
  ('admin','eligibility.manage'),
  -- committee: scoped reads + voter verify
  ('committee','election.view'),('committee','candidate.view'),
  ('committee','vote.view'),('committee','voter.view'),('committee','voter.verify'),
  ('committee','committee.view'),
  ('committee','audit.view'),
  -- observer: read-only
  ('observer','election.view'),('observer','candidate.view'),
  ('observer','vote.view'),
  ('observer','committee.view'),('observer','observer.view'),
  ('observer','audit.view'),
  -- voter
  ('voter','election.view'),('voter','vote.cast'),
  -- candidate
  ('candidate','election.view'),('candidate','candidate.create')
ON CONFLICT (role, permission) DO NOTHING;

COMMENT ON TABLE public.role_permissions IS
  'Default role -> permission mappings. Drives has_permission() / caller_has_permission(). ON CONFLICT DO NOTHING makes the seed safe to re-run.';
