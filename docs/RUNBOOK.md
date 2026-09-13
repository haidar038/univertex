# Runbook: Backup, Restore & Incident Response

> **Tujuan:** jika terjadi insiden (data corruption, tidak sengaja terhapus, bug deployment), tim tahu langkah recovery yang harus diambil.
> **Audience:** admin teknis & developer on-call.
> **Refresh:** review runbook ini setiap 3 bulan.

---

## 0. Environment

> **P0-02 (2026-09-13):** staging dipisah. Prod tetap `oiurjnmpkguyxevdbpbu`;
> staging = project `univertex-staging` (ref diisi setelah dibuat di dashboard).
> Vercel: `production` → URL+anon PROD; `preview`/branch `staging` → URL+anon STAGING
> (lihat `.env.example`). Sebelum `db push`, selalu `supabase migration list` +
> cek `--project-ref` agar tidak tertukar.

| Env | Supabase Project | URL |
|---|---|---|
| Production | UniVertex (prod) | `https://oiurjnmpkguyxevdbpbu.supabase.co` |
| Staging | univertex-staging | `https://<staging-ref>.supabase.co` (isi setelah P0-02 infra) |

---

## 1. Backup strategy

### 1.1 Otomatis (Supabase managed)

- **Point-in-Time Recovery (PITR)** — aktif di project Supabase. Settings → Database → Point in time → Enable.
  - Retensi default: 7 hari (Pro plan) atau 28 hari (Team/Enterprise).
  - Cara aktifkan:
    1. Login ke Supabase Dashboard
    2. Pilih project (prod / staging)
    3. Settings → Database
    4. Di bagian "Point in time", klik **Enable**
    5. Confirm
- **Daily backup** — included di PITR.

### 1.2 Manual snapshot (pre-election)

Sebelum election day, **selalu** ambil snapshot manual sebagai jaring pengaman tambahan:

```bash
# Install Supabase CLI (sekali)
brew install supabase/tap/supabase   # macOS
# atau
scoop install supabase               # Windows

# Login
supabase login

# Link project (sekali)
supabase link --project-ref oiurjnmpkguyxevdbpbu

# Dump schema + data ke file lokal
supabase db dump --schema public -f backup-pre-election-2026-09-07.sql

# Upload ke secure storage (S3 / Google Drive / etc.)
```

**Kapan snapshot manual wajib diambil:**
- 1 jam sebelum election dibuka (H-1)
- Setelah bulk import users
- Setelah migration baru di-apply ke production
- Setelah perubahan konfigurasi besar (RLS, RPC)

### 1.3 Snapshot retention

- Snapshot manual disimpan minimal 30 hari
- Snapshot election day disimpan **1 tahun** (audit requirement)
- Compress sebelum archive: `gzip backup-pre-election-*.sql`

---

## 2. Restore procedure

### 2.1 Kapan restore dibutuhkan

| Situasi | Aksi |
|---|---|
| 1-2 baris terhapus/admin salah edit | Jangan restore. Pakai UPDATE/INSERT manual via SQL editor (lebih cepat & targeted) |
| 1 tabel ter-corruption / data integritas rusak | PITR ke point sebelum masalah |
| Mayor disaster (DB kena hack / schema migration salah apply) | Snapshot manual restore ke project baru, lalu swap connection |
| Voter protes tidak bisa login | Jangan restore; troubleshoot individual |

### 2.2 Restore via PITR (point-in-time)

Cocok untuk: beberapa menit/jam sebelum masalah.

1. Login ke Supabase Dashboard
2. Pilih project
3. Database → Backups → Point in time
4. Pilih timestamp target
5. Klik "Restore" → project akan rollback ke state saat timestamp tersebut
6. **Warning**: semua data setelah timestamp akan **hilang**
7. Konfirmasi ke stakeholder dulu jika ini production

### 2.3 Restore via snapshot manual

Cocok untuk: restore ke project terpisah, atau untuk data besar.

```bash
# Restore ke project baru (disarankan, jangan overwrite prod langsung)
supabase link --project-ref <new-project-ref>
supabase db reset --linked
psql "$(supabase db remote get-uri)" < backup-pre-election-2026-09-07.sql
```

Atau via Supabase Studio:
1. SQL Editor → New query
2. Copy-paste isi file `.sql`
3. Run per chunk (tergantung ukuran)

### 2.4 Verifikasi setelah restore

Checklist WAJIB dijalankan:

- [ ] `SELECT COUNT(*) FROM public.profiles` — bandingkan dengan angka sebelum restore
- [ ] `SELECT COUNT(*) FROM public.election_events` — sama
- [ ] `SELECT COUNT(*) FROM public.votes` — krusial untuk integritas election
- [ ] `SELECT COUNT(*) FROM public.audit_log` — audit trail lengkap
- [ ] `SELECT id, status FROM public.election_events` — semua event dalam status benar
- [ ] Test login 1-2 user (admin + voter)
- [ ] Test 1 voting flow end-to-end (di staging dulu, tidak di prod)

---

## 3. Incident response

### 3.1 Severity levels

| Level | Contoh | Response time | Eskalasi |
|---|---|---|---|
| P0 (Critical) | Election tidak bisa diakses, vote corruption, data breach | < 15 menit | Semua hands + stakeholders |
| P1 (High) | Fitur utama rusak, sebagian voter terpengaruh | < 1 jam | Developer on-call |
| P2 (Medium) | Bug minor, ada workaround | < 4 jam | Next workday |
| P3 (Low) | Polish, typo, performance | Backlog | - |

