# LIVE ELECTION RUNBOOK — UniVertex (P1 Pilot)

> Versi: 2026-11-22 (WIB) · Commit baseline: `0922ccb` · Status: **ENGINEERING GREEN, MANUAL GATES WAIVED OLEH OWNER, TANDA TANGAN GO/NO-GO PENDING**
> Dokumen ini satu pintu untuk pilot/event pemilihan mendatang. Sumber kebenaran teknis tetap
> `docs/P0-Golive-Readiness-Plan.md`, `CHANGELOG.md`, `docs/RUNBOOK.md`.
> **Aturan emas: satu gate merah = postpone. Jangan paksa live.**

---

## 1. Status saat ini ( ASEAN Jakarta, 22 Nov 2026 )

### 1.1 Engineering — HIJAU

| Item | Bukti | Status |
|---|---|---|
| Migrasi prod | 4 migrasi via MCP `apply_migration`: 3 sebelumnya + `requeue_failed_email_queue` → prod **66** migrasi; verifikasi fungsi memakai `DO UPDATE` + guard `failed/bounced` (bukan `DO NOTHING`) | ✅ |
| Search path R3 | prod & staging: 0 fungsi `proconfig IS NULL` (dari 7) | ✅ |
| Deploy prod | Vercel `READY`, target production, commit `0922ccb`, alias `www.univertex.site` / `univertex.site` | ✅ |
| Smoke bundle/RLS anon | fitur baru terdeteksi; tally open 1 baris; closed → 401; helper `true` | ✅ |
| CI | Run GitHub Actions **#30 sukses** untuk `0922ccb` (32 files / 210 tests); YAML valid; `next-themes` & `vaul` support React 19; lockfile Linux Node 20.19.5/npm 10.8.2; audit gate `critical`; `fileParallelism: false` | ✅ |
| Verifikasi lokal | `npm ci` (npm 10) sukses, `tsc --noEmit` 0, vitest 31/206 lalu 32/210, coverage lines 68,92%, build sukses, lint 0 error | ✅ |
| Email retry | staging `email.blast_batch` **4 terkirim / 0 gagal** (audit 2026-11-21 12:27 UTC); migrasi requeue kini ada di staging **dan** prod | ✅ |
| Fixture staging | 5 event `[P1-TEST]` + 10 akun `p1-*` + DPT/paslon/committee/observer | ✅ |
| E2E | 7/7 passed, 0 skip — `test-results/e2e-staging-20261121-final2.log` | ✅ |
| k6 smoke | 100 VU × 1 mnt, 9.032/9.032 checks, 0 error, p95 tally 256 ms | ✅ |
| Audit `vote.cast` | metadata hanya `{event_id}`, tanpa kandidat | ✅ |

Bukti lengkap: `docs/P1-Proddirect-Notes.md`, `CHANGELOG.md [P1 Pilot]`, `docs/completion-phases/04-tasklist.md`, GitHub Actions run #30.

### 1.2 Manual gate — 1 HIJAU, 7 DI-SKIP OLEH OWNER, 1 PENDING

| Kode | Gate | Status | Bukti / Catatan |
|---|---|---|---|
| M1 | Email 4 provider | ✅ HIJAU | User melaporkan 4 provider lolos; audit staging `email.blast_batch` 4 terkirim / 0 gagal. Bukti inbox (screenshot) belum dilampirkan ke repo — **user-attested**. |
| M2 | ZAP pasif staging | ⚠️ DI-SKIP | Instruksi owner 2026-11-22. Tidak ada laporan ZAP di repo. |
| M3 | UAT 15/15 | ⚠️ DI-SKIP | Instruksi owner 2026-11-22. Tidak ada form tanda tangan panitia. |
| M4 | Pentest 6 vektor | ⚠️ DI-SKIP | Instruksi owner 2026-11-22. Tidak ada laporan pentest. |
| M5 | Peraturan pemilihan SAH | ⚠️ DI-SKIP | Instruksi owner 2026-11-22. File `Peraturan-Pemilihan-BEM-Hukum-2026.md` ada (tanda tangan 2026-09-29), tapi tidak diperbarui untuk event baru. |
| M6 | Helpdesk H-H | ⚠️ DI-SKIP | Instruksi owner 2026-11-22. `SOP-Helpdesk-HariH.md` masih ber-PIC kosong (`__`). |
| M7 | Backup H-1 | ⚠️ DI-SKIP | Instruksi owner 2026-11-22. Snapshot pre-migrasi ada, tapi snapshot H-1 + hash + 2 lokasi belum ada bukti baru. |
| M8 | Auth dashboard | ⚠️ DI-SKIP | Instruksi owner 2026-11-22. `supabase-auth-redirects.md` terakhir diupdate 2026-09-29. |
| M9 | GO/NO-GO tertulis | ⬜ PENDING | Menunggu keputusan + tanda tangan ketua & IT. |

