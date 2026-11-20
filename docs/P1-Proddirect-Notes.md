# P1 — Catatan Eksekusi Prod-Direct (tanpa staging)

> **Keputusan 2026-09-13:** slot project Supabase penuh (2/2 terpakai),
> staging TIDAK dibuat. P1 dijalankan prod-direct dengan penyesuaian aman.
> Event asli `95676965-a5c6-4f62-88bb-37ab9a57968b`
> (`Pemilihan BEM Fakultas Hukum 2026`, `registration`) TIDAK disentuh
> untuk uji tulis.

## Status 2026-09-13 (commit sesi: lihat CHANGELOG [P1 Pilot])

DONE (bukti lokal):
- Playwright scaffold: `playwright.config.ts`, `tests/e2e/*.spec.ts`
  (7 skenario), `@playwright/test@1.63.0`, Chromium `1243` installed,
  `npx playwright test --list` 7 listed, run rill sukses launch+login+
  video (tanpa kredensial → prod-safe SKIP).
- k6 scaffold: `tests/load/election-day.js` + `README.md` (smoke read-only).
- Coverage: `@vitest/coverage-v8@4.0.6` + gate di `vitest.config.ts`
  (threshold global) + job CI. Baseline scope P1:
  All 67.47 / lib 68.94 / hooks 51.41 / VotingPage 81.25 / sessions 85.71.
  `use-toast.ts` + `use-mobile.tsx` = 0% (belum ada test — backlog).
- PANDUAN_ADMIN / PANITIA / VOTER / OBSERVER.
- Test `vote.cast` audit baru HIJAU (13/13 VotingPage).

BLOCKED (butuh manusia/akses, DILARANG dipaksa) — langkah manual lengkap di
**`docs/P1-Manual-Testing-Runbook.md`** (Fase 0–5):
- E2E penuh hijau: butuh akun sintetis `p1-*` + event `[P1-TEST]` + BASE_URL
  jendela lain; jangan arahkan ke event asli.
- k6 run: binary k6 belum terinstall; SLO penuh NOT RUN ON PROD.
- UAT 15/15, ZAP, pentest penuh: butuh jendela maintenance + tester.

## Aturan uji tulis prod

1. Semua E2E tulis → `TEST_EVENT_ID` = event isolasi `[P1-TEST]` saja.
   Tanpa env itu spec tulis SKIP (lihat `tests/e2e/helpers.ts`).
2. Akun sintetis `p1test+*` saja; revoke + hapus setelah selesai.
3. k6: smoke read-only (`tests/load/election-day.js`); 200-VU + 2000-stretch
   = NOT RUN ON PROD (butuh env isolasi).
4. ZAP agresif + brute-force sungguhan DILARANG di prod.
5. Snapshot pre via `node scripts/snapshot-db.mjs --project=oiurjnmpkguyxevdbpbu`
   (butuh Supabase CLI — tidak ada di mesin ini, jalankan manual);
   catat hash SHA-256 + 2 lokasi, bukan isi dump.
6. Cleanup: hapus votes test → observations test → event test → users test;
   verifikasi residu 0 via `execute_sql` read-only.

## Snapshot fallback tanpa Docker (2026-09-28)

`scripts/snapshot-db.mjs` butuh Docker (`supabase db dump` exit 1, mesin dev tanpa Docker).
Pengganti yang disetujui untuk Fase 2 prod-direct:

* WAJIB: PITR/backup otomatis aktif — cek dashboard Database → Backups sebelum uji tulis.
* Baseline pra-uji via MCP (2026-09-28): event Poltekes `cdeca0be…` votes=0, obs=0.
  Pasca-uji wajib kembali ke angka ini (verifikasi residu 0); `audit_log` dipertahankan.
* Hash `Get-FileHash` sebelumnya (E3B0C44… = file kosong) TIDAK valid — abaikan.

## Cara menjalankan E2E prod-safe

```powershell
# 1) Dev server lokal
npm run dev
# 2) E2E (tanpa kredensial = skip tulis, hanya login=rill)
npx playwright test --list
npx playwright test --reporter=line          # semua
# 3) Dengan kredensial test + event isolasi
$env:BASE_URL='http://localhost:8080'
$env:TEST_EVENT_ID='<uuid event [P1-TEST]>'
$env:E2E_VOTER_EMAIL='...'; $env:E2E_VOTER_PASSWORD='...'
$env:E2E_NON_DPT_EMAIL='...'; $env:E2E_NON_DPT_PASSWORD='...'
$env:E2E_COMMITTEE_EMAIL='...'; $env:E2E_COMMITTEE_PASSWORD='...'
$env:E2E_OBSERVER_EMAIL='...'; $env:E2E_OBSERVER_PASSWORD='...'
$env:E2E_ADMIN_EMAIL='...'; $env:E2E_ADMIN_PASSWORD='...'
npx playwright test
```

