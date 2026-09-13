# Update Teknis UniVertex — September 2026

> **Tambahan dokumentasi untuk `Codebase_Review_UniVertex.md`**
> **Tanggal:** 5 September 2026
> **Status:** Selesai dan lulus test (35/35 tests passing, build bersih).

Dokumen ini menjabarkan implementasi teknis untuk delapan kebutuhan produk / bug
yang diidentifikasi setelah review awal. Semua perubahan ter-uji, ter-build, dan
siap untuk di-merge ke production setelah melalui code review internal.

---

## Ringkasan Perubahan

| # | Topik | Tipe | File utama |
|---|-------|------|-----------|
| 1 | Audit Log Admin | Fitur baru (5 files) | `20251104010000_create_audit_log.sql`, `lib/audit.ts`, `pages/admin/AuditLog.tsx` |
| 2 | Device Session Tracking | Fitur baru (4 files) | `20251104020000_create_user_sessions.sql`, `lib/device.ts`, `lib/sessions.ts`, `pages/admin/Sessions.tsx`, `pages/app/MySessions.tsx` |
| 3 | Invite-Only Registration | Fitur baru (3 files) | `20251104030000_create_invitations.sql`, `pages/admin/Invitations.tsx`, `pages/AcceptInvite.tsx` |
| 4 | Pasangan Calon (Pairs) | Fitur baru (1 migration) | `20251104040000_create_candidate_pairs.sql` |
| 5 | NaN bug di `/app/results/[eventId]` | Bug fix | `pages/app/ResultsPage.tsx` |
| 6 | Voting setelah deadline | Bug fix + hardening | `pages/app/VotingPage.tsx`, migration `20251104000000_*` |
| 7 | Email-confirmation redirect ke landing, baru dashboard | UX fix | `hooks/useAuth.ts`, `pages/Login.tsx`, `pages/Signup.tsx`, `pages/Index.tsx` |
| 8 | Signup publik di-nonaktifkan | Kontrak fix | `pages/Signup.tsx`, `pages/Index.tsx`, `components/AppBootstrap.tsx` |

---

## 1. Audit Log Admin

### Latar belakang
Semua aksi admin (buat/edit/hapus event, kandidat, user; ubah status; login
berhasil/gagal; revoke sesi) sebelumnya tidak meninggalkan jejak. Ini
bertentangan dengan prinsip transparansi pemilihan dan menyulitkan forensik
ketika ada insiden.

### Solusi

#### Schema (`supabase/migrations/20251104010000_create_audit_log.sql`)
- Tabel `public.audit_log` dengan kolom:
  - `id`, `created_at`, `actor_id` (FK ke `auth.users`), `actor_email`, `actor_role`,
  - `action` (string dot-notation: `event.create`, `candidate.approve`),
  - `category` (`admin` | `auth` | `election` | `security`),
  - `target_type` / `target_id` (TEXT agar bisa men-target non-UUID),
  - `description` (human-readable),
  - `metadata` (JSONB),
  - `ip_address` (INET), `user_agent`, `severity` (`info` | `warning` | `critical`).
- Indeks pada `actor_id`, `action`, `category`, `(target_type,target_id)`, `created_at`.
- RLS:
  - Admin: SELECT + INSERT.
  - Tidak ada UPDATE/DELETE policy → **immutable**.
- RPC `log_audit_event(...)` (SECURITY DEFINER) yang me-resolve actor dari
  `auth.uid()` server-side sehingga client tidak bisa memalsukan identity.

