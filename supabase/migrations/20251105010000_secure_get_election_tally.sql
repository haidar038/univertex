-- Migration: Secure get_election_tally with an access guard
--
-- Problem: get_election_tally was SECURITY DEFINER with no guard, so ANY
-- authenticated user (or anon, if granted) could read live vote counts for
-- any event - including closed elections whose results are not public yet.
--
-- Access matrix (see plan D2):
--   caller                       | active+open | active+closed | active+show_results_after_voting | closed+public_results | closed non-public
--   -----------------------------+-------------+--------------+--------------------------------+----------------------+------------------
--   admin                        | yes         | yes          | yes                            | yes                  | yes
--   authenticated (non-admin)    | yes         | no           | yes                            | yes                  | yes
--   anon                         | yes         | no           | no                             | yes                  | no
--
-- Notes:
--   * "active+open" means status='active' AND election_type='open' (open
--     elections show live tallies to everyone).
--   * Denials raise SQLSTATE 42501 (insufficient_privilege) so the client
--     can distinguish authorisation failures from other errors.
--   * The RPC is granted to anon AND authenticated because the public
--     results page is used by visitors without an account.

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
  -- Open active elections show live tallies to everyone (anon included)
  ELSIF v_status = 'active' AND v_election_type = 'open' THEN
    v_allowed := TRUE;
  -- Active event with show_results_after_voting: authenticated users who
  -- have voted (or any authenticated user - the flag is the admin's choice)
  ELSIF v_status = 'active' AND v_show_after_voting AND v_uid IS NOT NULL THEN
    v_allowed := TRUE;
  -- Closed events: everyone (anon included) sees the tally only when the
  -- admin marked results as public
  ELSIF v_status = 'closed' AND v_public_results THEN
    v_allowed := TRUE;
  -- Closed events without public results: authenticated non-admin users
  -- still see the tally (internal results page), anon does not.
  ELSIF v_status = 'closed' AND v_uid IS NOT NULL THEN
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

-- Supabase grants EXECUTE to PUBLIC by default; narrow it to the roles that
-- need it (anon + authenticated) so future functions don't inherit access.
REVOKE EXECUTE ON FUNCTION public.get_election_tally(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_election_tally(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_election_tally(UUID) TO anon;

COMMENT ON FUNCTION public.get_election_tally(UUID) IS
  'Returns per-candidate and per-pair vote counts for an event. Guards access: admins always; anon only for open active elections or closed events with public_results; authenticated users also for show_results_after_voting active events and closed events.';