> **Peringatan kebijakan:** `docs/P0-Golive-Readiness-Plan.md:30-40` menyatakan satu gate merah
> = postpone. M2–M8 tidak "hijau", melainkan **WAIVED atas instruksi owner**. Sebelum live,
> cantumkan penerimaan risiko tertulis (siapa menyetujui, jam, alasan) di M9 — jangan
> mengubah status M2–M8 jadi ✅ tanpa bukti.
>
> MFA/CAPTCHA tetap **deferred** secara aplikasi (tidak ada UI enroll/widget). Jika M8 dilewati,
> catat sebagai risiko: admin/committee wajib pakai TOTP di akun masing-masing dan login/invite
> diawasi manual. Jangan klaim enforced di aplikasi.

---

## 2. Fakta lingkungan (jangan tertukar)

| Item | Production | Staging |
|---|---|---|
| Supabase ref | `oiurjnmpkguyxevdbpbu` | `koveroqhxphdiakvukxt` |
| URL | `https://oiurjnmpkguyxevdbpbu.supabase.co` | `https://koveroqhxphdiakvukxt.supabase.co` |
| Region | `ap-southeast-1` | `ap-northeast-1` |
| Vercel | `production` → `https://www.univertex.site` | `preview` / branch `staging` |
| Migrasi | 65 (via MCP, ada drift versi) | 66 (paritas + 3 terbaru) |
| Frontend | `main`, deploy otomatis Vercel | `staging` |

- GitHub: `haidar038/univertex`, team Vercel `m-khaidars-projects`, project `univertex`
  (`prj_ucovhbj9sSJuLma7vvGzlLtghz7o`).
- `.env` lokal = **staging**. Kredensial prod ada di `.env-prod.bak`. Jangan tercetak/commit.
- Jangan `supabase db push` ke prod: drift histori migrasi belum direkonsiliasi (P2).
  Prod hanya via MCP `apply_migration` + catat mapping versi.
- Event prod asli `95676965-a5c6-4f62-88bb-37ab9a57968b` **jangan dipakai untuk uji tulis**.

### Role & lifecycle

- 5 role: `admin`, `voter`, `candidate`, `committee`, `observer`.
- Status: `draft → registration → voting → counting → published → archived`.
- Transisi **hanya via RPC** `admin_transition_election_state(p_election_id, p_to_status, p_reason)`
  atau tombol `EventStatusDialog`. Jangan UPDATE `status` langsung.
- Map yang diizinkan (admin bisa override):
  `draft→registration|archived`, `registration→voting|draft|archived`,
  `voting→counting|draft|archived`, `counting→published|voting|archived`,
  `published→archived`, `archived` terminal.

---

## 3. Invariant yang tidak boleh dilanggar

1. `UNIQUE(voter_id, event_id)` + trigger `trg_enforce_vote_timeline` → `assert_event_is_votable`.
   - `23505` = sudah vote, `P0001` = di luar window/status, `42501` = non-DPT/unauthorized.
   - Frontend wajib membedakan ketiganya (`src/pages/app/VotingPage.tsx`).
2. `audit_log` append-only. Koreksi hanya via `admin_correct_audit_entry`. Jangan UPDATE/DELETE.
3. `vote.cast` metadata hanya `{event_id}` — jangan pernah memasukkan kandidat (anonimitas).
4. Tally hanya via 1 RPC `get_election_tally(p_event_id)`, bukan N+1 query per kandidat.
5. `public_live_count` = opt-in untuk anon saat `voting + open`. Event `closed + voting`
   **selalu 42501** untuk non-staff. `counting/published` publik via `public_results`.