#### Helper (`src/lib/audit.ts`)
```ts
logAudit({ action, description, category, targetType, targetId, metadata, severity })
fetchAuditLog({ category, severity, search, limit })
```
Dipanggil di:
- `Login.tsx` → `auth.login` (info) + `auth.login.failed` (warning).
- `useAuth.ts` → `auth.logout`.
- `CreateEventDialog` → `event.create`.
- `DeleteEventDialog` → `event.delete` (warning).
- `EventStatusDialog` → `event.status_change` (warning saat activate).
- `ApproveCandidateDialog` → `candidate.approve` / `candidate.reject`.
- `AddCandidateDialog` → `candidate.add`.
- `AssignVoterGroupsDialog` → `event.assign_voter_groups`.
- `CreateUserDialog` → `user.create`.
- `DeleteUserDialog` → `user.delete` (warning).
- `AdminSessions.tsx` → `session.revoke` (warning).
- `AdminInvitations.tsx` → `invitation.create` / `invitation.revoke` (warning).
- `voting` (jika perlu) → `vote.cast` — *belum di-instrument, rekomendasi*.

#### UI (`src/pages/admin/AuditLog.tsx`)
- Sidebar admin punya menu **Audit Log** (`/admin/audit-log`).
- Filter: kategori, severity, free-text search.
- Pagination client-side (top 200 entri).

---

## 2. Device Session Tracking

### Latar belakang
Sebelumnya tidak ada cara untuk:
- Melihat daftar device yang sedang login untuk akun tertentu.
- Mendeteksi akun yang dipakai 2 device berbeda secara bersamaan.
- Mencabut sesi individual tanpa mereset seluruh akun.

### Solusi

#### Schema (`supabase/migrations/20251104020000_create_user_sessions.sql`)
- Tabel `public.user_sessions` dengan kolom:
  - `user_id` (FK `auth.users`, ON DELETE CASCADE),
  - `refresh_token_hash` (TEXT UNIQUE, **hash client-side** — server tidak
    menyimpan refresh token mentah),
  - `user_agent`, `ip_address` (INET),
  - `device_label` ("Chrome on Windows (Desktop)"),
  - `is_current`, `created_at`, `last_seen_at`, `expires_at`,
  - `revoked_at`, `revoked_reason`.
- Index pada `user_id`, `(user_id) WHERE revoked_at IS NULL`, dan `last_seen_at`.
- RLS:
  - User bisa SELECT & UPDATE sesi miliknya sendiri.
  - Admin bisa SELECT & UPDATE semua sesi.
- RPC:
  - `register_user_session(hash, ua, ip, label, expires)`,
  - `touch_user_session(hash)`,
  - `revoke_user_session(session_id, reason)`.

#### Client (`src/lib/device.ts`, `src/lib/sessions.ts`)
- `buildDeviceFingerprint()` — SHA-256 dari `(UA + screen + tz + language + hw)`.
  Tidak menyimpan data sensitif; hanya hash + label.
- `registerCurrentDeviceSession()`, `touchCurrentDeviceSession()`,
  `listMySessions()`, `listUserSessions()`, `revokeSession()`.
- `AppBootstrap` component (mounted sekali di `App.tsx`) melakukan:
  - `registerCurrentDeviceSession()` setelah login.
  - `touchCurrentDeviceSession()` setiap 5 menit.
- `useAuth.signOut()` sekarang me-revoke sesi device ini sebelum logout.

#### UI
- **User-facing:** `/app/my-sessions` ("Perangkat Saya") — lihat semua device,
  tandai "Sesi ini", cabut yang tidak dikenal.
- **Admin-facing:** `/admin/sessions` — lihat semua sesi seluruh user, ada
  peringatan kuning jika ada > 1 sesi aktif di sistem.

---

## 3. Invite-Only Registration

### Latar belakang
Konsep awal sudah menyatakan "Pendaftaran publik DINONAKTIFKAN. Akun hanya
bisa dibuat oleh Admin", namun implementasinya memiliki route `/signup` yang
menerima pendaftaran publik dan memanggil `supabase.auth.signUp()` langsung.
Kini di-nonaktifkan sepenuhnya dan diganti dengan alur undangan.

### Solusi

