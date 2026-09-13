-- Migration: Harden votes table integrity & add timeline enforcement
-- Fixes:
-- 1) Add UNIQUE constraint (voter_id, event_id) so that one voter can cast at most one vote per event.
--    This was previously only protected by an RLS policy + a fragile substring check in the frontend.
-- 2) Add a DB-level CHECK that ensures votes may only be cast while the related election is active and
--    within its [start_time, end_time] window. This prevents voting past the deadline even if a stale
--    client bypasses the UI guard.
-- 3) Provide a SQL helper `assert_event_is_votable(event_id)` that can be called from triggers or admin tooling.
--
-- NOTE (fix): the trigger function must be created BEFORE the trigger that references it.
-- The original version of this file created the trigger first, which failed with
-- ERROR 42883: function public.tg_enforce_vote_timeline() does not exist.

-- ============================================================
-- 1) UNIQUE constraint (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'votes_voter_event_unique'
      AND conrelid = 'public.votes'::regclass
  ) THEN
    ALTER TABLE public.votes
      ADD CONSTRAINT votes_voter_event_unique UNIQUE (voter_id, event_id);
  END IF;
END $$;

-- Helpful index for live counting
CREATE INDEX IF NOT EXISTS idx_votes_candidate_id ON public.votes (candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_event_id ON public.votes (event_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_event ON public.votes (voter_id, event_id);

-- ============================================================
-- 2) DB-level timeline enforcement for new votes
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_event_is_votable(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_status TEXT;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT status, start_time, end_time
    INTO v_status, v_start, v_end
    FROM public.election_events
   WHERE id = p_event_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Election event % not found', p_event_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Election event % is not active (status=%)', p_event_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  IF now() < v_start THEN
    RAISE EXCEPTION 'Election event % has not started yet', p_event_id
      USING ERRCODE = 'P0001';
  END IF;

  IF now() > v_end THEN
    RAISE EXCEPTION 'Election event % has already ended', p_event_id
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_event_is_votable(UUID) TO authenticated;

-- Trigger function (MUST exist before the trigger below references it)
CREATE OR REPLACE FUNCTION public.tg_enforce_vote_timeline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.assert_event_is_votable(NEW.event_id);
  RETURN NEW;
END;
$$;

-- Trigger that prevents inserts past the deadline / on a non-active event
DROP TRIGGER IF EXISTS trg_enforce_vote_timeline ON public.votes;
CREATE TRIGGER trg_enforce_vote_timeline
  BEFORE INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enforce_vote_timeline();

COMMENT ON FUNCTION public.assert_event_is_votable(UUID) IS
  'Raises an exception if the election event is not currently votable (status=active and within the [start_time,end_time] window).';
