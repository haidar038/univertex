# P1 — Handoff Staging (wajib sebelum E2E/k6/ZAP)

> **Status 2026-09-13:** staging BELUM ADA. Satu-satunya project di
> akun ini adalah **prod `oiurjnmpkguyxevdbpbu`** (`UniVertex`,
> `ap-southeast-1`, `ACTIVE_HEALTHY`, diverifikasi via MCP
> `list_projects` 2026-09-13).
> MCP di sesi ini TIDAK punya tool create-project / list-organizations
> mengembalikan `[]`, jadi pembuatan staging HARUS manual via dashboard.
> **E2E Playwright, k6, ZAP, UAT dilarang menyentuh prod — tunggu staging.**

## A. Buat project staging (dashboard Supabase, ±10 mnt)

1. https://supabase.com/dashboard → **New project**.
2. Name: `univertex-staging`. Organization: sama dengan prod.
3. Region: **`ap-southeast-1`** (sama dengan prod, menghindari latensi silang).
4. Catat **staging ref** (format `https://<staging-ref>.supabase.co`).
5. Ambil anon key: Project Settings → API (jangan commit ke repo).

## B. Push 50 migrasi ke staging (Supabase CLI di mesin yang ada CLI)

> Mesin sesi ini TIDAK punya Supabase CLI — jalankan di mesin/CI yang ada CLI.

```bash
supabase login
# JANGAN link ke prod oiurjnmpkguyxevdbpbu di langkah ini.
supabase link --project-ref <staging-ref>
supabase db push --dry-run   # harus hijau semua
supabase db push             # 50 migrasi (48 baseline + 2 P0)
```

Verifikasi via MCP di sesi berikutnya (`list_migrations(<staging-ref>)`):

- `20260913121150_enforce_eligibility_on_vote` ada.
- `20260913121201_session_revoke_check` ada.

Lalu `execute_sql` (read-only):

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('assert_event_is_votable', 'is_session_revoked')
order by 1, 2;
-- Harus 3 baris: assert_event_is_votable(uuid),
-- assert_event_is_votable(uuid,uuid), is_session_revoked(text).

select indexname from pg_indexes where schemaname = 'public'
  and indexname in ('idx_evg_event_class', 'idx_profiles_class', 'idx_rules_election')
order by 1;
-- Harus 3 baris.
```

## C. Vercel env split

- `production` (branch `main`) → URL + anon **PROD**.
- `preview` + branch `staging` → URL + anon **STAGING**.
- Mapping sudah didokumentasikan di `.env.example` + `docs/RUNBOOK.md §0`
  (tanpa secret).

## D. GitHub Secrets (CI deploy-preview)

`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`,
`STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`,
`STAGING_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

## E. Kembali ke sesi Cline dengan bukti

Tempel di chat (bukan secret — cukup ref + bukti):

1. Staging ref (mis. `abcdefghijklmnopqrst`).
2. Output `supabase db push` (hijau, 50 migrasi).
3. URL Vercel preview yang menunjuk staging.
4. Bukti PITR on + drill restore (mulai/selesai/durasi/RTO) bila sudah ada.

Sesi berikutnya lalu menjalankan (§prompt P1):

1. MCP `list_migrations` + `execute_sql` ke staging (fungsi + index).
2. P1-01 Playwright (7 skenario) → `npx playwright test` hijau + trace.
3. P1-02 k6 200-VU SLO + 1x 2000-stretch + `tests/load/README.md`.
4. P1-03 UAT 15/15 + ZAP (0 high) + pentest 6/6 + coverage CI + 4 PANDUAN_*
   + `vote.cast` audit (catatan: `vote.cast` SUDAH ada di
   `src/pages/app/VotingPage.tsx:185-192`, metadata hanya `event_id`).
