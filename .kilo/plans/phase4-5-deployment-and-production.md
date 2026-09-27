# Plan: Fase 4–5 — Deployment & Production

> **Tujuan:** bawa aplikasi UniVertex dari "dev ready" ke "live election-grade production".
> **Prasyarat (sudah selesai & diverifikasi live):**
> - Fase 0 — Stabilization (logger, ErrorBoundary, Sentry, CI workflow, RUNBOOK, snapshot script)
> - Fase 1 — Committee & Observer (5 roles, per-election governance)
> - Fase 2 — State Machine & Scope (6-state lifecycle, auto-transition, eligibility rules)
> - Fase 3 — RBAC + Audit (31 permissions, role_permissions seeded, audit immutability, export RPC, view)
> - 148/148 tests passing, tsc 0 error, build success
> - DB live: 17 tables, 25+ RPCs, 5 enums, 22 RLS policies, 2 audit views, 2 cron jobs
>
> **Cakupan fase ini:**
> - **Fase 4** (Deployment Infra & Hardening) — minggu 1–2
> - **Fase 5** (Pilot Production & UAT) — minggu 3–4

---

## 0. Gap analysis — apa yang belum siap

| Aspek | Status | Gap ke production |
|---|---|---|
| **Tests** | ✓ 148 passing | cukup |
| **TypeScript** | ✓ 0 error | cukup |
| **Build** | ✓ success | cukup |
| **Database** | ✓ live & verified | cukup (tapi **dev & prod share 1 DB** — perlu staging) |
| **Sentry** | ✓ wired, PII filter aktif | cukup |
| **CI** | ✓ `.github/workflows/ci.yml` ada | **GitHub Secrets belum di-set** (VERCEL_TOKEN dll) |
| **Vercel headers** | ✗ 3 header dasar | perlu CSP, HSTS, Permissions-Policy, Referrer-Policy |
| **Staging env** | ✗ tidak ada | **Wajib** sebelum pilot production |
| **Custom domain** | ✗ belum | perlu sebelum launch publik |
| **Load test** | ✗ 0 baseline | perlu k6/artillery |
| **Uptime monitoring** | ✗ tidak ada | perlu Sentry + BetterStack/UptimeRobot |
| **Security audit** | ✗ OWASP ZAP belum | perlu sebelum pilot |
| **UAT** | ✗ 0 tester independen | perlu 2-3 tester |
| **Pilot election** | ✗ belum pernah | perlu 1 election kecil |
| **End-user docs** | ✗ PANDUAN_* belum | perlu sebelum committee training |
| **Migration safety** | △ `schema_migrations` tidak record migrasi yang di-apply via `supabase_apply_migration` | dokumentasikan; raw SQL sudah di-DB |
| **npm scripts for DB** | ✗ tidak ada | tambah `db:types`, `db:snapshot`, `db:link` |
| **CHANGELOG** | ✗ tidak ada | tambah CHANGELOG.md |

**Estimasi total effort:** 2-3 minggu (1 developer + reviewer part-time).

---

## 1. Roadmap eksekusi (timeline)

```
MINGGU 1    →  FASE 4A: Hardening (security headers, env scripts, docs)
MINGGU 1-2  →  FASE 4B: Deploy Infra (staging Supabase, Vercel env, custom domain)
MINGGU 2    →  FASE 4C: UAT + Load Test + Security Audit
MINGGU 3    →  FASE 5A: Pilot Production (real election, small scope)
MINGGU 4    →  FASE 5B: Post-Launch Monitoring + Iteration
MINGGU 4+   →  FASE 6: Full Rollout (continuous operations)
```

---

# FASE 4A: Hardening (Minggu 1, hari 1-3)

> **Tujuan:** security headers lengkap, npm scripts untuk DB, dokumentasi updated.

## 4A.1 Security headers di Vercel

**File:** `vercel.json` (modify)

