-- ============================================================================
-- UniVertex — RESET DATA DEMO (MANUAL ONLY)
-- Lokasi: supabase/reset-db.sql
-- ============================================================================
-- APA INI?
--   Script bersih-bersih MANDIRI, dijalankan manual dari Supabase Dashboard
--   → SQL Editor, saat project sudah siap dipakai beneran (go-live).
--   BUKAN migrasi. Jangan taruh di supabase/migrations/ (tidak boleh ikut
--   `supabase db push`). File ini tidak pernah jalan otomatis.
--
-- CARA PAKAI (urutan wajib):
--   1. Snapshot dulu:  node scripts/snapshot-db.mjs --project=oiurjnmpkguyxevdbpbu
--      + catat hash SHA-256 di 2 lokasi (lihat docs/RUNBOOK.md §1).
--   2. Jalankan BAGIAN A (inventaris, read-only) → cocokkan angka dengan
--      ekspektasi di bawah.
--   3. Jalankan BAGIAN B di dalam transaksi: BEGIN; ... cek hasil ...
--      kalau verifikasi BAGIAN C = 0 semua → COMMIT; kalau ada aneh → ROLLBACK;
--   4. Jangan pernah hapus audit_log (append-only by design).
--
-- YANG DIHAPUS (default):
--   - Akun demo:  *@univertex.test, p1-*@test.local, *@test.local
--   - Event uji:   [P1-TEST]* dan event Poltekes cdeca0be-1892-4f01-b446-53e21c12a521
--     beserta votes, observations, transitions, committees, observers,
--     candidates, pairs, DPT-link, eligibility-rules, invitations-nya.
--   - Kelas uji:   'P1 TEST Kelas' (saat ini sudah 0, aman).
--
-- YANG DIPERTAHANKAN (default):
--   - Event asli:  Pemilihan BEM Fakultas Hukum 2026 (95676965-...)
--   - Admin asli:  admin@univertex.com + akun manusia (gmail/yahoo/outlook/proton)
--   - 5 kelas seed, audit_log + audit_archive, role_permissions.
--
-- OPT-IN (default MATI, buka komentar bila memang mau):
--   - BLOK H: 1 suara uji yang nempel di event Hukum (2026-09-27).
--   - BLOK I: 4 akun inbox H5 (gmail/yahoo/outlook/proton milik developer).
-- ============================================================================

-- ============================================================================
-- BAGIAN A — INVENTARIS DRY-RUN (read-only, aman dijalankan kapan saja)
-- Ekspektasi saat dokumen ini ditulis (2026-10-09):
--   demo_users ~7 | demo_votes 0 | poltekes_event 1 | hukum_votes 1 | p1_kelas 0
-- ============================================================================

-- A1. Akun demo yang akan dihapus
SELECT email, created_at FROM auth.users
WHERE email LIKE '%@univertex.test'
   OR email LIKE '%@test.local'
ORDER BY email;

-- A2. Event demo vs event asli
SELECT id, title, status FROM public.election_events ORDER BY created_at;

-- A3. Suara per event (Hukum = 1 suara uji, Poltekes = 0)
SELECT e.title, count(v.id) AS votes
FROM public.election_events e
LEFT JOIN public.votes v ON v.event_id = e.id
GROUP BY e.title ORDER BY e.title;

-- A4. Artefak lain yang nempel ke event demo
SELECT 'committees' AS t, count(*) FROM public.election_committees
  WHERE election_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
UNION ALL SELECT 'observers', count(*) FROM public.election_observers
  WHERE election_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
UNION ALL SELECT 'observations', count(*) FROM public.election_observations
  WHERE election_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
UNION ALL SELECT 'transitions', count(*) FROM public.election_state_transitions
  WHERE election_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
UNION ALL SELECT 'voter_groups', count(*) FROM public.event_voter_groups
  WHERE event_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
UNION ALL SELECT 'candidates', count(*) FROM public.candidates
  WHERE event_id = 'cdeca0be-1892-4f01-b446-53e21c12a521';

-- A5. Kelas uji (harus 0; kalau >0 akan ikut terhapus)
SELECT count(*) AS p1_kelas FROM public.classes WHERE name = 'P1 TEST Kelas';

-- ============================================================================
-- BAGIAN B — HAPUS (jalankan dalam transaksi!)
-- ============================================================================
BEGIN;

-- B1. Suara milik event demo / pemilih demo
DELETE FROM public.votes
WHERE event_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
   OR event_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%')
   OR voter_id IN (SELECT id FROM auth.users
                   WHERE email LIKE '%@univertex.test' OR email LIKE '%@test.local');

-- B2. Catatan pengawasan event demo
DELETE FROM public.election_observations
WHERE election_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
   OR election_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%');

-- B3. Jejak transisi status event demo
DELETE FROM public.election_state_transitions
WHERE election_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
   OR election_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%');

-- B4. Panitia + pengawas event demo
DELETE FROM public.election_committees
WHERE election_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
   OR election_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%');
DELETE FROM public.election_observers
WHERE election_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
   OR election_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%');

