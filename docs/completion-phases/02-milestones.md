# 02 — Milestones ke Pilot Terkendali

> Update tanggal + bukti setiap milestone lolos. Satu merah = postpone.

## M0 — Source of truth siap [DONE 2026-10-11]

* Folder ini dibuat (12 file). DoD: semua file ada, tidak ada placeholder kosong.

## M1 — Staging hidup + drill terbukti [HIJAU 2026-10-12]

* Project `univertex-staging` (`koveroqhxphdiakvukxt`, `ap-northeast-1`) sudah ada dan ACTIVE_HEALTHY (terpantau 11 Okt via akun `etercode-univertex`). Tinggal diisi + disambung.
* DoD:
  * [x] Migrasi staging hijau 2026-10-12 (52 + 1 reseed = 53, paritas RPC/trigger/policy terverifikasi).
  * [x] Vercel preview → staging, prod → prod (env split 2026-10-12, nilai prod tidak diubah).
  * [x] Snapshot prod tercatat 2026-10-12 (hash SHA-256 + `.tar.gz`; lokasi 2 menunggu upload user).
  * [x] Restore TERBUKTI 2026-10-12 run-2 (prosedur `RUNBOOK.md §2.3b`): staging profiles 58 / events 5 / votes 29 / audit 368 / cand 9 / evg 11 / sess 35 = COCOK prod 100%; trigger `trg_enforce_vote_timeline` ada. Log `backups\drill-restore-2026-10-12-run2.log`. RTO TERUKUR: **2 mnt 3 dtk** (`Measure-Command`, jauh <1 jam). Batasan tercatat: auth tak ikut di-clone + 5 `user_roles` orphan (diterima).
  * [x] Verifikasi §2.4: user pakai akun lama (1 admin, 2 kandidat, sisanya voter) — login OK; vote uji OK (staging votes 29→30 terverifikasi MCP). Backup lokasi 2 (Drive privat) DONE.
  * [ ] TEMUAN: hapus event staging gagal 400 (`delete-event-err.json`) — akar: `DeleteEventDialog.tsx:70` DELETE langsung tanpa hapus anak/cascade (padahal UI janji "hapus semua data terkait"); event `3c0c4606` (voting, votes 1/cand 2/evg 1) tertahan FK. Fix dicatat di P-B (aturan produk: tolak hapus bila ada votes, atau RPC `admin_delete_event`).

## M2 — Aturan main hasil + pasangan beres [HIJAU kode 2026-10-12; sisa E2E staging]

* Visibilitas closed/open tidak bocor + pairing bisa dipakai panitia tanpa bingung. Termasuk R1 (tally guard server) — disetujui 2026-10-11.
* DoD:
  * [ ] Event closed tidak pernah tampilkan perolehan/trophy ke voter sebelum `published` (walau checkbox nyala — checkbox di-disable untuk closed).
  * [ ] Voter closed yang sudah milih lihat "pilihanmu" + statistik abu-abu.
  * [ ] R1: `get_election_tally` tolak voter untuk closed pre-publish (admin/committee/observer lolos via permission).
  * [ ] Admin bisa buat/edit/approve paslon dari UI + voter bisa milih paslon + tally per-paslon benar.
  * [ ] E2E: vote single + vote paslon + cek closed tidak bocor.

## M3 — User 1600 rapi + invite tidak nyangkut [HIJAU 2026-10-12]

* Bulk delete + import per-kelas + invite susulan + akses H-H only jalan. R2 privacy per-tabel DITUNDA ke sesi sendiri (satu perubahan besar per sesi). Email konfirmasi/auto-login tetap backlog M4.
* DoD:
  * [x] Bulk delete 2026-10-12: `BulkDeleteUsersDialog.tsx` + checkbox/toolbar `Users.tsx` + RPC `admin_bulk_delete_users` (maks 200, lewati admin + pemilik votes/kandidatur, audit). Test +3. Live staging + prod.
  * [x] Uji klik staging 2026-10-12: import 10 + 100 OK; hapus 90 + sisa via Hapus Massal OK (termasuk shift+klik). Sisa 7 dummy UJI* — benar: termasuk UJI002 yang sudah vote (skip proteksi terbukti live).
  * [x] Import per-kelas 2026-10-12: override kelas di `BulkImportUsersDialog.tsx` + RPC `admin_import_class_users` (validasi + idempotent + audit). Test kontrak +1. Live staging + prod.
  * [ ] Uji klik staging: import 10 dummy → verifikasi class_id + role. Email konfirmasi = backlog M4 (akun pre-provision langsung aktif; hak vote via window H-H).
  * [x] Invite 2026-10-12: banner pengarah di `Invitations.tsx` (voter massal via import; undangan = susulan; salin-link manual = fallback resmi).
  * [x] Uji 100 dummy staging HIJAU 2026-10-12: import 100 via CSV OK; hapus massal OK; rantai DPT→vote terbukti (event `d8b974a5` open/voting: 2 suara — 1 admin lama + 1 Dummy UJI002 — + audit `vote.cast`). Sisa 7 dummy termasuk UJI002 (skip proteksi benar).

## M4 — Email + Auth cukup untuk H-H [HIJAU 2026-10-16]

* Di domain vercel.app, email seadanya tapi tidak matikan operasi.
* DoD:
  * [x] Keputusan tertulis 2026-10-12: Gmail relay (Opsi B) + batch 50–100/jam + template 1 paragraf (lihat `11-email-smtp-vercel.md`).
  * [x] Konfirmasi dashboard 2026-10-16 (JWT 3600, rate-limit ON, redirect + Site URL, reset → `/reset-password`) — manual user lolos.
  * [x] SOP fallback: §6 baru (spam → Not spam → salin link manual + reset manual). PIC terisi + 2 orang terlatih (<3 mnt/orang).
  * [x] MFA/committee via SOP manual, UI enroll pasca-pilot (deferred tercatat).

## M5 — Siap pilot (Go/No-Go H-1) [BELUM]

* DoD (cek `docs/GoLive-Manual-Checklist.md` + bawah ini). Termasuk R3 (advisor), R5 (scope freeze), R6 (SLO 1600) — disetujui 2026-10-11. R4 (domain sendiri) = TUNDA, backlog M5+.
* SLO R6: login 300 bersamaan p95 <2s, vote 100/menit error <1%, tally p95 <500ms di staging, helpdesk <5 mnt jam sibuk, backup + RTO <1 jam. Tidak tercapai = postpone tertulis.
* Scope freeze R5: tidak ada redesign ballots, hierarchy penuh, k6 prod, white-label, MFA UI di pilot ini.
* DoD:
  * [ ] `tsc 0 error`, `vitest` hijau, `build` sukses.
  * [ ] k6 staging: 300 VU campuran lolos (p95 + error rate tercatat).
  * [ ] R3: advisor rapi (search_path + EXECUTE berlebih) tanpa break invite/tally/sesi.
  * [ ] ZAP pasif 0 High di staging.
  * [ ] UAT 15/15 dengan panitia (termasuk HP).
  * [ ] Peraturan + helpdesk + backup hash + RTO tercatat.
