# Plan Implementasi — Perbaikan Isu Kritis UniVertex

> **Sumber:** Review `docs/ai-response.md` (Question 1 & 2), diverifikasi ulang terhadap kode aktual
> **Tanggal:** 6 September 2026
> **Scope:** 5 isu Prioritas 1 (Kritis) + 4 isu Prioritas 2 (Keamanan & Keandalan)
> **Di luar scope:** UI Pasangan Calon (roadmap terpisah), rotasi password admin default (manual oleh user)

---

## Konteks: Status Verifikasi Temuan

| # | Temuan | Status Saat Ini | File Terdampak |
|---|--------|------------------|----------------|
| 1 | Invite Catch-22 (user baru tak bisa terima undangan) | ❌ Terbuka | `AcceptInvite.tsx`, `20251104030000` |
| 2 | Kebocoran tally via `get_election_tally` (SECURITY DEFINER tanpa guard) | ❌ Terbuka | `20251104040000:137-154` |
| 3 | RLS `votes` — voter tidak bisa baca suaranya sendiri | ❌ Terbuka | `Dashboard.tsx (app)`, `VotingPage.tsx` |
| 4 | `revokeSession` mengirim hash ke parameter UUID | ❌ Terbuka | `useAuth.ts:188-191`, `sessions.ts:90-98` |
| 5 | Audit `auth.logout` & `auth.login.failed` tak pernah tercatat | ❌ Terbuka | `useAuth.ts:194-199`, `Login.tsx:94-100` |
| 6 | Kredensial hardcoded di `client.ts` | ❌ Terbuka | `client.ts:5-6`, `.env`, `.env.example` |
| 7 | `signUp` dari browser admin (session hijack risk) | ❌ Terbuka | `CreateUserDialog.tsx`, `BulkImportUsersDialog.tsx` |
| 8 | Reset password kirim ke email dummy | ❌ Terbuka | `Users.tsx:225` |
| 9 | N+1 query + realtime channel leak di admin dashboard | ❌ Terbuka | `Dashboard.tsx (admin):41-92` |
| — | Trigger order, GRANT signature, UPSERT, jwt policy, constraint | ✅ Selesai | (verified di DB live) |

---

## Keputusan Desain Utama

### D1: Pembuatan user via SQL langsung (bukan Edge Function)
Membuat auth user langsung via `INSERT INTO auth.users (..., encrypted_password = crypt(pw, gen_salt('bf', 10)), email_confirmed_at = now())` dalam RPC `SECURITY DEFINER`. Alasan:
- Konsisten dengan arsitektur existing (semua logic di SQL migrations, belum ada Edge Function sama sekali)
- Trigger `on_auth_user_created` otomatis membuat profile + role voter saat insert
- Tidak butuh manajemen `SUPABASE_SERVICE_ROLE_KEY` di repo/deployment
- Token undangan (64 hex, unguessable) berfungsi sebagai otorisasi — aman di-grant ke `anon`

### D2: Guard `get_election_tally` — matriks akses
| Caller | Active + open | Active + closed | Active + show_results_after_voting | Closed + public_results | Closed tanpa public |
|--------|---------------|------------------|-----------------------------------|-------------------------|---------------------|
| anon | ✅ | ❌ | ❌ | ✅ | ❌ |
| authenticated (non-admin) | ✅ | ❌ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |

RPC di-grant ke `anon` DAN `authenticated` (PublicResultsPage dipakai visitor publik).

### D3: Logging login-failed via RPC khusus untuk `anon`
RPC `log_failed_login(p_email)` granted ke `anon` dengan rate-limit internal (max 10 entri/email/15 menit via cek `audit_log`). Tidak membuka `log_audit_event` ke anon (spam risk). Field yang bisa diisi client dibatasi hanya email.

### D4: `client.ts` pakai env vars dengan fallback
`import.meta.env.VITE_SUPABASE_URL ?? "https://oiurjnmpkguyxevdbpbu.supabase.co"` — fallback memastikan build tidak rusak jika env belum diset, sementara `.env` yang benar sudah ada isinya.

---

## Tasks

### Fase A — Migration SQL (6 file baru)