6. Gunakan `src/lib/election-state.ts` untuk label/transisi UI, bukan literal lama `active/closed`.
7. Logger produksi: `src/lib/logger.ts` (filter PII). Dilarang `console.log` baru.

---

## 4. Roadmap implementasi H-14 → H+7

| Fase | Aksi | Verifikasi |
|---|---|---|
| **H-14** | Pull baseline, cek CI hijau, konfirmasi deploy prod `09d02d4`, isi PIC helpdesk, siapkan Peraturan | `git status` bersih; Vercel READY; SOP terisi |
| **H-7** | Gladi staging: E2E 7/7, RLS 6 kasus, k6 smoke, ZAP pasif, UAT awal | Log E2E + k6 + ZAP 0 High |
| **H-3** | Buat event produksi via UI, isi DPT/kandidat/paslon/panitia/observer → `registration` | SQL verifikasi §5.2 |
| **H-1** | Snapshot + hash + 2 lokasi, revoke test ≤5 mnt, tally vs votes, audit 24 jam, briefing, **GO/NO-GO** | Checklist §5.4 lengkap & ditandatangani |
| **H-0** | Transisi ke `voting` tepat jadwal, monitoring tiap 15–30 mnt, helpdesk standby | §5.5 |
| **Tutup** | Transisi `voting → counting`, verifikasi tally, `published` | §5.7 |
| **H+1** | Export audit, snapshot post, feedback, incident log | §5.8 |
| **H+7** | Archive event, cleanup fixture staging, tanda tangan akhir | §5.8 |

---

## 5. Runbook eksekusi

### 5.1 Preflight teknis (jalankan sebelum apa pun)

```powershell
git pull --ff-only
git status --short --branch
node -v            # CI: v20.19.5
npm ci             # lock final Linux/npm 10.8.2
npx tsc --noEmit
npm run test -- --run
npm run lint
npm run build
npm audit --audit-level=critical
npx playwright test --list
```

Verifikasi prod (SQL Editor, read-only — ganti `<EVENT_ID>`):

```sql
-- helper + flag event
select id, title, status, election_type, public_results, public_live_count,
       public.event_allows_public_tally(id) as anon_tally
from public.election_events where id = '<EVENT_ID>';

-- DPT & kandidat
select count(*) as dpt_group from public.event_voter_groups where event_id='<EVENT_ID>';
select id, status from public.candidates where event_id='<EVENT_ID>';

-- tally vs suara mentah
select * from public.get_election_tally('<EVENT_ID>');
select candidate_id, pair_id, count(*) from public.votes
 where event_id='<EVENT_ID>' group by 1,2;

-- audit terbaru
select action, created_at, metadata from public.audit_log
 order by created_at desc limit 20;
```

Cek deploy: Vercel project `univertex` → deployment production `READY` dengan SHA `main`
terbaru; alias `www.univertex.site` aktif. Smoke: GET `/login` → 200, bundle `assets/index-*.js` termuat.

### 5.2 Setup event produksi (via UI, bukan SQL langsung)

1. `/admin/events` → **Buat event**: judul, deskripsi, `start_time`/`end_time`, tipe
   (`open`/`closed`), `use_pairs`, `show_results_after_voting`, `public_results`,
   `public_live_count`.
   - Rekomendasi pilot: `open`, `public_live_count=true` bila ingin live count;
     `closed` → `show_results_after_voting` dipaksa false, `public_results=false` sampai publish.
2. Tab **DPT / Voter Groups** → pilih kelas yang eligible.
3. Tab **Kandidat** / **Paslon** → tambah → **Approve** semua yang sah.
4. Undang/assign **committee** & **observer** untuk event ini (`/admin/invitations`,
   `election_committees`, `election_observers`).
5. Status → `registration` via `EventStatusDialog`. Jangan lompat ke `voting` sebelum H-0.
6. Uji read-only sebagai voter DPT & non-DPT; pastikan banner benar.

Verifikasi assignment:

```sql
select 'committee' kind, user_id, committee_role::text from public.election_committees
 where election_id='<EVENT_ID>'
union all
select 'observer', user_id, null from public.election_observers
 where election_id='<EVENT_ID>';
```

### 5.3 Gladi & uji staging

Fixture staging (password lengkap di `docs/completion-phases/13-manual-ops-handbook.md`):

