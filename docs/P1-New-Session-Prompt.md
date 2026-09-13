# Prompt P1 Pilot Readiness — UniVertex (copy ke New Session, Act mode)

> Dibuat 2026-09-13 sebagai handoff P0 → P1. Paste isi blok PROMPT ke new session.

## PROMPT (paste dari sini)

Kamu adalah Cline, AI coding agent. Kerjakan **P1 Pilot Readiness UniVertex**
sampai `CHANGELOG.md [P1 Pilot]` bisa ditandai Done + bukti uji.

### 0. Konteks awal (jangan dilewati)

- Repo: `c:\Users\BinaryVerse\Documents\Websites\univertex`, branch `main`,
  remote `https://github.com/haidar038/univertex.git`.
- P0 code DONE + migrasi P0-01/P0-03 SUDAH ter-push ke prod
  `oiurjnmpkguyxevdbpbu` (verifikasi 2026-09-13):
  `20260913121150_enforce_eligibility_on_vote` +
  `20260913121201_session_revoke_check` ada di `schema_migrations`;
  fungsi `assert_event_is_votable(uuid)`, `(uuid,uuid)`,
  `is_session_revoked(text)` + 3 index DPT ada.
- Commit terakhir: `c0c4000`. Total 50 file migrasi lokal.
  Baseline uji lokal: vitest 20 files / 155 tests, tsc 0 error, build sukses.
- Supabase CLI TIDAK ada di mesin ini — untuk DB gunakan MCP:
  `list_tables` / `list_migrations` / `execute_sql` (read-only) /
  `apply_migration` (DDL).
- DILARANG ubah skema `votes` (`voter_id`, `candidate_id/pair_id`,
  constraint `votes_voter_event_unique`, trigger `trg_enforce_vote_timeline`).
  Tetap di luar scope: redesign secrecy `ballots` (P2), hierarchy organisasi (P2).

### 1. Baseline wajib (30 mnt, buktikan output)

1. `git pull --ff-only`, `status --short --branch`, `log --oneline -5`.
2. Working tree dirty → `git stash` / commit selektif (jangan commit
   `test-sql.cjs`, `issues.log`, `issues/`, `.kilo/`, `docs/logs`).
3. MCP `list_migrations(oiurjnmpkguyxevdbpbu)` — pastikan 2 migrasi P0 ada.
   `execute_sql`: cek 3 fungsi + 3 index (query di `CHANGELOG.md [P0 Go-Live]`).
4. `npm run test -- --run` (155/155), `npx tsc --noEmit` (0 error),
   `npm run build` (sukses). Catat durasi sebagai bukti.
5. Tutup sisa gate P0 `[ ]` di CHANGELOG (T2 42501, drill restore staging,
   H1 revoke ≤5 mnt, H5 email 4 provider, dashboard Auth/SMTP, Peraturan panitia).
   Aturan: **satu gate P0 merah → POSTPONE pilot. P1 hanya boleh jalan di
   staging, bukan alasan pilot di prod.**


### 2. Scope P1 (P1-01 → P1-02 → P1-03)

**P1-01 — E2E Playwright penuh (prioritas tertinggi).**
Alasan: `docs/Test_Strategy_Verifikasi.md §4` — mock Vitest tidak bisa
verifikasi RLS/trigger/email/multi-device. Acuan:
`.kilo/plans/phase4-5-deployment-and-production.md §4C.1` (15 skenario UAT) +
`Test_Strategy §5` (gap 5-6 happy-path). Minimal hijau di staging:
1. voter login → dashboard hanya event eligible → vote → toast sukses →
   banner sudah-vote → vote ke-2 ditolak 23505;
2. non-DPT buka `/app/vote/:id` → banner DPT + tombol disabled; insert via
   API ditolak 42501 (regresi P0-01);
3. timeline: status draft/registration/counting/published/archived tampil
   banner benar; vote luar window ditolak P0001;
4. committee login → `/committee` → tally + submit observation tersimpan;
5. observer login → `/observer` read-only (tanpa tombol aksi);
6. admin export audit (`AuditExport` → JSON) + revoke via `/admin/sessions`
   → user logout ≤5 mnt (regresi P0-03 H1);
