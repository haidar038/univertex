-- Migration: Allow voters to view their own votes (RLS)
-- Fixes the issue where a voter could not read their own `votes` rows, so:
--   * The "Sudah Memilih" badge on the voter dashboard never appeared.
--   * The pre-vote `hasVoted` check in VotingPage always returned false.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY.

DROP POLICY IF EXISTS "Voters can view their own votes" ON public.votes;

CREATE POLICY "Voters can view their own votes"
  ON public.votes
  FOR SELECT
  TO authenticated
  USING (voter_id = auth.uid());
