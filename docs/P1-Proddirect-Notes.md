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

BLOCKED (butuh manusia/akses, DILARANG dipaksa):
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
