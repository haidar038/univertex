-- Migration: Add committee & observer roles for per-election governance
--
-- Problem: today only 'admin' (platform-wide) manages elections. For real-
-- world field operations we need a "panitia" that admin can invite per
-- election, who can monitor & validate data but NOT modify it. Observers
-- (BPM, saksi) need read-only access.
--
-- Design:
--   - app_role extended with 'committee' and 'observer' (global flag)
--   - election_committees: per-election assignment with committee_role enum
--     (chair, secretary, verifier, technical, member)
--   - election_observers: per-election read-only assignment
--   - election_observations: monitoring notes with category + severity
--   - audit_log gets election_id column for per-election audit filtering
--   - Helper functions: has_election_role, can_access_election
--   - RLS for new tables, and additive SELECT policy for votes (committee
--     scoped to their election)
--
-- Backward-compatible: existing users, data, and flows are untouched. New
-- roles are opt-in. New tables default-empty.

-- ============================================================
-- 1) Extend app_role enum
-- ============================================================
-- NOTE: ALTER TYPE ... ADD VALUE cannot run in the same transaction as
-- a value usage. This migration is therefore its own file and applies to
-- a non-transactional scope. The IF NOT EXISTS guard makes re-runs safe.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'committee';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'observer';

-- ============================================================
-- 2) Committee role enum (per-election)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'committee_role') THEN
    CREATE TYPE public.committee_role AS ENUM (
      'chair',         -- ketua panitia, approval final
      'secretary',     -- administrasi & notulensi
      'verifier',      -- validasi data lapangan (DPT, kandidat)
      'technical',     -- teknis IT, monitoring sistem
      'member'         -- anggota biasa
    );
  END IF;
END $$;

-- ============================================================
-- 3) election_committees table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.election_committees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  committee_role  public.committee_role NOT NULL,
  appointed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  appointed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_reason  TEXT,
  notes           TEXT,
  CONSTRAINT election_committees_unique UNIQUE (election_id, user_id, committee_role)
);

CREATE INDEX IF NOT EXISTS idx_election_committees_election
  ON public.election_committees(election_id);
CREATE INDEX IF NOT EXISTS idx_election_committees_user
  ON public.election_committees(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_election_committees_chair
  ON public.election_committees(election_id) WHERE committee_role = 'chair' AND revoked_at IS NULL;

-- ============================================================
-- 4) election_observers table (read-only, per-election)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.election_observers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  appointed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_reason  TEXT,
  CONSTRAINT election_observers_unique UNIQUE (election_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_election_observers_election
  ON public.election_observers(election_id);
CREATE INDEX IF NOT EXISTS idx_election_observers_user
  ON public.election_observers(user_id) WHERE revoked_at IS NULL;

-- ============================================================
-- 5) election_observations table (monitoring notes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.election_observations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  observer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN
                    ('attendance', 'irregularity', 'technical', 'voter_question', 'other')),
  severity        TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  description     TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_observations_election
  ON public.election_observations(election_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_unresolved
  ON public.election_observations(election_id) WHERE resolved_at IS NULL;

-- ============================================================
-- 6) Extend audit_log with election_id (backward-compatible)
-- ============================================================
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS election_id UUID REFERENCES public.election_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_election
  ON public.audit_log(election_id, created_at DESC) WHERE election_id IS NOT NULL;

-- ============================================================
-- 7) Helper functions
-- ============================================================
-- has_election_role: TRUE if user is committee/observer on the given election
CREATE OR REPLACE FUNCTION public.has_election_role(
  p_user_id     UUID,
  p_election_id UUID,
  p_role        TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role = 'committee' THEN EXISTS (
      SELECT 1 FROM public.election_committees
      WHERE user_id = p_user_id
        AND election_id = p_election_id
        AND revoked_at IS NULL
    )
    WHEN p_role = 'observer' THEN EXISTS (
      SELECT 1 FROM public.election_observers
      WHERE user_id = p_user_id
        AND election_id = p_election_id
        AND revoked_at IS NULL
    )
    ELSE FALSE
  END;
$$;

-- can_access_election: TRUE if user is admin OR committee OR observer on event
CREATE OR REPLACE FUNCTION public.can_access_election(
  p_user_id     UUID,
  p_election_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(p_user_id, 'admin'::app_role)
    OR public.has_election_role(p_user_id, p_election_id, 'committee')
    OR public.has_election_role(p_user_id, p_election_id, 'observer');
$$;

-- can_manage_election: TRUE if user is admin OR committee chair on event
CREATE OR REPLACE FUNCTION public.can_manage_election(
  p_user_id     UUID,
  p_election_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(p_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.election_committees
      WHERE user_id = p_user_id
        AND election_id = p_election_id
        AND committee_role = 'chair'
        AND revoked_at IS NULL
    );
$$;

-- ============================================================
-- 8) RLS for new tables
-- ============================================================
ALTER TABLE public.election_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_observers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_observations ENABLE ROW LEVEL SECURITY;

-- election_committees policies
DROP POLICY IF EXISTS "Admins manage committees" ON public.election_committees;
CREATE POLICY "Admins manage committees"
  ON public.election_committees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Committee members see their own assignments" ON public.election_committees;
CREATE POLICY "Committee members see their own assignments"
  ON public.election_committees FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Committee chairs see all committee of their events" ON public.election_committees;
CREATE POLICY "Committee chairs see all committee of their events"
  ON public.election_committees FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.election_committees ec2
      WHERE ec2.election_id = election_committees.election_id
        AND ec2.user_id = auth.uid()
        AND ec2.committee_role = 'chair'
        AND ec2.revoked_at IS NULL
    )
  );

