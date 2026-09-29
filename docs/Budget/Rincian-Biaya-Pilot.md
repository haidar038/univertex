# Rincian Biaya Pilot Institusional — UniVertex

> **ANNEX BISNIS — bukan gate produksi.** Acuan teknis tetap `AGENTS.md` + `docs/P0-Golive-Readiness-Plan.md`.
> Sumber model: `docs/schema/Skema-Pembiayaan-Project.md` (§1-§18).
> File ini adalah breakdown operasional dari skema tersebut dengan referensi arsitektur/codebase aktual.
> Status: `DRAFT untuk penawaran pilot pertama — angka Rp adalah framework range, bukan harga final`.
> Template angka: `docs/Budget/budget-pilot-template.csv` (31 item A–G + total) + `docs/Budget/payment-schedule-template.csv` (50/50 dan 40/30/30).
> Cara pakai: isi kolom `harga_dipilih_rp` per baris di CSV, jumlahkan `subtotal_dipilih_rp` untuk Project Fee final.

## 0. Ringkasan

Model: **One-Time Implementation + Event License + Operational Support + Infrastructure (client-paid)**.

Bukan: SaaS bulanan mahasiswa, fee per-voter, revenue sharing, jual source sekaligus — lihat `Skema §1, §2, §13`.

```text
UNIVERTEX Institutional Pilot — [Nama Universitas / Event]
─────────────────────────────────────────────
A. Production Readiness      Rp 5–10 jt  (one-time)
B. Event Deployment          Rp 3–7 jt   (per-event)
C. Event Operations          Rp 3–8 jt   (per-event)
                             ──────────
Project Fee                  Rp 11–25 jt

D. Infrastructure            client-paid, akun universitas (~$45/bln base + domain/SMTP)
E. Maintenance               opsional recurring (terpisah)
F. Annual License            opsional pasca-pilot (terpisah)
G. Source Buyout             terpisah, hanya jika diminta (terpisah)
```

Yang dibeli universitas bukan `React + Supabase`, tapi **sistem pemilihan siap pakai + konfigurasi sesuai event + penanggung jawab saat event** — `Skema §2`: bisa login, 1 voter 1 suara, hasil valid, ada runbook + kontak darurat, rekap hasil.

Hubungan kontraktual: `Haidar / Binary Verse ↔ universitas / panitia event` — bukan mahasiswa initiator. Initiator tetap sebagai pengenal/product partner, bukan pembayar — `Skema §4`.

## 1. Basis arsitektur (kenapa biaya ini muncul)

### 1.1 Frontend — SPA institutional

* Stack: `Vite 5 + React 19 + TS 5.8 + shadcn-ui + Tailwind + TanStack Query 5` — `package.json:30-84`.
* Pages `src/pages/`: `admin/` 10 halaman (`Dashboard, Events, EventDetail, Users, Invitations, Classes, ElectionStaff, AuditLog, AuditExport, Sessions`), `committee/Dashboard,ElectionDetail`, `observer/Dashboard,ElectionDetail`, `app/Dashboard,VotingPage,ResultsPage,Profile,CandidateDashboard,CandidateSettings,MySessions`, auth `Login,AcceptInvite,Signup,ResetPassword`, publik `Index,PublicResultsPage,PrivacyPolicy,TermsOfService,NotFound`.
* Guard: `src/components/ProtectedRoute.tsx`, `src/hooks/useAuth.ts` (`isAdmin/isVoter/isCandidate/isCommittee/isObserver`, `dashboardPathFor`), `src/hooks/usePermission.ts` + `<RequirePermission>` untuk 31 `permission_key` Fase-3.
* Helper: `src/lib/election-state.ts` (`STATUS_LABEL`, `ALLOWED_TRANSITIONS`), `src/lib/sessions.ts`, `src/lib/logger.ts` (forward Sentry, filter PII), `src/lib/audit.ts`, `src/lib/candidate-helpers.ts`, `src/lib/candidate-pair-helpers.ts`, `src/lib/device.ts`.
* Root safety: `ErrorBoundary` di `src/App.tsx:71`, jangan dilepas.
* Build aktual: `~3513 modules, ~1-2 mnt`.

Implikasi biaya: testing UI per-role, training 4 panduan, UAT per-event tidak bisa dihindari karena surface luas.

### 1.2 Backend — Supabase Postgres + Auth + Storage + Realtime

