-- Fix vote timeline trigger and tally guard for the phase2 state machine.
--
-- The phase2 migration (20251108000000) renamed the election lifecycle
-- statuses ('active' -> 'voting', 'closed' -> 'published') and added
-- 'counting'/'archived', but two older functions were never updated and
-- still branch on the removed values:
--
--   * assert_event_is_votable() requires status = 'active'. It is attached
--     to votes via the trg_enforce_vote_timeline BEFORE INSERT trigger,
--     so EVERY vote insert is rejected while an event is in the 'voting'
--     state — voting is impossible in the current schema.
--   * get_election_tally() gates access on 'active'/'closed', so live and
--     published results fall into the deny branches for non-admins.
--
-- This migration realigns both functions with the current lifecycle:
--   draft -> registration -> voting -> counting -> published -> archived
--
-- No trigger changes are required: trg_enforce_vote_timeline calls
-- assert_event_is_votable() by name, so replacing the function body is
-- enough. Grants are preserved by CREATE OR REPLACE.

-- ============================================================
-- 1) assert_event_is_votable: 'active' -> 'voting'
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

  IF v_status <> 'voting' THEN
    RAISE EXCEPTION 'Election event % is not open for voting (status=%)', p_event_id, v_status
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

COMMENT ON FUNCTION public.assert_event_is_votable(UUID) IS
  'Raises an exception if the election event is not currently votable (status=voting and within the [start_time,end_time] window).';

-- ============================================================
-- 2) get_election_tally: realign the access matrix with the
--    draft/registration/voting/counting/published/archived states.
--
-- Access matrix (mirrors the election_events RLS SELECT policies from
-- 20251108000000 section 13 and 20260909000100 section 3):
--   caller                       | voting+open | voting other   | counting/published+public | counting/published other | archived
--   -----------------------------+-------------+----------------+---------------------------+-------------------------+---------
--   admin                        | yes         | yes            | yes                       | yes                     | yes
--   authenticated (non-admin)    | yes         | w/ show_results | yes                       | yes                     | yes
--   anon                         | yes         | no             | yes                       | no                      | no
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_election_tally(p_event_id UUID)
RETURNS TABLE (
  candidate_id UUID,
  pair_id      UUID,
  total_votes  BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status               TEXT;
  v_election_type        TEXT;
  v_show_after_voting    BOOLEAN;
  v_public_results       BOOLEAN;
  v_is_admin             BOOLEAN := FALSE;
  v_uid                  UUID := auth.uid();
  v_allowed              BOOLEAN := FALSE;
BEGIN
  SELECT status, election_type, show_results_after_voting, public_results
    INTO v_status, v_election_type, v_show_after_voting, v_public_results
    FROM public.election_events
   WHERE id = p_event_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Election event % not found', p_event_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_uid IS NOT NULL THEN
    v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  END IF;

  -- Admins always pass
  IF v_is_admin THEN
    v_allowed := TRUE;
  -- Open voting elections show live tallies to everyone (anon included)
  ELSIF v_status = 'voting' AND v_election_type = 'open' THEN
    v_allowed := TRUE;
  -- Voting events that reveal results after voting: authenticated users
  ELSIF v_status = 'voting' AND v_show_after_voting AND v_uid IS NOT NULL THEN
    v_allowed := TRUE;
  -- Counting/published with public results: everyone (anon included)
  ELSIF v_status IN ('counting', 'published') AND v_public_results THEN
    v_allowed := TRUE;
  -- Counting/published/archived for authenticated users (internal results).
  -- Archived events are visible to authenticated users but hidden from anon
  -- by the election_events RLS policy, so the tally follows the same rule.
  ELSIF v_status IN ('counting', 'published', 'archived') AND v_uid IS NOT NULL THEN
    v_allowed := TRUE;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'You are not allowed to view the tally for this election event'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT v.candidate_id, v.pair_id, COUNT(*) AS total_votes
    FROM public.votes v
   WHERE v.event_id = p_event_id
   GROUP BY v.candidate_id, v.pair_id;
END;
$$;

COMMENT ON FUNCTION public.get_election_tally(UUID) IS
  'Returns per-candidate and per-pair vote counts for an event. Guards access: admins always; anon only for open voting elections or counting/published events with public_results; authenticated users also for show_results_after_voting voting events and any counting/published/archived event.';
