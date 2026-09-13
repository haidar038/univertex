# Changelog

All notable changes to UniVertex are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com), versioning follows
[SemVer](https://semver.org).

## [P0 Go-Live] — Planned (belum dikerjakan, target pilot pertama)

> Rencana kerja: `docs/P0-Golive-Readiness-Plan.md`. Jangan centang sebelum DoD tiap P0 terpenuhi + bukti terlampir di PR.

### Planned — P0-01 Eligibility Enforcement di DB

- `assert_event_is_votable(event, voter)` + `tg_enforce_vote_timeline` validasi `is_eligible_voter()` — non-DPT ditolak `42501` di level DB.
- Index `event_voter_groups(event_id, class_id)`, `profiles(class_id)`.
- `VotingPage` bedakan pesan `23505` (sudah vote) / `P0001` (timeline) / `42501` (non-DPT).
- Spec + matriks uji: `docs/P0-01-Eligibility-Enforcement.md`.

### Planned — P0-02 Staging Separation + Backup Drill

- Project `univertex-staging` terpisah, Vercel env split (production vs preview/staging).
- PITR aktif + snapshot manual + drill restore <1 jam terdokumentasi.
- Prosedur: `docs/P0-02-Staging-Backup-Drill.md` (melengkapi `docs/RUNBOOK.md §0-§2`).

### Planned — P0-03 Auth & Session Hardening

- RPC `is_session_revoked(hash)` + `AppBootstrap`/`useAuth` paksa logout ≤5 mnt setelah revoke.
- MFA wajib `admin/committee`, JWT expiry 1 jam, CAPTCHA login/invite, SMTP produksi.
- Setting + matriks uji: `docs/P0-03-Auth-Session-Hardening.md`, `docs/supabase-auth-redirects.md`.

### Planned — Docs Operasional

- `docs/Peraturan-Pemilihan-Template.md` (tie-break, masa sanggah, 2-approvals publish, retensi UU PDP).
- `docs/SOP-Helpdesk-HariH.md` (reset manual, sengketa "sudah memilih", internet down).

### Security (setelah P0 selesai)

- Non-DPT tidak bisa insert suara walau bypass UI.
- Sesi revoke benar-benar mati di client; brute-force tercatat tanpa enumerasi email.

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
