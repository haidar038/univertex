# Test Strategy & Verifikasi Implementasi — UniVertex

> **Tanggal:** 6 September 2026
> **Status:** 97/97 tests passing (13 file), TypeScript 0 errors
> **Scope:** Verifikasi 7 implementasi + fix recursive login loop

Dokumen ini merangkum strategi testing frontend untuk memverifikasi bahwa
implementasi 7 item (audit log, device session, invite-only, pasangan calon,
NaN results, deadline voting, redirect email confirmation) bekerja proper,
komprehensif, dan benar-benar menyelesaikan masalah.

---

## 1. Peta Implementasi → Test Suite

| # | Implementasi | File Test | Jumlah Test | Yang Diverifikasi |
|---|--------------|-----------|-------------|-------------------|
| 1 | Audit Log | `src/lib/__tests__/audit.test.ts` | 7 | Parameter RPC lengkap, default values, tidak pernah break flow (error/reject), filter kategori/severity/search |
| 2 | Device Session | `src/lib/__tests__/sessions.test.ts`, `device.test.ts` | 14 | Register/touch/revoke RPC, hash SHA-256 deterministik, label device, graceful 404, session list |
| 3 | Invite-Only | `src/pages/__tests__/AcceptInvite.test.tsx`, `Signup.test.tsx`, `Index.test.tsx` | 17 | Validasi token (4 kondisi), email match/mismatch, redeem RPC, tidak ada form signup, tidak ada CTA Daftar |
| 4 | Pasangan Calon | Skema DB (migration) + `get_election_tally` | —* | *Diuji tidak langsung via ResultsPage; UI admin menyusul* |
| 5 | NaN Results | `src/pages/__tests__/ResultsPage.test.tsx` | 6 | Tidak ada "NaN" di DOM (0 suara & ada suara), persentase benar (75%/25%), pakai RPC bukan N+1, sorting desc, empty/error state |
| 6 | Deadline Voting | `src/pages/__tests__/VotingPage.test.tsx` | 10 | Banner belum-mulai/sudah-berakhir/non-aktif, DPT, double-vote, error.code 23505/P0001 (bukan string match), sukses, not-found |
| 7 | Redirect Email Confirm | `src/hooks/__tests__/useAuthRedirect.test.tsx` | 8 | dashboardPathFor (4 kasus role), TOKEN_REFRESHED tidak re-fetch, tidak ada infinite fetch (bug issues.log), SIGNED_OUT reset state, error 400 tidak infinite retry |
| — | Recursive Loop Fix (bonus) | `useAuthRedirect.test.tsx` | 8 | Sama seperti #7 — ini fix bug yang sudah kamu verifikasi manual |

**Total: 97 tests / 13 files** (35 test lama + 62 test baru)

---

## 2. Pendekatan Testing per Item

### 2.1 Audit Log — "helper tidak boleh jadi single point of failure"
Poin terpenting: **audit logging adalah cross-cutting concern**. Jika RPC
gagal (misal migrasi belum di-apply — persis skenario di `issues.log`), flow
utama (login, vote, approve) TIDAK boleh gagal. Test eksplisit memverifikasi:
- `logAudit()` resolve menjadi `undefined` walau `rpc` return error object.
- `logAudit()` resolve walau `rpc` throw exception (network down).
- Hanya menghasilkan `console.warn` — bukan exception ke caller.

### 2.2 Device Session — kontrak interface + graceful degradation
- `registerCurrentDeviceSession()` harus mengirim `p_refresh_token_hash`
  berupa 64-char hex (SHA-256), `p_device_label`, `p_user_agent`,
  `p_expires_at` — sesuai signature RPC di migration.