| Event | ID | Kegunaan |
|---|---|---|
| Voting Tunggal | `a1111111-1111-4111-8111-111111111111` | E2E voter, double-vote, non-DPT, committee/observer |
| Voting Paslon | `b2222222-2222-4222-8222-222222222222` | paslon + tally live |
| Counting Publik | `c3333333-3333-4333-8333-333333333333` | hasil publik + k6 tally |
| Voting Tertutup | `d4444444-4444-4444-8444-444444444444` | redaksi hasil (anon 401) |
| Arsip | `e5555555-5555-4555-8555-555555555555` | uji hapus |

Akun: `p1-admin`, `p1-voter`, `p1-voter2`, `p1-nondpt`, `p1-committee`, `p1-observer`,
`p1-candidate1..4` `@test.local`. Semua password grant terverifikasi.

E2E:

```powershell
npm run dev   # .env = STAGING
$env:BASE_URL='http://localhost:8080'
$env:TEST_EVENT_ID='a1111111-1111-4111-8111-111111111111'
$env:E2E_VOTER_EMAIL='p1-voter@test.local';      $env:E2E_VOTER_PASSWORD='P1Test!2026vtr'
$env:E2E_NON_DPT_EMAIL='p1-nondpt@test.local';   $env:E2E_NON_DPT_PASSWORD='P1Test!2026ndp'
$env:E2E_COMMITTEE_EMAIL='p1-committee@test.local'; $env:E2E_COMMITTEE_PASSWORD='P1Test!2026cmt'
$env:E2E_OBSERVER_EMAIL='p1-observer@test.local';   $env:E2E_OBSERVER_PASSWORD='P1Test!2026obs'
$env:E2E_ADMIN_EMAIL='p1-admin@test.local';         $env:E2E_ADMIN_PASSWORD='P1Test!2026adm'
npx playwright test
```

Reset sebelum rerun:

```sql
delete from public.election_observations
 where election_id='a1111111-1111-4111-8111-111111111111';
delete from public.votes
 where event_id='a1111111-1111-4111-8111-111111111111'
   and voter_id='6e01e5b3-7dec-4f51-bdb4-4354a94d988d';
```

k6 smoke read-only (jangan ke prod):

```powershell
$env:ANON_KEY='<anon-staging>'; $env:LANDING='0'
$env:TALLY_EVENT_ID='c3333333-3333-4333-8333-333333333333'
$env:VUS='100'; $env:DURATION='1m'
k6 run tests/load/staging-mixed.js
```

RLS 6 kasus minimal: anon open+`public_live_count` → allow; anon closed+voting → 401;
anon counting+`public_results` → allow; non-DPT insert vote → 42501; voter sah vote → sukses;
duplicate vote → 23505.

Cleanup fixture staging (urutan penting, audit dipertahankan):

```sql
-- lihat docs/P1-Manual-Testing-Runbook.md §4.3 untuk versi lengkap
delete from public.votes            where event_id in (select id from public.election_events where title like '[P1-TEST]%');
delete from public.election_observations where election_id in (select id from public.election_events where title like '[P1-TEST]%');
delete from public.election_state_transitions where election_id in (select id from public.election_events where title like '[P1-TEST]%');
delete from public.election_committees where election_id in (select id from public.election_events where title like '[P1-TEST]%');
delete from public.election_observers  where election_id in (select id from public.election_events where title like '[P1-TEST]%');
delete from public.candidates         where event_id in (select id from public.election_events where title like '[P1-TEST]%');
delete from public.event_voter_groups where event_id in (select id from public.election_events where title like '[P1-TEST]%');
delete from public.candidate_pairs    where event_id in (select id from public.election_events where title like '[P1-TEST]%');
delete from public.election_events    where title like '[P1-TEST]%';
-- residu harus 0 (kecuali audit_log, append-only by design)
```

### 5.4 Gate H-1 — GO / NO-GO

Salin tabel ini, centang hanya dengan bukti (screenshot/hash/log):