**T1. `20251105000000_add_votes_own_vote_rls_policy.sql`** (Isu #3)
```sql
DROP POLICY IF EXISTS "Voters can view their own votes" ON public.votes;
CREATE POLICY "Voters can view their own votes"
  ON public.votes FOR SELECT TO authenticated
  USING (voter_id = auth.uid());
```
Perbaikan instan: badge "Sudah Memilih" di dashboard voter + pre-check `hasVoted` di VotingPage mulai bekerja.

**T2. `20251105010000_secure_get_election_tally.sql`** (Isu #2)
- Rewrite `get_election_tally` sebagai `plpgsql` dengan guard sesuai matriks D2 (admin / open-active / show-after-voting+authenticated / closed / closed+public untuk anon)
- `RAISE EXCEPTION ... ERRCODE='42501'` jika tidak lolos
- `GRANT EXECUTE ... TO authenticated, anon`

**T3. `20251105020000_add_revoke_session_by_hash.sql`** (Isu #4)
```sql
CREATE OR REPLACE FUNCTION public.revoke_user_session_by_hash(
  p_refresh_token_hash TEXT,
  p_revoked_reason TEXT DEFAULT 'user_logout'
) RETURNS VOID SECURITY DEFINER ...
  -- UPDATE user_sessions SET revoked_at=now(), revoked_reason=...
  -- WHERE refresh_token_hash = p_refresh_token_hash AND revoked_at IS NULL;
GRANT EXECUTE ... TO authenticated;
```

**T4. `20251105030000_add_log_failed_login_rpc.sql`** (Isu #5, bagian anon)
```sql
CREATE OR REPLACE FUNCTION public.log_failed_login(p_email TEXT)
RETURNS VOID SECURITY DEFINER ...
  -- rate limit: skip jika >10 entri 'auth.login.failed' utk email sama dalam 15 menit
  -- INSERT INTO audit_log (action='auth.login.failed', category='security',
  --   severity='warning', description='Failed login attempt for '||p_email,
  --   metadata=jsonb_build_object('email', lower(p_email)))
GRANT EXECUTE ... TO anon, authenticated;
```

**T5. `20251105040000_add_accept_invitation_registration.sql`** (Isu #1, backend)
RPC `accept_invitation_and_register(p_token TEXT, p_password TEXT)` → `RETURNS UUID (user_id)`:
1. Validasi token: ada, belum `accepted_at`, belum `revoked_at`, belum expired → else RAISE
2. Validasi password server-side: min 8 char, huruf+angka
3. Cek `auth.users` by email: jika sudah ada → RAISE 'Akun sudah terdaftar, silakan login'
4. `INSERT INTO auth.users (id, email, encrypted_password=crypt(p_password, gen_salt('bf',10)), email_confirmed_at=now(), raw_user_meta_data={full_name,...})` — trigger `handle_new_user` otomatis buat profile+voter role
5. `UPDATE profiles SET full_name/student_id/class_id` dari undangan
6. `INSERT INTO user_roles ... ON CONFLICT DO NOTHING` untuk roles undangan
7. `UPDATE invitations SET accepted_at=now(), accepted_user_id=...`
8. Log audit `invitation.register` (actor = user baru)
9. `GRANT EXECUTE TO anon` (token = otorisasi)

**T6. `20251105050000_implement_admin_create_user.sql`** (Isu #7, backend)
Implementasi nyata `admin_create_user` (menggantikan placeholder yang return NULL):
1. Guard: `has_role(auth.uid(),'admin')` else RAISE 42501
2. Validasi email format + password min 8
3. Duplicate email → RAISE 'Email sudah terdaftar' (errcode 23505-style)
4. Insert auth.users (pola sama dengan T5, `p_skip_confirmation` → `email_confirmed_at`)
5. Upsert profile + roles
6. Return user_id
Catatan: signature disesuaikan dengan types.ts existing (`p_email, p_full_name, p_password, p_student_id, p_class_id?, p_department?, p_skip_confirmation?`) — verifikasi ulang saat implementasi.

### Fase B — Frontend

**T7. `src/lib/sessions.ts`** (Isu #4)
- Tambah `revokeSessionByHash(hash, reason)` → RPC `revoke_user_session_by_hash`
- Keep `revokeSession(id)` untuk admin UI

**T8. `src/hooks/useAuth.ts`** (Isu #4 + #5)
- `signOut()`: panggil `revokeSessionByHash(fp.hash, 'user_logout')` (bukan `revokeSession(fp.hash)`)
- `signOut()`: pindahkan `logAudit({action:'auth.logout'})` **SEBELUM** `supabase.auth.signOut()`

**T9. `src/pages/Login.tsx`** (Isu #5)
- Ganti `logAudit` di catch-block → `supabase.rpc('log_failed_login', { p_email: email })` (fire-and-forget, catch silent)

**T10. `src/pages/AcceptInvite.tsx`** (Isu #1, frontend)
- Jika `!user`: tampilkan form **Set Password** (password + konfirmasi + validasi client-side min 8, huruf+angka)
- Submit → `supabase.rpc('accept_invitation_and_register', { p_token, p_password })`
- Sukses → `supabase.auth.signInWithPassword({ email: invite.email, password })` → `refresh()` profile → redirect dashboard
- Error 'Akun sudah terdaftar' → tampilkan pesan + arahkan ke login
- Jika `user` dengan email cocok: pertahankan flow `redeem_invitation` existing

**T11. `src/integrations/supabase/client.ts`** (Isu #6)
- `const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://oiurjnmpkguyxevdbpbu.supabase.co"`
- `const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "<current>"`
- Update `.env.example` dengan kedua var (jika belum)

**T12. `src/components/admin/users/CreateUserDialog.tsx` + `BulkImportUsersDialog.tsx`** (Isu #7)
- Ganti `supabase.auth.signUp` → `supabase.rpc('admin_create_user', {...})`
- Handle error mapping (duplicate email, password lemah) → pesan Indonesia
- Bulk import: loop RPC per row, kumpulkan hasil sukses/gagal, tampilkan ringkasan

**T13. `src/pages/admin/Users.tsx`** (Isu #8)
- Saat membuka ResetPasswordDialog: fetch `supabase.rpc('get_user_email', { user_id: selectedUser.id })` → simpan di state → pass email asli ke dialog
- Hapus fallback `${student_id}@university.edu`

**T14. `src/pages/admin/Dashboard.tsx`** (Isu #9)
- Ganti N+1 nested `Promise.all` → per event: 1 query `candidates` + 1 RPC `get_election_tally` (total 2N vs 1+N+N)
- `useEffect`: `return setupRealtimeVotes();` (cleanup channel saat unmount — fix memory leak)

### Fase C — Testing & Validasi

**T15. Update test files:**
- `sessions.test.ts`: + test `revokeSessionByHash` (RPC args verifikasi)
- `AcceptInvite.test.tsx`: + tests set-password flow (submit RPC, sign-in sukses, password mismatch client, akun sudah ada)
- `useAuthRedirect.test.tsx` / `useAuth.test.ts`: update mock signOut ordering (logAudit sebelum signOut — assert call order)
- `audit.test.ts`: test `log_failed_login` RPC terpisah (tidak lagi lewat logAudit anon)
- Tests createUser: assert `admin_create_user` RPC dipanggil (bukan signUp)

**T16. Apply migrations ke database:**
- Via `supabase_apply_migration` (tool tersedia) ATAU user jalankan manual via SQL Editor (urutan T1→T6)
- Post-check: `supabase_list_migrations` + spot-check policies via `supabase_execute_sql` (query `pg_policies` untuk votes)

**T17. Validasi akhir:**
- `npx vitest --run` → target all passing (99+ tests)
- `tsc --noEmit` → 0 errors
- `vite build` → sukses
- Smoke test manual (user): login → cek badge "Sudah Memilih", logout → cek `user_sessions.revoked_at` terisi, invite flow end-to-end user baru
- Update `docs/Update_September_2026.md` dengan status perbaikan (atau dokumen baru)

---

## Urutan Eksekusi & Dependensi

```
T1 (RLS votes)      ──┐
T2 (tally guard)    ──┼── independen, bisa paralel
T3 (revoke hash)    ──┤
T4 (failed login)   ──┘
T5 (invite reg RPC) ──→ T10 (AcceptInvite UI)
T6 (admin create)   ──→ T12 (CreateUserDialog)
T7 (sessions lib)   ──→ T8 (useAuth)
T9 (Login)          ── tergantung T4
T11 (client.ts)     ── independen
T13 (Users.tsx)     ── independen (RPC get_user_email sudah ada)
T14 (admin Dash)    ── independen (tally RPC sudah ada, guard T2 tidak menghalangi admin)
T15 tests ── setelah semua frontend selesai
T16 apply  ── setelah Fase A selesai (bukan blocker frontend)
T17 validasi ── terakhir
```

## Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Direct INSERT ke `auth.users` bypass Supabase Auth logic (future breaking changes) | Pola crypt/bf adalah workaround yang sudah banyak dipakai; trigger `handle_new_user` tetap jalan; dicatat di komentar migration |
| Guard tally terlalu ketat → halaman valid gagal load | Matriks D2 diuji per role via test manual + cek `PublicResultsPage` flow anon |
| `accept_invitation_and_register` granted ke anon → spam | Token 64-hex unguessable + rate: 1 redeem per token (accepted_at check) |
| Session hijack fix (RPC admin_create_user) berubah behavior | Bulk import tetap lapor per-row; CreateUserDialog error mapping dipertahankan |
| Env vars belum diset di deployment | Fallback ke nilai hardcoded saat ini — tidak ada breaking change |
| Migration dijalankan user manual via SQL Editor | Semua migration idempotent (DROP IF EXISTS + DO $$ guard) — aman dijalankan ulang |

## Definisi Selesai (Definition of Done)

1. Voter login → dashboard menampilkan badge "Sudah Memilih" pada event yang sudah divote
2. User baru menerima undangan → set password → langsung masuk dashboard (tanpa login manual)
3. Voter non-admin memanggil `get_election_tally` di console pada pemilihan closed+active → error 42501
4. Logout → row `user_sessions` user terisi `revoked_at` + audit_log berisi `auth.logout`
5. Login gagal → audit_log berisi `auth.login.failed` (meski caller anon)
6. Admin membuat user → sesi admin tetap utuh (tidak ada signUp dari browser)
7. Reset password admin → email asli mahasiswa (bukan @university.edu)
8. Admin dashboard load tanpa N+1; navigasi keluar halaman melepas channel realtime
9. 99+ tests passing, tsc 0 error, build sukses