* Prod aktual: `https://oiurjnmpkguyxevdbpbu.supabase.co`, region `ap-southeast-1`. Prod=dev, slot 2/2 penuh → staging tidak dibuat, P1 jalan prod-direct scoped — `CHANGELOG.md:7-13`, `docs/P1-Proddirect-Notes.md`.
* 50 file migrasi di `supabase/migrations/` (48 baseline + 2 P0). DDL hanya via migrasi `1 file = 1 tujuan`, jangan edit yang sudah push prod.
* Tabel inti: `profiles`, `user_roles` (`app_role`: `admin/voter/candidate/committee/observer`), `election_events` (6-state), `candidates/candidate_pairs`, `votes` (`UNIQUE(voter_id,event_id)`), `audit_log` immutable, `invitations`, `user_sessions`, `election_committees`, `election_observers`, `election_observations`, `election_state_transitions`, `election_eligibility_rules`, `event_voter_groups`.
* **DILARANG** ubah skema `votes` (`voter_id`, `candidate_id/pair_id`, constraint, trigger `trg_enforce_vote_timeline`).
* RPC existing (jangan diduplikasi): `get_election_tally`, `is_eligible_voter`, `assert_event_is_votable`, `accept_invitation_and_register`, `redeem_invitation`, `admin_create_user`, `admin_transition_election_state`, `is_session_revoked`, `revoke_user_session_by_hash`, `log_audit_event`, `log_failed_login`, `has_permission/caller_has_permission`, `admin_export_audit_log`, `admin_archive_old_audit_entries`, `admin_correct_audit_entry`.
* Invariant vote: `UNIQUE(voter_id,event_id)` + trigger cek `status='voting'` + window + `is_eligible_voter()` + `voter_id=auth.uid()`. Error: `23505` sudah-vote, `P0001` timeline, `42501` non-DPT/unauthorized. Frontend wajib bedakan ketiganya — contoh `src/pages/app/VotingPage.tsx`.
* `audit_log` append-only (blok UPDATE/DELETE, koreksi via `admin_correct_audit_entry`). `vote.cast` metadata hanya `{event_id}` tanpa candidate.
* Lifecycle hanya via RPC state-machine, bukan update `status` langsung.

Implikasi biaya: review RLS + trigger + RPC adalah item Production Readiness yang paling mahal secara risiko, bukan sekadar `hosting`.

### 1.3 Auth / session hardening (P0-03)

* Client hanya anon key: `src/integrations/supabase/client.ts:7-25` (`detectSessionInUrl:true`).
* Revoke enforcement: `src/lib/sessions.ts` (`isCurrentSessionRevoked`, `revokeAllMySessions`), `src/components/AppBootstrap.tsx` cek mount + interval 5 mnt → paksa logout + toast, `refresh()` cek revoke dulu, `src/pages/app/MySessions.tsx` tombol keluar device lain.
* Dashboard manual (catat tanggal+pelaku di `docs/supabase-auth-redirects.md`): JWT expiry 3600, MFA TOTP wajib `admin/committee`, leaked-password + rate-limit ON, CAPTCHA hanya `/login` + `/invite/:token`, SMTP produksi + uji 4 provider (Gmail/Yahoo/Outlook/kampus).
* Invite-only: `src/pages/Signup.tsx` info-only. Akun via `admin_create_user` / `accept_invitation_and_register` / `redeem_invitation`.

### 1.4 Infra / operasional

* `vercel.json:7-51`: SPA rewrite `/(.*)->/`, headers `CSP/HSTS-preload/Permissions-Policy/Referrer-Policy/X-Frame-DENY`, cache `/assets/*` 1 thn immutable.
* Backup `docs/RUNBOOK.md:24-71`: PITR + daily backup (butuh Pro), snapshot manual `scripts/snapshot-db.mjs` wajib H-1, pasca-import, pasca-migrasi, pasca-perubahan RLS/RPC. Retensi manual 30 hari, election-day 1 thn. Simpan 2 lokasi + gzip + hash SHA-256.
* RTO `docs/RUNBOOK.md:230-237`: 1 user <5 mnt, 1 tabel <1 jam PITR, full corrupt <4 jam, outage Supabase <24 jam.
* Incident `docs/RUNBOOK.md:127-199`: Sentry spike, `voter tidak bisa vote`, `tally tidak muncul`, `admin tidak bisa login`. H-1 checklist `docs/RUNBOOK.md:202-216`, H+1 `docs/RUNBOOK.md:219-226`.
* Testing: `vitest 20 files / 155-156 tests`, `tsc --noEmit 0`, `vite build` sukses — `CHANGELOG.md:16-17`. E2E 7 skenario `tests/e2e/` prod-safe (tanpa `TEST_EVENT_ID` + kredensial `p1-*` → SKIP, tulis hanya event `[P1-TEST]`, larang sentuh `95676965-a5c6-4f62-88bb-37ab9a57968b`). k6 smoke read-only `tests/load/election-day.js`; 200-VU/2000-stretch NOT RUN ON PROD. ZAP agresif + brute-force sungguhan dilarang di prod.
* Dok operasional: `docs/PANDUAN_ADMIN.md`, `PANDUAN_PANITIA.md`, `PANDUAN_VOTER.md`, `PANDUAN_OBSERVER.md`, `docs/SOP-Helpdesk-HariH.md`, `docs/Peraturan-Pemilihan-Template.md`.

