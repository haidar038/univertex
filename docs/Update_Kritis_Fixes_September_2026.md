# Update Teknis UniVertex — Kritis Fixes (Prioritas 1 & 2)

> **Tambahan dokumentasi untuk `Update_September_2026.md`**
> **Tanggal:** 6 September 2026
> **Sumber:** Rencana `.kilo/plans/fix-critical-issues.md` — 9 isu kritis hasil review `docs/ai-response.md`
> **Status:** Selesai — 108/108 tests passing, tsc 0 error, build sukses, semua migration ter-apply ke DB live.

Dokumen ini menjabarkan perbaikan 9 isu kritis (Prioritas 1) dan isu keamanan/keandalan
(Prioritas 2) yang diidentifikasi setelah review. Semua perubahan backend sudah diterapkan
ke database produksi via `supabase_apply_migration` (tercatat di `supabase_migrations.schema_migrations`).

---

## Ringkasan Perbaikan

| # | Isu | Fix | File utama |
|---|-----|-----|-----------|
| 1 | Invite Catch-22 (user baru tak bisa terima undangan) | RPC `accept_invitation_and_register` + form Set Password | `20251105040000_*.sql`, `AcceptInvite.tsx` |
| 2 | Kebocoran tally via `get_election_tally` | Guard matriks akses + errcode 42501 | `20251105010000_*.sql` |
| 3 | RLS `votes` — voter tak bisa baca suara sendiri | Policy "Voters can view their own votes" | `20251105000000_*.sql` |
| 4 | `revokeSession` kirim hash ke parameter UUID | RPC baru `revoke_user_session_by_hash` + `revokeSessionByHash()` | `20251105020000_*.sql`, `lib/sessions.ts`, `hooks/useAuth.ts` |
| 5 | Audit `auth.logout` & `auth.login.failed` tak tercatat | Logout: audit sebelum signOut; login gagal: RPC anon `log_failed_login` | `20251105030000_*.sql`, `useAuth.ts`, `Login.tsx` |
| 6 | Kredensial hardcoded di `client.ts` | `import.meta.env` + fallback | `client.ts`, `.env.example` |
| 7 | `signUp` dari browser admin (session hijack) | RPC `admin_create_user` implementasi nyata | `20251105050000_*.sql`, `CreateUserDialog.tsx`, `BulkImportUsersDialog.tsx` |
| 8 | Reset password kirim ke email dummy | Hapus fallback `${student_id}@university.edu` (dialog sudah fetch email asli via `get_user_email`) | `admin/Users.tsx` |
| 9 | N+1 query + realtime channel leak di admin dashboard | 2 query per event + cleanup channel saat unmount | `admin/Dashboard.tsx` |
| + | (Bonus) `make_user_admin` executable anon — privesc vector | REVOKE semua grant API-role | `20251105060000_*.sql` |

---

## Detail per Isu

### 1. Invite Catch-22 — RPC `accept_invitation_and_register`

**Masalah:** User baru tanpa akun menerima undangan, tapi `AcceptInvite.tsx` mewajibkan
login dulu — padahal signup publik dinonaktifkan. Mustahil menerima undangan.

**Solusi backend** (`20251105040000_add_accept_invitation_registration.sql`):
- RPC SECURITY DEFINER granted ke `anon` (token 64-hex unguessable = otorisasi).
- Validasi: token ada/belah dipakai/belum dicabut/belum expired; password min 8
  char huruf+angka (server-side); email belum terdaftar di `auth.users`.
- Insert langsung ke `auth.users` dengan `crypt(pw, gen_salt('bf',10))` —
  trigger `on_auth_user_created` tetap jalan (profile + role voter otomatis).
- Update profile dari undangan, insert roles undangan, tandai `accepted_at`,
  tulis audit `invitation.register` (actor = user baru).

**Solusi frontend** (`AcceptInvite.tsx`):
- Jika `!user`: form **Buat Password** + konfirmasi, validasi client-side.
- Submit → `accept_invitation_and_register` → langsung
  `signInWithPassword` → `refresh()` → redirect dashboard.
- Error "akun sudah terdaftar" → tampilkan pesan + arahkan login.
- User yang sudah login dengan email cocok → flow `redeem_invitation` lama dipertahankan.

### 2. Guard `get_election_tally`

**Masalah:** RPC SECURITY DEFINER tanpa guard — siapa pun bisa baca tally event mana pun.

**Matriks akses** (diimplementasikan di plpgsql, denial = ERRCODE 42501):