| # | Cek | Bukti | OK |
|---|---|---|---|
| 1 | `npm ci`, tsc, vitest 32/210, build, audit critical = 0 | CI run #30 | ☑ |
| 2 | Deploy prod SHA terbaru `0922ccb` `READY` + smoke bundle | Vercel | ☑ |
| 3 | Prod migrasi lengkap (66); 0 `search_path` mutable; requeue aktif | SQL | ☑ |
| 4 | M1 email 4 provider inbox | audit 4/0 + user-attested | ☑ |
| 5 | M2 ZAP pasif 0 High | — | ⚠️ WAIVED |
| 6 | M3 UAT 15/15 + tanda tangan | — | ⚠️ WAIVED |
| 7 | M4 pentest 6/6 | — | ⚠️ WAIVED |
| 8 | M5 Peraturan SAH | — | ⚠️ WAIVED |
| 9 | M6 helpdesk PIC + latihan 2/2 | — | ⚠️ WAIVED |
| 10 | M7 snapshot + hash + 2 lokasi + RTO | — | ⚠️ WAIVED |
| 11 | M8 dashboard auth terdokumentasi | — | ⚠️ WAIVED |
| 12 | Revoke 2-device ≤5 mnt | bukti 2026-09-28 (±3 mnt) | ☑ |
| 13 | Tally = jumlah votes; audit 24 jam wajar | SQL H-1 | ☐ |
| 14 | Sentry tidak ada error baru; kontak darurat valid | dashboard H-1 | ☐ |
| 15 | E2E 7/7 + k6 smoke staging | log | ☑ |

**Keputusan:** ☐ GO  ☐ NO-GO — Ketua: ______ IT: ______ Jam: ______

**Penerimaan risiko M2–M8:** saya __________ menyetujui pengecualian gate di atas pada __________ pukul ______, alasan: ______________________________. Tanda tangan: ______

> Tanpa penerimaan risiko tertulis di atas, kebijakan `P0-Golive-Readiness-Plan.md:30-40`
> tetap berlaku: gate merah = **NO-GO**. Jangan tandatangani GO hanya karena engineering hijau.

### 5.5 H-0 — Hari pemilihan

| Jam | Aksi | Verifikasi |
|---|---|---|
| T-60 mnt | Helpdesk standby, cek 2 ISP + tethering, buka `/admin/events`, konfirmasi event `registration` | SOP pos 1–3 terisi |
| T-15 mnt | Cek status/window/DPT/kandidat; test vote 1 akun internal lalu **hapus vote itu** via SQL | query §5.1 |
| T-0 | Transisi `registration → voting` via `EventStatusDialog` | `status='voting'` |
| T+15 mnt | Cek 3 voter nyata bisa vote; cek tally bertambah; cek audit `vote.cast` | tally + audit |
| Tiap 30 mnt | Cek jumlah votes, error Sentry, antrean helpdesk, `public_live_count` bila aktif | dashboard |
| Menjelang tutup | Umumkan 15 mnt lagi; pastikan tidak ada perpanjangan mendadak tanpa keputusan komite | WA + pengeras suara |
| Tutup | Transisi `voting → counting` (lihat §5.7) | `status='counting'` |

### 5.6 Incident playbook

| Gejala | Diagnosa | Aksi | Eskalasi |
|---|---|---|---|
| Voter tidak muncul di dashboard | cek `event_voter_groups` + `profiles.class_id` | Tambah kelas DPT via UI; jangan tambah vote manual | Pos 1 → admin |
| Vote ditolak `42501` | non-DPT / belum login / status bukan voting | Tunjukkan alasan; arahkan ke helpdesk; jangan hapus data | Pos 1 |
| Vote ditolak `P0001` | di luar window/status | Cek `start_time/end_time`; perpanjang via `EditEvent` + keputusan tertulis | Ketua + IT |
| "Sudah memilih" padahal merasa belum | cek `votes` + `audit_log` + `user_sessions` | Tunjukkan jam/device; ke Pos 3, **jangan hapus suara diam-diam** | Pos 3 |
| Email invite/reset tidak sampai | spam, rate-limit 30/jam | SOP §6: "Not spam" dulu → salin link manual → fallback `admin_update_password` | Pos 2 |
| Tally tidak cocok | `get_election_tally` vs `group by votes` | Cek event_id, status, pair vs candidate; jangan edit votes | IT on-call |
| Sesi tidak langsung keluar | `user_sessions.revoked_at` | Tunggu ≤5 mnt (JWT 1 jam), cek `AppBootstrap` | IT |
| Deploy rusak | Vercel deployment merah | Promote deployment `READY` sebelumnya di Vercel | IT |
| DB corrupt / salah hapus massal | lihat RUNBOOK §2 | PITR/snapshot ke project baru, jangan overwrite prod langsung | IT + Supabase |