## 2. Prinsip pricing (dari Skema §9)

Dihitung sebagai:

```text
Development effort + Production hardening + Deployment effort
+ Operational risk + Support + Infrastructure + Margin
```

Bukan `berapa biaya hosting?`. Contoh event butuh 2 mgg hardening + testing + DB prep + security review + deploy + konfigurasi + training + monitoring + standby + troubleshooting — yang dibayar adalah **engineering + responsibility + availability**.

## 3. Rincian A — Production Readiness (one-time, Rp5–10jt)

Tujuan: sistem layak pilot nyata pertama (<200 voter, 1 event). Gate: `docs/P0-Golive-Readiness-Plan.md:31-39`.

| Item | Scope teknis aktual | Bukti / file | Termasuk di fee |
|---|---|---|---|
| A1 Eligibility enforcement | Migrasi `20260913000000_enforce_eligibility_on_vote.sql`, `assert_event_is_votable(uuid,uuid)`, trigger `tg_enforce_vote_timeline`, 3 index DPT, UI bedakan `23505/P0001/42501` | `docs/P0-01-Eligibility-Enforcement.md`, `VotingPage.tsx`, `VotingPage.test.tsx +2 case` | Ya |
| A2 Session hardening | Migrasi `is_session_revoked`, `sessions.ts`, `AppBootstrap` enforce ≤5 mnt, `useAuth.refresh()`, `MySessions` | `docs/P0-03-Auth-Session-Hardening.md`, `sessions.test.ts +5 case` | Ya |
| A3 RLS / RPC review | Audit 50 migrasi, `has_permission` sweep, `get_election_tally` guard `42501`, lockdown `make_user_admin/create_admin_user`, audit immutability | `supabase/migrations/20251109000000_*`, `20251110000000_*`, `20251111000000_*` | Ya |
| A4 Auth dashboard | JWT 3600, MFA admin/committee, leaked-password, rate-limit, CAPTCHA, SMTP + uji 4 provider, redirect Site URL prod, reset → `/reset-password` | `docs/supabase-auth-redirects.md` | Ya (konfigurasi + dokumentasi tanggal+pelaku) |
| A5 Testing baseline | `npm run test -- --run`, `npx tsc --noEmit`, `npm run build`, coverage gate P1 `vitest.config.ts:22-41` | `CHANGELOG.md [P0 Go-Live]` | Ya |
| A6 Deploy hardening | `vercel.json` CSP/HSTS, Sentry PII-filter, logger, ErrorBoundary, CI `.github/workflows/ci.yml`, `public/health.html` | `vercel.json`, `src/lib/logger.ts`, `src/App.tsx:71` | Ya |
| A7 Backup strategy | PITR enable, `snapshot-db.mjs`, prosedur restore, verifikasi query | `docs/RUNBOOK.md §1-§2`, `docs/P0-02-Staging-Backup-Drill.md` | Ya (prosedur + 1 drill) |

Tidak termasuk: redesign secrecy `ballots` (P2), hierarchy organisasi (P2), k6 penuh, E2E penuh — itu P1/P2 terpisah.

Acceptance A: T2 non-DPT → `42501`, H1 revoke → logout ≤5 mnt, H5 email 4 provider masuk inbox, `vitest+tsc+build` hijau, drill restore <1 jam tercatat.

## 4. Rincian B — Event Deployment (per-event, Rp3–7jt)

