# Manual Testing Runbook — P1 Prod-Direct (kerjakan ANDA sendiri)

> **Untuk:** 3 blokker sisa P1 (event `[P1-TEST]` → snapshot pre → `npm test:e2e`).
> **Env:** Windows PowerShell + browser. Supabase dashboard project
> `oiurjnmpkguyxevdbpbu`. Repo `c:\Users\BinaryVerse\Documents\Websites\univertex`.
> **Jangan sentuh:** event asli `95676965-a5c6-4f62-88bb-37ab9a57968b`
> (`Pemilihan BEM Fakultas Hukum 2026`).

---

## Fase 0 — Precheck (5 mnt)

1. Login ke **Supabase dashboard** → project **UniVertex** (`oiurjnmpkguyxevdbpbu`)
   → SQL Editor (siap untuk Fase 4) + Settings (anon key bila butuh Fase 4.2).
2. Buka app prod (Vercel), login dengan **akun admin yang TERDAFTAR**.
   *(Prod kini: 2 admin, 5 voter, 1 candidate, 1 committee, 1 observer — cek `/admin/users`.)*
3. Terminall PowerShell di root repo:
   ```powershell
   git status --short --branch     # cek: main
   npm --version && node --version
   ```
4. `.env` lokal harus menunjuk PROD (saat `npm run dev` di Fase 3 pakai prod DB):
   ```powershell
   Select-String -Path .env -Pattern 'VITE_SUPABASE_URL' | Select-Object -First 1
   # Harus: ...oiurjnmpkguyxevdbpbu.supabase.co
   ```

---

## Fase 1 — Event isolasi `[P1-TEST]` + akun sintetis (via UI admin, ±20 mnt)

> **Kenapa UI bukan SQL editor:** RPC `admin_create_user`, `admin_transition_election_state`,
> `admin_assign_committee/observer` guard `caller_has_permission` (require `auth.uid()`); dari
> SQL editor (`auth.uid() = NULL`) → `42501`. Setup WAJIB via web app sebagai admin sungguhan.

### 1.1 Kelas baru
`/admin/classes` → **Buat Kelas** → Nama `P1 TEST Kelas`, Fakultas `P1 TEST` → Simpan.

### 1.2 Lima akun sintetis (`/admin/users` → **Tambah User**)
| Email | Full Name | NIM | Kelas | Roles | Pass (min 8) |
|---|---|---|---|---|---|
| `p1-voter@test.local` | P1 Voter | `P1-000-VTR` | **P1 TEST Kelas** | Pemilih | `P1Test!2026vtr` |
| `p1-nondpt@test.local` | P1 NonDPT | `P1-000-NDP` | **Teknik Informatika 2021** (TIDAK dilink) | Pemilih | `P1Test!2026ndp` |
| `p1-committee@test.local` | P1 Committee | `P1-000-CMT` | (kosong) | Pemilih | `P1Test!2026cmt` |
| `p1-observer@test.local` | P1 Observer | `P1-000-OBS` | (kosong) | Pemilih | `P1Test!2026obs` |
| `p1-candidate@test.local` | P1 Kandidat | `P1-000-CND` | **P1 TEST Kelas** | **Kandidat** | `P1Test!2026cnd` |

Toggle **"Konfirmasi email otomatis" ON** → **Buat Pengguna** ×5.
*(Admin di Fase 3 = akun admin lama Anda — sudah ada.)*

### 1.3 Event
`/admin/events` → **Buat Acara**:
- Judul: `[P1-TEST] Pilot Readiness`
- Status: **Draft** (JANGAN voting langsung — transisi via Ubah Status)
- Mulai: hari ini − 5 menit; Selesai: hari ini + 3 jam
- Type `closed`, hasil setelah voting OFF, Scope kosong
- **Buat Acara** → EventDetail → **kopi UUID dari URL** `/admin/events/<UUID>` → `EVENT_ID`.

### 1.4 Kandidat (≈ status approved)
EventDetail → **Tambah Kandidat** → `P1 Kandidat - P1-000-CND` → Visi
`Visi P1 TEST minimal 10 karakter.` / Misi `Misi P1 TEST minimal 10 karakter.` →
Tambah → **Approve** (disetujui) → status `approved`.

### 1.5 DPT
EventDetail → **Grup Pemilih** → check **`P1 TEST Kelas`** → **Simpan Perubahan**.

### 1.6 Status → Voting (state machine)
EventDetail → **Ubah Status** → **Pendaftaran** → **Ubah Status** → **Voting**.
*(Dialog menguard Voting bila belum ada kandidat+DPT — verifi 1.4+1.5 selesai.)*

### 1.7 Staff
`/admin/events/<EVENT_ID>/staff` → Panitia: email `p1-committee@test.local`, role
**Anggota** → Tambah. Observer: email `p1-observer@test.local` → Tambah.
*(Auto `user_roles` committee/observer + baris election_committees/observers.)*

