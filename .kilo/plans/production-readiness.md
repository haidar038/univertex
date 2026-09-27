# Plan: Production Readiness untuk UniVertex

> **Tujuan:** aplikasi siap dipakai untuk election event langsung di lapangan (real-world).
> **Sudah ada:** fix-critical-issues.md (17 task selesai, 108 tests passing) + election-governance-roadmap.md (Fase 1: committee/observer).
> **Plan ini menjawab:** "Langkah konkret apa yang harus dilakukan, dalam urutan apa, untuk go-live?"

---

## 0. Quick assessment (keadaan saat ini)

### Sudah jadi (siap pakai)
- Fix kritis 9 isu: RLS, audit, session, tally guard, invite catch-22, admin create user, dll. — selesai, applied ke DB live, tested.
- Frontend: 14 task (T1-T14) selesai, build sukses, tsc 0 error.
- Schema: 12 tabel + 12 migration SQL (4 Nov batch + 7 Sep batch) + 6 RPC baru.
- Deploy target: Vercel (`vercel.json` minimal, security headers dasar, SPA rewrite).

### Belum ada (gap ke production)
- **CI/CD** — tidak ada `.github/`, tidak ada automated test/lint on push, tidak ada preview deploy otomatis
- **Monitoring/error tracking** — tidak ada Sentry, tidak ada logger terstruktur, error dari client tidak ter-capture
- **Backup & DR** — Supabase punya PITR tapi belum ada runbook restore
- **Load testing** — 0 baseline, tidak tahu kapasitas sistem
- **Security headers** — hanya 3 header dasar; perlu CSP, Permissions-Policy, Referrer-Policy
- **Domain & TLS** — `vercel.app` default; perlu custom domain + cert verification
- **Environment parity** — hanya 1 DB; tidak ada staging environment terpisah
- **GDPR/UU PDP compliance** — tidak ada consent UI, data export, right-to-delete flow
- **Documentation** — tidak ada end-user guide, admin manual, atau runbook insiden
- **Governance** — belum ada committee/observer (Fase 1 dari governance roadmap)
- **Performance baseline** — tidak ada metrics

### Risiko tertinggi (jika di-skip)
| Risiko | Dampak di lapangan |
|---|---|
| 0 CI/CD + monitoring | Bug lolos ke user, tidak terdeteksi cepat, downtime tidak ter-notify |
| 0 backup runbook | Data loss jika ada masalah DB → krusial untuk integritas election |
| 0 load test | Server down saat traffic puncak (election day biasanya ramai) |
| 0 security hardening | Vulnerable terhadap serangan umum (XSS, CSRF, data leak) |
| 0 governance (committee) | Admin jadi single point of failure, tidak ada oversight lapangan |

---

## 1. Prinsip eksekusi

### E1: Stabilize dulu, baru enhance
Jangan tambah fitur baru sebelum fondasi produksi jadi. Urutan: observability → CI/CD → hardening → governance.

### E2: Staging sebelum production
Tidak boleh deploy langsung ke production. Bikin environment **staging** yang mirror production, test di situ dulu.

### E3: Rollout bertahap (pilot → scale)
Election pertama: **pilot kecil** (1 event, 1 fakultas, <500 voter). Setelah 1-2 cycle sukses, scale up.

### E4: Data integrity = non-negotiable
Election = integritas data. Setiap perubahan DB harus:
- Idempotent (bisa di-apply ulang)
- Backward-compatible
- Tested di staging dulu
- Ada rollback plan

### E5: Auditability end-to-end
Semua aksi (admin, committee, voter) tercatat. Audit log harus **exportable** dan **immutable**.

---

## 2. Peta eksekusi (timeline realistis)

```
MINGGU 1-2  →  FASE 0: Stabilization & Visibility
MINGGU 2-4  →  FASE 1: Committee & Observer (governance)
MINGGU 4-5  →  FASE 2: Hardening (security, performance, error handling)
MINGGU 5-6  →  FASE 3: Deployment Infrastructure (CI/CD, backup, monitoring)
MINGGU 6-7  →  FASE 4: Staging & Load Test
MINGGU 7-8  →  FASE 5: Pilot Production (real election, small scale)
MINGGU 8+   →  FASE 6: Full Rollout + Post-Launch Operations
```