- Skenario 404 dari issues.log ("Could not find the function
  register_user_session") **harus tidak crash** — return null.
- Hash deterministik = prekondisi identifikasi device yang sama antar reload.
- Hash berubah ketika userAgent berubah = device berbeda terdeteksi.

### 2.3 Invite-Only — verifikasi 3 lapisan
1. **Halaman** (`Signup.test.tsx`): form signup tidak ada (0 input password,
   0 tombol daftar), `supabase.auth.signUp` tidak pernah dipanggil.
2. **Landing** (`Index.test.tsx`): 0 link "Daftar", semua CTA → `/login`,
   note undangan tampil, FAQ menjelaskan invite-only.
3. **Flow undangan** (`AcceptInvite.test.tsx`): 4 kondisi invalid token
   (not found / sudah dipakai / dicabut / kedaluwarsa), email mismatch
   men-disable tombol, redeem RPC dipanggil saat accept.

### 2.4 Pasangan Calon (Catatan)
Skema DB + `get_election_tally` RPC sudah ter-deploy dalam migration, dan
RPC tersebut **diuji langsung** oleh ResultsPage tests (item #5) karena
`get_election_tally` adalah agregasi yang sama untuk kandidat tunggal maupun
pasangan (return `candidate_id` + `pair_id` + `total_votes`). UI admin untuk
membuat pair belum ada — ini gap yang tercatat di dokumentasi update.

### 2.5 NaN Fix — regression test eksplisit
Bug asli: `Math.round(votes/total)` → `NaN%` ketika `totalVotes = 0`.
Test kuncinya bukan hanya "angka benar" tapi **DOM tidak boleh mengandung
string "NaN" sama sekali**:
```ts
expect(document.body.textContent).not.toMatch(/NaN/);
```
Ditambah verifikasi positif: `0%` saat kosong, `75%/25%` saat ada 3:1 suara,
`Total: 4`, sorting desc, dan pemakaian RPC tunggal (bukan N+1).

### 2.6 Deadline Voting — setiap guard diuji terpisah
4 state event masing-masing punya test: belum-mulai (start_time depan),
sudah-berakhir (end_time lewat — bug asli), non-active (status), plus DPT.
Assertion terpenting untuk bug aslinya:
```ts
expect(screen.queryByText(/Konfirmasi Pilihan/i)).not.toBeInTheDocument();
```
Double-vote diuji di 2 level: pre-check DB (banner "sudah vote") dan insert
error `code === '23505'` (unique constraint) — memverifikasi kita tidak lagi
pakai string matching rapuh seperti sebelumnya. `P0001` (custom raise dari
trigger timeline) juga diuji.

### 2.7 Redirect Email Confirmation + Loop Fix
Karena kamu sudah verifikasi manual bahwa loop hilang, test ini berfungsi
sebagai **regression guard**: jika ada refactor yang tidak sengaja
mengembalikan anti-pattern (fetch profile di effect yang depend ke
`location.pathname`), test ini gagal. Yang diuji:
- `TOKEN_REFRESHED` × 3 → 0 query tambahan (loop issues.log melibatkan
  re-fetch beruntun).
- `SIGNED_IN` × 5 beruntun → jumlah fetch profile terbatas (bukan
  1-per-event × re-render × loop).
- Profile error (400) → `profile = null` tanpa retry beruntun; issues.log
  menampilkan 100+ request identik — sekarang maksimal ~4.
- Begitu profile termuat di public path `/`, tepat SATU redirect ke
  `/admin/dashboard` (diverifikasi via `current-path`).
- `SIGNED_OUT` → user & profile di-reset.

---

## 3. Cara Menjalankan

```powershell
# Semua test
npx vitest --run

# Test spesifik per implementasi
npx vitest --run src/pages/__tests__/VotingPage.test.tsx
npx vitest --run src/pages/__tests__/ResultsPage.test.tsx
npx vitest --run src/pages/__tests__/AcceptInvite.test.tsx
npx vitest --run src/hooks/__tests__/useAuthRedirect.test.tsx
npx vitest --run src/lib/__tests__/audit.test.ts
npx vitest --run src/lib/__tests__/sessions.test.ts

# Watch mode saat develop
npx vitest

# Coverage (opsional)
npx vitest --run --coverage
```

---

## 4. Apa yang MASIH Perlu Testing Manual (tidak tercakup unit test)

Unit/integration test dengan Supabase client yang di-mock **tidak bisa**
memverifikasi hal-hal berikut — perlu testing manual atau e2e (Playwright):

1. **RLS policies** — apakah `votes` benar-benar ditolak untuk voter lain,
   apakah `audit_log` immutable. → Test via SQL Editor dengan
   `set request.jwt.claims` atau pgTAP.
2. **Trigger timeline DB** — `trg_enforce_vote_timeline` menolak insert
   setelah `end_time`. → Insert manual via SQL console setelah ubah clock /
   set event yang sudah lewat.
3. **Migration berjalan mulus** — `supabase db push` sukses & semua RPC
   (`log_audit_event`, `register_user_session`, `redeem_invitation`,
   `get_election_tally`) ada di schema (errors 404 di issues.log
   mengindikasikan migration belum di-apply).
4. **Real email confirmation link** — klik link asli dari Supabase Auth
   email → harus langsung dashboard (sudah kamu verifikasi untuk loop;
   ulangi setelah setiap perubahan auth).
5. **Multi-device nyata** — login 2 browser/device, cek halaman
   "Perangkat Saya" menampilkan keduanya, revoke satu, pastikan yang
   di-revoke tetap bisa melihat UI tapi session-nya marked revoked.
6. **Pasangan calon end-to-end** — setelah UI admin dibuat: buat event
   `use_pairs=true`, tambah paslon, vote sebagai voter, cek hasil.

---

## 5. Gap yang Teridentifikasi (follow-up)

| Gap | Risiko | Rekomendasi |
|-----|--------|-------------|
| UI admin untuk `candidate_pairs` belum ada | Fitur #4 tidak usable end-to-end | Implement `CreatePairDialog` + mode pair di VotingPage |
| `vote.cast` belum di-instrument audit log | Jejak vote tidak lengkap | Tambah `logAudit` di VotingPage sukses (metadata: event_id saja, tanpa candidate — jaga anonimitas) |
| Coverage report belum aktif | Tak ada metrik % coverage | Tambah `@vitest/coverage-v8` + threshold di CI |
| E2E (Playwright) belum ada | Integrasi penuh (login→vote→hasil) tak teruji otomatis | Tambahkan 5-6 happy-path scenario |
