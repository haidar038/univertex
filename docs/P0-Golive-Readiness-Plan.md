# P0 Go-Live Readiness Plan — UniVertex

> **Status:** CODE DONE 2026-09-13 — code+migrasi lokal selesai, infra dashboard menunggu.
> Lihat `CHANGELOG.md [P0 Go-Live]` untuk bukti uji lokal (155 tests, tsc 0, build sukses).
> **Tanggal dibuat:** 13 September 2026
> **Tujuan:** 3 aksi wajib sebelum pilot nyata pertama (<200 voter, 1 event).
> **Hubungan:** Melanjutkan `docs/RUNBOOK.md`, `docs/Update_Kritis_Fixes_September_2026.md`, `CHANGELOG.md [Unreleased]`.

## 1. Ringkasan 3 Aksi P0

| ID | Judul | Masalah | Kriteria Selesai (DoD) |
|----|-------|---------|------------------------|
| P0-01 | Eligibility Enforcement di DB | `assert_event_is_votable()` hanya cek `status=voting + window`, tidak cek DPT. Non-DPT bisa insert via API langsung. | Migrasi `enforce_eligibility_on_vote` ter-apply di staging+prod, non-DPT ditolak `42501`, voter legit tetap bisa vote, test hijau. Detail: `docs/P0-01-Eligibility-Enforcement.md` |
| P0-02 | Staging Separation + Backup Drill | Prod = Dev (`oiurjnmpkguyxevdbpbu`). Belum ada PITR terbukti / drill restore. | Project staging ada, `db push` staging hijau (46 migrasi), Vercel env split, snapshot + restore drill <1 jam terdokumentasi. Detail: `docs/P0-02-Staging-Backup-Drill.md` |
| P0-03 | Auth & Session Hardening | Revoke hanya kosmetik (JWT tetap valid), tanpa MFA/rate-limit/SMTP produksi. | JWT 1 jam, revoke memaksa logout ≤5 mnt, MFA admin/committee, captcha login/invite, SMTP produksi terkirim. Detail: `docs/P0-03-Auth-Session-Hardening.md` |

Yang SENGAJA di luar P0: redesign secrecy `ballots` (P2), hierarchy organisasi (P2), k6 2000-user (P1), E2E Playwright penuh (P1).

## 2. Urutan Kerja New Session

```
1. Baseline (30 mnt) → 2. P0-01 (0.5–1 hari) → 3. P0-02 (0.5–1 hari, bisa paralel) → 4. P0-03 (1–2 hari) → 5. Docs final + CHANGELOG → 6. Gate pilot
```

- Baseline: `git stash/commit`, catat `supabase migration list`, `npx vitest --run`, `tsc --noEmit`.
- Kerjakan P0-01 dulu karena murni SQL + test, tidak butuh infra.
- P0-02 butuh akses dashboard Supabase + Vercel — siapkan credential sebelum mulai.
- P0-03 butuh ubah setting dashboard Auth — catat setiap perubahan di doc.

## 3. Gate Pilot (Go / No-Go H-1)

- [x] P0-01: test SQL manual non-DPT → `42501` (bukti 2026-09-28: event `cdeca0be…/Poltekes`, trigger `tg_enforce_vote_timeline` → `assert_event_is_votable` line 35; UI banner DPT + tombol disabled terverifikasi).
- [ ] P0-02: staging ≠ prod, drill restore tercatat (tanggal, durasi, RTO aktual).
- [x] P0-03-revoke: uji 2-device revoke → keluar ±3 mnt ≤5 mnt (2026-09-28, toast + `revoked_at` + audit terverifikasi).
- [ ] P0-03-sisa: email invite/reset masuk inbox (bukan spam); setting dashboard (JWT/MFA/rate-limit/CAPTCHA/SMTP) terdokumentasi.
- [ ] `npx vitest --run` hijau, `tsc --noEmit` 0 error, `vite build` sukses.
- [x] `docs/Peraturan-Pemilihan-BEM-Hukum-2026.md` SAH 2026-09-29 (Chalid Ridwan + Faisal Abidin).
- [ ] Helpdesk H-H siap (lihat `docs/SOP-Helpdesk-HariH.md`).

Jika satu saja merah → **postpone election**, jangan paksakan.

## 4. File Terkait

- Spec: `docs/P0-01-*.md`, `docs/P0-02-*.md`, `docs/P0-03-*.md`
- Operasional: `docs/Peraturan-Pemilihan-Template.md`, `docs/SOP-Helpdesk-HariH.md`
- Tracking: `CHANGELOG.md → [P0 Go-Live] Planned`
- Referensi: `docs/RUNBOOK.md §0-§4`, `docs/supabase-auth-redirects.md`, `docs/Test_Strategy_Verifikasi.md §4`
