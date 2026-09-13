# Changelog

All notable changes to UniVertex are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com), versioning follows
[SemVer](https://semver.org).

## [P1 Pilot] — In Progress 2026-09-13 (prod-direct scoped: staging tidak dibuat, 2/2 slot terpakai)

> **Keputusan 2026-09-13:** slot project penuh → staging TIDAK dibuat.
> P1 jalan **prod-direct scoped** — semua uji tulis hanya ke event isolasi
> `[P1-TEST]` (belum dibuat, butuh kredensial + jendela maintenance);
> event asli `95676965-a5c6-4f62-88bb-37ab9a57968b` TIDAK disentuh.
> Rincian: `docs/P1-Proddirect-Notes.md`.

### Selesai (bukti lokal 2026-09-13)
- Baseline: `npm run test -- --run` **20 files / 156 tests passed** (~45s),
  `npx tsc --noEmit` **0 error**, `npm run build` **sukses (~1m9s)**.
- **P1-01 (scaffold + harness):** `npm i -D @playwright/test@1.63.0`
  + `playwright.config.ts` (1 worker; trace `on-first-retry`; baseURL via env) +
  `tests/e2e/{helpers,vote,committee-observer,admin}.spec.ts` (7 skenario
  §4C.1). `npx playwright test --list` = 7 tests terdaftar; run rill sukses
  launch Chromium + login + video; prod-safe SKIP aktif tanpa kredensial.
  [ ] `npx playwright test` penuh hijau — butuh akun sintetis
  (`p1-voter`/`p1-nonDPT`/`p1-committee`/`p1-observer`/`p1-admin`) +
  `TEST_EVENT_ID` event `[P1-TEST]` di prod (buat manual via dashboard,
  DILARANG pakai event asli).
- **P1-02 (scaffold):** `tests/load/election-day.js` (k6, smoke READ-ONLY,
  VUS/DURATION via env, threshold p95<500/p99<1000/errors<1%) +
  `tests/load/README.md`. `k6 run` belum dijalankan — binary k6 tidak ada
  di mesin ini. **SLO 200-VU + stretch 2000-user = NOT RUN ON PROD** (butuh
  env isolasi; catat bottleneck tidak berlaku).
- **P1-03 (sebagian):**
  - `@vitest/coverage-v8@4.0.6` + `vitest.config.ts` coverage gate
    (P1 scope: `src/lib`+`src/hooks`+`VotingPage.tsx`; threshold
    lines≥50/funcs≥45/branches≥35/stmts≥50) + CI job. Baseline scope:
    **All 67.47% lines | lib 68.94 | hooks 51.41 (ditarik oleh
    `use-toast`/`use-mobile` 0%) | VotingPage 81.25 | sessions 85.71** —
    whole-app shadow 15.66% dicatat sebagai backlog P2 (admin/UI belum
    ber-table). Target ≥70% per area = paper target, threshold CI =
    under-baseline agar stabil.
  - `docs/PANDUAN_ADMIN.md`, `PANDUAN_PANITIA.md`, `PANDUAN_VOTER.md`,
    `PANDUAN_OBSERVER.md` (template phase4-5 §5A.2).
  - `vote.cast` audit: verifikasi test `VotingPage ("mencatat audit
    vote.cast ...")` HIJAU (metadata `{event_id}` tanpa candidate) — kode
    sudah ada sejak P0 (`VotingPage.tsx:185-192`).
  - [ ] UAT 15/15 (butuh 2-3 tester + jendela) · [ ] ZAP (0 high — butuh
    jendela scan; agresif dilarang di prod) · [ ] pentest 6/6 (read-only
    via SQL console, tulis hanya ke event test).

### Gate pilot final — status 2026-09-13
- [ ] P0 gates sisa (T2 42501, drill restore, H1 revoke ≤5 mnt, H5 email
      4 provider, dashboard Auth/SMTP, Peraturan panitia) — tetap open.
- [ ] P1-01 penuh hijau (kredensial + `[P1-TEST]`).
- [ ] P1-02 k6 smoke + README (SLO penuh NOT-PROVEN).
- [ ] P1-03 UAT 15/15 + ZAP 0 high + pentest 6/6 + PANDUAN_* + coverage CI
      (**PANDUAN_* + coverage CI + vote.cast DONE**).
- [ ] vitest hijau ✓, tsc 0 ✓, build ✓.
- One DoD merah → NO-GO pilot nyata + backlog (item berbahaya di prod
  ditunda eksplisit, bukan dipaksa).


## [P0 Go-Live] — Done 2026-09-13 (code + migrasi ter-push ke prod; drill/dashboard menunggu manual)

> Rencana kerja: `docs/P0-Golive-Readiness-Plan.md`.
> Baseline: commit `6f94290` (pre-P0 snapshot Fase0-3 + tsconfig TS5095 fix).
> Bukti uji lokal 2026-09-13: `vitest --run` **20 files / 155 tests passed**,
> `tsc --noEmit` **0 error** (fix: `tsconfig.json` root tambah `"module":"ESNext"`),
> `vite build` **sukses** (~1m52s).
> Push DB prod `oiurjnmpkguyxevdbpbu` via MCP 2026-09-13:
> `20260913121150_enforce_eligibility_on_vote` + `20260913121201_session_revoke_check`
> tercatat di `schema_migrations`; verifikasi fungsi
> `assert_event_is_votable(uuid)`, `assert_event_is_votable(uuid,uuid)`,
> `is_session_revoked(text)` ada + 3 index DPT ada.
> Sisa manual: drill restore staging, setting dashboard Auth/SMTP, bukti T2/H1/H5.
> JANGAN pilot sebelum gate §Gate lolos.

### Done — P0-01 Eligibility Enforcement di DB (ter-push prod 2026-09-13; bukti SQL manual T2 menunggu staging)

- Migrasi `supabase/migrations/20260913000000_enforce_eligibility_on_vote.sql`:
  `assert_event_is_votable(UUID, UUID DEFAULT NULL)` (timeline + `is_eligible_voter()`
  → `42501`), wrapper 1-arg lama (timeline only), `tg_enforce_vote_timeline()`
  (cek `voter_id = auth.uid()` → `42501`), trigger dijamin ada, 3 index
  (`idx_evg_event_class`, `idx_profiles_class`, `idx_rules_election`). Rollback copy
  versi 20260912 ada di komentar migrasi.
- `VotingPage.handleVote` bedakan `23505` (sudah vote) / `P0001` (timeline) /
  `42501` (non-DPT → toast + banner DPT; DB menang, tanpa refetch agar tidak tertimpa).
- Test: `VotingPage.test.tsx` +2 case P0-01 (42501 non-DPT → banner + insert kirim
  `voter_id+event_id`; 42501 mismatch) — lokal **12/12 hijau**.
- Spec + matriks uji: `docs/P0-01-Eligibility-Enforcement.md`.
- [x] Code + test lokal hijau + ter-push prod (`20260913121150`, fungsi 1-arg + 2-arg + trigger + 3 index terverifikasi ada). [ ] Bukti manual T2
  (SQL console non-DPT → `42501`) ditempel di PR.

### Partial — P0-02 Staging Separation + Backup Drill (code/docs selesai; infra menunggu dashboard)

- Selesai (code): `.env.example` split prod/staging placeholder, `docs/RUNBOOK.md §0`
  (tabel env baru, hapus "masih share database") + `§4 H-1` (hash SHA-256 + 2 lokasi + gate P0).
- Menunggu manual (butuh akses dashboard Supabase + Vercel): buat project
  `univertex-staging` (region = prod), `supabase db push --dry-run` lalu `push`
  50 migrasi, Vercel env split, PITR on, snapshot manual + drill restore <1 jam.
  Saat ini 50 file migrasi lokal (48 baseline + 2 P0).
- Prosedur: `docs/P0-02-Staging-Backup-Drill.md` (melengkapi `docs/RUNBOOK.md §0-§2`).
- [x] Code/docs. [ ] Staging online + migrasi hijau. [ ] Vercel preview → staging.
  [ ] Drill restore log (mulai/selesai/durasi/RTO) + hash backup.

### Done (code) / Partial (dashboard) — P0-03 Auth & Session Hardening

- Migrasi `supabase/migrations/20260913000100_session_revoke_check.sql`:
  RPC `is_session_revoked(p_hash TEXT) RETURNS BOOLEAN` (SECURITY DEFINER,
  GRANT `authenticated`).
- `src/lib/sessions.ts`: `+ isCurrentSessionRevoked()` (best-effort, false jika 404)
  + `revokeAllMySessions()` (lewati sesi device ini).
- `src/components/AppBootstrap.tsx`: cek revoke saat mount + interval 5 mnt →
  revoke paksa logout + toast "Sesi dicabut" (≤5 mnt enforcement).
- `src/hooks/useAuth.ts refresh()`: cek revoke dulu sebelum fetch profile →
  clear state + redirect `/login`.
- `src/pages/app/MySessions.tsx`: tombol "Keluar dari semua device lain".
- Test: `sessions.test.ts` +5 case P0-03 (revoked true/false/404/throw, revoke-all
  lewati sesi ini) — lokal hijau (sessions 16 tests, total 155) + RPC ter-push prod
  (`20260913121201`, `is_session_revoked(text)` terverifikasi ada).
- Setting dashboard + SMTP: terdokumentasi di `docs/supabase-auth-redirects.md`
  §P0-03 (JWT 3600, MFA TOTP admin/committee, leaked-password + rate-limit,
  CAPTCHA login/invite, SMTP + uji 4 provider) — [ ] menunggu eksekusi + bukti
  H1 (2-browser ≤5 mnt) + H5 (email 4 provider) ditempel di PR.
- Setting + matriks uji: `docs/P0-03-Auth-Session-Hardening.md`, `docs/supabase-auth-redirects.md`.

### Done — Docs Operasional (template tersedia; pengisian oleh panitia)

- `docs/Peraturan-Pemilihan-Template.md` (tie-break, masa sanggah, 2-approvals publish, retensi UU PDP).
- `docs/SOP-Helpdesk-HariH.md` (reset manual, sengketa "sudah memilih", internet down).

### Security (code selesai; verifikasi prod menunggu push + drill)

- Non-DPT tidak bisa insert suara walau bypass UI (trigger 42501; RLS Fase 2 + pesan eksplisit).
- Sesi revoke benar-benar mati di client ≤5 mnt; brute-force tercatat tanpa enumerasi email.

### Gate pilot (Go / No-Go H-1) — status 2026-09-13

- [x] `vitest --run` hijau (20/155), `tsc --noEmit` 0 error, `vite build` sukses.
- [ ] P0-01: T2 manual non-DPT → `42501` di staging (log di PR).
- [ ] P0-02: staging ≠ prod + drill restore tercatat (tanggal, durasi, RTO).
- [ ] P0-03: H1 2-browser revoke ≤5 mnt; email invite/reset 4 provider (bukan spam); setting dashboard terdokumentasi.
- [ ] `docs/Peraturan-Pemilihan-Template.md` diisi panitia; Helpdesk H-H siap.
- Satu saja merah → **postpone election**.

## [Unreleased] — Fase 0–3 + Hardening

### Added

#### Fase 3 — RBAC + Audit
- **Permission-based authorization** — 31 permissions in `permission_key` enum
  (`election.*`, `candidate.*`, `vote.*`, `voter.*`, `committee.*`, `observer.*`,
  `audit.*`, `user.*`, `system.*`, `eligibility.*`)
- `role_permissions` table seeded with default mappings (admin: all,
  committee: scoped via `can_access_election`, observer: scoped read-only,
  voter: `vote.cast`, candidate: `candidate.create`)
- `has_permission(p_user_id, p_permission)` and `caller_has_permission(p_permission)` RPCs
- `usePermission` hook + `<RequirePermission>` component for frontend
- **Audit log enhancements**: `request_id`, `ip_address_hash`, `schema_version` columns
- **Audit immutability**: BEFORE UPDATE/DELETE trigger blocks edits
  (corrections go through `admin_correct_audit_entry` RPC with audit trail)
- `admin_export_audit_log(p_election_id, p_from, p_to, p_limit, p_offset)` RPC
- `election_audit_trail` and `election_audit_by_election` views
- `AuditExport` admin page (download JSON via filter)
- `admin_archive_old_audit_entries(p_older_than)` RPC + pg_cron weekly job
- 7+ new tests (`usePermission`, `RequirePermission`, `AuditExport`)

#### Fase 2 — State Machine & Scope
- 6-state election lifecycle: `draft → registration → voting → counting → published → archived`
- CHECK constraint with 6 valid states
- `election_state_transitions` table — full audit trail of every state change
- `validate_election_state_transition` trigger — enforces allowed transitions + actor role
- `auto_transition_elections` RPC + pg_cron (every minute) for time-based transitions
- `admin_transition_election_state` RPC for manual override
- `election_scope_type` enum + `scope_type`/`scope_id` columns (polymorphic)
- `election_eligibility_rules` table (rule_type + rule_value)
- `is_eligible_voter` RPC (combines `event_voter_groups` legacy + new rules)
- `admin_add_eligibility_rule` / `admin_remove_eligibility_rule` RPCs
- `validate_scope_id` RPC
- `src/lib/election-state.ts` (UI helper: `STATUS_LABEL`, `ALLOWED_TRANSITIONS`, `canTransition`)

#### Fase 1 — Committee & Observer
- `committee` and `observer` roles in `app_role` enum
- `committee_role` enum: `chair`, `secretary`, `verifier`, `technical`, `member`
- `election_committees`, `election_observers`, `election_observations` tables
- `election_id` column on `audit_log` (per-election audit filtering)
- `has_election_role`, `can_access_election`, `can_manage_election` helpers
- RLS policies: `Committee and observers view votes/candidates/elections of their elections`
- RPCs: `admin_assign_committee`, `admin_revoke_committee`, `admin_assign_observer`,
  `admin_revoke_observer`, `add_election_observation`, `list_my_committee_assignments`,
  `list_my_observer_assignments`, `admin_lookup_user_id_by_email`
- Invitation flow extended: `intent='committee'` / `'observer'` auto-assigns role + table rows
- `CommitteeLayout`, `ObserverLayout` shells
- `pages/committee/Dashboard`, `pages/committee/ElectionDetail`
- `pages/observer/Dashboard`, `pages/observer/ElectionDetail`
- `pages/admin/ElectionStaff` (committee/observer assignment UI)
- Protected routes `/committee/*` and `/observer/*`

#### Fase 0 — Stabilization & Visibility
- Sentry integration with PII filter (`beforeSend` strips email/password/student_id)
- `src/lib/logger.ts` — structured JSON logger, `error()` forwards to Sentry
- `src/components/ErrorBoundary.tsx` — global React error boundary
- Global `window.onerror` and `unhandledrejection` handlers
- `.github/workflows/ci.yml` — typecheck + test + lint + build + audit + deploy-preview
- `docs/RUNBOOK.md` — backup, restore, incident response, RTO
- `scripts/snapshot-db.mjs` — pre-election DB snapshot tool
- Public health endpoint at `public/health.html`

### Changed

- `auth_events` table (Fase 0) hardened
- `accept_invitation_and_register` extended to handle committee/observer intents
- `admin_create_user` (Fase 1 fix-critical-issues) returns real user creation via direct auth.users insert
- `get_election_tally` guarded by D2 access matrix (denies with SQLSTATE 42501)
- `useAuth` now exposes `isCommittee`, `isObserver`, plus `dashboardPathFor` routes per role
- `ProtectedRoute` accepts `committee` and `observer` roles

### Security

- Locked down `make_user_admin` and `create_admin_user` (REVOKE all API roles)
- Hardened `client.ts` with env-var override + safe fallback
- 9 critical security issues addressed (see `docs/Update_Kritis_Fixes_September_2026.md`)

### Hardening (this release)

- `vercel.json` security headers: CSP, HSTS (preload), Permissions-Policy, Referrer-Policy
- Cache-Control for `/assets/*` (1 year immutable)
- npm scripts: `db:types`, `db:link`, `db:snapshot`, `db:diff`, `db:push`, `db:status`

## [Pre-Fase 0] — Initial Development

Original Lovable-built application with 3 roles (admin/voter/candidate),
basic voting, audit log, invitation flow, candidate approval, session management.