```json
{
  "buildCommand": "bun run build",
  "installCommand": "bun install",
  "outputDirectory": "dist",
  "framework": null,
  "rewrites": [{ "source": "/(.*)", "destination": "/" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=(), payment=()" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

**Risiko:** CSP terlalu strict bisa break Vite/Sentry. Test dengan:
1. `npm run build` lokal
2. Inspect bundle: `dist/index.html` + chunk JS
3. CSP audit: `https://csp-evaluator.withgoogle.com/` (paste policy)
4. Deploy preview Vercel → cek console browser tidak ada CSP violation

**Acceptance:** [securityheaders.com](https://securityheaders.com) score A/A+.

## 4A.2 NPM scripts for DB operations

**File:** `package.json` (add to scripts)

```json
{
  "db:types": "supabase gen types typescript --project-id oiurjnmpkguyxevdbpbu --schema public > src/integrations/supabase/types.ts",
  "db:link": "supabase link --project-ref oiurjnmpkguyxevdbpbu",
  "db:snapshot": "node scripts/snapshot-db.mjs",
  "db:diff": "supabase db diff",
  "db:push": "supabase db push",
  "db:status": "supabase migration list"
}
```

**Catatan:** Supabase CLI required. Install via `brew install supabase/tap/supabase` or `scoop install supabase`.

**Acceptance:** `npm run db:types` regenerates types.ts. `npm run db:snapshot` produces SQL file in `./backups/`.

## 4A.3 Sentry sourcemaps upload

**File:** `package.json` + `vite.config.ts` (modify)

```bash
npm install --save-dev @sentry/vite-plugin
```

**vite.config.ts** (add plugin):
```ts
import { sentryVitePlugin } from '@sentry/vite-plugin';
plugins: [
  react(),
  mode === 'production' && sentryVitePlugin({
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    release: process.env.npm_package_version,
    sourcemaps: { assets: './dist/assets/**' },
  }),
].filter(Boolean)
```

**GitHub Secrets:** add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

**Acceptance:** Sentry stack traces show original TS source, not minified JS.

## 4A.4 CHANGELOG + version tracking

**File:** `CHANGELOG.md` (new, keep a changelog)

```markdown
# Changelog

## [Unreleased]

### Added
- Fase 3: Permission-based RBAC (31 permissions, has_permission RPC)
- Fase 3: Audit log immutability + correction RPC
- Fase 3: admin_export_audit_log RPC + election_audit_trail view
- Fase 2: 6-state election lifecycle with auto-transition via pg_cron
- Fase 2: election_eligibility_rules table
- Fase 1: Committee & Observer roles with per-election scoping

### Changed
- Hardened: Sentry, CSP, HSTS, Permissions-Policy
- DB: 25+ RPCs, 17 tables, 5 enums
```

## 4A.5 Update `docs/Update_September_2026.md`

Tambah section "Fase 0-3 Status" dengan:
- Daftar migration (Fase 1, 2, 3)
- Test count
- DB state
- Open issues

**Acceptance:** dokumen accurate, baru 1 page, ready for new dev to onboard.

---

# FASE 4B: Deploy Infrastructure (Minggu 1-2, hari 4-10)

> **Tujuan:** staging env + Vercel branches + custom domain + UptimeRobot.

## 4B.1 Create staging Supabase project

1. Login https://supabase.com/dashboard
2. New project: `UniVertex Staging` (region sama dengan prod: `us-east-1`, tier free/Pro)
3. Apply 17+ migrations via `psql` atau `supabase db push`:
   ```bash
   # Setelah link ke staging
   supabase db push --project-ref <staging-ref>
   ```
4. Seed minimum:
   - 1 admin user (via setup:admin script atau SQL console)
   - 1 class, 1 election draft
5. Set `VITE_APP_ENV=staging`

**Acceptance:** staging project live, accessible, has same schema as production.

## 4B.2 Vercel environment per branch

1. Vercel dashboard → Project → Settings → Environment Variables
2. Create 3 environments:
   - **Production** (branch: `main`):
     - `VITE_SUPABASE_URL` = production URL
     - `VITE_SUPABASE_ANON_KEY` = production anon
     - `VITE_SENTRY_DSN` = production Sentry
     - `VITE_APP_ENV=production`
   - **Preview** (all other branches):
     - `VITE_SUPABASE_URL` = staging URL
     - `VITE_SUPABASE_ANON_KEY` = staging anon
     - `VITE_SENTRY_DSN` = staging Sentry
     - `VITE_APP_ENV=staging`
3. Connect GitHub repo to Vercel (auto-detected via `vercel.json`)

**Acceptance:** setiap PR auto-deploy ke preview URL dengan env staging.

## 4B.3 GitHub Secrets (CI)

Settings → Secrets and variables → Actions:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SUPABASE_PROJECT_ID` (prod, untuk db:types job nanti)

**Acceptance:** CI workflow runs to completion including deploy-preview job.

## 4B.4 Custom domain

1. Beli domain (Namecheap, Cloudflare Registrar). Contoh: `vote.univertex.id` (jika extension .id tersedia, atau `.com`).
2. Vercel → Project → Settings → Domains → Add: `vote.univertex.id`
3. Vercel kasih CNAME/ALIAS. Tambah DNS record di registrar.
4. Propagasi 1-24 jam. Vercel auto-issue Let's Encrypt.
5. Verify: `https://www.ssllabs.com/ssltest/` → A/A+

**Acceptance:** domain live dengan HTTPS A+ score, HSTS preload enabled.

## 4B.5 Uptime monitoring

1. Daftar https://betterstack.com/uptime atau https://uptimerobot.com (free tier).
2. Add monitor: `https://vote.univertex.id/health` — GET setiap 5 menit.
3. Buat `/health` endpoint sederhana di Vercel (Edge Function atau static page).
4. Alert channel: email + WhatsApp via webhook.

**File:** `public/health.html` (static)
```html
<!DOCTYPE html><html><body>OK: <script>document.write(new Date().toISOString())</script></body></html>
```

**Acceptance:** alert terkirim ke WhatsApp/email dalam 5 menit setelah downtime.

---

# FASE 4C: UAT + Load Test + Security Audit (Minggu 2, hari 11-15)

> **Tujuan:** validasi sistem di bawah beban election-day, hardening final.

## 4C.1 UAT — User Acceptance Test

**Recruit 2-3 tester independen** (bukan developer):
- 1 orang扮演 admin
- 1 orang扮演 committee (BPM)
- 1 orang扮演 voter biasa

**Test scenarios** (jalankan di staging):

| # | Skenario | Expected | Tester |
|---|----------|----------|--------|
| 1 | Admin login → bisa akses semua menu admin | OK | admin tester |
| 2 | Admin create user baru via CreateUserDialog | user ada di list, no console error | admin |
| 3 | Admin invite user dengan intent=committee | user receive email, accept → role=committee | admin |
| 4 | Admin assign committee ke event | user bisa akses /committee | admin + committee |
| 5 | Committee login → lihat /committee | daftar elections muncul | committee |
| 6 | Committee klik election → lihat tally + form observation | form submit berhasil, observation tersimpan | committee |
| 7 | Voter login → lihat elections eligible di /app/dashboard | hanya elections di kelas voter | voter |
| 8 | Voter klik "Lihat Hasil" untuk election closed → tampil hasil | tally match | voter |
| 9 | Voter coba vote 2x di election sama | error 23505 / "sudah memilih" | voter |
| 10 | Test mobile (iPhone Safari, Android Chrome) | responsive OK | all |
| 11 | Test dark mode | kontras cukup | all |
| 12 | Admin export audit log via AuditExport page | JSON file download | admin |
| 13 | Admin correct audit entry (typo di description) | row updated dengan metadata.corrected_by | admin |
| 14 | Try direct DB UPDATE ke audit_log via Studio | blocked by trigger | admin |
| 15 | Auto-transition: set election start_time = now() + 1 menit, tunggu cron | status jadi 'voting' otomatis | admin |

**Acceptance:** semua 15 skenario passed, bugs dicatat di backlog.

## 4C.2 Load test

**Tool:** k6 (free, open source) atau Artillery.

**File:** `tests/load/election-day.js` (new)

```js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const votesCounter = new Counter('votes_cast');

export const options = {
  stages: [
    { duration: '5m', target: 100 },   // ramp-up
    { duration: '10m', target: 500 }, // peak
    { duration: '5m', target: 0 },    // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
  },
};

const BASE = __ENV.TARGET || 'https://staging.vote.univertex.id';
const ANON = __ENV.ANON_KEY;

export default function () {
  // 1. Public landing
  let res = http.get(`${BASE}/`);
  check(res, { 'landing 200': r => r.status === 200 });

  // 2. Login (mock 1 user per iteration)
  res = http.post(`${BASE}/auth/v1/token?grant_type=password`, JSON.stringify({
    email: `voter${__VU}@test.com`,
    password: 'test1234',
  }), {
    headers: {
      'apikey': ANON,
      'Content-Type': 'application/json',
    },
  });
  check(res, { 'login 200': r => r.status === 200 });
  const token = res.json('access_token');

  // 3. List events
  res = http.get(`${BASE}/rest/v1/election_events?status=eq.voting&limit=10`, {
    headers: { 'apikey': ANON, 'Authorization': `Bearer ${token}` },
  });
  check(res, { 'list 200': r => r.status === 200 });

  sleep(1);
}
```

**Run:**
```bash
npm install -g k6
k6 run tests/load/election-day.js
```

**Target SLOs:**
- p95 < 500ms
- p99 < 1000ms
- Error rate < 1%
- Vote insert throughput > 50/sec (Supabase free tier supports ~100 writes/sec)

**Acceptance:** SLOs met. Identify bottleneck (kemungkinan: RLS eval, cold start, Supabase free tier limits → upgrade to Pro).

## 4C.3 Security audit (OWASP ZAP)

```bash
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://staging.vote.univertex.id
```

**Acceptance:** 0 high-risk, ≤ 3 medium-risk. Document in `docs/SECURITY_AUDIT.md`.

## 4C.4 Penetration test manual (1 hour)

Coba sebagai attacker:
1. Coba akses `/admin/dashboard` tanpa login → redirect ke `/login` ✓
2. Coba akses `/admin/users` dengan anon token → 401 ✓
3. Coba `supabase.from('votes').insert({voter_id: '<other-user>', ...})` → RLS block ✓
4. Coba brute force login → rate limit (Supabase built-in) ✓
5. Cek exposed admin RPCs (admin_create_user etc) tanpa auth → 42501 ✓
6. Cek audit log immutability: direct DELETE via service_role → blocked by trigger (need bypass via SQL console, not REST) ✓

**Acceptance:** semua attack vectors blocked, documented.

---

# FASE 5: Pilot Production & Post-Launch (Minggu 3-4)

> **Tujuan:** jalankan election pertama di production dengan scope kecil.

## 5A.1 Pilih pilot event

**Kriteria pilot:**
- Scope kecil: 1 fakultas/departemen, **< 200 voter** (bukan 500 — kita reduce karena belum load test)
- Bukan election "penting" (misal: pemilihan coordinator himpunan, bukan ketua BEM universitas)
- Panitia kooperatif, available untuk briefing
- Jadwal: **2 minggu setelah Fase 4 selesai** (buffer untuk UAT fixes)

**Contoh:** "Pemilihan Koordinator Divisi Acara HMJ Informatika 2026" dengan 80 voter, 2 kandidat.

## 5A.2 Briefing & training (1 minggu sebelum)

- Admin training: kelola event, undang panitia, lihat audit log
- Committee training: dashboard monitoring, tambah observation
- Voter briefing: link, tutorial singkat, kontak helpdesk
- **Dokumentasi end-user (WAJIB):**
  - `docs/PANDUAN_ADMIN.md`
  - `docs/PANDUAN_PANITIA.md`
  - `docs/PANDUAN_VOTER.md`
  - `docs/PANDUAN_OBSERVER.md`

**Template PANDUAN_VOTER.md:**
```markdown
# Panduan Pemilih

## Cara Login
1. Buka https://vote.univertex.id/login
2. Masukkan email & password (diberikan saat akun dibuat)
3. Klik "Masuk"

## Cara Vote
1. Setelah login, Anda masuk ke dashboard
2. Lihat daftar pemilihan yang tersedia
3. Klik "Mulai Voting"
4. Pilih kandidat
5. Klik "Konfirmasi" (tidak bisa dibatalkan!)
6. Tunggu notifikasi "Suara Anda telah tercatat"
7. Logout jika sudah selesai

## Lupa Password
Klik "Lupa password" di halaman login, masukkan email, cek inbox.

## Bantuan
WhatsApp: +62xxx | Email: help@univertex.id
```

## 5A.3 H-1 preparation

- Verify env production pointing ke production DB (bukan staging)
- Seed pilot data: 1 admin, 1 committee, 1 observer, 80 voters, 2 kandidat, 1 event (status='voting')
- Snapshot DB pre-election (`npm run db:snapshot --tag=election-pilot-pre`)
- Aktifkan mode "monitoring ketat":
  - Sentry alert threshold rendah
  - On-call rotation (kalau ada)
  - Telegram/WhatsApp channel untuk alerts

## 5A.4 Hari H (election day)

- Voting window: 4-6 jam
- Real-time monitoring: Sentry dashboard + Vercel logs + Supabase logs
- Committee standby untuk handle voter issues via WhatsApp
- Help channel: WhatsApp group (admin + developer + committee)
- Incident response plan (per `docs/RUNBOOK.md`):
  - Error spike → Sentry alert → cek `last seen` migrations → rollback via Vercel
  - Downtime → Vercel status → supabase status
  - Critical bug → freeze voting, notify all, manual fix atau postpone

## 5A.5 Post-election (H+1 sampai H+7)

- Verifikasi tally final: `SELECT * FROM get_election_tally('<event_id>')` match export UI
- Export audit log (`admin_export_audit_log`) → save ke `docs/pilots/election-pilot-2026-09-21-audit.json`
- Snapshot DB post-election: `npm run db:snapshot --tag=election-pilot-post`
- Feedback session dengan committee + sample voters (3-5 orang)
- Catat semua issues ke `issues.log`
- Tutup event (status → 'archived' via `admin_transition_election_state`)

## 5A.6 Decision gate

Sebelum lanjut ke Fase 6 (full rollout):
- [ ] 0 insiden major (P0/P1)
- [ ] 90%+ positive feedback dari committee
- [ ] Tidak ada bug blocker dari feedback session
- [ ] Audit log lengkap (semua votes tercatat)
- [ ] Snapshot pre & post tersimpan

**If any fail:** iterate Fase 4 fixes, re-pilot dengan event lebih kecil.

---

# 5B: Post-Launch Operations (minggu 4+)

## Ongoing monitoring

| Kegiatan | Frekuensi | Owner |
|---|---|---|
| Cek Sentry error rate | Harian | Dev |
| Review audit log anomalies | Mingguan | Admin + Dev |
| Rotate Supabase anon key | Per 3 bulan | Dev |
| Backup test (PITR restore ke staging) | Per 3 bulan | Dev |
| Security review (dependensi update) | Per 3 bulan | Dev |
| Update kontak emergency | Per 3 bulan | Admin |

## Per-election-event checklist

Untuk setiap election setelah pilot:
- [ ] H-1: snapshot pre (`npm run db:snapshot --tag=election-NAME-pre`)
- [ ] H-1: briefing panitia, briefing voter (jika perlu)
- [ ] Hari H: monitoring ketat, on-call standby
- [ ] Hari H+1: export audit log ke `docs/elections/<NAME>-audit.json`
- [ ] Hari H+1: snapshot post (`--tag=election-NAME-post`)
- [ ] Hari H+7: archive event (`admin_transition_election_state(p_to_status='archived')`)
- [ ] Hari H+30: review feedback, file di `docs/elections/<NAME>-review.md`

## Incident response

Lihat `docs/RUNBOOK.md` §3. Severity levels P0-P3 dengan response time & eskalasi.

---

# Definisi Selesai per fase

## Fase 4 (Deployment & Hardening)
- [ ] CSP, HSTS, Permissions-Policy aktif, securityheaders.com A+
- [ ] Staging Supabase project live & ter-seed
- [ ] Vercel env per branch (prod vs preview)
- [ ] Custom domain dengan HTTPS A+
- [ ] Uptime monitoring aktif
- [ ] UAT passed (15 skenario)
- [ ] Load test: p95 < 500ms, error < 1%
- [ ] OWASP ZAP: 0 high risk
- [ ] npm scripts `db:types`, `db:snapshot`, `db:link` aktif
- [ ] Sentry sourcemaps uploaded
- [ ] CHANGELOG.md up-to-date
- [ ] docs/Update_September_2026.md updated

## Fase 5 (Pilot Production)
- [ ] End-user docs (PANDUAN_*) published
- [ ] Pilot event selesai tanpa P0/P1 insiden
- [ ] Feedback session dilakukan
- [ ] Backlog issues ter-update
- [ ] Decision: lanjut Fase 6 atau iterate
- [ ] Snapshot pre & post tersimpan untuk 1 tahun

## Definition of Done (Final Go-Live)

Aplikasi siap production-grade election ketika SEMUA ini terpenuhi:
- [ ] Semua 148+ tests passing, tsc 0 error, build success
- [ ] 1 pilot election sukses dengan < 200 voter
- [ ] 0 insiden P0/P1 dalam 4 minggu pasca-pilot
- [ ] Uptime > 99.5% selama pilot
- [ ] Documentation lengkap (PANDUAN_*, RUNBOOK, CHANGELOG)
- [ ] Monitoring aktif (Sentry + Uptime + cron jobs)
- [ ] Backup tested (PITR restore verified)
- [ ] Security audit passed (OWASP ZAP clean)
- [ ] Custom domain + HTTPS + A+ score

---

# Out of scope (defer ke iterasi berikutnya)

- **Multi-region deployment** (saat ini single region us-east-1)
- **Mobile app** (saat ini web only)
- **Anonymous voting / blind ballot** (privacy-fanatic elections)
- **Real-time push notifications** (saat ini email + sonner toast)
- **Multi-tenancy** (saat ini single-tenant)
- **Advanced analytics** (Pareto, turnout heatmap, etc.)
- **Ballot separation** (Fase 4 governance roadmap — di-defer lagi)
- **Org hierarchy** (organizations, organizational_positions — di-defer lagi)

---

# Rujukan

- **Roadmap governance**: `.kilo/plans/election-governance-roadmap.md` (Fase 0–3, done)
- **Production readiness** (sebelumnya): `.kilo/plans/production-readiness.md` (master plan)
- **Phase 3 plan**: `.kilo/plans/phase3-rbac-and-audit.md` (done)
- **Phase 2 plan**: `.kilo/plans/phase2-state-machine-and-scope.md` (done)
- **Runbook**: `docs/RUNBOOK.md` (backup, restore, incident)
- **Live DB**: `oiurjnmpkguyxevdbpbu` (UniVertex)
- **Deploy target**: Vercel (`vercel.json` ada, header akan di-enhance di 4A.1)
- **State**: 17 tables, 25+ RPCs, 5 enums, 31 permissions seeded, 148/148 tests

> **Pesan akhir:** Fase 4-5 bukan sprint terakhir — ini transisi dari "dev bagus" ke "production-grade election platform". Quality bar untuk election ≠ quality bar untuk SaaS biasa. **Bugs di election = erosion of public trust**. Invest 2-3 minggu ini sekarang lebih murah dari damage control setelah election gagal.