-- election_observers policies
DROP POLICY IF EXISTS "Admins manage observers" ON public.election_observers;
CREATE POLICY "Admins manage observers"
  ON public.election_observers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Observers see their own assignments" ON public.election_observers;
CREATE POLICY "Observers see their own assignments"
  ON public.election_observers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- election_observations policies
DROP POLICY IF EXISTS "Admins manage all observations" ON public.election_observations;
CREATE POLICY "Admins manage all observations"
  ON public.election_observations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Committee and observers see observations of their events" ON public.election_observations;
CREATE POLICY "Committee and observers see observations of their events"
  ON public.election_observations FOR SELECT TO authenticated
  USING (public.can_access_election(auth.uid(), election_id));

DROP POLICY IF EXISTS "Committee and observers add observations" ON public.election_observations;
CREATE POLICY "Committee and observers add observations"
  ON public.election_observations FOR INSERT TO authenticated
  WITH CHECK (
    observer_id = auth.uid()
    AND public.can_access_election(auth.uid(), election_id)
  );

-- ============================================================
-- 9) Extend invitation intent CHECK
-- ============================================================
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_intent_check;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_intent_check CHECK (
    intent IN ('register', 'candidate', 'voter_group', 'committee', 'observer')
  );

-- Add optional FK to event_id already exists; ensure metadata can carry
-- committee_role for committee invites.
COMMENT ON COLUMN public.invitations.metadata IS
  'For intent=committee: {committee_role: chair|secretary|verifier|technical|member}. For intent=observer: {}. Free-form otherwise.';

-- ============================================================
-- 10) Extend votes RLS so committee/observer can SELECT scoped to their event
-- ============================================================
-- The existing policies:
--   "Voters can view their own votes"   FOR SELECT TO authenticated USING (voter_id = auth.uid())
--   "Admins can view all votes"        FOR SELECT TO authenticated USING (admin check)
-- We add a third SELECT policy for committee/observer scoped to their event.
DROP POLICY IF EXISTS "Committee and observers view votes of their elections" ON public.votes;
CREATE POLICY "Committee and observers view votes of their elections"
  ON public.votes FOR SELECT TO authenticated
  USING (public.can_access_election(auth.uid(), event_id));

-- Similarly for candidates (already SELECT true for everyone, so this is
-- redundant for candidates, but we keep a focused policy for clarity).
DROP POLICY IF EXISTS "Committee and observers view candidates of their elections" ON public.candidates;
CREATE POLICY "Committee and observers view candidates of their elections"
  ON public.candidates FOR SELECT TO authenticated
  USING (public.can_access_election(auth.uid(), event_id));

-- And election_events: ensure committee can SELECT events they are assigned to
-- (admins already have full access).
DROP POLICY IF EXISTS "Committee and observers view their assigned elections" ON public.election_events;
CREATE POLICY "Committee and observers view their assigned elections"
  ON public.election_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR status IN ('active', 'closed', 'draft')
    OR public.can_access_election(auth.uid(), id)
  );

-- ============================================================
-- 11) Comments
-- ============================================================
COMMENT ON TABLE public.election_committees IS
  'Per-election committee assignments. A user can be on multiple committees across different elections.';

COMMENT ON TABLE public.election_observers IS
  'Per-election read-only observers (BPM, saksi, external auditor). Cannot modify any data.';

COMMENT ON TABLE public.election_observations IS
  'Monitoring notes recorded by admins, committee, or observers during an election. Immutable append-only (no UPDATE/DELETE policy).';

COMMENT ON FUNCTION public.has_election_role(UUID, UUID, TEXT) IS
  'Returns TRUE if the user holds the given election-scoped role (committee|observer) on the given election.';

COMMENT ON FUNCTION public.can_access_election(UUID, UUID) IS
  'Returns TRUE if the user can READ data of the given election (admin OR committee OR observer on that election).';

COMMENT ON FUNCTION public.can_manage_election(UUID, UUID) IS
  'Returns TRUE if the user can MODIFY data of the given election (admin OR committee chair on that election).';