### 1.8 Preflight manual (bukti UAT partial)
- **p1-voter** login → dashboard tampil `[P1-TEST]` → `/app/vote/<EVENT_ID>` → kandidat +
  tombol "Konfirmasi Pilihan" aktif.
- **p1-nondpt** login → `/app/vote/<EVENT_ID>` → banner *"Anda tidak termasuk dalam Daftar
  Pemilih Tetap (DPT)"* + tombol aksi disabled.
- **p1-committee** login → `/committee` card event test → `/committee/election/<EVENT_ID>` tally.
- **p1-observer** login → `/observer` read-only.
- **admin** login → `/admin/audit-export` + `/admin/sessions` render utan error.
- Catat pass/fail + screenshot.

> **Done Fase 1** ↔ semua 1.8 pas. `EVENT_ID` siap untuk Fase 3.

---

## Fase 2 — Snapshot pre (hash + 2 lokasi, ±10 mnt)

### 2.1 Install Supabase CLI (sekali saja, Windows)
```powershell
scoop install supabase     # atau: winget install supabase.cli
supabase --version
```

### 2.2 Login + link prod (JANGAN link project lain)
```powershell
supabase login
supabase link --project-ref oiurjnmpkguyxevdbpbu   # prompt DB password dari dashboard
```

### 2.3 Snapshot + hash
```powershell
node scripts/snapshot-db.mjs --project=oiurjnmpkguyxevdbpbu --tag=p1-pre
# -> backups\oiurjnmpkguyxevdbpbu-p1-pre-<timestamp>.sql

Get-FileHash .\backups\oiurjnmpkguyxevdbpbu-p1-pre-*.sql -Algorithm SHA256

# Kompresi (jangan .sql plain):
tar -a -c -f .\backups\oiurjnmpkguyxevdbpbu-p1-pre-<timestamp>.sql.tar.gz `
         .\backups\oiurjnmpkguyxevdbpbu-p1-pre-<timestamp>.sql
```

### 2.4 Simpan
1. Lokasi 1: Google Drive / bucket privado.
2. Lokasi 2: lokal terenkripsi (BitLocker/VeraCrypt).
Catat di `docs/P1-Proddirect-Notes.md`: `p1-pre: <tanggal> <hash> <lokasi1> <lokasi2>`.

> **Fallback tanpa CLI (opsional):** dashboard → Settings → Database → Connection string
> (URI/pooler). Lalu:
> `pg_dump "postgresql://postgres.<ref>:<DBPASS>@<pooler-host>:6543/postgres" -f p1-pre.sql --no-owner --no-privileges`
> Hash dengan Get-FileHash seperti di atas.

---

## Fase 3 — `npm test:e2e` (±10 mnt)

### 3.1 Terminal A — dev server (pakai .env prod)
```powershell
npm run dev
# Tunggu sampai:  "Local: http://localhost:8080"
```

### 3.2 Terminal B — env + run
```powershell
$env:BASE_URL               = 'http://localhost:8080'
$env:TEST_EVENT_ID          = '<EVENT_ID-uuid>'
$env:E2E_VOTER_EMAIL        = 'p1-voter@test.local'
$env:E2E_VOTER_PASSWORD     = 'P1Test!2026vtr'
$env:E2E_NON_DPT_EMAIL      = 'p1-nondpt@test.local'
$env:E2E_NON_DPT_PASSWORD   = 'P1Test!2026ndp'
$env:E2E_COMMITTEE_EMAIL    = 'p1-committee@test.local'
$env:E2E_COMMITTEE_PASSWORD = 'P1Test!2026cmt'
$env:E2E_OBSERVER_EMAIL     = 'p1-observer@test.local'
$env:E2E_OBSERVER_PASSWORD  = 'P1Test!2026obs'
$env:E2E_ADMIN_EMAIL        = '<email-admin-lama-Anda>'
$env:E2E_ADMIN_PASSWORD     = '<password-admin-lama-Anda>'