| Item | Scope teknis aktual | Catatan effort |
|---|---|---|
| B1 Institusi + branding | Origin prod, Site URL, redirect `https://<prod>/**`, logo/nama event, `Index/PublicResultsPage` copy | 0.5–1 hari |
| B2 Konfigurasi election | `election_events` + `scope_type/scope_id` + window + `election_eligibility_rules` + `validate_scope_id` + state `draft->registration` via RPC | 0.5–1 hari |
| B3 Kandidat | `candidates/candidate_pairs` + approval flow + foto Storage + `candidate-helpers.ts` | Tergantung jumlah kandidat, 0.5–1 hari |
| B4 DPT / voter import | Bulk `profiles` + `event_voter_groups` + index `idx_evg_event_class/idx_profiles_class`, `is_eligible_voter` check, undangan via `admin_create_user` / `invitations` + `redeem_invitation` | 1–2 hari + 1 snapshot pasca-import |
| B5 Staff | `admin_assign_committee/observer`, `ElectionStaff.tsx`, `CommitteeLayout/ObserverLayout`, route `/committee/* /observer/*` | 0.5 hari |
| B6 Jadwal + transisi | `auto_transition_elections` pg_cron/mnt + `admin_transition_election_state` manual override, `election_state_transitions` audit | Termasuk |
| B7 Staging + UAT | Vercel preview → staging, `db push --dry-run` + push, UAT checklist Fase 0–5 `docs/P1-Manual-Testing-Runbook.md`, `Peraturan-Pemilihan-Template` diisi panitia (tie-break, masa sanggah, publisher) | 1 hari + jendela panitia |
| B8 Training | `PANDUAN_ADMIN/PANITIA/VOTER/OBSERVER` walkthrough + `SOP-Helpdesk-HariH` briefing | 0.5 hari |

Acceptance B: DPT terimport + 2–3 akun uji lolos voting di staging, tally match, audit normal, panitia sign-off UAT.

## 5. Rincian C — Event Operations (per-event, Rp3–8jt)

| Item | Scope | SLA |
|---|---|---|
| C1 Monitoring H-H | Sentry error spike, Vercel + Supabase status, uptime check, `audit_log` anomaly mingguan | P0 <15 mnt, P1 <1 jam — `RUNBOOK §3` |
| C2 Support voter/panitia | Troubleshoot `tidak bisa vote` (status/window/eligibility/RLS), `tally tidak muncul` (`get_election_tally` + `public_results`), `admin tidak bisa login` (profiles/user_roles lookup), reset manual, sengketa `sudah memilih`, internet down | Window disepakati, mis. 09.00–15.00 + 1 jam standby |
| C3 Incident handling | Template komunikasi severity, eskalasi, kontak darurat terisi sebelum go-live | `RUNBOOK §3.2-§3.3` |
| C4 Result verification | `SELECT * FROM get_election_tally(event-id)`, `safePercent` anti-NaN, 2-approvals publish, export `admin_export_audit_log` JSON | H+1 checklist |
| C5 Post-event report | Tally final, incident log, snapshot post-election (simpan 1 thn), archive `status=archived` | H+1 s.d. H+7 |
| C6 Cleanup P1 (jika pakai event test) | Hapus votes → observations → transitions/committees/observers → candidates+DPT → event → users `p1-*` → kelas test, verifikasi residu 0, `audit_log` dipertahankan | `docs/P1-Manual-Testing-Runbook.md Fase 5` |

Tidak termasuk: ZAP agresif di prod, brute-force sungguhan, k6 200-VU di prod tanpa env isolasi.

## 6. Rincian D — Infrastructure (client-paid, akun universitas)

Prinsip `Skema §6`: jangan di akun personal. Struktur target:

```text
University
 ├── Vercel Organization (owner billing)
 ├── Supabase Organization (owner billing)
 ├── Domain + DNS
 └── Billing
      ▼
   UniVertex Production
      ▼
   Haidar / Binary Verse sebagai Technical Provider (role admin/operator, bukan owner)
```

| Layanan | Paket minimum produksi | Biaya acuan Sep 2026 | Keterangan |
|---|---|---|---|
| Vercel | Pro | `$20/bln` | Hobby hanya personal/non-komersial |
| Supabase | Pro | `$25/bln` | Free pause 1 mgg inactivity, tanpa auto-backup; Pro daily backup 7 hari + PITR + tanpa pausing |
| Base | — | `$45/bln` blm usage + pajak (~Rp750rb/bln+) | Event kampus publik wajib Pro |
| Domain | `.ac.id/.org/.com` | `Rp150–400rb/thn` | Milik universitas |
| Email/SMTP | Provider kampus / Gmail / Outlook / Yahoo | `Rp0–500rb/event` | Uji 4 provider bagian H5 |
| Storage/egress/SMS | Sesuai usage | Variabel | Dibayar sesuai tagihan |

Catatan: `.env.example` mapping `production→PROD`, `preview/staging→STAGING`. Sebelum `db push` selalu `supabase migration list` + cek `--project-ref` agar tidak tertukar prod/staging.

## 7. Rincian E — Maintenance & Annual License (opsional)