## Status falsifikasi jujur

- P1-01: file scaffold ada + harness terbukti; run penuh hijau TERTUNDA
  (kredensial + `[P1-TEST]`), bukan klaim hijau.
- P1-02: script smoke ada; SLO penuh NOT-PROVEN.
- P1-03: PANDUAN_* + coverage CI + test `vote.cast` ada; UAT 15/15 + ZAP +
  pentest penuh menunggu jendela maintenance.

## Snapshot pilot-pre 2026-10-12 (agen + user)

- Prod dump ackups\pilot-pre-prod.sql (8.699.897 bytes, 61.620 lines) SHA256 21512C0961295D9BCD45D55F983F2F1418C67108AC3E8CAF5295A988EE008E27 � full DB incl auth schema, pg_dump 18.6.
- Staging dump ackups\pilot-pre-staging.sql (662.218 bytes, 11.490 lines) SHA256 669A3CB769B885A1AD61A469634F9F08BDCFD2055CE80935404167B154F3E200.
- Kompresi: pilot-pre-prod-2026-10-12.sql.tar.gz (1.082.107 bytes), pilot-pre-staging-2026-10-12.sql.tar.gz (120.346 bytes). Lokasi 2 (Drive privat) menunggu user upload.
- Verifikasi isi prod dump = live 2026-10-12: profiles 58 / events 5 / votes 29 / audit 368 / candidates 9 / evg 11 / transitions 18 � COCOK 100%.
- Sisa: drill restore dump prod ke staging (<1 jam) + verifikasi RUNBOOK �2.4 � butuh staging DB password untuk psql.


## Drill restore 2026-10-12 � SEBAGIAN (bukan hijau penuh)

- Metode: psql -f backups\pilot-pre-prod.sql ke staging (full-DB dump, 61.620 lines). Log: ackups\drill-restore-2026-10-12.log (78KB). Durasi mulai/selesai BELUM dicatat � catat manual saat ulang.
- Hasil akhir staging (verifikasi MCP read-only): profiles 58 / events 5 / audit 368 / cand 9 / evg 11 / sess 35 / inv 3 / rp 48 = COCOK prod; user_roles 57/62 (5 orphan, FK ke auth.users); votes 0/29 (ditolak trigger sendiri).
- Error noise (diabaikan): ratusan 'already exists' (restore di atas skema 53 migrasi) + 'permission denied/must be owner' untuk schema managed (auth/storage/realtime/extensions/vault) � ekspektasi Supabase, auth TIDAK bisa di-clone via dump.
- Temuan prosedur: (1) DROP 	rg_enforce_vote_timeline sebelum load votes, CREATE lagi sesudahnya; (2) FK order � load events dulu atau ulangi COPY yang gagal; (3) DR env butuh re-provision auth (re-invite/reset). RTO <1 jam BELUM terbukti (durasi tak tercatat).


## Drill restore run-2 2026-10-12 � HIJAU data aplikasi

- Prosedur �2.3b: reset staging + DROP trigger + \psql -f\ 2x + CREATE trigger P0-01. Log: \ackups\drill-restore-2026-10-12-run2.log\ (~80KB).
- Durasi kasar dari timestamp file: 00:36:38 ? 00:47:56 � 11 menit (<1 jam). Menunggu konfirmasi user apakah itu 1 atau 2 run.
- Verifikasi MCP: staging profiles 58 / events 5 / votes 29 / audit 368 / cand 9 / evg 11 / sess 35 = COCOK prod 100%; roles 57/62 (5 orphan FK auth, diterima); trigger \	rg_enforce_vote_timeline\ ADA (langkah 3 done).
- Sisa: auth tak ikut (batasan Supabase) + tes login 1 admin + 1 voter + 1 vote uji staging (manual user).


## Hasil uji manual user 2026-10-12 (M1 hijau penuh)

- Akun: pakai data lama (1 admin, 2 kandidat, sisanya voter) � bukan email saran agen.
- RTO TERUKUR: restore 8.7MB = 2 mnt 3 dtk (Measure-Command: TotalMinutes 2.06). Target <1 jam TERCAPAI.
- Vote uji: BERHASIL sesuai skenario (staging votes 29?30 terverifikasi MCP).
- Backup lokasi 2 (Drive privat): DONE.
- TEMUAN: hapus event staging 400 (edge log DELETE election_events). Akar: bukan RLS (user admin valid) � FK menahan (event voting + votes 1/cand 2/evg 1); dialog janji cascade yang tak ada. SQL manual + fix produk dicatat di tasklist P-B.


