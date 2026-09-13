-- P0-01: Eligibility enforcement di level DB.
--
-- Masalah: assert_event_is_votable(UUID) hanya cek status=voting + window.
-- UI (VotingPage) cek DPT, tapi penyerang bisa bypass via
-- supabase.from('votes').insert(...) langsung. RLS Fase 2 SUDAH cek
-- is_eligible_voter, tapi pesan RLS generik; trigger ini jadikan
-- penolakan eksplisit 42501 + cek voter_id = auth.uid().
--
-- Rollback: jalankan blok "ROLLBACK COPY" di bawah (kembalikan fungsi
-- versi 20260912000000) + DROP INDEX opsional (index aman dibiarkan).
--
-- ROLLBACK COPY (versi 20260912000000):
--   CREATE OR REPLACE FUNCTION public.assert_event_is_votable(p_event_id UUID)
--   RETURNS VOID LANGUAGE plpgsql STABLE AS $$
--   DECLARE v_status TEXT; v_start TIMESTAMPTZ; v_end TIMESTAMPTZ;
--   BEGIN
--     SELECT status, start_time, end_time INTO v_status, v_start, v_end
--     FROM public.election_events WHERE id = p_event_id;
--     IF v_status IS NULL THEN RAISE EXCEPTION 'Election event % not found', p_event_id USING ERRCODE='P0002'; END IF;
--     IF v_status <> 'voting' THEN RAISE EXCEPTION 'Election event % is not open for voting (status=%)', p_event_id, v_status USING ERRCODE='P0001'; END IF;
--     IF now() < v_start THEN RAISE EXCEPTION 'Election event % has not started yet', p_event_id USING ERRCODE='P0001'; END IF;
--     IF now() > v_end THEN RAISE EXCEPTION 'Election event % has already ended', p_event_id USING ERRCODE='P0001'; END IF;
--   END; $$;
--   CREATE OR REPLACE FUNCTION public.tg_enforce_vote_timeline()
--   RETURNS TRIGGER LANGUAGE plpgsql AS $$
--   BEGIN PERFORM public.assert_event_is_votable(NEW.event_id); RETURN NEW; END; $$;

-- ============================================================
-- 1) assert_event_is_votable 2-arg (timeline + DPT)
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_event_is_votable(p_event_id UUID, p_voter_id UUID DEFAULT NULL)
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

  -- P0-01: DPT check. NULL voter = skip (kompatibilitas pemanggil lama);
  -- trigger votes selalu kirim NEW.voter_id.
  IF p_voter_id IS NOT NULL AND NOT public.is_eligible_voter(p_voter_id, p_event_id) THEN
    RAISE EXCEPTION 'Voter % is not eligible for election event %', p_voter_id, p_event_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_event_is_votable(UUID, UUID) IS
  'P0-01: Raises unless event is votable (status=voting + window) AND voter is eligible (is_eligible_voter). NULL voter skips the DPT check.';

GRANT EXECUTE ON FUNCTION public.assert_event_is_votable(UUID, UUID) TO authenticated;

-- Wrapper 1-arg lama: delegasi ke 2-arg (tanpa DPT check) agar pemanggil
-- lama / tooling admin tidak pecah.
CREATE OR REPLACE FUNCTION public.assert_event_is_votable(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  PERFORM public.assert_event_is_votable(p_event_id, NULL);
END;
$$;

COMMENT ON FUNCTION public.assert_event_is_votable(UUID) IS
  'Legacy 1-arg wrapper: timeline check only (no DPT check). Prefer the 2-arg form.';

GRANT EXECUTE ON FUNCTION public.assert_event_is_votable(UUID) TO authenticated;

-- ============================================================
-- 2) Trigger: voter_id = auth.uid() + timeline + DPT
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_enforce_vote_timeline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Defense-in-depth: voter_id harus pemilik sesi (RLS sudah cek,
  -- trigger jadikan pesan jelas 42501).
  IF NEW.voter_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'voter_id must equal authenticated user'
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_event_is_votable(NEW.event_id, NEW.voter_id);
  RETURN NEW;
END;
$$;

-- Trigger trg_enforce_vote_timeline tidak perlu di-drop/create ulang
-- (call by name), tapi pastikan ada untuk fresh DB:
DROP TRIGGER IF EXISTS trg_enforce_vote_timeline ON public.votes;
CREATE TRIGGER trg_enforce_vote_timeline
  BEFORE INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enforce_vote_timeline();

-- ============================================================
-- 3) Index pendukung DPT lookup
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_evg_event_class ON public.event_voter_groups(event_id, class_id);
CREATE INDEX IF NOT EXISTS idx_profiles_class ON public.profiles(class_id);
CREATE INDEX IF NOT EXISTS idx_rules_election ON public.election_eligibility_rules(election_id);
