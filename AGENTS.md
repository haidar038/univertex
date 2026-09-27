# AGENTS.md — UniVertex (E-Voting Universitas, Ready-for-Production)

> Entry-point agen + developer. Sumber kebenaran teknis tetap: `docs/P0-Golive-Readiness-Plan.md`, `CHANGELOG.md`, `docs/RUNBOOK.md`. Dokumen ini mengatur **cara kerja**, bukan mengulang spec.

## 1. Konteks proyek

* App: E-Voting universitas (BEM/Himpunan). SPA `Vite 5 + React 19 + TS 5.8 + shadcn-ui + Tailwind + TanStack Query 5`, backend `Supabase (Postgres + Auth + Storage + Realtime)`, deploy `Vercel`.
* Roles aktual 5: `admin / voter / candidate / committee / observer` (`app_role` enum, tabel `user_roles`, 31 `permission_key` Fase-3). Jangan pakai model lama 3-role di docs konsep.
* Lifecycle 6-state: `draft → registration → voting → counting → published → archived`. Transisi **hanya via RPC state-machine** (`admin_transition_election_state`), bukan update `status` langsung. Helper UI: `src/lib/election-state.ts`.
* Invite-only: `src/pages/Signup.tsx` info-only, tidak ada signup publik. Akun via `admin_create_user` / `accept_invitation_and_register` / `redeem_invitation`.
* Prod aktual: `https://oiurjnmpkguyxevdbpbu.supabase.co` (prod=dev, slot penuh 2/2 → staging TIDAK dibuat, P1 jalan prod-direct scoped). Region `ap-southeast-1`.
* Baseline 2026-09-13/14: 50 migrasi lokal, `vitest` 20 files / 155–156 tests hijau, `tsc --noEmit` 0 error, `vite build` sukses. E2E 7 skenario scaffold, k6 smoke read-only, UAT/ZAP/pentest/k6-penuh/UAT/SMTP/MFA menunggu jendela manual.

## 2. Peta dokumen (baca sesuai kebutuhan)

| Butuh | Baca |
|---|---|
| Gate go-live, DoD | `docs/P0-Golive-Readiness-Plan.md` |
| Spec P0 | `docs/P0-01-Eligibility-Enforcement.md`, `docs/P0-02-Staging-Backup-Drill.md`, `docs/P0-03-Auth-Session-Hardening.md` |
| Eksekusi manual P1 prod-direct | `docs/P1-Manual-Testing-Runbook.md` (Fase 0–5), `docs/P1-Proddirect-Notes.md` |
| Operasional | `docs/RUNBOOK.md` (§0 env, §1 backup, §2 restore, §4 H-1, §5 H+1), `docs/SOP-Helpdesk-HariH.md`, `docs/Peraturan-Pemilihan-Template.md` |
| Auth redirect/SMTP/MFA/CAPTCHA | `docs/supabase-auth-redirects.md` |
| Testing | `docs/Test_Strategy_Verifikasi.md` (§4 manual-only wajib), `playwright.config.ts`, `tests/e2e/`, `tests/load/` |
| Histori (jangan jadikan acuan implementasi) | `docs/Update_September_2026.md`, `docs/Update_Kritis_Fixes_September_2026.md`, `docs/Codebase_Review_UniVertex.md`, `docs/ai-response.md`, `docs/gpt-response.md`, `docs/Aplikasi E-Voting UniVertex.md`, `docs/Konsep_Proyek_UniVertex.md`, `docs/Prompt_Teknis_Univertex.md`, `docs/last-work-codex.md` |
| Bisnis/non-teknis | `docs/schema/Skema-Pembiayaan-Project.md` (annex, bukan gate produksi) |
| Arsip debug (jangan commit baru) | `docs/logs/`, `issues.log`, `test-sql.cjs` |

## 3. Perintah baku

