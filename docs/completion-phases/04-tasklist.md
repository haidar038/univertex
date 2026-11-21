# 04 — Tasklist (Checklist Harian)

> Centang `[x]` + tulis tanggal + bukti (commit/hash/screenshot). Jangan klaim hijau tanpa output.

## P-A — Staging + Backup

* [x] Verifikasi staging kosong 2026-10-12 (0 tabel via read-only) + catat ref: prod `oiurjnmpkguyxevdbpbu` (`ap-southeast-1`), staging `koveroqhxphdiakvukxt` (`ap-northeast-1`).
* [x] Push 2026-10-12 TANPA ganti link (linked tetap prod; semua push pakai `--project-ref koveroqhxphdiakvukxt` eksplisit): dry-run 52 hijau → push 37 + 15 (EXIT 0) + `20261012000000_reseed_role_permissions.sql` (EXIT 0) = 53. Paritas vs prod terverifikasi (22 relasi, 7 RPC, 10 policy, trigger inti).
* [x] Vercel env split 2026-10-12: 4 var prod → `production` saja (nilai tak diubah); 4 var staging baru → `preview` + `development`. `.env.example` diisi URL staging (tanpa secret).
* [x] Snapshot prod 2026-10-12: user dump via pg_dump, agen verifikasi + hash + arsip. `backups\pilot-pre-prod.sql` 8.699.897 bytes / 61.620 lines SHA256 `21512C09…E27` + `.tar.gz` 1.082.107 bytes; staging dump 662.218 bytes / 11.490 lines SHA256 `669A3C…200`. Isi prod COCOK 100% live (profiles 58 / events 5 / votes 29 / audit 368 / cand 9 / evg 11 / tr 18). Lokasi 2 (Drive privat) DONE 2026-10-12. Tercatat di `docs/P1-Proddirect-Notes.md`.
* [x] Drill restore run-2 HIJAU 2026-10-12 (prosedur `RUNBOOK.md §2.3b`: reset staging → DROP vote trigger → `psql -f` 2x → CREATE trigger P0-01): staging cocok prod 100% (58/5/29/368/9/11/35) + trigger ada, terverifikasi MCP. RTO TERUKUR **2 mnt 3 dtk** (`Measure-Command`). Log `backups\drill-restore-2026-10-12-run2.log`. Diterima: auth tak ikut + 5 roles orphan.
* [x] Verifikasi §2.4 RUNBOOK 2026-10-12: user pakai akun lama (1 admin + 2 kandidat + voter) — login OK, vote uji OK (staging votes 29→30 terverifikasi MCP).
* [ ] TEMUAN delete-event 400 di staging (event `3c0c4606` voting, anak: votes 1/cand 2/evg 1/tr 2): `DeleteEventDialog.tsx:70` DELETE langsung, FK menahan. SQL hapus-manual diberikan ke user; fix produk dicatat di P-B.
* [x] Update `02-milestones.md M1` (SEBAGIAN 2026-10-12). `CHANGELOG.md` menyusul saat commit.

## P-B — Hasil + Paslon

* [x] `CreateEventDialog.tsx` + `EditEventDialog.tsx` 2026-10-12: `election_type=closed` → force `show_results_after_voting=false` (radio handler + zod refine + submit) + checkbox disabled + helper text. tsc 0, build OK.
* [x] Guard server R1 2026-10-12 (`20261012000100_secure_tally_closed.sql`): closed+voting selalu 42501 untuk non-staff walau flag menyala; committee/observer boleh pantau. Push staging EXIT 0. Prod via MCP `apply_migration` (CLI push terhalang drift histori dashboard — lihat bawah) + verifikasi body live. Data fix `20261012000200` (UPDATE flag closed) staging EXIT 0 + prod via MCP; prod `3c0c4606` kini false.
* [x] `VotingPage.tsx` 2026-10-12: closed sesudah vote → `/app/dashboard`, hanya open → `/app/results`. Test +2 hijau.
* [x] `ResultsPage.tsx` 2026-10-12: mode `redacted` untuk closed pre-publish (trophy disembunyi, angka → `?`, bar abu-abu, total → "Disembunyikan", struk "Pilihanmu: X"; 42501 tally ditelan jadi sensor bukan error). Test tangkap 1 bocor badge `Total:` → diperbaiki. Test +3 hijau.
* [x] `Dashboard.tsx:189` 2026-10-12: tombol hasil sementara hanya open.
* [x] Fix hapus event 2026-10-12 (`DeleteEventDialog.tsx`): tolak bila `votes>0` (tombol disabled + pesan arsip) — berlaku UI; hapus manual staging via SQL diberikan.
* [ ] Paslon: UI admin (`EventDetail` tab + 3 dialog) + voter + tally sudah ada; uji klik + E2E paslon MENUNGGU fixture auth staging (terkait P-C). Tanpa баг yang terbukti — tidak diubah (YAGNI).
* [ ] E2E `closed-redacted` + `vote-paslon` di staging: MENUNGGU fixture auth staging (P-C import). Unit + tsc + build hijau (21 files / 165 tests).
* [ ] Drift histori prod: remote punya versi dashboard (`20260912113532`, `20260913121150`, `20260913121201`, `20261009054208` + 2 apply MCP P-B) yang tak ada di lokal → `db push --project-ref prod` DITOLAK CLI. Jangan `repair reverted` buta. Opsi: `db pull` lalu rapikan, atau teruskan pola MCP `apply_migration` + catat. Putuskan sebelum push prod berikutnya.

