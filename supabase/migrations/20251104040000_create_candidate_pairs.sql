-- Migration: Add candidate_pairs support (pasangan calon)
-- Some elections (e.g. ketua-wakil BEM) require multiple candidates to be voted
-- on as a single ticket. This migration introduces a `candidate_pairs` table
-- and adds an optional `pair_id` column to `votes` so that a voter is voting
-- for a *pair* rather than a single candidate.

-- 1) candidate_pairs -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_pairs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  -- optional human label, e.g. "Paslon 1"
  label         TEXT,
  number        INTEGER,                  -- ballot number, optional
  vision        TEXT,
  mission       TEXT,
  photo_url     TEXT,
  photo_storage_path TEXT,
  status        public.candidate_status NOT NULL DEFAULT 'pending',
  admin_notes   TEXT,
  rejection_reason TEXT,
  approved_at   TIMESTAMPTZ,
  approved_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_pairs_event
  ON public.candidate_pairs (event_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_pairs_event_number
  ON public.candidate_pairs (event_id, number)
  WHERE number IS NOT NULL;

COMMENT ON TABLE public.candidate_pairs IS
  'A pair/ticket of candidates that voters elect together (e.g. ketua + wakil ketua).';

-- Junction table: which individual candidates belong to which pair
CREATE TABLE IF NOT EXISTS public.candidate_pair_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id      UUID NOT NULL REFERENCES public.candidate_pairs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  -- Optional role label inside the pair: 'ketua' | 'wakil' | etc.
  position     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pair_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_pair_members_pair
  ON public.candidate_pair_members (pair_id);
CREATE INDEX IF NOT EXISTS idx_pair_members_candidate
  ON public.candidate_pair_members (candidate_id);

-- 2) Extend votes with optional pair_id --------------------------------------
ALTER TABLE public.votes
  ADD COLUMN IF NOT EXISTS pair_id UUID REFERENCES public.candidate_pairs(id) ON DELETE SET NULL;

-- If a vote was for a pair, it does not need a single candidate_id (allow NULL)
ALTER TABLE public.votes
  ALTER COLUMN candidate_id DROP NOT NULL;

-- A vote is either for a single candidate OR for a pair; enforce at DB level.
-- Wrapped in DO block so the migration is idempotent (safe to re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'votes_single_or_pair'
      AND conrelid = 'public.votes'::regclass
  ) THEN
    ALTER TABLE public.votes
      ADD CONSTRAINT votes_single_or_pair CHECK (
        (candidate_id IS NOT NULL AND pair_id IS NULL)
        OR
        (candidate_id IS NULL AND pair_id IS NOT NULL)
      );
  END IF;
END $$;

-- Helpful index for tallying
CREATE INDEX IF NOT EXISTS idx_votes_pair_id ON public.votes (pair_id);

-- 3) event level flag indicating whether pairs are allowed -------------------
ALTER TABLE public.election_events
  ADD COLUMN IF NOT EXISTS use_pairs BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.election_events.use_pairs IS
  'When true, voters elect pairs (pasangan calon) instead of individual candidates.';

-- 4) RLS for candidate_pairs (mirror candidates) -----------------------------
ALTER TABLE public.candidate_pairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Voters can view approved pairs" ON public.candidate_pairs;
CREATE POLICY "Voters can view approved pairs"
  ON public.candidate_pairs FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins can insert pairs" ON public.candidate_pairs;
CREATE POLICY "Admins can insert pairs"
  ON public.candidate_pairs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update pairs" ON public.candidate_pairs;
CREATE POLICY "Admins can update pairs"
  ON public.candidate_pairs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete pairs" ON public.candidate_pairs;
CREATE POLICY "Admins can delete pairs"
  ON public.candidate_pairs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) RLS for candidate_pair_members ------------------------------------------
ALTER TABLE public.candidate_pair_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View pair members" ON public.candidate_pair_members;
CREATE POLICY "View pair members"
  ON public.candidate_pair_members FOR SELECT
  TO authenticated
  USING (TRUE);   -- always visible; pair visibility is gated by candidate_pairs.status

DROP POLICY IF EXISTS "Admins manage pair members" ON public.candidate_pair_members;
CREATE POLICY "Admins manage pair members"
  ON public.candidate_pair_members FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6) Vote-counts RPC for both single candidates and pairs --------------------
CREATE OR REPLACE FUNCTION public.get_election_tally(p_event_id UUID)
RETURNS TABLE (
  candidate_id UUID,
  pair_id      UUID,
  total_votes  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT candidate_id, pair_id, COUNT(*) AS total_votes
    FROM public.votes
   WHERE event_id = p_event_id
   GROUP BY candidate_id, pair_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_election_tally(UUID) TO authenticated;