```powershell
npm run dev                 # dev lokal (port 8080)
npm run test -- --run       # vitest full
npx vitest --run <file>     # satu file
npx tsc --noEmit            # wajib 0 error
npm run build               # vite build (~1-2 mnt, 3513 modules)
npm run test:e2e            # playwright (butuh dev server + env, lihat §8)
npx playwright test --list  # daftar 7 skenario tanpa run
node scripts/snapshot-db.mjs --project=oiurjnmpkguyxevdbpbu --tag=p1-pre
```

CI (`.github/workflows/ci.yml`): typecheck + test + lint + build + audit + deploy-preview. Coverage gate scope P1 di `vitest.config.ts:22-41` (lib+hooks+VotingPage, lines≥50). Whole-app 15.66% adalah backlog P2, bukan target gate.

## 4. Database / Supabase (aturan keras)

* DDL hanya via migrasi `supabase/migrations/YYYYMMDDHHMMSS_snake_case.sql`, 1 file = 1 tujuan. Baca via `execute_sql` read-only, tulis DDL via `apply_migration`. Jangan edit migrasi yang sudah ter-push ke prod.
* Sebelum `db push`: `supabase migration list` + cek `--project-ref`. Jangan tertukar prod/staging. Prod ref: `oiurjnmpkguyxevdbpbu`.
* **DILARANG** ubah skema `votes` (`voter_id`, `candidate_id/pair_id`, constraint `votes_voter_event_unique`, trigger `trg_enforce_vote_timeline`). Out-of-scope tetap: redesign secrecy `ballots` (P2), hierarchy organisasi (P2).
* Invariant: `UNIQUE(voter_id, event_id)` + trigger `assert_event_is_votable(event, voter)` cek `status='voting'` + window + `is_eligible_voter()` + `voter_id=auth.uid()`. Error: `23505` sudah-vote, `P0001` timeline, `42501` non-DPT/unauthorized. Frontend wajib bedakan ketiganya (contoh `src/pages/app/VotingPage.tsx`).
* `audit_log` immutable (blok UPDATE/DELETE, koreksi via `admin_correct_audit_entry`). `vote.cast` metadata hanya `{event_id}`, tanpa candidate (anonimitas).
* RPC yang sudah ada jangan diduplikasi: `get_election_tally`, `is_eligible_voter`, `accept_invitation_and_register`, `redeem_invitation`, `admin_create_user`, `revoke_user_session_by_hash`, `is_session_revoked`, `log_audit_event`, `log_failed_login`.
* Jangan commit secret (anon key, SMTP pass, service_role). Bukti cukup ref + hash SHA-256, bukan isi dump. Snapshot simpan 2 lokasi, gzip.

## 5. Auth / RBAC

* Client hanya anon key: `src/integrations/supabase/client.ts:7-25` (`detectSessionInUrl: true`, jangan matikan).
* Guard frontend: `src/components/ProtectedRoute.tsx`, `src/hooks/useAuth.ts` (`isAdmin/isVoter/isCandidate/isCommittee/isObserver`, `dashboardPathFor`), `usePermission` + `<RequirePermission>` untuk 31 permissions.
* Session: `src/lib/sessions.ts` (`isCurrentSessionRevoked`, `revokeAllMySessions`), `src/components/AppBootstrap.tsx` cek revoke saat mount + interval 5 mnt → paksa logout + toast. `refresh()` cek revoke dulu.
* Setting dashboard (manual, catat tanggal+pelaku di `docs/supabase-auth-redirects.md`): JWT expiry 3600, MFA TOTP wajib `admin/committee`, leaked-password + rate-limit ON, CAPTCHA hanya `/login` + `/invite/:token`, SMTP produksi + uji 4 provider (Gmail/Yahoo/Outlook/kampus).

## 6. Konvensi frontend