| Caller | Active+open | Active+closed | Active+show_results_after_voting | Closed+public | Closed non-public |
|--------|:-----------:|:-------------:|:--------------------------------:|:--------------:|:-----------------:|
| anon | ✅ | ❌ | ❌ | ✅ | ❌ |
| authenticated | ✅ | ❌ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |

RPC di-grant ke `anon` + `authenticated` (PublicResultsPage dipakai visitor).

### 3. RLS votes — voter baca suara sendiri

Policy `SELECT ... USING (voter_id = auth.uid())`. Efek: badge "Sudah Memilih" di
dashboard voter dan pre-check `hasVoted` di VotingPage langsung bekerja.

### 4. `revoke_user_session_by_hash`

**Masalah:** `signOut()` mem-pass fingerprint hash ke `revoke_user_session(p_session_id UUID)`
— 0 row cocok, `revoked_at` tak pernah terisi.

**Solusi:** RPC baru menerima hash; memvalidasi kepemilikan (`user_id = auth.uid()`);
`revokeSessionByHash()` di `lib/sessions.ts`; `signOut()` memakainya.

### 5. Audit login/logout

- **Logout:** `logAudit('auth.logout')` dipindah SEBELUM `supabase.auth.signOut()`
  (sebelumnya sesudah — caller sudah anon, insert ditolak diam-diam).
- **Login gagal:** RPC khusus `log_failed_login(p_email)` granted ke `anon`,
  rate-limit internal max 10 entri/email/15 menit, field client dibatasi email saja.
  `Login.tsx` catch-block memanggilnya fire-and-forget.

### 6. Env vars di `client.ts`

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://oiurjnmpkguyxevdbpbu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "<anon-key-lama>";
```
Fallback menjaga build tetap jalan bila env belum diset. `.env`/`.env.example` sudah berisi keduanya.

### 7. `admin_create_user` implementasi nyata

**Masalah:** placeholder return NULL → frontend pakai `supabase.auth.signUp` dari
browser admin → sesi admin diganti sesi user baru (session hijack by design).

**Solusi:** RPC SECURITY DEFINER dengan guard `has_role(auth.uid(),'admin')`,
validasi email/password (min 8), duplicate email → errcode 23505, duplicate NIM → 23505.
Insert `auth.users` + upsert profile + audit `user.create` (actor = admin).
Signature cocok dengan `types.ts` existing. `CreateUserDialog` dan `BulkImportUsersDialog`
sudah memakai RPC; mapping error → pesan Indonesia. Password client-side juga dinaikkan ke min 8.

### 8. Reset password ke email asli

`Users.tsx` tidak lagi pass `${student_id}@university.edu`. `ResetPasswordDialog`
sudah fetch email asli via RPC `get_user_email` (admin-only) dan memakainya.

### 9. Admin dashboard N+1 + realtime leak

- Per event: 1 query `candidates` + 1 RPC `get_election_tally` (total 2N vs 1+N+N).
- `useEffect` me-return cleanup `supabase.removeChannel(channel)` — channel
  realtime tidak lagi bocor saat navigasi keluar.

### Bonus: Lockdown `make_user_admin` / `create_admin_user`

Security advisor menandai `make_user_admin` (SECURITY DEFINER, promote email mana pun
jadi admin tanpa cek caller) executable oleh anon — privesc vector. Kedua helper
tidak dipakai runtime → semua grant API-role di-REVOKE (hanya postgres/service_role).

---

## Validasi

| Check | Hasil |
|-------|-------|
| `npx vitest --run` | ✅ 108 tests passed (14 files) |
| `tsc --noEmit` | ✅ 0 errors |
| `vite build` | ✅ Build success (3513 modules) |
| Migration tercatat di `schema_migrations` | ✅ 7 migration baru (6 rencana + 1 lockdown bonus) |
| `pg_policies` votes | ✅ policy "Voters can view their own votes" aktif |
| GRANT RPC | ✅ anon: tally/log_failed_login/accept_invite; authenticated-only: revoke_by_hash/admin_create_user |
| Smoke `get_election_tally` (event live active+open) | ✅ mengembalikan tally |

## Smoke test manual (untuk user)

1. Login voter → dashboard menampilkan badge "Sudah Memilih" pada event terisi suara.
2. Logout → cek `user_sessions.revoked_at` terisi + `audit_log` berisi `auth.logout`.
3. Login dengan password salah → `audit_log` berisi `auth.login.failed` (meski anon).
4. Buat undangan → buka link di browser incognito → set password → langsung masuk dashboard.
5. Admin buat user → sesi admin tetap utuh.
6. Voter memanggil `get_election_tally` via console pada event closed+non-public → error 42501.