> **Catatan:** timeline ini asumsi 1 developer full-time + reviewer part-time. Bisa parallel-kan Fase 0 + 1 (governance tidak butuh production infra).

---

# FASE 0: Stabilization & Visibility (Minggu 1-2)

> **Tujuan:** bisa "melihat" apa yang terjadi di aplikasi; deployment reproducible; ada baseline.

## 0.1 Error tracking & logging (hari 1-2)

### Frontend logger terstruktur
**Tujuan:** semua error & event penting tercatat, bisa di-query.

File baru: `src/lib/logger.ts`
```ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
interface LogContext {
  userId?: string;
  electionId?: string;
  route?: string;
  action?: string;
  [key: string]: unknown;
}
export const logger = {
  debug: (msg: string, ctx?: LogContext) => console.debug(JSON.stringify({level:'debug', msg, ...ctx, ts: Date.now()})),
  info:  (msg: string, ctx?: LogContext) => console.info(...),
  warn:  (msg: string, ctx?: LogContext) => console.warn(...),
  error: (msg: string, error?: unknown, ctx?: LogContext) => console.error(...),
};
```

Integrasikan:
- `supabase.auth.onAuthStateChange` callback — log login/logout
- Global error boundary — log unhandled React errors
- `window.addEventListener('unhandledrejection')` — log promise rejections
- RPC call wrappers — log request/response shape (no PII)

### Sentry integration (opsional tapi sangat direkomendasikan)
- Daftar di sentry.io, buat project React/Vite
- Install: `npm install @sentry/react`
- File `src/lib/sentry.ts`: inisialisasi dengan DSN dari env
- Wire ke error boundary + unhandledrejection
- Set `tracesSampleRate: 0.1` (10% untuk hemat quota)
- Set `beforeSend` filter untuk tidak capture PII (email, student_id, full_name)

**Acceptance:** error UI ter-capture ke Sentry, ada source map untuk debug.

## 0.2 Backup & DR runbook (hari 2-3)

**Tujuan:** jika DB rusak/terhapus, bisa restore.

- Aktifkan **Point-in-Time Recovery** (PITR) di Supabase project (Settings → Database → Point in time)
- Runbook file: `docs/RUNBOOK_BACKUP_RESTORE.md`
  - Daily: Supabase auto-backup (PITR 7 hari included)
  - Manual snapshot sebelum election: `supabase db dump --schema public` → simpan di safe location
  - Restore step: `supabase db restore <snapshot>` + verify dengan checklist
- Test restore: **sekali per quarter**, ke project terpisah, verify data integrity

**Acceptance:** PITR aktif, snapshot election-day tersimpan, restore terverifikasi.

## 0.3 Environment parity (hari 3-4)

**Tujuan:** production dan development tidak lagi share database.

Problem: saat ini `.env` dan `client.ts` hardcode ke `oiurjnmpkguyxevdbpbu` (dev DB). Production harus pakai DB terpisah.

Action:
1. Buat Supabase project baru: `UniVertex Staging` (region sama, tier sama)
2. Apply semua 12 migration ke staging (via `supabase db push` atau manual run)
3. Seed data minimum (1 admin, 1 class, 1 election draft)
4. Update Vercel env vars:
   - `VITE_SUPABASE_URL` → staging URL untuk branch `develop`
   - `VITE_SUPABASE_URL` → production URL untuk branch `main`
5. Test connection dari local pakai staging env

**Acceptance:** staging & production adalah 2 Supabase project terpisah, env vars jelas.

## 0.4 CI/CD dasar (hari 4-7)

**Tujuan:** setiap push ke GitHub otomatis di-test dan di-deploy ke Vercel preview.

File: `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx vitest --run
      - run: npm run lint
  deploy-preview:
    if: github.ref != 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--env VITE_SUPABASE_URL=${{ secrets.STAGING_SUPABASE_URL }} ...'
```

Vercel setup:
- Hubungkan repo GitHub ke Vercel
- Set environment variables per branch:
  - Production branch `main` → production DB env
  - Preview branches → staging DB env
- Auto-deploy: PR → preview URL, merge to main → production

**Acceptance:** setiap PR ada preview URL, setiap push ke main auto-deploy.