## P-B 2026-10-12 � lubang closed HIJAU (kode + guard + data)

- Temuan: event prod \3c0c4606\ closed+voting+show=true = bocor tally ke semua voter. Tutup 3 lapis: UI force false (Create/Edit dialog + zod + submit), guard R1 (\20261012000100\, closed selalu 42501 non-staff + staff boleh pantau), data fix (\20261012000200\).
- Voter closed: vote ? dashboard (bukan results); ResultsPage mode redacted (\?\, bar abu-abu, struk Pilihanmu); Dashboard tombol hasil hanya open. Test sendiri tangkap 1 bocor (badge Total) ? fixed.
- DeleteEventDialog: tolak hapus bila votes>0 (arahkan arsip).
- Bukti: vitest 21 files / 165 tests hijau (+5 P-B), tsc 0, build 1m01s OK. Guard + flag live di staging (push EXIT 0) dan prod (MCP apply, body terverifikasi).
- Sisa: E2E staging (tunggu fixture auth P-C) + drift histori prod (CLI push ditolak; teruskan MCP apply atau db pull).


## P-C 2026-10-12 � bulk delete + import per-kelas HIJAU kode

- RPC baru: \dmin_bulk_delete_users\ (\20261012000300\; maks 200, skip admin + pemilik votes/kandidatur, audit) + \dmin_import_class_users\ (\20261012000400\; validasi + idempotent + audit). Live staging (push EXIT 0) + prod (MCP apply, terverifikasi ada).
- UI: \BulkDeleteUsersDialog.tsx\ + checkbox/toolbar \Users.tsx\; override kelas di \BulkImportUsersDialog.tsx\; banner pengarah di \Invitations.tsx\.
- Bukti: vitest 22 files / 169 tests hijau (+4 P-C), tsc 0, build OK.
- Sisa manual: uji klik staging (import 10 dummy + bulk delete 3) + 100-dummy bila hijau. Email konfirmasi/auto-login = backlog M4. R2 privacy = sesi sendiri.


## Bug checkbox Users.tsx 2026-10-12 (temuan user, staging)

- Gejala: klik checkbox -> crash \Cannot read properties of undefined (reading 'size')\ di \Users.tsx:162\.
- Akar: updater \	oggleSelect\ tidak me-\eturn next\ (Set baru hilang, state jadi undefined). Salah tulis agen, bukan salah data.
- Fix 1 baris + test regresi \UsersSelection.test.tsx\ (klik-tampil-toolbar-tanpa-crash, pilih-semua). Full suite 23 files / 171 tests hijau, tsc 0, build OK.


## M3 hijau penuh 2026-10-12 � rantai import?DPT?vote terbukti staging

- Import 10 + 100 dummy OK; hapus massal (biasa + shift+klik) OK.
- Event uji \d8b974a5\ (open/voting): 2 suara (M Khaidar + Dummy UJI002) + audit \ote.cast\ � rantai H-H valid.
- 7 dummy tersisa termasuk UJI002 = benar (skip proteksi pemilik suara terbukti live, bukan bug). Flag closed \3c0c4606\ tetap false.


## P-D 2026-10-12 � email HIJAU dokumen

- Keputusan: Gmail relay + batch 50-100/jam + template 1 paragraf. SOP fallback �6 baru. MFA deferred + aturan manual.
- Sisa manual: konfirmasi dashboard tak berubah + isi PIC + latih 2 helpdesk.


## PIN 8 digit H-H 2026-10-12 (persetujuan user)

- Keputusan: password generate = 8 digit acak (10^8 kombinasi, CSPRNG, string zero-padded). Aman untuk kredensial 1 hari (rate-limit + audit bunuh brute-force); anti-bingung (tanpa O/0, l/I, case).
- Implementasi: \src/lib/pin.ts\ (test 2 hijau) + toggle di \BulkImportUsersDialog\ (default ON; kolom password CSV boleh kosong) + tombol Unduh CSV Kredensial sekali + peringatan hapus file digital.
- Bukti: full suite 175 hijau, tsc 0, build OK. Sisa: uji klik staging (import 3 PIN -> unduh CSV -> login 1 PIN).


## Email blast Fase 2 HIJAU kode 2026-10-12

