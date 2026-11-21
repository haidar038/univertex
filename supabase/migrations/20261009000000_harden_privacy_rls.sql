-- Fase 1 (T1–T3) — Privacy RLS hardening: kunci data orang sebelum pilot.
--
-- Masalah: tiga policy SELECT terlalu longgar (bahkan TERBUKA UNTUK ANON
-- karena tanpa klausa TO):
--   1. profiles "Users can view all profiles" USING (true)
--   2. event_voter_groups "Everyone can view event voter groups" USING (true)
--   3. votes "Committee and observers view votes of their elections"
--      (hubungan voter -> kandidat bisa dibaca panitia/pengawas)
--
-- Pengganti (prinsip: minimum yang perlu, per role):
--   profiles: diri sendiri + admin + panitia/pengawas se-event + kandidat
--     approved (nama kandidat memang info publik pemilihan).
--   event_voter_groups: admin + panitia se-event + voter untuk kelasnya sendiri
--     (dipakai Dashboard/VotingPage cek DPT).
--   votes: cabut akses baris untuk committee/observer; mereka baca hasil via
--     RPC get_election_tally (committee/ElectionDetail + observer/ElectionDetail
--     sudah pakai RPC — tidak ada caller langsung yang terdampak).
--
-- Audit_log tidak disentuh (append-only). Policy lama selain yang di-DROP
-- di bawah dipertahankan apa adanya.

-- ============================================================
-- T1 — profiles: cabut "view all", ganti 4 policy scoped
-- ============================================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- 1a. Setiap user login boleh lihat profilnya sendiri.
--     Menutup: useAuth, Index redirect, Profile, Login.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 1b. Admin boleh lihat semua (basis user_roles, bukan kolom legacy).
--     Menutup: ElectionStaff, EditUserDialog, DeleteUserDialog, semua dialog
--     admin/classes, AssignVoterGroupsDialog, AddCandidateDialog, EventResultsView.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 1c. Panitia/pengawas boleh lihat profil orang yang terlibat di
--     pemilihan yang mereka tangani (kandidat, staff, atau DPT se-event).
DROP POLICY IF EXISTS "Committee can view profiles in their elections" ON public.profiles;
CREATE POLICY "Committee can view profiles in their elections"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.election_events e
      WHERE public.can_access_election(auth.uid(), e.id)
        AND (
          EXISTS (SELECT 1 FROM public.candidates c
                  WHERE c.event_id = e.id AND c.user_id = profiles.id)
          OR EXISTS (SELECT 1 FROM public.election_committees ec
                     WHERE ec.election_id = e.id AND ec.user_id = profiles.id
                       AND ec.revoked_at IS NULL)
          OR EXISTS (SELECT 1 FROM public.election_observers eo
                     WHERE eo.election_id = e.id AND eo.user_id = profiles.id
                       AND eo.revoked_at IS NULL)
          OR EXISTS (SELECT 1 FROM public.event_voter_groups evg
                     WHERE evg.event_id = e.id AND evg.class_id = profiles.class_id)
        )
    )
  );

-- 1d. Voter boleh lihat profil kandidat approved (nama kandidat = info
--     publik; dipakai VotingPage embed profiles(full_name, student_id)).
DROP POLICY IF EXISTS "Voters can view approved candidate profiles" ON public.profiles;
CREATE POLICY "Voters can view approved candidate profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.user_id = profiles.id
        AND c.status = 'approved'
        AND EXISTS (SELECT 1 FROM public.election_events e
                    WHERE e.id = c.event_id
                      AND e.status IN ('registration', 'voting', 'counting', 'published'))
    )
  );

-- ============================================================
-- T2 — event_voter_groups: cabut "everyone", ganti 3 policy scoped
-- ============================================================
DROP POLICY IF EXISTS "Everyone can view event voter groups" ON public.event_voter_groups;

-- 2a. Admin (policy manage-FOR-ALL yang lama dipertahankan; ini menutup SELECT).
DROP POLICY IF EXISTS "Admins can view event voter groups" ON public.event_voter_groups;
CREATE POLICY "Admins can view event voter groups"
  ON public.event_voter_groups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2b. Panitia/pengawas untuk pemilihannya sendiri.
DROP POLICY IF EXISTS "Committee can view voter groups of their elections" ON public.event_voter_groups;
CREATE POLICY "Committee can view voter groups of their elections"
  ON public.event_voter_groups FOR SELECT TO authenticated
  USING (public.can_access_election(auth.uid(), event_id));

-- 2c. Voter untuk kelasnya sendiri (dipakai Dashboard + VotingPage cek DPT).
--     Subquery profiles di sini aman: policy 1a mengizinkan baris sendiri.
DROP POLICY IF EXISTS "Voters can view voter groups of their own class" ON public.event_voter_groups;
CREATE POLICY "Voters can view voter groups of their own class"
  ON public.event_voter_groups FOR SELECT TO authenticated
  USING (
    class_id = (SELECT p.class_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ============================================================
-- T3 — votes: cabut SELECT langsung committee/observer.
-- Hasil tetap tersedia via get_election_tally RPC (guard matriks D2).
-- Kebijakan "Admins can view all votes" + "Voters can view their own votes"
-- + "Voters can insert their own votes" dipertahankan.
-- ============================================================
DROP POLICY IF EXISTS "Committee and observers view votes of their elections" ON public.votes;

COMMENT ON POLICY "Voters can view their own votes" ON public.votes IS
  'Pilot-hardened 2026-10-09 (T3): voter hanya barisnya sendiri; committee/observer baca rekap via get_election_tally, bukan baris vote.';
