# P0-02 — Staging Separation + Backup Drill Terbukti

> **Status:** CODE/DOCS DONE 2026-09-13 (env split + RUNBOOK; infra dashboard menunggu).
> Parent: `docs/P0-Golive-Readiness-Plan.md`
> Sisa: buat `univertex-staging` + `db push` 50 migrasi + Vercel split + PITR + drill restore.
> **Masalah:** `docs/RUNBOOK.md §0` mengakui prod = dev di project `oiurjnmpkguyxevdbpbu`. Belum ada project staging, Vercel env belum split, PITR + `scripts/snapshot-db.mjs` belum pernah drill restore.

## 1. Langkah Infra (butuh akses dashboard Supabase + Vercel)

1. **Baseline:** `git stash`/`commit` kerja kini. Catat output `supabase migration list` prod + jumlah tabel/RPC (`get_election_tally`, `is_eligible_voter`, `accept_invitation_and_register`, `revoke_user_session_by_hash` harus ada).
2. **Buat project `univertex-staging`** (region sama dengan prod). `supabase link --project-ref <staging-ref>` di clone terpisah atau via `--linked` flag agar tidak ganggu link prod.
3. **Push 46 migrasi ke staging:** `supabase db push --dry-run` dulu, lalu `push`. Harus hijau semua. Jika ada yang merah, JANGAN lanjut ke prod — perbaiki di staging.
4. **Vercel env split:**
   - `production` → URL + anon prod.
   - `preview` + `staging branch` → URL + anon staging.
   - Dokumentasikan mapping di `.env.example` (hanya placeholder, tanpa secret).
5. **PITR:** enable di staging (Database → Backups → Point in time). Catat retensi (7 hari Pro / 28 hari Team).
6. **Snapshot manual:** `node scripts/snapshot-db.mjs` (atau `supabase db dump --schema public -f backup-pre-election-<tgl>.sql`), gzip, simpan 2 lokasi (Drive + lokal terenkripsi).
7. **Drill restore:** restore snapshot ke project ketiga `univertex-restore-drill`, verifikasi login + tally 1 event, catat waktu mulai→selesai = RTO aktual. Hapus project drill setelahnya (hemat biaya).

## 2. Bukti Yang Harus Ditempel di PR

- Screenshot `migration list` staging hijau.
- File `backup-pre-election-<tgl>.sql.gz` (hash SHA-256, bukan isi).
- Log drill: `mulai, selesai, durasi, kendala, RTO`.
- Perbandingan `SELECT count(*) FROM votes` staging vs prod (harus beda / staging kosong — bukti tidak tertukar).

## 3. Update RUNBOOK (di new session, edit kecil saja)

- `docs/RUNBOOK.md §0`: ganti tabel env (staging ref baru), hapus kalimat "masih share database".
- Tambah baris checklist H-1: "snapshot diambil + hash dicatat + 2 lokasi".

## 4. Tradeoff & Risiko

- Biaya: +1 project Pro untuk staging (+1 sementara untuk drill). Alternatif "schema terpisah 1 project" DITOLAK — RLS/RPC grant bocor silang.
- Risiko tertukar link prod/staging saat `db push`. Mitigasi: selalu `supabase migration list` + cek project-ref sebelum push; beri nama branch `staging` khusus.

## 5. DoD

- [ ] Staging online, migrasi hijau, login admin/voter jalan.
- [ ] Vercel preview → staging terbukti (ubah teks kecil, deploy preview, cek data staging).
- [ ] Drill restore <1 jam + log terlampir.