## 0.5 Definition of Done Fase 0
- [ ] Sentry (atau alternatif) aktif, error ter-capture
- [ ] PITR aktif, snapshot election-day script ready
- [ ] Staging Supabase project dibuat & ter-seed
- [ ] CI workflow jalan (test + lint + typecheck)
- [ ] Vercel preview deploy otomatis per PR

---

# FASE 1: Committee & Observer (Minggu 2-4)

> **Tujuan:** admin bisa invite panitia/observer per-election; mereka punya dashboard monitoring; read-only by default.
> **Detail lengkap:** `.kilo/plans/election-governance-roadmap.md` Fase 1.

## 1.1 Schema migration (hari 1-3)

File: `supabase/migrations/20251106000000_add_committee_observer_roles.sql`

Isi (lihat detail di governance roadmap §1.1):
- Extend `app_role` enum: tambah `'committee'`, `'observer'`
- Tabel `election_committees` (per-election assignment, dengan committee_role enum)
- Tabel `election_observers` (per-election read-only assignment)
- Tabel `election_observations` (catatan monitoring)
- Tambah `election_id` ke `audit_log` (backward-compatible)
- Helper functions: `has_election_role(uid, election_id, role)`, `can_access_election(uid, election_id)`
- RLS policies untuk tabel baru

Terapkan ke staging dulu, test query manual, baru apply ke production.

## 1.2 RPC baru (hari 3-5)

File migration RPC (atau bundle dalam satu):
- `admin_assign_committee(p_user_id, p_election_id, p_role)` — admin only
- `admin_revoke_committee(p_committee_id, p_reason)`
- `admin_assign_observer(p_user_id, p_election_id)`
- `admin_revoke_observer(p_observer_id, p_reason)`
- `add_election_observation(p_election_id, p_category, p_severity, p_description, p_metadata)` — admin/committee/observer pada election tsb
- Update `accept_invitation_and_register` untuk handle `intent='committee'` & `'observer'`

## 1.3 Extend invitation flow (hari 5-7)

- Update `invitations.intent` CHECK constraint: tambah `'committee'`, `'observer'`
- Update `CreateInvitationDialog` di admin UI: tambah intent option
- Kalau `intent='committee'`: tambah field `committee_role` + event selector
- Kalau `intent='observer'`: tambah field event selector
- Update `accept_invitation_and_register` SQL: setelah user dibuat, insert ke `election_committees`/`election_observers` sesuai invitation

## 1.4 Frontend: Committee dashboard (hari 7-12)

File baru:
- `src/components/CommitteeLayout.tsx` — sidebar + protected route
- `src/pages/committee/Dashboard.tsx` — list election yang di-assign
- `src/pages/committee/ElectionDetail.tsx` — detail event (read-only + actions)
- `src/components/ProtectedCommitteeRoute.tsx` — guard role

Fitur ElectionDetail:
- Live vote count (reuse `get_election_tally` RPC, admin bypasses guard)
- Daftar kandidat (read-only)
- Daftar voter eligible (read-only, with attendance status if committee_role='verifier')
- Election observations list (with severity badge)
- Form tambah observation (category, severity, description)
- Audit log filtered by election_id

## 1.5 Frontend: Observer dashboard (hari 12-14)

Mirip committee tapi **read-only total**:
- Tidak ada tombol "Tandai Voter Hadir"
- Hanya bisa lihat data + tambah observation
- Lebih sederhana, bisa pakai komponen yang sama dengan prop `readOnly`

## 1.6 Update useAuth + routing (hari 14-15)

- Tambah `isCommittee`, `isObserver` di return value `useAuth`
- Update `dashboardPathFor`: admin → /admin, committee → /committee, observer → /observer, voter → /app
- Update `App.tsx`: route `/committee/*` dan `/observer/*` dengan protected wrapper

## 1.7 Tests (hari 15-17)

- `sessions.test.ts`, `audit.test.ts` — extend jika ada flow baru
- `useAuth.test.ts` — test committee/observer role
- `AcceptInvite.test.tsx` — test invite for committee
- File baru: `src/pages/__tests__/committee/Dashboard.test.tsx`
- File baru: `src/hooks/__tests__/useAuthCommittee.test.tsx`

