# P0-01 — Eligibility Enforcement di Level Database

> **Status:** CODE DONE 2026-09-13 (migrasi lokal + frontend + test hijau).
> Parent: `docs/P0-Golive-Readiness-Plan.md`
> Sisa: `db push` staging+prod + bukti manual T2 (`42501` via SQL console non-DPT) di PR.
> **Masalah:** `assert_event_is_votable(UUID)` (lihat `supabase/migrations/20260912000000_fix_vote_timeline_and_tally_statuses.sql:25-60`) hanya memvalidasi `status='voting'` + `start_time/end_time`. Tidak memanggil `is_eligible_voter()` (`20251108000000_phase2_state_machine_and_scope.sql:255-288`). UI `src/pages/app/VotingPage.tsx:86-93` cek DPT, tapi penyerang bisa bypass via `supabase.from('votes').insert(...)` langsung.

## 1. Desain Migrasi Baru

Nama file (new session): `supabase/migrations/20260913000000_enforce_eligibility_on_vote.sql`

```sql
-- P0-01: tolak suara dari non-DPT di level DB.
CREATE OR REPLACE FUNCTION public.assert_event_is_votable(p_event_id UUID, p_voter_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql STABLE AS $$
DECLARE v_status TEXT; v_start TIMESTAMPTZ; v_end TIMESTAMPTZ;
BEGIN
  SELECT status, start_time, end_time INTO v_status, v_start, v_end
  FROM public.election_events WHERE id = p_event_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Election event % not found', p_event_id USING ERRCODE='P0002'; END IF;
  IF v_status <> 'voting' THEN RAISE EXCEPTION 'Election event % is not open for voting (status=%)', p_event_id, v_status USING ERRCODE='P0001'; END IF;
  IF now() < v_start THEN RAISE EXCEPTION 'Election event % has not started yet', p_event_id USING ERRCODE='P0001'; END IF;
  IF now() > v_end THEN RAISE EXCEPTION 'Election event % has already ended', p_event_id USING ERRCODE='P0001'; END IF;
  -- P0-01: DPT check. NULL voter = skip (untuk kompatibilitas pemanggil lama), trigger selalu kirim voter.
  IF p_voter_id IS NOT NULL AND NOT public.is_eligible_voter(p_voter_id, p_event_id) THEN
    RAISE EXCEPTION 'Voter % is not eligible for election event %', p_voter_id, p_event_id USING ERRCODE='42501';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_enforce_vote_timeline()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Defense-in-depth: voter_id harus pemilik sesi juga (RLS sudah cek, trigger jadikan pesan jelas).
  IF NEW.voter_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'voter_id must equal authenticated user' USING ERRCODE='42501';
  END IF;
  PERFORM public.assert_event_is_votable(NEW.event_id, NEW.voter_id);
  RETURN NEW;
END; $$;
-- Trigger trg_enforce_vote_timeline tidak perlu di-drop/create ulang (call by name).
```

Catatan: overload `assert_event_is_votable(UUID)` → `(UUID, UUID)` aman karena `CREATE OR REPLACE` tidak hapus signature lama; biarkan signature 1-arg sebagai wrapper ke 2-arg agar pemanggil lama tidak pecah, atau hapus setelah grep bersih.

## 2. Index Pendukung (sertakan di migrasi yang sama)

```sql
CREATE INDEX IF NOT EXISTS idx_evg_event_class ON public.event_voter_groups(event_id, class_id);
CREATE INDEX IF NOT EXISTS idx_profiles_class ON public.profiles(class_id);
CREATE INDEX IF NOT EXISTS idx_rules_election ON public.election_eligibility_rules(election_id);
```

## 3. Perubahan Frontend (`src/pages/app/VotingPage.tsx`)

Di `handleVote` tambah cabang (setelah `P0001`):

```ts
} else if (error.code === '42501') {
  toast.error('Anda tidak terdaftar di DPT pemilihan ini. Hubungi panitia.');
  setNotEligible(true);
  await fetchEventAndCandidates();
}
```

Tidak perlu ubah query eligibility existing — itu tetap untuk UX cepat; DB kini sumber kebenaran.

## 4. Matriks Uji

| # | Skenario | Cara | Harapan |
|---|----------|------|---------|
| T1 | Voter DPT vote di window `voting` | UI normal | sukses, `vote.cast` audit ada |
| T2 | Non-DPT insert langsung via API/`rpc` | SQL console sebagai user non-DPT | `42501` |
| T3 | Non-DPT via UI (tombol) | login non-DPT buka `/app/vote/:id` | banner DPT, tombol disabled |
| T4 | Double-vote DPT | klik 2x cepat | pertama sukses, kedua `23505` |
| T5 | Vote di luar window | ubah `end_time` lampau di staging | `P0001` |
| T6 | `profiles.class_id` NULL | user tanpa kelas | `42501`, dashboard imbau hubungi admin |
| T7 | Rules path (`election_eligibility_rules profile_id`) | tambah rule per-user | lolos walau beda kelas |

Unit: tambah 2 case di `src/pages/__tests__/VotingPage.test.tsx` (42501 → banner DPT; insert kirim `voter_id+event_id`). Manual SQL WAJIB karena mock tidak cover RLS/trigger (lihat `docs/Test_Strategy_Verifikasi.md §4`).

## 5. Rollback

Simpan copy fungsi versi `20260912...` di komentar migrasi. Rollback = `CREATE OR REPLACE` balik + drop index (opsional, index aman dibiarkan).

## 6. DoD

- [ ] Migrasi apply bersih di staging lalu prod (`supabase migration list` hijau).
- [ ] T2 manual terbukti `42501` (log terlampir di PR).
- [ ] `vitest VotingPage` + `tsc` hijau.