#### Schema (`supabase/migrations/20251104030000_create_invitations.sql`)
- Tabel `public.invitations`:
  - `email` (target), `full_name`, `student_id`, `intent`
    (`register` | `candidate` | `voter_group`),
  - `event_id`, `class_id`,
  - `roles TEXT[]` (default `['voter']`),
  - `token` (TEXT UNIQUE, 64 hex),
  - `expires_at`, `accepted_at`, `accepted_user_id`, `revoked_at`,
  - `metadata` (JSONB untuk catatan internal).
- RLS:
  - Admin: ALL.
  - User terautentikasi: SELECT jika `email` miliknya.
- RPC `redeem_invitation(token)` yang memvalidasi token, expiry, dan email
  sebelum assign roles + update profile.

#### UI
- **Admin:** `/admin/invitations` — buat, salin link, revoke.
- **Penerima:** `/invite/:token` → `AcceptInvite.tsx`:
  - Validasi token, tampilkan detail (email, nama, intent, expiry).
  - Wajib login dengan email yang sesuai (`user.email === invite.email`).
  - Tombol "Terima Undangan" menjalankan RPC `redeem_invitation`.

#### Penonaktifan Signup Publik
- `src/pages/Signup.tsx` sekarang menjadi *info-only*: menampilkan
  penjelasan "Pendaftaran Tertutup" + link ke Login / Beranda. Form signup
  dihapus.
- `src/pages/Index.tsx`: CTA "Daftar" dihapus dari navbar/hero/footer.
  CTA diganti dengan "Mulai Sekarang" yang mengarah ke `/login`.
- `src/App.tsx`: route `/signup` tetap ada tapi menampilkan info.
- `src/pages/Login.tsx`: link "Daftar di sini" diganti dengan penjelasan
  tentang undangan.

---

## 4. Pasangan Calon (Candidate Pairs)

### Latar belakang
Pemilihan di beberapa kampus (mis. ketua + wakil ketua BEM) membutuhkan
calon yang dipilih secara berpasangan, bukan individual. Implementasi awal
hanya mendukung single-candidate.

### Solusi

#### Schema (`supabase/migrations/20251104040000_create_candidate_pairs.sql`)
- Tabel `public.candidate_pairs`:
  - `event_id`, `label`, `number` (ballot number), `vision`, `mission`,
    `photo_url`, `photo_storage_path`,
  - status approval (`pending` | `approved` | `rejected`),
  - `admin_notes`, `rejection_reason`, `approved_at`, `approved_by`.
- Tabel junction `public.candidate_pair_members(pair_id, candidate_id,
  position)`.
- Tabel `public.votes` ditambah kolom `pair_id` (UUID nullable).
- `votes.candidate_id` dibuat nullable.
- **CHECK constraint:** vote harus salah satu dari `{candidate_id OR pair_id}`,
  tidak boleh keduanya atau tidak sama sekali.
- `election_events` ditambah `use_pairs BOOLEAN` (default `false`).
- **RPC `get_election_tally(event_id)`** — agregasi per candidate & per pair dalam
  satu query (mengatasi N+1 query lama).

#### UI Wiring (status)
- DB sudah siap. Frontend admin/candidate pairing UI akan dikirim dalam
  iterasi berikutnya — saat ini use-case pair di-skip di UI tetapi voting
  tunggal tetap bekerja seperti biasa.

---

## 5. Bug Fix: NaN% di `/app/results/[eventId]`

### Penyebab
`ResultsPage.tsx` lama menggunakan `Math.round((winner.votes / totalVotes) *
100)`. Ketika `totalVotes === 0` atau ada nilai undefined, hasilnya `NaN`,
ditampilkan sebagai "NaN%" di UI.

### Solusi
- Helper `safePercent(votes, totalVotes)` yang:
  - Return `0` jika salah satu argumen bukan finite number atau `totalVotes <= 0`.
  - Menggunakan `Number(votes) || 0` untuk coerce.