## 1.8 Definition of Done Fase 1
- [ ] Migration applied ke staging
- [ ] Admin bisa invite committee/observer
- [ ] Committee dashboard menampilkan election yang di-assign
- [ ] Committee tidak bisa INSERT/UPDATE/DELETE data event (RLS verified)
- [ ] Observer dashboard read-only
- [ ] Semua aksi tercatat di audit_log dengan election_id
- [ ] Tests 100% passing, tsc 0 error, build sukses
- [ ] Disimpan di staging 1 minggu tanpa error

---

# FASE 2: Hardening (Minggu 4-5)

> **Tujuan:** security, performance, error handling kuat untuk production traffic.

## 2.1 Security headers & CSP (hari 1-2)

Update `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';"
        }
      ]
    }
  ]
}
```

Test CSP dengan browser console, pastikan tidak ada violation. Supabase WebSocket perlu di-allow.

## 2.2 Rate limiting (hari 2-3)

Supabase tidak punya built-in rate limit per user. Implementasi di PostgreSQL:
- Tabel `rate_limit_log` (user_id, action, window_start)
- Function `check_rate_limit(p_user_id, p_action, p_max, p_window)` — count per window
- Apply di RPC sensitive: `accept_invitation_and_register` (max 5/jam), `log_failed_login` (already 10/15min), `add_election_observation` (max 30/jam)

Atau pakai Vercel Edge Middleware untuk limit di front door (lebih murah). Rekomendasi: kombinasi.

## 2.3 Performance baseline (hari 3-4)

- Run Lighthouse di staging: target Performance ≥ 90, Accessibility ≥ 95
- Identifikasi bottlenecks (umumnya: terlalu banyak RPC, gambar tidak teroptimasi, bundle besar)
- Code splitting: `React.lazy()` untuk admin/committee/observer routes
- Bundle analysis: `npm run build -- --mode analyze` (via rollup-plugin-visualizer)

Optimasi konkret:
- Tabel `votes` sudah ada index `(voter_id, event_id)` dan `(event_id)` — query tally optimal
- `get_election_tally` RPC — single query, tidak ada N+1 (sudah di-fix T14)
- Lazy load admin routes — voter dashboard tidak perlu download admin bundle
- Image: convert ke WebP, lazy load dengan `<img loading="lazy">`

## 2.4 Error handling & UX (hari 4-5)

- Global error boundary (`src/components/ErrorBoundary.tsx`) — render fallback UI, log ke Sentry
- 404 page (`src/pages/NotFound.tsx`) — sudah ada, polish UX
- Offline detection — `navigator.onLine` check, tampilkan banner "Anda offline"
- Form submission: optimistic update + rollback on error (saat ini masih loading state)
- Toast consistency — pakai sonner, sudah ada, audit placement
- Loading skeletons untuk dashboard (voter & admin)

## 2.5 Definition of Done Fase 2
- [ ] Security headers + CSP aktif, tested
- [ ] Rate limit di RPC sensitive
- [ ] Lighthouse Performance ≥ 90
- [ ] Error boundary + Sentry wiring
- [ ] Bundle splitting verified

---

# FASE 3: Deployment Infrastructure (Minggu 5-6)

> **Tujuan:** production deployment aman, reproducible, dengan observability.

## 3.1 Custom domain & DNS (hari 1)

- Beli domain (Namecheap, Cloudflare Registrar)
- Setup DNS: Vercel kasih CNAME/ALIAS, propagasi 1-24 jam
- Vercel auto-issue Let's Encrypt cert
- HSTS preload (header sudah diset di 2.1)
- Test di https://www.ssllabs.com/ssltest/

## 3.2 Environment variables management (hari 1-2)

Vercel env (production):
- `VITE_SUPABASE_URL` — production Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — production anon key (rotate per quarter)
- `VITE_SENTRY_DSN` (jika pakai Sentry)
- `VITE_APP_ENV=production`

Vercel env (preview/staging):
- Sama tapi pointing ke staging Supabase
- Plus `VITE_APP_ENV=staging`

Dokumentasi: `docs/ENVIRONMENT.md` (list semua env, cara rotate, secret management).

## 3.3 Monitoring & alerting (hari 2-4)

- Sentry untuk error tracking
- Vercel Analytics untuk Web Vitals (built-in, free)
- Supabase Logs untuk DB performance
- Setup uptime monitoring: UptimeRobot atau BetterStack (cek `/health` setiap 5 menit)
- Alert channel: email + WhatsApp/Telegram untuk critical alerts

