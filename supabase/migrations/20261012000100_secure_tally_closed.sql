-- R1 (P-B): tutup lubang tally untuk event closed yang masih voting.
--
-- Lubang nyata 2026-10-12 (prod): event closed + voting + show_results_after_voting=true
-- membuat SEMUA authenticated user bisa memanggil get_election_tally dan melihat
-- siapa unggul — persis kebocoran yang dilarang spec 05-event-visibility.
-- UI (Create/EditEventDialog) akan memaksa closed => show_after=false, tapi data
-- lama / client nakal tetap bisa lewat — jadi guard dipasang di server.
--
-- Perubahan dari versi 20260912000000 (satu-satunya yang berubah: 2 cabang):
--   1) voting + show_after_voting HANYA berlaku untuk election_type='open',
--      ATAU pemanggil staff (committee/observer event itu).
--   2) Cabang staff baru: committee/observer event yang sedang voting boleh
--      lihat tally (operasional panitia/pengawas), voter biasa tetap ditolak.
-- Matriks lain tidak berubah. Admin selalu lolos (paling atas).

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
  v_is_staff             BOOLEAN := FALSE;
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
    -- Staff = committee/observer aktif event ini (revoked tidak dihitung).
    v_is_staff :=
      public.has_election_role(v_uid, p_event_id, 'committee')
      OR public.has_election_role(v_uid, p_event_id, 'observer');
  END IF;

  -- Admins always pass
  IF v_is_admin THEN
    v_allowed := TRUE;
  -- Staff operasional boleh pantau tally eventnya saat voting berjalan
  ELSIF v_status = 'voting' AND v_is_staff THEN
    v_allowed := TRUE;
  -- Open voting elections show live tallies to everyone (anon included)
  ELSIF v_status = 'voting' AND v_election_type = 'open' THEN
    v_allowed := TRUE;
  -- R1: show_results_after_voting HANYA untuk open. Closed pre-publish
  -- tetap 42501 walau flag-nya menyala (data lama / client nakal).
  ELSIF v_status = 'voting' AND v_election_type = 'open'
          AND v_show_after_voting AND v_uid IS NOT NULL THEN
    v_allowed := TRUE;
  -- Counting/published with public results: everyone (anon included)
  ELSIF v_status IN ('counting', 'published') AND v_public_results THEN
    v_allowed := TRUE;
  -- Counting/published/archived for authenticated users (internal results).
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
  'R1 (20261012): closed+voting selalu 42501 untuk non-staff walau show_results_after_voting menyala; committee/observer event boleh pantau tally saat voting. Matriks lain sama seperti 20260912.';