Perpanjang waktu (contoh, masih `voting`, trigger mengizinkan update non-status):

```sql
update public.election_events
   set end_time = now() + interval '30 minutes'
 where id = '<EVENT_ID>' and status = 'voting';
```

### 5.7 Counting & publish

```sql
-- 1. pastikan tidak ada votes masuk setelah tutup
select count(*) from public.votes where event_id='<EVENT_ID>';
-- 2. tally final
select * from public.get_election_tally('<EVENT_ID>');
-- 3. transisi via RPC/UI: voting -> counting, lalu counting -> published
select public.admin_transition_election_state('<EVENT_ID>','counting','tutup pemilihan');
select public.admin_transition_election_state('<EVENT_ID>','published','tally disahkan panitia');
```

- `counting`: anon hanya lihat bila `public_results=true`.
- `published`: hasil final tampil; simpan bukti tally + tanda tangan panitia.
- Jangan pernah mengubah `votes` untuk "merapikan" hasil.

### 5.8 H+1 sampai H+7

1. Export audit (`/admin/audit-export`, filter `election_id`) ke JSON/CSV.
2. Snapshot DB post-election + hash SHA-256, simpan 1 tahun (audit requirement).
3. Verifikasi tally final = suara masuk; catat insiden; feedback komite + voter.
4. Transisi `published → archived` via RPC.
5. Cleanup fixture staging (§5.3); verifikasi residu 0; `audit_log` tetap ada.
6. Update `CHANGELOG.md [P1 Pilot]` → **Done + GO/NO-GO**, update
   `docs/completion-phases/04-tasklist.md`, arsipkan bukti ke `backups/`.

---

## 6. Rollback & recovery

| Skenario | RTO | Prosedur |
|---|---|---|
| 1 baris salah | < 5 mnt | UPDATE/INSERT targeted via SQL Editor; jangan restore |
| 1 tabel rusak | < 1 jam | PITR Supabase (RUNBOOK §2.2) |
| Full DB corruption | < 4 jam | restore snapshot ke project baru + swap (RUNBOOK §2.3b) |
| Supabase outage | < 24 jam | tunggu SLA, komunikasi via helpdesk |
| Frontend rusak | < 10 mnt | Vercel → promote deployment `READY` sebelumnya |

Rollback definisi `get_election_tally`: `backups/get_election_tally-before-20261120.sql`
(SHA256 `700A45DC…8E335`). Manifest pre-migrasi:
`backups/oiurjnmpkguyxevdbpbu-p1-premigrasi-20261120-manifest.json` (`55D0DABD…1965A`).
Drill restore terakhir: 2 mnt 3 dtk (2026-10-12).

---

## 7. Format laporan manual

Kirim ke agen/lead dengan format ini per item:

```
item: M1 | hasil: ok | bukti: 4 screenshot inbox, menit kirim→terima 1–3
item: M2 | hasil: gagal | bukti: laporan ZAP, 1 High di /login
```

Lampiran wajib: log E2E, ringkasan k6, hash snapshot, sign-off UAT, keputusan GO/NO-GO.

---

## 8. Referensi

- Gate & DoD: `docs/P0-Golive-Readiness-Plan.md:30-40`
- Backup/restore/insiden: `docs/RUNBOOK.md §0–§7`
- Manual B1–G3: `docs/completion-phases/13-manual-ops-handbook.md`
- E2E & cleanup: `docs/P1-Manual-Testing-Runbook.md`
- Auth/SMTP/MFA/redirect: `docs/supabase-auth-redirects.md`
- Helpdesk: `docs/SOP-Helpdesk-HariH.md`
- Panduan peran: `docs/PANDUAN_{ADMIN,PANITIA,VOTER,OBSERVER}.md`
- Peraturan: `docs/Peraturan-Pemilihan-BEM-Hukum-2026.md`
- Bukti eksekusi: `docs/P1-Proddirect-Notes.md`, `CHANGELOG.md`
- Status task: `docs/completion-phases/04-tasklist.md`