`/health` endpoint sederhana di frontend (atau di Supabase via Edge Function):
```ts
// src/pages/Health.tsx
export default function Health() {
  return <div>OK: {new Date().toISOString()}</div>;
}
```

## 3.4 Admin runbook (hari 4-5)

File: `docs/RUNBOOK.md` (untuk operator/admin jika ada insiden)

Isi:
- Akses: login sebagai admin, navigation
- Reset password user: via Supabase dashboard
- Buka/tutup election: `EditEventDialog`
- Tambah admin baru: SQL via Supabase dashboard
  ```sql
  INSERT INTO public.user_roles (user_id, role) VALUES ('uuid', 'admin');
  ```
- Restore data: lihat backup runbook
- Cek audit log: `/admin/audit-log`
- Eskalasi: kontak developer (siapa? kapan?)

## 3.5 Definition of Done Fase 3
- [ ] Custom domain aktif + HTTPS
- [ ] Env vars terdokumentasi & ter-rotate
- [ ] Sentry + Uptime monitoring aktif
- [ ] Alert channel siap
- [ ] Runbook ada & ditinjau

---

# FASE 4: Staging & Load Test (Minggu 6-7)

> **Tujuan:** validasi sistem di bawah beban election-day, sebelum pilot production.

## 4.1 Staging smoke test (hari 1-2)

Manual test semua flow utama di staging:
- [ ] Sign in admin
- [ ] Buat event (status draft → active → closed)
- [ ] Invite voter, voter accept → bisa vote
- [ ] Invite committee, committee lihat dashboard
- [ ] Tambah kandidat
- [ ] Submit vote, cek tally
- [ ] Lihat audit log
- [ ] Test di mobile browser (Chrome Android, Safari iOS)

## 4.2 Load test (hari 2-3)

Tool: `k6` atau `artillery` (free, open source).

Skenario election-day (misal: 500 voter, voting 1 jam):
```js
// load-test.js (k6)
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 100 },   // ramp-up ke 100 concurrent
    { duration: '10m', target: 500 },  // ramp-up ke 500 concurrent (peak)
    { duration: '5m', target: 0 },     // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% request < 500ms
    http_req_failed: ['rate<0.01'],     // error rate < 1%
  },
};

// Simulasi: GET / (landing), GET /api/elections, POST /api/vote
```

Target metrik:
- p95 latency < 500ms
- Error rate < 1%
- Vote insert throughput > 50 votes/sec (untuk 500 voter / 1 jam = 0.14/sec avg, peak mungkin 5/sec)

Jalankan di staging, identifikasi bottleneck (kemungkinan: Supabase free tier limit, RPC cold start, RLS eval cost). Optimasi jika perlu.

## 4.3 Security audit (hari 3-4)

- Jalankan `supabase_get_advisors` security — recheck semua
- OWASP ZAP scan di staging URL
- Manual review RLS policies: pastikan tidak ada yang overly permissive
- Penetration test sederhana: coba akses sebagai anon ke endpoint admin (harus 401/403)
- Test SQL injection: input field test (form name, email, etc.) — supabase-js sudah parameterized, tapi verify
- Test CSRF: Supabase pakai JWT, jadi OK; verify cookie flags

## 4.4 Definition of Done Fase 4
- [ ] All smoke tests passed di staging
- [ ] Load test: p95 < 500ms, error < 1%
- [ ] Security audit: 0 critical/high issue
- [ ] UAT dengan 2-3 tester independen

---

# FASE 5: Pilot Production (Minggu 7-8)

> **Tujuan:** jalankan election pertama di production dengan scope kecil, untuk validasi real-world.

## 5.1 Pilih pilot event (hari 1)

Kriteria pilot:
- Scope kecil: 1 fakultas/departemen, <500 voter
- Bukan election "penting" (misal: pemilihan coordinator, bukan ketua BEM universitas)
- Panitia yang kooperatif untuk feedback
- Jadwal: ≥1 minggu setelah launch, agar ada buffer

Contoh pilot: "Pemilihan Koordinator Laboratorium Informatika 2026" dengan 50 voter, 3 kandidat.

## 5.2 Briefing & training (hari 1-3)