- Pesan error state eksplisit ("Pemilihan tidak ditemukan", "Gagal memuat
  hasil pemilihan") alih-alih silent render.
- Empty state ("Tidak ada kandidat terdaftar", "Belum ada suara yang masuk").
- **Bonus:** query digabung jadi satu (`get_election_tally`) → tidak ada N+1.

### Test
Manual verification di browser dengan event kosong / tanpa suara — sekarang
menampilkan pesan informatif, bukan "NaN%".

---

## 6. Bug Fix: Voting Setelah Deadline

### Penyebab
- `VotingPage.tsx` tidak mengecek `event.end_time` atau `event.start_time`.
- RLS `votes` hanya mengecek `voter_id = auth.uid()` — tidak ada
  validasi timeline.
- Jika admin mengubah `status` ke `closed` setelah user membuka halaman,
  user masih bisa vote sampai refresh.

### Solusi

#### Frontend (`VotingPage.tsx`)
- Live "now" timer yang re-render setiap 30 detik untuk akurasi status.
- Banner eksplisit untuk:
  - **Belum dimulai** (now < start_time).
  - **Sudah berakhir** (now > end_time).
  - **Status non-aktif** (draft/closed).
  - **Tidak masuk DPT** (`profile.class_id` tidak ada di `event_voter_groups`).
  - **Sudah vote**.
- Tombol "Konfirmasi Pilihan" di-disable jika `votingDisabled === true`.
- Pre-check `votes` sebelum menampilkan UI (menghindari refresh manual).
- `error.code === '23505'` (unique violation) untuk pesan "sudah vote" yang
  reliable.
- `error.code === 'P0001'` (custom raise) untuk pesan "waktu pemilihan sudah
  berakhir".

#### Backend (Migration `20251104000000_*`)
- **Trigger** `trg_enforce_vote_timeline` (BEFORE INSERT) memanggil
  `assert_event_is_votable(event_id)`:
  - Event harus `status = 'active'`.
  - `now() >= start_time` AND `now() <= end_time`.
  - Jika tidak terpenuhi → RAISE EXCEPTION P0001 (ditangkap di frontend).
- `UNIQUE (voter_id, event_id)` constraint di level DB → satu-satunya sumber
  kebenaran "satu pemilih satu suara" (sebelumnya hanya string-matching
  di frontend).

---

## 7. UX Fix: Email-Confirmation Redirect

### Penyebab
Saat user mengklik link konfirmasi email:
1. Supabase mengarahkan ke `emailRedirectTo` (default: `/`).
2. User melihat landing page padahal sudah authenticated.
3. Klik "Mulai Sekarang" atau "Masuk ke Akun" → ke `/login`.
4. `/login` me-redirect ke dashboard.

User berharap langsung ke dashboard setelah klik link konfirmasi. Loop visual
ini terasa janggal dan merusak trust.

### Solusi
- `useAuth.ts` sekarang punya `useEffect` kedua yang memonitor `location.pathname`:
  - Jika loading selesai, profile loaded, dan pathname ada di public list
    (`/`, `/login`, `/signup`, `/reset-password`) → auto-redirect ke
    `dashboardPathFor(profile)`.
- `Index.tsx` (landing page) juga punya cek session serupa di awal.
- `useEffect` ini otomatis fire ketika user pertama kali landing di `/` lewat
  email-confirmation link — langsung ke dashboard tanpa klik tambahan.

---

## 8. Penonaktifan Signup Publik

Sudah dijabarkan di §3. Intinya:
- `Signup.tsx` jadi info-only (form dihapus).
- `Index.tsx` tidak punya CTA "Daftar" lagi.
- Login form menyertakan catatan "Punya undangan? Buka tautan undangan yang
  diberikan panitia."

---

## Validasi

| Check | Hasil |
|-------|-------|
| `npx vitest --run` | ✅ 35 tests passed (4 files) |
| `tsc --noEmit` | ✅ 0 errors |
| `vite build` | ✅ Build success (3513 modules) |
| Manual smoke test landing | ✅ Redirect ke dashboard saat session aktif |

---

## Rekomendasi Lanjutan (belum diimplementasi di iterasi ini)

1. **Real-time audit log** — Supabase Realtime subscribe ke `audit_log` agar
   admin dashboard update otomatis.
2. **Halaman pairing admin** — UI untuk membuat `candidate_pairs` +
   `candidate_pair_members`.
3. **Voting untuk pair** — UI `VotingPage` mendukung mode pair vs single.
4. **Email template undangan** — integrasi dengan Supabase Auth email untuk
   mengirim link undangan via email (saat ini harus share manual).
5. **Background job untuk auto-revoke** sesi yang `expires_at < now()`.
6. **Logout dari semua device** di `MySessions` page.
7. **2FA untuk admin** — Supabase Auth MFA.
8. **Webhook ke `vote.cast`** — jika downstream perlu notifikasi.

---

# Status Update (post-original, 7 September 2026)

Dokumen di atas menjelaskan status 5 September 2026. Sejak itu, UniVertex telah
melewati empat fase governance hardening. Lihat `.kilo/plans/` untuk detail
implementasi.

| Fase | Topik | Status | Plan file | Migrations |
|---|---|---|---|---|
| **Fase 0** | Stabilization (Sentry, logger, ErrorBoundary, CI workflow, RUNBOOK) | ✅ Selesai | `.kilo/plans/fix-critical-issues.md`, `.kilo/plans/production-readiness.md` | n/a |
| **Fase 1** | Committee & Observer (per-election governance) | ✅ Selesai | `.kilo/plans/election-governance-roadmap.md` (Fase 1) | `20251106000000_*` |
| **Fase 2** | State Machine (6-state lifecycle) + Scope + Eligibility | ✅ Selesai | `.kilo/plans/phase2-state-machine-and-scope.md` | `20251108000000_*` |
| **Fase 3** | RBAC (31 permissions) + Audit (immutability, export, view) | ✅ Selesai | `.kilo/plans/phase3-rbac-and-audit.md` | `20251109000000_*` sampai `20251113000000_*` |
| **Fase 4** | Deployment & Hardening (staging, custom domain, load test, UAT) | ⏳ In progress | `.kilo/plans/phase4-5-deployment-and-production.md` | belum |
| **Fase 5** | Pilot Production + Post-Launch | ⏳ Belum mulai | `.kilo/plans/phase4-5-deployment-and-production.md` | belum |

## Statistik codebase saat ini (7 Sep 2026)

- **Tests:** 148/148 passing (20 test files)
- **TypeScript:** 0 error
- **Build:** Success (Vite, single-bundle)
- **Database tables:** 17 public tables
- **RPCs:** 25+ functions
- **Enums:** 5 (`app_role`, `committee_role`, `election_type`, `election_scope_type`, `permission_key`, `candidate_status`)
- **RLS policies:** 22+
- **Permission key values:** 31 (Fase 3 seed: 48 rows in `role_permissions`)
- **Roles in production:** 5 (`admin`, `voter`, `candidate`, `committee`, `observer`)
- **Live DB project:** `oiurjnmpkguyxevdbpbu` (Supabase)
- **Live elections:** 2 (1 voting, 1 published)

## Apa yang harus dilakukan selanjutnya (Fase 4)

Lihat `.kilo/plans/phase4-5-deployment-and-production.md` untuk deployment plan
lengkap. Ringkasan:

1. **Fase 4A** (minggu 1): Hardening — security headers, npm scripts, sourcemaps, CHANGELOG
2. **Fase 4B** (minggu 1-2): Deploy infra — staging Supabase project, Vercel env per branch, custom domain
3. **Fase 4C** (minggu 2): UAT (15 skenario), load test (k6 p95 < 500ms), OWASP ZAP audit
4. **Fase 5A** (minggu 3): Pilot production — 1 election kecil (< 200 voter)
5. **Fase 5B** (minggu 4+): Post-launch monitoring + iteration

## Out of scope (di-defer ke iterasi berikutnya)

- Organizational hierarchy (organizations, organizational_positions)
- Ballot vs Vote separation (issued/used lifecycle)
- Multi-region deployment, mobile app, anonymous voting