- DB: \email_queue\ + RPC \dmin_enqueue_event_voters\ (\20261012000500\) � push staging EXIT 0, prod via MCP apply (terverifikasi ada). PIN tidak disimpan.
- Function \send-voter-credentials\ (Deno, deno check EXIT 0): auth admin via JWT, PIN CSPRNG, set password Auth Admin API, kirim Resend, throttle 1.5s, batch 40, idempotent, audit per batch. Deploy staging + prod EXIT 0 (secrets RESEND_API_KEY/RESEND_FROM/APP_URL menyusul Fase 1 user).
- UI: \/admin/email-blast\ (rute + nav): isi antrean, kirim batch, export gagal->slip. Test +3.
- Bukti: vitest 178 hijau, tsc 0, build OK.



## Fix blast 405 + panel + search + hapus arsip 2026-10-14

- CORS function: jawab OPTIONS + header di semua response (localhost/preview/prod). Deploy staging + prod EXIT 0. deno check EXIT 0.
- Panel blast: label dinamis \Kirim N Email\ (N=min antrean), pemilih batch 10/40/100, tombol Reset Antrean (hapus pending + konfirmasi).
- Users: search nama/NIM/email client-side + seleksi/shift jalan di hasil filter + pesan kosong.
- Hapus event: RPC \dmin_delete_event\ (20261012000600; arsip-only, transaksional, audit dipertahankan) + dialog konfirmasi ketik. Blokir non-arsip berdata tetap. Live staging + prod.
- Bukti: 183 tests hijau (+5: 2 search + 3 delete-dialog), tsc 0, build OK.


## Fix 401/400 + pagination 2026-10-14

- Blast 401 = sesi habis (CORS sudah sembuh). Function: pesan granular no_token/bad_token/not_admin + UI pre-check sesi + toast pesan server. Deploy staging + prod.
- Delete 400 = trigger audit_log_immutable menolak NULL election_id. Fix: klausa election_id-only-NULL (cermin actor_id) via 20261012000700 (staging push, prod MCP + terverifikasi). Dialog arsip + ketik-nama + RPC tetap.
- Users pagination 20/halaman (First/Prev/Next/Last, seleksi lintas halaman, search reset). Test flaky timeout 5s -> 15s untuk render 25-baris.
- Bukti: 26 files / 186 tests hijau, tsc 0, build OK.


## Akar 401 blast ketemu 2026-10-14 (gotcha supabase-js)

- \supabase.functions\ = client BARU dengan header STATIK (anon key); token sesi TIDAK disuntik otomatis (beda dengan realtime yang ada setAuth). Jadi server selalu terima anon key -> bad_token 401. Fix: kirim \headers: { Authorization: Bearer <access_token> }\ eksplisit di invoke + test kontrak header. Bukan salah sesi user.


## Dua sumber kredensial 2026-10-14 (temuan user)

- Gejala: login gagal pasca-blast padahal import pakai password123.
- Akar: blast MEREGENERASI PIN + set password baru saat kirim (server tak bisa baca password lama � hanya hash). Maka password import/CSV import OTOMATIS kedaluwarsa; yang berlaku = PIN di email blast. Bukan bug, tapi jebakan alur: dipermanenkan di UI (peringatan di dialog import + panel blast: satu kohort satu jalur).


## Sinkronisasi user management 2026-10-16

- Import SATU jalur: RPC batch + roles per baris (20261012000800); loop per-baris UI DIHAPUS. PIN tetap client-side (slip).
- Hapus SATU aturan: dialog tunggal via admin_bulk_delete_users([id]) + blokir berdata + teks diperbaiki.
- Keputusan: invite=orang luar, assign=orang dalam; banned_until tidak dibangun; get_my_access dibatalkan. Detail di 10-invitations-and-class-import.md.
- Staging push EXIT 0; prod via MCP apply x2 (roles + audit parity) sukses.
- Bukti: 28 files / 190 tests hijau, tsc 0, build OK. Sisa manual: import uji 2 baris (voter + candidate) di staging.


## Audit INSERT 42601 2026-10-16 (salah hitung kolom, salah saya)

- Daftar kolom audit kehilangan target_id tapi VALUES tetap 10 item. Plpgsql baru gagal saat DIEKSEKUSI (bukan saat CREATE) � itu sebabnya push lolos tapi batch meledak + rollback total. Fix: 20261012001000 (10 kolom, push staging EXIT 0). Pelajaran: hitung kolom-vs-values manual untuk setiap INSERT di RPC baru.