- Admin training: cara kelola event, undang panitia, lihat audit log
- Committee training: cara pakai dashboard monitoring, tambah observation
- Voter briefing: link, tutorial singkat, kontak helpdesk
- Dokumentasi: `docs/PANDUAN_ADMIN.md`, `docs/PANDUAN_PANITIA.md`, `docs/PANDUAN_VOTER.md`

## 5.3 Persiapan H-1 (hari 3-4)

- Verifikasi env production pointing ke production DB
- Seed pilot data: 1 admin, 1 committee, 1 observer, 50 voter, 3 kandidat, 1 event (status=active)
- Test voting 1-2 voter manual, verify tally
- Snapshot DB pre-election (untuk rollback jika ada masalah)
- Aktifkan mode "monitoring ketat": Sentry alert threshold rendah, on-call rotation

## 5.4 Hari H (election day) (hari 5)

- Voting window: 4-8 jam
- Real-time monitoring: Sentry + Supabase logs
- Committee standby untuk handle voter issues
- Help channel (WhatsApp group): admin + developer + committee
- Incident response: jika ada masalah kritis, keputusan untuk extend voting window atau rollback (snapshot tersedia)

## 5.5 Post-election (hari 6-8)

- Verifikasi tally & result
- Export audit log untuk dokumentasi
- Feedback session dengan committee & beberapa voter
- Catat semua issue untuk backlog
- Tutup event (status → archived)

## 5.6 Definition of Done Fase 5
- [ ] Pilot election selesai tanpa insiden major
- [ ] Feedback session dilakukan
- [ ] Backlog issue ter-update
- [ ] Decision: lanjut ke Fase 6 (scale up) atau iterate

---

# FASE 6: Full Rollout & Post-Launch (Minggu 8+)

> **Tujuan:** operasional production ongoing, scale ke election-event lebih besar.

## 6.1 Iterasi dari pilot (minggu 8-9)

Berdasarkan feedback pilot, fix issue prioritas. Re-test di staging.

## 6.2 Scale up (minggu 10+)

Election kedua: scope lebih besar (1 fakultas, 1000+ voter). Pantau metrics ketat.

## 6.3 Post-launch operations (ongoing)

- **Monitoring harian**: cek Sentry error rate, Supabase performance
- **Weekly review**: audit log anomalies, failed login patterns
- **Monthly**: rotate anon key, review advisor warnings, backup test
- **Quarterly**: DR drill (test restore), security review, dependency update
- **Election-event checklist** (per event):
  - [ ] Pre-event: snapshot DB, briefing panitia, test voting
  - [ ] During: monitoring ketat, on-call standby
  - [ ] Post: export audit, feedback session, archive

## 6.4 Backlog governance (Fase 2 & 3 dari governance roadmap)

Setelah stabil, mulai implementasi:
- Election state machine
- Scope & eligibility rules
- Permission-based RBAC
- Ballot vs vote separation
- Organizational hierarchy

Lihat `.kilo/plans/election-governance-roadmap.md` untuk detail.

---

# 3. Critical path & dependencies

```
FASE 0 ─┬─→ FASE 3 (butuh CI/CD dari Fase 0)
        │
        └─→ FASE 2 (butuh monitoring dari Fase 0)

FASE 1 (governance) ── independen, bisa parallel dengan Fase 0

FASE 3 (infra) ── butuh Fase 0 selesai

FASE 4 (staging+load) ── butuh Fase 1+2+3 selesai

FASE 5 (pilot) ── butuh Fase 4 passed

FASE 6 (rollout) ── butuh Fase 5 feedback incorporated
```

**Critical path terpanjang:** Fase 0 → 2 → 3 → 4 → 5 → 6 = ~8 minggu.
**Bisa di-compress:** Fase 0 + 1 paralel (governance tidak butuh CI) → 6-7 minggu.

---

# 4. Definisi Selesai Global (Final Go-Live Checklist)

Sistem siap production ketika SEMUA ini terpenuhi:

### Stabilitas
- [ ] CI green untuk 7 hari terakhir (test, lint, typecheck, build)
- [ ] Sentry error rate < 0.5% dari total requests
- [ ] Lighthouse Performance ≥ 90 di staging
- [ ] Load test: p95 < 500ms pada 500 concurrent

### Keamanan
- [ ] Security headers + CSP aktif
- [ ] Rate limiting di RPC sensitive
- [ ] No critical/high security advisor warning
- [ ] OWASP ZAP scan clean
- [ ] Backup tested (restore verified)

