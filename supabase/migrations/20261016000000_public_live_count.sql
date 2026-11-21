-- Poin 4: Public Live Count opt-in (public_live_count) + RLS anon.
--
-- Masalah:
--  1) get_election_tally mengizinkan anon untuk SEMUA event voting+open
--     tanpa opt-in -> live count bocor ke publik walau form tidak
--     mencentang apa pun.
--  2) Sebaliknya candidates / candidate_pairs / candidate_pair_members
--     SELECT hanya TO authenticated -> anon selalu dapat 0 baris ->
--     halaman publik selalu "Belum ada suara" walau tally mengizinkan.
--
-- Perbaikan: kolom public_live_count (default false) mengontrol live
-- publik saat voting+open; public_results tetap untuk counting/published.
-- RLS anon dibuka TEPAT saat event boleh dilihat publik (predikat sama
-- dengan cabang anon di tally). Closed+voting tetap gelap untuk anon.

-- 1) Kolom baru (default false = menutup lubang bocor saat ini).
ALTER TABLE public.election_events
  ADD COLUMN IF NOT EXISTS public_live_count BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.election_events.public_live_count IS
  'Live count publik saat status voting + tipe open. Tanpa ini anon tidak bisa melihat tally live walau event open.';

-- 2) Helper predikat publik: sumber tunggal untuk 3 policy anon di bawah.
--    Cerminan cabang anon get_election_tally (bukan cabang staff/auth).
CREATE OR REPLACE FUNCTION public.event_allows_public_tally(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.election_events e
     WHERE e.id = p_event_id
       AND (
             (e.status = 'voting' AND e.election_type = 'open' AND e.public_live_count)
          OR (e.status IN ('counting', 'published') AND e.public_results)
       )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.event_allows_public_tally(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_allows_public_tally(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.event_allows_public_tally(UUID) IS
  'TRUE bila anon boleh melihat tally event (cerminan cabang anon get_election_tally).';

-- 3) Tally: live open+voting wajib opt-in public_live_count.
--    Salinan persis 20261012000100_secure_tally_closed, satu cabang berubah.
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
  v_public_live          BOOLEAN;
  v_is_admin             BOOLEAN := FALSE;
  v_is_staff             BOOLEAN := FALSE;
  v_uid                  UUID := auth.uid();
  v_allowed              BOOLEAN := FALSE;
BEGIN
  SELECT status, election_type, show_results_after_voting, public_results,
         public_live_count
    INTO v_status, v_election_type, v_show_after_voting, v_public_results,
         v_public_live
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
  -- Open voting elections show live tallies to everyone (anon included),
  -- TAPI hanya bila admin mengaktifkan public_live_count di form.
  ELSIF v_status = 'voting' AND v_election_type = 'open' AND v_public_live THEN
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
  'Live open+voting wajib public_live_count (opt-in form); closed+voting selalu 42501 untuk non-staff; counting/published publik via public_results.';

GRANT EXECUTE ON FUNCTION public.get_election_tally(UUID) TO anon, authenticated;

-- 4) RLS anon: buka baca kandidat/paslon TEPAT saat tally publik diizinkan.
DROP POLICY IF EXISTS "Public can view public tally candidates" ON public.candidates;
CREATE POLICY "Public can view public tally candidates"
  ON public.candidates FOR SELECT
  TO anon
  USING (
    status = 'approved'
    AND public.event_allows_public_tally(event_id)
  );

DROP POLICY IF EXISTS "Public can view public tally pairs" ON public.candidate_pairs;
CREATE POLICY "Public can view public tally pairs"
  ON public.candidate_pairs FOR SELECT
  TO anon
  USING (
    status = 'approved'
    AND public.event_allows_public_tally(event_id)
  );

DROP POLICY IF EXISTS "Public can view public tally pair members" ON public.candidate_pair_members;
CREATE POLICY "Public can view public tally pair members"
  ON public.candidate_pair_members FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.candidate_pairs p
       WHERE p.id = candidate_pair_members.pair_id
         AND p.status = 'approved'
         AND public.event_allows_public_tally(p.event_id)
    )
  );