Maintenance recurring (usulan `Rp1–3jt/bln` atau paket semester, disepakati pasca-pilot):

* Bugfix, security update, dependency update, DB maintenance, minor improvement, X jam support/bln.
* Berkala: PITR cek bulanan, restore drill/3 bln ke staging, rotate anon key/3 bln, review Sentry mingguan, review audit mingguan, update kontak/3 bln — `RUNBOOK §7`.

Annual License (baru setelah pilot sukses, jika dipakai BEM/Himpunan/survei berulang):

```text
Annual License
 ├── unlimited election configurations (wajar)
 ├── hosting guidance + updates
 ├── technical support + backups
 └── X hours/month support
```

Evolusi: `Bootstrap → Paid Pilot → Institutional Deployment → Recurring Maintenance → Annual License → Multi-Tenant SaaS`. Jangan lompat ke SaaS — `Skema §12`.

## 8. Aset & IP (jangan dicampur — Skema §7, §15)

| Aset | Isi | Pemilik |
|---|---|---|
| Core Software | Kode, arsitektur, components, logic, DB model, framework | Haidar / Binary Verse (licensed, bukan dijual) |
| Institutional Configuration | Univ A, event 2026, kandidat, voter groups, branding, jadwal, rules | Universitas (per-event) |
| Institutional Data | Mahasiswa, votes, results, `audit_log` (append-only, retensi 1 thn) | Universitas, tunduk UU PDP |

Repo: pisahkan public demo vs private production (migrasi, deploy config, security, data institusi). Public repo ≠ open-source otomatis tanpa lisensi eksplisit — `Skema §16`.

## 9. Payment term (Skema §14)

Minimal `50/50`:

```text
50% saat agreement/kickoff
50% sebelum production go-live
```

Atau proyek besar `40/30/30`:

```text
40% kontrak/kickoff
30% staging + UAT sign-off
30% production go-live
```

Jangan biayai deploy prod sampai selesai baru menunggu bayar — kamu menanggung dev + cloud + deadline risk.

## 10. Checklist kontrak minimum

Scope, acceptance criteria (A+B+C di atas), deployment date, event date, SLA/support window, incident handling, backup + RTO, retensi/deletion data, change request, cancellation, milestone pembayaran, limitasi liability, pemilik IP/data/infra/support, auditability + integrity + access control + data handling untuk voting.

## 11. Template penawaran (copy ke proposal)

```text
UNIVERTEX — Institutional Pilot Deployment — [Nama Universitas] — [Nama Event] — [Tanggal Event]
──────────────────────────────────────────────────────────────
One-time
A. Production Readiness (A1–A7)          Rp [5–10jt] → Rp [___]
Per-event
B. Institution Deployment (B1–B8)        Rp [3–7jt]  → Rp [___]
C. Event Operations (C1–C6)              Rp [3–8jt]  → Rp [___]
                                         ──────────
Project Fee                              Rp [11–25jt] → Rp [___]

Infrastructure (client-paid, akun universitas)
Vercel Pro $20/bln + Supabase Pro $25/bln + Domain + SMTP   [tagihan langsung]

Post-event (opsional)
Maintenance [Rp ___/bln]   Annual License [Rp ___/thn]   Source Buyout [terpisah]

Term: [50/50 | 40/30/30] — DP [___] sebelum kickoff, pelunasan sebelum go-live H-1.
SLA H-H: [mis. 09.00–15.00 + 1 jam] — PIC on-call [nama/HP/email].
Go/No-Go H-1: satu merah → postpone — `docs/P0-Golive-Readiness-Plan.md:31-39` + `docs/RUNBOOK.md:204-216`.
```

## 12. Referensi

* Skema: `docs/schema/Skema-Pembiayaan-Project.md` §1–§18.
* Gate: `docs/P0-Golive-Readiness-Plan.md`, `docs/P0-01-Eligibility-Enforcement.md`, `docs/P0-02-Staging-Backup-Drill.md`, `docs/P0-03-Auth-Session-Hardening.md`.
* Operasional: `docs/RUNBOOK.md`, `docs/SOP-Helpdesk-HariH.md`, `docs/Peraturan-Pemilihan-Template.md`, `docs/supabase-auth-redirects.md`.
* Testing: `docs/Test_Strategy_Verifikasi.md §4`, `docs/P1-Manual-Testing-Runbook.md`, `docs/P1-Proddirect-Notes.md`, `playwright.config.ts`, `tests/e2e/`, `tests/load/election-day.js`.
* Histori: `CHANGELOG.md [P0 Go-Live], [P1 Pilot]`.