### Governance
- [ ] Committee & observer roles aktif
- [ ] Audit log per-election tersedia
- [ ] Admin bisa invite & revoke
- [ ] Committee tidak bisa modify data (RLS verified)

### Operasional
- [ ] Custom domain + HTTPS aktif
- [ ] Staging & production env terpisah
- [ ] Runbook untuk backup, restore, incident response
- [ ] End-user documentation (admin, committee, voter)
- [ ] Alert channel (email + chat) tested

### Compliance
- [ ] Privacy policy halaman ada (sudah ada)
- [ ] Terms of service halaman ada (sudah ada)
- [ ] Data consent saat registrasi (UU PDP)
- [ ] Audit log exportable (untuk audit external)

### Pilot validation
- [ ] 1 election sukses di production dengan <500 voter
- [ ] 0 insiden major
- [ ] Feedback incorporated

---

# 5. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Time underestimation | Plan buffer 20% per fase; cut scope jika perlu |
| Scope creep (terus tambah fitur) | Lock scope di awal setiap fase, defer ke Fase 6 backlog |
| Solo developer burnout | Pecah fase, ada cut-off jelas per fase |
| Production data corruption | Snapshot pre-event, runbook restore |
| Security breach | Sentry alerting, rate limit, audit log review |
| Election-day downtime | Vercel SLA 99.99%, Supabase SLA 99.9%, on-call standby |
| User confusion | Documentation, training, help channel |
| Regulatory (UU PDP) | Konsultasi legal, implement consent + data export |

---

# 6. Rekomendasi urutan eksekusi konkret (minggu depan)

**Jika Anda mulai besok, urutan yang paling efisien:**

1. **Hari 1-2**: Setup Sentry (15 menit) + logger.ts (2 jam) + wire ke error boundary
2. **Hari 3-4**: Aktifkan PITR Supabase + tulis backup runbook
3. **Hari 5-6**: Buat staging project, apply 12 migration, seed data
4. **Hari 7-9**: Setup CI workflow (`.github/workflows/ci.yml`)
5. **Hari 10-11**: Setup Vercel preview deploy per PR
6. **Hari 12-17 (paralel dengan #1-5)**: Implement Fase 1 Committee/Observer

Setelah itu → Fase 2 (hardening) → Fase 3 (infra) → dst.

**Jika ada yang di-defer ke v2:** governance Fase 2 & 3 (state machine, RBAC penuh, ballot terpisah, org hierarchy) bisa di-defer ke iterasi setelah production stabil. Yang **wajib** untuk v1 production: Fase 0 (stabilitas) + Fase 1 (committee/observer) + security basics.

---

# 7. Definisi Selesai per fase (recap)

| Fase | DoD |
|---|---|
| 0 | Sentry aktif, PITR aktif, staging env, CI jalan, preview deploy |
| 1 | Committee/observer dashboard, RLS verified, audit per-election |
| 2 | CSP + rate limit, Lighthouse ≥ 90, error boundary |
| 3 | Custom domain, monitoring, runbook, alert |
| 4 | Load test passed, security audit clean, UAT passed |
| 5 | Pilot production sukses, feedback incorporated |
| 6 | Scale up, ongoing operations |

---

# 8. Rujukan

- **Fix kritis sebelumnya**: `.kilo/plans/fix-critical-issues.md` (17 task, selesai)
- **Governance roadmap**: `.kilo/plans/election-governance-roadmap.md` (Fase 1-3 arsitektur)
- **Production readiness** (plan ini): `.kilo/plans/production-readiness.md`
- **Update dokumentasi**: `docs/Update_September_2026.md`, `docs/Update_Kritis_Fixes_September_2026.md`
- **Live DB**: `oiurjnmpkguyxevdbpbu` (UniVertex)
- **Deploy target**: Vercel (`vercel.json` sudah ada, perlu di-enhance)

> **Pesan terakhir:** fondasi (Fase 0-3) **wajib** sebelum go-live. Fitur governance tambahan (Fase 1) sangat direkomendasikan tapi bisa di-defer ke iterasi v1.1 jika time-to-market kritis. Yang **paling penting** adalah: observability (Sentry), backup (PITR + snapshot), staging env, dan CI/CD — tanpa ini, satu bug saja bisa mengancam integritas election.