7. invite committee/observer → accept → role + baris tabel benar.
Setup: install `@playwright/test`, `playwright.config.ts` (baseURL staging,
1 worker lokal, trace on-failure), `tests/e2e/*.spec.ts`, script `test:e2e`,
seed staging via RPC (jangan seed prod).
Bukti: `npx playwright test` hijau + trace/video.

**P1-02 — k6 load test (staging SAJA, dilarang sentuh prod).**
Acuan: `phase4-5 §4C.2` (`tests/load/election-day.js`,
stages 5m→100 / 10m→500 / 5m→0, threshold p95<500ms, p99<1000ms,
errors<1%, vote >50/sec). Skala: (a) **200 VU wajib lolos SLO**
(≈ pilot <200 voter); (b) **stretch 2000-user 1x run singkat** cukup untuk
tahu bottleneck (RLS eval, cold start, tier) — jika gagal catat bottleneck +
rekomendasi (upgrade Pro / index / cache), bukan kejar lolos.
File: `tests/load/election-day.js` + `tests/load/README.md`
(env TARGET/ANON_KEY, cara run, interpretasi hasil).
Bukti: ringkasan k6 (p95/p99, error, throughput) di PR + CHANGELOG.

**P1-03 — UAT + Security + Docs + Coverage (penutup gate pilot).**
- UAT 15 skenario §4C.1 di staging oleh 2-3 tester independen
  (admin/committee/voter), termasuk mobile (Safari iPhone, Chrome Android) +
  dark mode + auto-transition cron (`start_time = now()+1 mnt` → voting).
- Security: `zap-baseline.py -t <staging>` syarat **0 high, ≤3 medium** →
  `docs/SECURITY_AUDIT.md`; pentest manual 1 jam §4C.4 (6 vektor: /admin/*
  tanpa login, anon ke /admin/users, insert vote user lain, brute-force
  rate-limit, RPC admin tanpa auth → 42501, DELETE audit_log diblokir).
- Coverage: tambah `@vitest/coverage-v8` + threshold di CI
  (target awal ≥70% lines untuk `src/lib`, `src/hooks`, VotingPage, sessions).
- Docs end-user WAJIB: `docs/PANDUAN_ADMIN.md`, `PANDUAN_PANITIA.md`,
  `PANDUAN_VOTER.md`, `PANDUAN_OBSERVER.md`
  (template di `phase4-5 §5A.2`).
- Audit: tambah `logAudit vote.cast` di VotingPage sukses
  (metadata `event_id` saja, TANPA candidate — jaga anonimitas).

### 3. Aturan kerja

- Ikuti konvensi kode yang ada; hanya pakai lib yang sudah dipakai
  (cek `package.json`); dilarang redesign votes/ballots/hierarchy.
- DDL via `apply_migration` (snake_case, 1 tujuan per file); baca via `execute_sql`.
- Setiap edit/test dibuktikan: vitest file terkait → full suite → tsc →
  build bila sentuh UI. Jangan klaim hijau tanpa output.
- Jangan commit secret (anon key, SMTP pass, service_role).
  Staging ref + hash backup cukup sebagai bukti, bukan isi dump.
- Update CHANGELOG: tambah `## [P1 Pilot] — Planned/Done` + bukti
  (trace E2E, ringkasan k6, ZAP report, UAT sign-off) + Gate pilot final.
  Update `docs/P0-Golive-Readiness-Plan.md §3` bila lolos.

### 4. Definition of Done (semua hijau)

- [ ] Baseline §1 hijau + sisa gate P0 tertutup / ditunda eksplisit.
- [ ] P1-01: `npx playwright test` hijau di staging (7 skenario) + trace.
- [ ] P1-02: k6 200-VU lolos SLO + 1x run 2000-stretch + `tests/load/README.md`.
- [ ] P1-03: UAT 15/15 + ZAP (0 high) + pentest 6/6 blocked + coverage CI +
      4 PANDUAN_* + `vote.cast` audit.
- [ ] vitest hijau, tsc 0 error, build sukses, CHANGELOG [P1 Pilot] Done + Gate Go.
- Satu DoD merah → laporkan NO-GO + backlog, jangan paksa pilot.

Mulai dari §1 sekarang, tunjukkan planning + tool calls di tiap respons.

## (akhir PROMPT)

