-- REVERT Fase 1 (T1–T3) — kembalikan policy SELECT longgar pra-pilot.
--
-- Pasangan dari: supabase/migrations/20261009000000_harden_privacy_rls.sql
-- (file itu TETAP disimpan sebagai histori — jangan dihapus, jangan diedit).
--
-- CARA PAKAI (MCP Supabase sedang tidak tersedia, jadi manual):
--   1. Supabase Dashboard → SQL Editor → paste SELURUH file ini → Run.
--      Aman diulang (idempoten): semua DROP pakai IF EXISTS, semua CREATE
--      didahului DROP nama yang sama.
--   2. Jalankan BAGIAN VERIFIKASI di bawah, cocokkan ekspektasi.
--   3. Cek app sebagai voter + panitia + observer (dashboard + halaman vote).
--   4. Opsional via CLI bila sudah link: supabase db push (file ini ikut ke-push
--      sebagai migrasi biasa, histori tetap urut).
--
-- YANG DIKEMBALIKAN (persis redaksi aslinya):
--   profiles: "Users can view all profiles" FOR SELECT USING (true) — tanpa TO,
--     dari 20251030174513_36c0d56d-4957-46bf-aaf4-00b3e1efcc5d.sql:103.
--   event_voter_groups: "Everyone can view event voter groups" USING (true),
--     dari file yang sama:190.
--   votes: "Committee and observers view votes of their elections"
--     TO authenticated USING (can_access_election), dari
--     20251106000000_add_committee_observer_roles.sql:268-271.

-- ============================================================
-- T1 revert — profiles: hapus 4 policy scoped, kembalikan "view all"
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Committee can view profiles in their elections" ON public.profiles;
DROP POLICY IF EXISTS "Voters can view approved candidate profiles" ON public.profiles;

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- ============================================================
-- T2 revert — event_voter_groups: hapus 3 policy scoped, kembalikan "everyone"
-- ============================================================
DROP POLICY IF EXISTS "Admins can view event voter groups" ON public.event_voter_groups;
DROP POLICY IF EXISTS "Committee can view voter groups of their elections" ON public.event_voter_groups;
DROP POLICY IF EXISTS "Voters can view voter groups of their own class" ON public.event_voter_groups;

DROP POLICY IF EXISTS "Everyone can view event voter groups" ON public.event_voter_groups;
CREATE POLICY "Everyone can view event voter groups"
  ON public.event_voter_groups FOR SELECT
  USING (true);

-- ============================================================
-- T3 revert — votes: kembalikan SELECT committee/observer + hapus comment T3
-- ============================================================
DROP POLICY IF EXISTS "Committee and observers view votes of their elections" ON public.votes;
CREATE POLICY "Committee and observers view votes of their elections"
  ON public.votes FOR SELECT TO authenticated
  USING (public.can_access_election(auth.uid(), event_id));

COMMENT ON POLICY "Voters can view their own votes" ON public.votes IS NULL;

-- ============================================================
-- VERIFIKASI (read-only, jalankan setelah blok di atas)
-- Ekspektasi = kondisi pra-Fase-1:
--   profiles: ada "Users can view all profiles", TANPA 4 policy scoped baru.
--   event_voter_groups: ada "Everyone can view event voter groups", TANPA 3 scoped baru.
--   votes: ada "Committee and observers view votes of their elections".
-- ============================================================
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('profiles', 'votes', 'event_voter_groups')
-- ORDER BY tablename, policyname;