-- B5. Paket kandidat (members dulu, baru pairs) event demo
DELETE FROM public.candidate_pair_members
WHERE pair_id IN (SELECT id FROM public.candidate_pairs
                  WHERE event_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
                     OR event_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%'));
DELETE FROM public.candidate_pairs
WHERE event_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
   OR event_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%');

-- B6. Notifikasi kandidat demo (sebelum candidates dihapus)
DELETE FROM public.candidate_notifications
WHERE user_id IN (SELECT id FROM auth.users
                  WHERE email LIKE '%@univertex.test' OR email LIKE '%@test.local')
   OR candidate_id IN (SELECT id FROM public.candidates
                       WHERE event_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
                          OR event_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%'));

-- B7. Kandidat event demo / milik akun demo
DELETE FROM public.candidates
WHERE event_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
   OR event_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%')
   OR user_id IN (SELECT id FROM auth.users
                  WHERE email LIKE '%@univertex.test' OR email LIKE '%@test.local');

-- B8. DPT-link + aturan eligibility event demo
DELETE FROM public.event_voter_groups
WHERE event_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
   OR event_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%');
DELETE FROM public.election_eligibility_rules
WHERE election_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
   OR election_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%');

-- B9. Undangan demo
DELETE FROM public.invitations
WHERE email LIKE '%@univertex.test' OR email LIKE '%@test.local'
   OR event_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
   OR event_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%');

-- B10. Event demo itu sendiri (Poltekes + [P1-TEST]*)
DELETE FROM public.election_events
WHERE id = 'cdeca0be-1892-4f01-b446-53e21c12a521' OR title LIKE '[P1-TEST]%';

-- B11. Sesi → roles → profil → auth akun demo (urutan penting!)
DELETE FROM public.user_sessions
WHERE user_id IN (SELECT id FROM auth.users
                  WHERE email LIKE '%@univertex.test' OR email LIKE '%@test.local');
DELETE FROM public.user_roles
WHERE user_id IN (SELECT id FROM auth.users
                  WHERE email LIKE '%@univertex.test' OR email LIKE '%@test.local');
DELETE FROM public.profiles
WHERE id IN (SELECT id FROM auth.users
             WHERE email LIKE '%@univertex.test' OR email LIKE '%@test.local');
DELETE FROM auth.users
WHERE email LIKE '%@univertex.test' OR email LIKE '%@test.local';

-- B12. Kelas uji (saat ini 0 baris — no-op yang aman)
DELETE FROM public.classes WHERE name = 'P1 TEST Kelas';

-- ============================================================================
-- BLOK H — OPT-IN: hapus 1 suara uji di event HUKUM (asli!)
-- Default MATI. Nyalakan (hapus --) hanya bila panitia setuju:
-- suara 35bf35c9-.../2026-09-27 adalah jejak testing, bukan suara nyata.
-- ============================================================================
-- DELETE FROM public.votes WHERE event_id = '95676965-a5c6-4f62-88bb-37ab9a57968b';

-- ============================================================================
-- BLOK I — OPT-IN: hapus 4 akun inbox H5 milik developer
-- Default MATI. Nyalakan hanya bila akun-akun ini tidak dipakai lagi.
-- ============================================================================
-- DELETE FROM public.user_sessions WHERE user_id IN
--   (SELECT id FROM auth.users WHERE email IN
--    ('haidar038@gmail.com','haidar038@yahoo.com','hydr038@outlook.com','hdr038@proton.me'));
-- DELETE FROM public.user_roles WHERE user_id IN
--   (SELECT id FROM auth.users WHERE email IN
--    ('haidar038@gmail.com','haidar038@yahoo.com','hydr038@outlook.com','hdr038@proton.me'));
-- DELETE FROM public.profiles WHERE id IN
--   (SELECT id FROM auth.users WHERE email IN
--    ('haidar038@gmail.com','haidar038@yahoo.com','hydr038@outlook.com','hdr038@proton.me'));
-- DELETE FROM auth.users WHERE email IN
--   ('haidar038@gmail.com','haidar038@yahoo.com','hydr038@outlook.com','hdr038@proton.me');

-- ============================================================================
-- BAGIAN C — VERIFIKASI RESIDU (harus 0 semua, kecuali audit_* yang dipertahankan)
-- Jalankan SEBELUM commit. Kalau ada angka >0 yang tak diharapkan → ROLLBACK;
-- ============================================================================
SELECT
  (SELECT count(*) FROM auth.users
     WHERE email LIKE '%@univertex.test' OR email LIKE '%@test.local') AS demo_users,
  (SELECT count(*) FROM public.election_events
     WHERE title LIKE '[P1-TEST]%' OR id = 'cdeca0be-1892-4f01-b446-53e21c12a521') AS demo_events,
  (SELECT count(*) FROM public.votes
     WHERE event_id = 'cdeca0be-1892-4f01-b446-53e21c12a521'
        OR event_id IN (SELECT id FROM public.election_events WHERE title LIKE '[P1-TEST]%')) AS demo_votes,
  (SELECT count(*) FROM public.classes WHERE name = 'P1 TEST Kelas') AS p1_kelas;

-- Sanity: yang boleh tersisa (catat angkanya, jangan dihapus)
SELECT
  (SELECT count(*) FROM public.election_events) AS events_total,
  (SELECT count(*) FROM public.votes) AS votes_total,
  (SELECT count(*) FROM public.profiles) AS profiles_total,
  (SELECT count(*) FROM public.audit_log) AS audit_total;

-- ============================================================================
-- BAGIAN D — KEPUTUSAN (pilih SALAH SATU, hapus komentarnya)
-- ============================================================================
-- COMMIT;     -- verifikasi C hijau → kunci hasil
-- ROLLBACK;   -- ada yang aneh → batalkan semua, data kembali utuh