### 3.2 Contact list (template)

Isi dengan kontak aktual sebelum go-live:

| Peran | Nama | Telepon | Email |
|---|---|---|---|
| Developer on-call | (isi) | (isi) | (isi) |
| Database admin | (isi) | (isi) | (isi) |
| Product owner | (isi) | (isi) | (isi) |
| Komite election (saat election) | (isi) | (isi) | (isi) |

### 3.3 Communication template

Saat election day incident:

```
[SEVERITY] [INCIDENT ID] [WAKTU]

Yang terjadi:
- (deskripsi singkat)

Dampak:
- (berapa voter/committee/admin terdampak)

Aksi yang sedang dilakukan:
- (langkah recovery)

ETA resolution:
- (estimasi waktu)

Kontak: (PIC on-call)
```

Distribusikan ke:
- Channel internal (Slack/Discord)
- Komite election (jika election aktif)
- Admin (jika butuh reset user)

### 3.4 Common incidents

#### Sentry alert: error rate spike
1. Cek Sentry → Issues → cek apakah satu error atau banyak
2. Jika 1 error dominan: cek commit terakhir, rollback jika perlu
3. Jika banyak: kemungkinan infrastructure issue, cek Vercel + Supabase status pages

#### "Voter tidak bisa vote"
1. Reproduce dengan akun sendiri
2. Cek: event status, time window, eligibility (event_voter_groups), RLS
3. Cek Sentry untuk error dari browser voter

#### "Tally tidak muncul"
1. Cek: election status, public_results flag, get_election_tally guard
2. Test RPC manual di SQL editor: `SELECT * FROM get_election_tally('<event-id>')`
3. Cek RLS: voter tidak bisa SELECT all votes (hanya own + admin)

#### "Admin tidak bisa login"
1. Cek: profile row ada? user_roles row ada?
2. SQL: `SELECT * FROM auth.users WHERE email = '<email>'`
3. SQL: `SELECT * FROM public.profiles WHERE id = '<uid>'`
4. SQL: `SELECT * FROM public.user_roles WHERE user_id = '<uid>'`
5. Fix missing rows, atau reset password via Supabase Dashboard

---

## 4. Pre-election checklist (H-1)

Wajib dijalankan 1 hari sebelum election:

- [ ] **Snapshot DB** (lihat §1.2) — snapshot diambil + hash SHA-256 dicatat + tersimpan di 2 lokasi
- [ ] **P0 gate**: T2 non-DPT → `42501`, H1 revoke → logout ≤5 mnt, drill restore tercatat
- [ ] **Test voting** dengan 2-3 akun berbeda (voter, committee, admin)
- [ ] **Cek tally** match dengan jumlah suara yang masuk
- [ ] **Cek audit log** recent entries normal (no suspicious activity)
- [ ] **Cek Sentry** no unresolved error baru
- [ ] **Cek uptime monitoring** (jika ada)
- [ ] **Briefing panitia** (lihat `docs/PANDUAN_PANITIA.md`)
- [ ] **Backup kontak darurat** — semua nomor HP/email tim bisa dihubungi
- [ ] **Decision go/no-go** — apa ada blocker? kalau ya, postpone election

---

## 5. Post-election checklist (H+1 sampai H+7)

- [ ] **Verifikasi tally final** match dengan suara masuk
- [ ] **Export audit log** ke CSV/JSON untuk dokumentasi
- [ ] **Feedback session** dengan komite + beberapa voter
- [ ] **Catat incidents** yang terjadi (jika ada) ke incident log
- [ ] **Snapshot DB** post-election (simpan 1 tahun untuk audit)
- [ ] **Archive event** (set status ke archived, hapus active flag)

---

## 6. Recovery time objective (RTO)

| Skenario | RTO |
|---|---|
| 1 user error (typo, etc.) | < 5 menit (fix via SQL) |
| 1 tabel rusak | < 1 jam (PITR) |
| Full DB corruption | < 4 jam (snapshot restore ke project baru + DNS swap) |
| Complete Supabase outage | < 24 jam (tergantung Supabase SLA) |

---

## 7. Verifikasi berkala

| Kegiatan | Frekuensi | Owner |
|---|---|---|
| PITR aktif cek | Bulanan | Dev |
| Test restore (ke staging) | Per 3 bulan | Dev |
| Rotate Supabase anon key | Per 3 bulan | Dev |
| Review Sentry errors | Mingguan | Dev |
| Review audit log anomalies | Mingguan | Admin + Dev |
| Update kontak emergency | Per 3 bulan | Admin |

---

## 8. Referensi

- Plan: `.kilo/plans/production-readiness.md`
- Governance: `.kilo/plans/election-governance-roadmap.md`
- Supabase PITR docs: https://supabase.com/docs/guides/database/point-in-time-recovery
- Supabase CLI: https://supabase.com/docs/guides/local-development/cli/getting-started
- Sentry: https://docs.sentry.io/

> **Pesan:** backup tanpa test restore = tidak ada backup. Jalankan drill restore ke staging setiap 3 bulan untuk memastikan prosedur berjalan.