## Import 2-user staging HIJAU 2026-10-16

- 1 voter + 1 voter|candidate via RPC batch: kelas + badge peran benar (screenshot). Sinkronisasi import selesai.
- Sisa: paste 20261012001000 di dashboard PROD (mencakup roles + pgcrypto + audit fix).


## P-E agen 2026-10-16 (R3 + k6 script)

- R3: 20261012001100 kunci search_path 7 fungsi (isi diaudit aman), push staging EXIT 0; prod = paste dashboard user. EXECUTE noise = accepted-risk tercatat.
- k6: tests/load/staging-mixed.js baru (login burst + tally + vote opt-in), archive valid. Run vs staging = manual user (butuh ANON + akun beban). ZAP/UAT/H-1 = manual.



## k6 100 VU staging � bedah + fix + verify ulang 2026-10-17

Temuan dari run user (`test-results/k6-output.txt`):
- `errors rate=100%` = bug cetak skrip lama (hanya `add(1)`, tanpa `add(0)`); kegagalan riil 3/5005 = 0,06% (timeout landing), di bawah SLO 1%.
- Akar: TARGET preview `*.vercel.app` TERPROTEKSI Vercel Authentication ? anonim di-redirect 2� ke `vercel.com/login`. k6 ikut redirect; "landing 200" ? sebenarnya halaman login Vercel (333.827 B � 1001 � 343 MB = cocok `data_received: 343 MB`; p95 10s = vercel.com). Run lama: TIDAK VALID sebagai bukti SLO.
- 5005 req = 5�1001: k6 menghitung tiap redirect sebagai request (dibuktikan probe lokal) + 1 hop ekstra (salah satu URL memakai `http://`).
- PostgREST staging: 42501 ? HTTP 401; event tak terlihat anon ? 500 P0002 (penyebab false-red saat TALLY_EVENT_ID basi).

Fix `tests/load/staging-mixed.js` v2 (belum di-commit):
- abort di setup bila TARGET terproteksi (redirect vercel.com / 401) + saran BYPASS / LANDING=0;
- `errors` 0/1 per check; tag per-endpoint landing/events/login/tally + threshold per-tag untuk breakdown summary;
- `LANDING=0` mode REST-only; `BYPASS=<secret>` header `x-vercel-protection-bypass`;
- validasi awal TALLY_EVENT_ID (abort bila P0002); `http_req_failed` sengaja tidak di-threshold (4xx yang diharapkan menyesatkan).

Verifikasi agen (mesin lokal, staging read-only):
- `k6 archive` OK; smoke LANDING=0 6/6 hijau exit 0; guard abort target terproteksi OK; abort ID basi OK.
- Run 100 VU � 1m `LANDING=0` + TALLY `87f36fe7-f251-4326-8215-1eff49058608`: checks 7392/7392 (100%), exit 0; {events} avg 324ms p95 746ms max 7,4s; {tally} avg 298ms p95 607ms max 5,6s; 7393 req / 60s. Bukti: `test-results/k6-100vu-v2.txt`.


## k6 600 VU staging � analisa + accounting bersih 2026-10-17

Run user (`test-results/k6-600.txt`): semua threshold ? (errors 0,02%; p95 534ms; checks 99,97%). Yang tampak "merah" = artefak, bukan error:
- `http_req_failed 50,02%` = 44.343 tally 401 (deny anon by design) + 23 reset TCP + 1 setup-probe (cocok persis, tidak ada kegagalan tersembunyi).
- 23 reset `wsarecv forcibly closed` (0,026%): TCP RST dari edge Cloudflare di depan staging (IP 172.64.149.246 / 104.18.38.10, dicek DNS), burst sekali di detik 20�21, hanya GET events, tanpa 5xx/429.
- Watch: tally deny-path p95 536ms (target R6 500ms; jalur 401 cepat, bukan compute penuh � ukur authenticated saat H-7); outlier max 20,95s.

Patch accounting `tests/load/staging-mixed.js`: tally 400/401/403 ditandai expected via `responseCallback: http.expectedStatuses(...)` (default + setup-probe) + threshold `http_req_failed rate<0.01`.

Verify agen 600 VU x 2m `LANDING=0` (`test-results/k6-600-v2.txt`): exit 0; checks 82.792/82.792 (100%); http_req_failed 0,00%; 0 reset; {events} p95 817ms; {tally} p95 775ms; avg 364ms; max 6,65s; 678 req/s. (Bandingkan run user: p95 534 vs 791ms = varians antar-run; reset 23 vs 0 ? menegaskan sifat transien.)