## P-C — User + Invite

* [x] Bulk delete di `Users.tsx` (2026-10-16, `676e683`): checkbox + toolbar + `BulkDeleteUsersDialog` + RPC `admin_bulk_delete_users` + audit `user.bulk_delete` + blokir admin/pemilik votes/kandidatur. Test `BulkDeleteUsersDialog.test.tsx` + `UsersSelection.test.tsx` hijau.
* [x] Import per-kelas (2026-10-16, `676e683`): `BulkImportUsersDialog.tsx` punya override kelas + kolom `class_name` opsional; RPC `admin_import_class_users` (roles + audit `target_id`) sudah live di prod via `20261015162954`.
* [x] Invite rework (2026-10-16, `676e683`): `Invitations.tsx` untuk susulan (committee/observer/kandidat), voter massal lewat import kelas; token 64-hex + salin link manual; hapus user undangan via RPC `admin_delete_invitation_user` (migrasi `20261016000100`, test `Invitations.test.tsx`).
* [ ] Akses H-H only: akun pre-provision aktif, tapi vote tetap ditolak di luar window via trigger (`42501`/`P0001`) + banner DPT di `VotingPage.tsx:168-173`. Uji simulasi window di staging.
* [ ] Uji 100 akun dummy staging end-to-end.

## P-D — Email + Auth

* [x] Putuskan 2026-10-12: Gmail relay + batch 50–100/jam + template. Tertulis di `11-email-smtp-vercel.md`. (Domain `univertex.site` + Resend diambil alih kemudian — lihat Fase email.)
* [x] Cek dashboard 2026-10-16: JWT 3600, rate-limit ON, redirect + Site URL, reset → `/reset-password`. Lolos.
* [x] SOP fallback: §6 baru di `SOP-Helpdesk-HariH.md`. PIC terisi + 2 helpdesk terlatih.
* [x] MFA: deferred + aturan manual admin/committee wajib (tercatat di `11-email-smtp-vercel.md`).

## P-E — Beban + Security staging

* [x] R3 search_path 2026-10-16 (`20261012001100`, 7 fungsi; push staging EXIT 0; prod = paste dashboard oleh user). EXECUTE berlebih DINYATAKAN accepted-risk (fungsi wajib callable; penjagaan riil = cek `has_role` di dalam; mencabut EXECUTE = matikan fitur).
* [x] Skrip k6 staging `tests/load/staging-mixed.js` v2 2026-10-17 — temuan run 100 VU pertama: preview Vercel TERPROTEKSI (Vercel Authentication) → k6 tanpa sadar mengukur halaman login Vercel (343 MB download; run TIDAK VALID). v2: abort di setup untuk target terproteksi, `LANDING=0`/`BYPASS=<secret>`, metrik `errors` jujur (0/1), tag + threshold per-endpoint, validasi TALLY_EVENT_ID (abort bila P0002). Bukti: archive OK, smoke 6/6, verify agen 100 VU×1m `LANDING=0` → checks 7392/7392, p95 events 746ms / tally 607ms, exit 0 (`test-results/k6-100vu-v2.txt`). Run 100/300 VU user hijau; 600 VU selesai 2026-10-17 — user (`test-results/k6-600.txt`) + verify agen bersih (`test-results/k6-600-v2.txt`: checks 82.792/82.792, p95 791ms, 0 reset), setelah patch accounting `http_req_failed` (tally 400/401/403 = expected).
* [ ] ZAP pasif staging 0 High — manual user (ZAP/docker tidak ada di mesin ini).
* [ ] UAT 15/15 + H-1 — manual user + panitia.
* [ ] Pentest 6 vektor ulang di staging — manual user (pola P1-03 berlaku).
* [ ] Rapikan advisor: `search_path` 7 fungsi + cabut EXECUTE anon/auth yang tidak perlu (uji tidak break invite/tally/sesi).

## P-F — Gladi + Go/No-Go

* [ ] UAT 15/15 (HP + laptop) + tanda tangan panitia + `Peraturan-*.md` SAH.
* [ ] Gladi auto-`counting` via `auto_transition_elections` (cron tiap menit) + publish manual.
* [ ] H-1: tally cocok counts, audit 24 jam wajar, backup hash + RTO tercatat, helpdesk siap.
* [ ] Keputusan GO / NO-GO tertulis. Satu merah = postpone.