npm test:e2e                 # alias: npx playwright test
```

### 3.3 Hasil ekspektasi (7 tests, nol skip)
| # | Skenario | Pas bila |
|---|----------|----------|
| 1 | voter vote → toast sukses → banner sudah-vote → dup 23505 | toast + vote row di DB (Fase 4.1) |
| 2 | non-DPT → banner DPT + tombol disabled | banner DPT, tanpa aksi |
| 3 | timeline banner sesuai status | banner status `[P1-TEST]` (voting) |
| 4 | committee tally + observation | observasi tersimpan (Fase 4.1) |
| 5 | observer read-only | /observer tanpa tombol aksi |
| 6 | admin export audit + sessions | Hasil(n baris…) + "Manajemen Sesi" |
| 7 | invite page render | /admin/invitations render utan error |

Bukti otomatis di:
- `test-results/` (video + error-context bila fail)
- `playwright-report/` (HTML; buka `npx playwright show-report`)

**Troubleshooting ringan:**
- Login admin gagal → akun admin Anda memakai MFA? Gunakan admin tanpa MFA untuk E2E.
- Test 1 tidak vote (banner "belum dimulai/sudah berakhir") → window event test habis →
  EditEvent → selesai +3 uur lagi.
- Test 4/5 assignment kosong → ulangi Fase 1.7 di web app.
- Rerun satu file: `npx playwright test tests/e2e/vote.spec.ts`

---

## Fase 4 — Verifikasi + cleanup (dashboard SQL Editor, ±10 mnt)

### 4.1 Verifikasi hasil (read-only)
```sql
-- vote dari test 1 (harus 1 baris):
select v.id, v.candidate_id, e.title
from public.votes v join public.election_events e on e.id = v.event_id
where e.title like '[P1-TEST]%';

-- observasi committee test 4 (harus >= 1):
select count(*) from public.election_observations o
join public.election_events e on e.id = o.election_id
where e.title like '[P1-TEST]%';

-- audit vote.cast (harus ada, metadata tanpa candidate):
select action, description, metadata from public.audit_log
where action = 'vote.cast' order by created_at desc limit 5;
```

### 4.2 (Opsional, regresi P0-01 T2) insert non-DPT via API → 42501
Login p1-nondpt (`/auth/v1/token`), lalu:
```powershell
curl -X POST "https://oiurjnmpkguyxevdbpbu.supabase.co/rest/v1/votes" ^
  -H "apikey: $env:ANON_KEY" -H "Authorization: Bearer $env:NONDPT_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"voter_id\":\"<uid-p1-nondpt>\",\"candidate_id\":\"<candidate-id>\",\"event_id\":\"<EVENT_ID>\"}"
# Ekspektasi: 42501 (non-DPT ditolak). ANON_KEY = secret, JANGAN commit.
```

### 4.3 Cleanup (postgres) — urutan penting
```sql
-- 1. event id
select id from public.election_events where title like '[P1-TEST]%';   -- EVENT_ID

-- 2. votes test
delete from public.votes where event_id = '<EVENT_ID>';
-- 3. observations test
delete from public.election_observations where election_id = '<EVENT_ID>';
-- 4. state transitions, committees, observers
delete from public.election_state_transitions where election_id = '<EVENT_ID>';
delete from public.election_committees        where election_id = '<EVENT_ID>';
delete from public.election_observers         where election_id = '<EVENT_ID>';
-- 5. candidate + DPT link
delete from public.candidates         where event_id = '<EVENT_ID>';
delete from public.event_voter_groups where event_id = '<EVENT_ID>';
-- 6. event
delete from public.election_events where id = '<EVENT_ID>';
-- 7. users test (roles -> sessions -> profiles -> auth)
delete from public.user_roles   where user_id in (select id from auth.users where email like 'p1-%@test.local');
delete from public.user_sessions where user_id in (select id from auth.users where email like 'p1-%@test.local');
delete from public.profiles      where id in (select id from auth.users where email like 'p1-%@test.local');
delete from auth.users where email like 'p1-%@test.local';
-- 8. kelas test
delete from public.classes where name = 'P1 TEST Kelas';
```

### 4.4 Verifikasi residu (harus semua 0)
```sql
select
 (select count(*) from public.election_events where title like '[P1-TEST]%') as ev,
 (select count(*) from public.votes where event_id in
    (select id from public.election_events where title like '[P1-TEST]%')) as votes,
 (select count(*) from public.election_observations where election_id in
    (select id from public.election_events where title like '[P1-TEST]%')) as obs,
 (select count(*) from auth.users where email like 'p1-%@test.local') as users;
```
> **Audit_log tetap dipertahankan** (append-only by design) — entry `user.create`/`vote.cast`
> test tetap ada; itu EKSPEKTASI (immutability), bukan residu data.

### 4.5 Optional — snapshot post + hash (bukti no-diff)
```powershell
node scripts/snapshot-db.mjs --project=oiurjnmpkguyxevdbpbu --tag=p1-post
Get-FileHash .\backups\oiurjnmpkguyxevdbpbu-p1-post-*.sql -Algorithm SHA256
```

---

## Fase 5 — Kembali ke sesi Cline dengan bukti
Tempel di chat:
1. Output `npm test:e2e` (7 tests) + path `playwright-report/index.html`.
2. Hasil 4.1 (count vote=1, obs>=1, audit vote.cast).
3. Hash p1-pre (+ p1-post bila Fase 4.5).
4. Konfirmasi cleanup 4.4 = 0 semua.

Sesi lalu: update `CHANGELOG.md [P1 Pilot]` → Done + Gate Go (bila semua hijau),
atau NO-GO + backlog (bila ada yang merah).