* Ikuti lib yang sudah ada (`package.json`); dilarang tambah framework tanpa persetujuan.
* Error handling: pakai `error.code`, jangan string-match pesan Postgres. Audit/log helper tidak boleh break flow utama (resolve `undefined` + `console.warn`).
* `safePercent(votes,total)` untuk hasil (anti NaN). Query tally via `get_election_tally` (1 RPC), bukan N+1 per kandidat.
* Status event via `src/lib/election-state.ts` (`STATUS_LABEL`, `ALLOWED_TRANSITIONS`), bukan string literal `active/closed` lama.
* Jangan tambah `console.log` produksi; pakai `src/lib/logger.ts` (forward Sentry, filter PII email/password/NIM).
* `ErrorBoundary` sudah di root `src/App.tsx:71`; jangan lepas.

## 7. Testing (jujur, bukan klaim hijau)

* Vitest: setiap edit → test file terkait → full suite → tsc → build bila sentuh UI. Jangan klaim hijau tanpa output.
* Playwright prod-safe: tanpa `TEST_EVENT_ID` + kredensial `p1-*`, spec tulis SKIP (`tests/e2e/helpers.ts`). Tulis hanya ke event `[P1-TEST]`, dilarang sentuh event asli `95676965-a5c6-4f62-88bb-37ab9a57968b`. Runbook: `docs/P1-Manual-Testing-Runbook.md` Fase 0–5.
* k6: hanya smoke read-only di prod (`tests/load/election-day.js`); 200-VU/2000-stretch NOT RUN ON PROD tanpa env isolasi.
* ZAP agresif + brute-force sungguhan DILARANG di prod.
* Yang tidak dicover mock (§4 `docs/Test_Strategy_Verifikasi.md`): RLS, trigger timeline, migrasi, email link asli, multi-device nyata, pair end-to-end → wajib manual/E2E.
* Cleanup P1: hapus votes → observations → transitions/committees/observers → candidates+DPT → event → users `p1-*` → kelas test; verifikasi residu 0; `audit_log` dipertahankan (append-only).

## 8. Env / deploy

* `.env.example` mapping: `production` → URL+anon PROD; `preview`/branch `staging` → STAGING. Vercel headers+CSP sudah di `vercel.json`.
* Redirect URLs: Site URL = origin prod; tambah `https://<prod>/**`, `http://localhost:5173/**`, preview bila dipakai. Reset selalu ke `/reset-password`, bukan landing.
* GitHub Secrets CI: `VERCEL_*`, `STAGING_SUPABASE_*`, `SENTRY_*`.

## 9. Gate pilot (Go / No-Go H-1)

Satu merah → postpone, jangan paksa. Checklist: `docs/P0-Golive-Readiness-Plan.md:31-39` + `docs/RUNBOOK.md:204-216`.
P0: T2 42501, drill restore <1 jam + RTO, H1 revoke ≤5 mnt, H5 email 4 provider, dashboard Auth/SMTP terdokumentasi, Peraturan diisi panitia, helpdesk siap. P1: E2E 7/7, k6 smoke, UAT 15/15, ZAP 0 high, pentest 6/6, coverage CI, 4 PANDUAN_*, `vote.cast` audit. Plus vitest/tsc/build hijau.

## 10. Alur kerja agen

1. Baseline 30 mnt: `git pull --ff-only`, `status --short --branch`, `log --oneline -5`; stash/commit selektif (jangan commit `test-sql.cjs`, `issues.log`, `issues/`, `.kilo/`, `docs/logs/`, `backups/`).
2. Kerjakan P0-01 → P0-02 → P0-03 → P1-01 → P1-02 → P1-03. Satu DoD merah → lapor NO-GO + backlog.
3. Update `CHANGELOG.md` (`[P1 Pilot]` + bukti: trace E2E, ringkasan k6, ZAP, UAT sign-off, hash backup) + gate di `docs/P0-Golive-Readiness-Plan.md` bila lolos.
4. Jangan ubah scope ke P2 tanpa persetujuan user.
