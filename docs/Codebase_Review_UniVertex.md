# Codebase Review & Dokumentasi Teknis - UniVertex

> **Proyek:** UniVertex - Aplikasi E-Voting Universitas
> **Tipe:** Single Page Application (SPA) berbasis Vite + React 19
> **Backend / Database:** Supabase (Postgres + Auth + Storage + Realtime)
> **Styling:** Tailwind CSS + shadcn-ui (Radix UI primitives)
> **Bahasa:** TypeScript
> **Tanggal Review:** 5 September 2026
> **Status:** Stabil / Production-ready (dengan catatan)

---

## 1. Ringkasan Eksekutif

UniVertex adalah platform e-voting untuk tingkat universitas yang dirancang untuk memangkas proses pemilihan manual yang lambat, rentan kesalahan, dan tidak transparan. Aplikasi ini menyediakan tiga peran (Admin, Voter, Candidate) dan menggunakan **Supabase** sebagai backend terpadu (Auth, Postgres DB, Storage, Realtime) untuk memastikan keamanan, konsistensi data, dan visibilitas hasil secara *real-time*.

### Tujuan bisnis (sesuai konsep):
- **Efisiensi:** Menggantikan pemilihan manual (BEM/Himpunan) dengan alur digital.
- **Transparansi:** Rekapitulasi suara real-time + jejak audit via RLS.
- **Partisipasi:** Mempermudah akses pemilih (one-person-one-vote yang diverifikasi NIM).
- **Manajemen DPT:** Mengelola Daftar Pemilih Tetap berbasis kelas/jurusan.

### Stack teknologi aktual:
| Layer | Teknologi |
|-------|-----------|
| Frontend | Vite 5, React 19, TypeScript 5.8, React Router 6 |
| UI | Tailwind CSS 3, shadcn-ui (Radix UI), lucide-react, recharts, sonner |
| State / Data | TanStack React Query 5, next-themes |
| Backend | Supabase (Postgres, Auth, Storage, Realtime) |
| Forms / Validation | react-hook-form, zod |
| Testing | Vitest 4, Testing Library |
| Build | Vite + Bun (lihat `bun.lockb`), deploy via Vercel |
| Code Quality | ESLint 9, TypeScript ESLint |

> **Catatan:** Dokumentasi konsep menyebutkan Next.js, namun implementasi aktual menggunakan **Vite + React**. Stack Vite lebih ringan untuk SPA internal seperti ini; tetap kompatibel dengan semua fitur yang diminta.

---

## 2. Arsitektur & Struktur Folder

```
univertex/
|-- database/                   # Schema referensi (read-only context)
|   |-- schema.sql              # Snapshot schema (warning: for context only)
|   `-- policies.csv            # Daftar RLS policies (diekspor)
|-- supabase/                   # Konfigurasi Supabase lokal & migrasi
|   |-- config.toml
|   |-- migrations/             # 12 file migrasi (lihat §6)
|   `-- seed.sql
|-- scripts/                    # Utilitas CLI (setup admin)
|-- src/
|   |-- App.tsx                 # Root + Router
|   |-- main.tsx
|   |-- index.css
|   |-- components/
|   |   |-- ProtectedRoute.tsx  # Route guard berbasis role
|   |   |-- AdminLayout.tsx     # Layout sidebar admin
|   |   |-- VoterLayout.tsx     # Layout sidebar voter/candidate
|   |   |-- admin/              # Dialog & subview admin
|   |   |   |-- classes/        # CreateClassDialog, EditClassDialog, dll.
|   |   |   |-- events/         # CreateEventDialog, AddCandidateDialog, dll.
|   |   |   `-- users/          # CreateUserDialog, BulkImportUsersDialog, dll.
|   |   |-- ui/                 # 51 komponen shadcn-ui
|   |   `-- __tests__/          # ProtectedRoute.test.tsx
|   |-- hooks/
|   |   |-- useAuth.ts          # Hook auth + profile + roles
|   |   |-- use-mobile.tsx
|   |   |-- use-toast.ts
|   |   `-- __tests__/
|   |-- integrations/supabase/
|   |   |-- client.ts           # Supabase client singleton
|   |   `-- types.ts            # Database types (auto-generated)
|   |-- lib/
|   |   |-- utils.ts            # cn() helper
|   |   |-- candidate-helpers.ts # getCandidatePhotoUrl, getCandidateStatusInfo
|   |   `-- __tests__/
|   |-- pages/
|   |   |-- Index.tsx           # Landing page (publik)
|   |   |-- Login.tsx
|   |   |-- Signup.tsx          # Lihat catatan §5
|   |   |-- ResetPassword.tsx
|   |   |-- PublicResultsPage.tsx
|   |   |-- PrivacyPolicy.tsx
|   |   |-- TermsOfService.tsx
|   |   |-- NotFound.tsx
|   |   |-- admin/              # Dashboard, Events, EventDetail, Users, Classes
|   |   `-- app/                # Dashboard, VotingPage, ResultsPage, Profile,
|   |                           # CandidateSettings, CandidateDashboard
|   `-- test/setup.ts
|-- components.json            # Konfigurasi shadcn
|-- tailwind.config.ts
|-- vite.config.ts              # Manual chunks untuk optimasi bundle
|-- vercel.json                 # Headers keamanan + SPA rewrites
|-- vitest.config.ts
`-- package.json
```

**Penilaian:** Struktur bersih, modular, dan mengikuti konvensi shadcn-ui. Pemisahan `pages/`, `components/`, `hooks/`, `lib/`, `integrations/` jelas dan konsisten.

---

## 3. Skema Database (Implementasi Aktual)

> **Penting:** Skema aktual **berbeda** dari konsep awal. ID berubah dari `SERIAL/INT` menjadi `UUID`, dan relasi menggunakan **UUID foreign keys**. Ada tambahan tabel `candidate_notifications` dan sistem approval kandidat.

### Tabel Inti

| Tabel | Fungsi | Catatan |
|-------|--------|---------|
| `profiles` | Ekstensi publik `auth.users` (nama, NIM, class_id, department) | NIM unique; trigger `handle_new_user` membuat profile otomatis |
| `classes` | DPT per kelas/jurusan | UUID, name unique |
| `user_roles` | RBAC multi-role (admin/voter/candidate) | Menggunakan ENUM `app_role` |
| `election_events` | Acara pemilihan | UUID; ada enum `election_type` (open/closed), flag `public_results`, `show_results_after_voting` |
| `event_voter_groups` | Junction event ke kelas (DPT per event) | UUID |
| `candidates` | Kandidat per event | UUID; punya **status approval** (pending/approved/rejected), `photo_storage_path`, `admin_notes`, `rejection_reason` |
| `votes` | Suara masuk | UUID; **TANPA unique constraint `(voter_id, event_id)` di schema** - lihat §5 |
| `candidate_notifications` | Notifikasi untuk kandidat (approval/rejection) | UUID |

### Enum & Functions
- **Enums:** `app_role` (`admin`/`voter`/`candidate`), `candidate_status` (`pending`/`approved`/`rejected`), `election_type` (`open`/`closed`).
- **Functions:** `has_role(_user_id, _role)`, `admin_create_user(...)`, `create_admin_user(...)`, `get_user_email(user_id)`, `make_user_admin(user_email)`.

### Storage
- Bucket `candidate-photos` dengan RLS: SELECT publik, INSERT/UPDATE/DELETE hanya pemilik folder (path = `auth.uid()`).

---

## 4. RLS Policies (Ringkasan)

| Tabel | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | Semua user | Hanya admin | User sendiri (sendiri) atau admin | Hanya admin |
| `user_roles` | User sendiri (lihat role-nya) | - | - | Hanya admin (`ALL`) |
| `classes` | Publik | Hanya admin | Hanya admin | Hanya admin (`ALL`) |
| `election_events` | Active/closed untuk authenticated; admin semua | Hanya admin | Hanya admin | Hanya admin (`ALL`) |
| `event_voter_groups` | Publik | Hanya admin | Hanya admin | Hanya admin (`ALL`) |
| `candidates` | Approved untuk voter; admin semua; owner lihat sendiri | Hanya admin | Admin (approve/reject) atau owner (visi/misi) | Hanya admin |
| `votes` | Hanya admin | Voter (`voter_id = auth.uid()`) | - | - |
| `candidate_notifications` | User sendiri | Hanya admin | User sendiri | - |
| `storage.objects` (`candidate-photos`) | Publik | Authenticated (folder = uid) | Owner folder | Owner folder |

**Penilaian:** Pemodelan RLS sudah sangat baik, mengikuti *principle of least privilege*. Yang perlu diperhatikan: tidak ada policy explicit untuk `UPDATE`/`DELETE` `auth.users` - semestinya hanya service role yang boleh.

---

## 5. Temuan Kritis & Rekomendasi

### Kritis - Harus Segera Diperbaiki

#### 5.1 Kontradiksi Spesifikasi: Signup Publik vs "Registrasi DINONAKTIFKAN"
- **Konsep** (`Aplikasi E-Voting UniVertex.md` §3): *"Logika Pendaftaran: Pendaftaran publik DINONAKTIFKAN. Akun hanya bisa dibuat oleh Admin."*
- **Implementasi**: `src/pages/Signup.tsx` (223 baris) adalah form signup publik yang memanggil `supabase.auth.signUp()`. Halaman ini dirender di route `/signup` dan dipromosikan di landing page (CTA "Daftar Sekarang").
- **Dampak**:
  1. Siapa pun bisa membuat akun dengan role `voter` (default trigger).
  2. Akan terjadi *open registration* padahal konsep menjanjikan kontrol admin penuh atas DPT.
  3. Risiko vote stuffing / akun palsu.
- **Rekomendasi**:
  - **Opsi A (Strict):** Hapus `Signup.tsx`, route `/signup`, dan link "Daftar" dari landing page & footer. Nonaktifkan `supabase.auth.signUp` untuk anonymous (RLS tidak melarang signUp itu sendiri, tapi di Supabase perlu disable signups via `auth.config` atau set `auth.users` insert hanya oleh service role). Gunakan hanya `CreateUserDialog` di admin.
  - **Opsi B (Hybrid):** Signup publik diizinkan tapi **tidak langsung diberi role `voter`** - hanya setelah admin memvalidasi NIM dan menetapkan class_id. Cocok untuk kampus yang menerima calon pendaftar.
  - Minimal: sembunyikan CTA "Daftar" jika Anda berniat strict mode.

#### 5.2 `votes` Tidak Punya Unique Constraint di Schema Aktual
- **Konsep** (`Prompt_Teknis_Univertex.md` §2):* UNIQUE(voter_id, event_id) wajib.*
- **Schema aktual** (`database/schema.sql` lines 83-93 dan types.ts lines 282-327): **TIDAK ada UNIQUE(voter_id, event_id)**.
- **Dampak**: Perlindungan satu-pemilih-satu-suara **hanya** bergantung pada:
  - Kode frontend yang mengecek string `'unique'` di error message (`VotingPage.tsx` line 65).
  - RLS policy `voter_id = auth.uid()` (mencegah insert atas nama orang lain, tapi TIDAK mencegah insert duplikat oleh user yang sama).
- **Risiko**:
  - Race condition pada double-click -> bisa double vote.
  - Bug string-matching rapuh (Postgres bisa mengubah pesan error).
- **Rekomendasi**:
  ```sql
  ALTER TABLE public.votes
  ADD CONSTRAINT votes_one_per_event UNIQUE (voter_id, event_id);
  ```
  Dan di frontend, gunakan `error.code === '23505'` (Postgres unique violation) alih-alih substring matching.

#### 5.3 Kredensial Admin Default yang Hardcoded & Terbuka
- `scripts/setup-admin.js` & `setup-admin.ts` menggunakan:
  - Email: `admin@univertex.com`
  - Password: `UniVertex.02025`
- Tercatat di `supabase/seed.sql`, `scripts/README.md`, dan `.env` (file yang dilacak Git? Cek `.gitignore` - lihat §5.10).
- **Rekomendasi**: Wajib ganti sebelum deploy production. Buat admin pertama via dashboard, jangan commit password.

#### 5.4 Service Role Key Tidak Ada di `.env.example` & Beredar di `.env`
- `.env` berisi `VITE_SUPABASE_ANON_KEY` (publishable, aman) tapi **tidak ada** `SUPABASE_SERVICE_ROLE_KEY` (yang digunakan script setup admin). Namun, setup-admin script membaca `process.env.SUPABASE_SERVICE_ROLE_KEY` - harus di-set saat run.
- Pastikan `.env` di-`.gitignore`-kan (lihat §5.10).

### Penting - Perlu Perbaikan Segera

#### 5.5 Validasi Input Lemah di `Signup.tsx`
```ts
if (!fullName || !studentId) {
  setError('Semua field harus diisi');
  return;
}
```
- Tidak ada validasi format NIM, kekuatan password (hanya `length < 6`), sanitasi input.
- Tidak ada rate limiting client-side (rentan *brute force* untuk password lemah).
- **Rekomendasi**: Gunakan `zod` + `react-hook-form` (sudah ada di deps). Terapkan aturan: min 8 char, alphanumeric + simbol, NIM regex sesuai pattern universitas.

#### 5.6 N+1 Query di `PublicResultsPage.tsx` & `ResultsPage.tsx`
```ts
const resultsWithVotes = await Promise.all(
  candidates.map(async (candidate) => {
    const { count } = await supabase.from('votes').select(...).eq('candidate_id', candidate.id);
    ...
  })
);
```
- Untuk N kandidat = N query terpisah ke `votes`. Sangat tidak efisien untuk voting dengan banyak kandidat.
- **Rekomendasi**: Gunakan **view/function agregat** di Postgres:
  ```sql
  CREATE VIEW vote_tally AS
  SELECT candidate_id, event_id, COUNT(*) AS total
  FROM votes GROUP BY candidate_id, event_id;
  ```
  Lalu query: `SELECT c.*, COALESCE(vt.total,0) FROM candidates c LEFT JOIN vote_tally vt ON vt.candidate_id = c.id WHERE c.event_id = $1`.

#### 5.7 N+1 Query Sama di `AdminDashboard.tsx` (lines 36-67)
- Sama persis pola N+1 untuk live vote count.
- **Rekomendasi**: Sama seperti 5.6, atau gunakan **Supabase Realtime** pada view dengan trigger increment (increment `candidates.total_votes` saat INSERT ke `votes`). Realtime channel sudah di-subscribe untuk event INSERT, tapi hanya re-fetch `fetchStats()` tanpa agregasi optimal.

#### 5.8 Hardcoded Logo Path di Banyak File
- `"/UniVertexWhite.png"`, `"/UniVertex-Primary.png"`, `"/UniVertexPrimaryWhite.png"`, `"/UniVertex-Horizontal.png"`, `"/UniVertexWhiteHorizontal.png"` muncul di banyak komponen.
- Inkonsisten naming (UniVertexWhite vs UniVertexPrimaryWhite vs UniVertexWhiteHorizontal). Jika salah satu file hilang di `public/`, akan broken image.
- **Rekomendasi**: Konstanta terpusat di `src/lib/brand.ts`:
  ```ts
  export const LOGOS = { primaryLight: '/UniVertex-Primary.png', primaryDark: '/UniVertexWhite.png', horizontal: '/UniVertex-Horizontal.png' };
  ```

#### 5.9 Query `.in('id', eligibleEventIds)` ketika `eligibleEventIds` kosong
- `src/pages/app/Dashboard.tsx` line 77: `supabase.from('election_events').select('*').in('id", [])` - Supabase akan throw error.
- Sudah ada guard di line 66, tapi alur return bisa di-refactor jadi cleaner.

#### 5.10 Cek `.gitignore`
Pastikan:
- `.env` dan `.env*.local` diabaikan
- `node_modules`, `dist`, `bun.lockb` dll sudah diabaikan
- Direkomendasikan: cek apakah `.env` terlacak git (lihat §8 untuk detail).

### Sedang - Best Practice & Maintainability

#### 5.11 Typo & Inkonsistensi Penamaan
- `userEmail || `${selectedUser?.student_id}@university.edu`` (`Users.tsx` line 225) - placeholder email hardcoded, bukan email asli (email tidak di-fetch di halaman Users). Untuk Reset Password Dialog, ini akan mengirim ke email yang salah.
- "Voter" vs "Pemilih" (campur bahasa Inggris/Indonesia, tapi UI memang sengaja dwibahasa di beberapa tempat). Sebaiknya konsisten: pilih salah satu.

#### 5.12 Duplikasi Logic Real-time Vote Counting
- `AdminDashboard.tsx` & `PublicResultsPage.tsx` keduanya fetch votes per-candidate. Pertimbangkan custom hook `useElectionResults(eventId)`.

#### 5.13 Tidak Ada Error Boundary Global
- `App.tsx` tidak wrap dengan `<ErrorBoundary>`. Error runtime di komponen mana pun akan=white screen.
- **Rekomendasi**: Tambah `<ErrorBoundary>` di root, log ke Sentry/equivalent.

#### 5.14 `ProtectedRoute.tsx` Redirect Logic Sederhana
```ts
if (profile?.roles.includes('admin')) return <Navigate to="/admin/dashboard" />;
return <Navigate to="/app/dashboard" />;
```
- User dengan multiple roles (admin + candidate) akan selalu diarahkan ke admin dashboard, tidak bisa mengakses `/app/candidate-dashboard`. Mungkin intentional, tapi perlu klarifikasi.

#### 5.15 ESLint Config Sangat Longgar
```js
"@typescript-eslint/no-unused-vars": "off",
"@typescript-eslint/no-explicit-any": "off",
```
- **`no-explicit-any: off`** menyebabkan code penuh `as any` cast (`Users.tsx`, `Dashboard.tsx`, `VotingPage.tsx`, dll). Defeats purpose of TypeScript.
- **Rekomendasi**: Hidupkan kembali sebagai `warn` atau `error`. Hapus `as any` dan gunakan type narrowing.

#### 5.16 Komponen `Nav` di `Index.tsx` Terlalu Besar (~795 baris)
- Landing page monolitik. Pertimbangkan split: `<HeroSection />`, `<FeaturesSection />`, `<FAQSection />`, `<Footer />`.
- Atau ekstrak `<Navbar />` & `<Footer />` jadi reusable (saat ini Footer ada di Index, PublicResultsPage, PrivacyPolicy, TermsOfService - duplikasi).

#### 5.17 Mock Data di Production Landing Page
- `Index.tsx` line 78: `const participationRate = 87; // Mock data`
- Statistik partisipasi ditampilkan di landing publik padahal tidak ada datanya.
- **Rekomendasi**: Hitung real atau tampilkan placeholder "Coming soon".

#### 5.18 Akses Langsung `auth.users` di Kode yang Tidak Perlu
- `useAuth.ts` line 23-44 membuat subscription `onAuthStateChange` yang fetch profile setiap kali auth state berubah - bagus, tapi `getSession()` + `onAuthStateChange` keduanya set state, bisa double-fetch. Pertimbangkan flag.

#### 5.19 Realtime Channel di `AdminDashboard` Tidak Di-unsubscribe dengan Benar
```ts
const setupRealtimeVotes = () => {
  ...
  return () => { supabase.removeChannel(channel); };
};
```
- Return value ini **tidak pernah dipanggil** (tidak ada `useEffect` yang return function ini). Memory leak.
- **Rekomendasi**:
  ```ts
  useEffect(() => {
    const cleanup = setupRealtimeVotes();
    return cleanup;
  }, []);
  ```

#### 5.20 `<a href="#features">` di SPA
- `Index.tsx` & `PrivacyPolicy.tsx` menggunakan `<a>` untuk navigasi internal, bukan `react-router-dom` `<Link>` atau `<button>` + scroll. Akan reload halaman.
- Untuk anchor section di halaman yang sama, `<a href="#features">` OK, tapi pastikan parent tidak perlu `Link`. Di landing page ini OK (satu halaman).

#### 5.21 `process.env` Override di vite.config.ts
```ts
define: { "process.env": {} }
```
- Mengosongkan `process.env` di build. Library yang membaca `process.env.NODE_ENV` (mis. untuk development-only features) akan rusak.
- Vite sudah menyediakan `import.meta.env.MODE`. Hapus override ini.

### Minor / Nice-to-have

#### 5.22 `getCandidatePhotoUrl` Tidak Handle Error
- Jika storage bucket tidak ada, `getPublicUrl` masih return URL tapi akan 404 saat di-fetch. Pertimbangkan return `null` + fallback `<img>` onError.

#### 5.23 `vitest.config.ts` & Setup Test
- Hanya 3 test files (ProtectedRoute, useAuth, candidate-helpers). Coverage tipis. Idealnya tambah test untuk komponen kritis: `VotingPage`, `ResultsPage`, dialog forms.

#### 5.24 `vercel.json` Sudah Bagus tapi Headers Bisa Ditingkatkan
- Sudah ada `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`.
- Tambahkan: `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy` (perlu diset hati-hati karena Supabase & Google Fonts mungkin di-whitelist).

#### 5.25 README.md Adalah Default Lovable, Bukan Custom
- Mengarahkan ke project Lovable random. Ganti dengan README UniVertex yang menjelaskan setup lokal, environment variables, dan cara deploy.

#### 5.26 CSS Variables untuk Success Variant
- `tailwind.config.ts` line 46-49: `success` color didefinisikan, tapi tidak ada `--success` didefinisikan di `index.css` (perlu dicek). Jika tidak ada, `bg-success` akan jadi transparan. **Verifikasi** dengan menjalankan dev mode.

---

## 6. Migrasi Database - Audit Trail

12 migrasi chronologis menunjukkan evolusi project:
1. `20251030174513` - Schema awal
2. `20251031034634` - Penambahan
3. `20251031035900` - Penambahan
4. `20251031120000_create_admin_user.sql` - Helper functions `make_user_admin`, `create_admin_user`
5. `20251031140000_fix_admin_voter_role.sql` - Trigger `handle_new_user` skip voter role untuk admin
6. `20251101000000_add_get_user_email_function.sql`
7. `20251101100000_add_candidate_approval_system.sql` - Tambah kolom approval di candidates + table notifications
8. `20251101110000_add_admin_create_user_function.sql` - Function `admin_create_user`
9. `20251101120000_fix_admin_update_profiles_policy.sql`
10. `20251101130000_add_admin_notes_to_candidates.sql`
11. `20251102000000_add_election_type_settings.sql` - Tambah `election_type`, `public_results`, `show_results_after_voting`
12. `20251103000000_fix_public_event_access.sql`

**Penilaian:** Iterasi sehat, setiap migrasi fokus satu concern. Namun tidak ada migrasi yang menambahkan **UNIQUE constraint di votes** - penting untuk ditambah (lihat §5.2).

---

## 7. Frontend - Review Komponen

### 7.1 `useAuth.ts` (96 baris)
- Clean, type-safe dengan `Profile` interface.
- Provide derived flags (`isAdmin`, `isVoter`, `isCandidate`).
- `setProfile({...profileData, roles})` - type assertion yang merisikokan jika schema drift.
- `signOut` navigasi ke `/login` bahkan jika user di halaman public - UX minor.

### 7.2 `ProtectedRoute.tsx`
- Test coverage baik (8 test cases).
- Tidak cek apakah `profile` null setelah loading selesai (line 23 hanya cek `user`). Untuk admin route: `requireRole="admin"` tapi `profile` bisa null. Tambah guard `if (!profile)` redirect ke login juga.

### 7.3 `Login.tsx` / `Signup.tsx` / `ResetPassword.tsx`
- Pola serupa: `useEffect` cek session, redirect. Duplikasi 3x.
- **Rekomendasi**: Ekstrak custom hook `useRedirectIfAuthenticated()`.
- Error handling: `try/catch` lalu `setError(error.message)` - TIDAK menampilkan error jika error TIDAK instance of Error (lihat `Signup.tsx` line 84 `error: any`).

### 7.4 `VotingPage.tsx`
- Tidak cek apakah user sudah vote (line 53-89). Frontend hanya insert; constraint DB seharusnya cegah (tapi §5.2!). Tambah pre-check `SELECT FROM votes WHERE voter_id = $1 AND event_id = $2`.
- Tidak cek `event.status === 'active'` sebelum tampilkan voting UI.
- Tidak cek apakah user termasuk DPT event (`event_voter_groups`). RLS memungkinkan insert jika user terautentikasi, tapi tidak ada validasi class membership.

### 7.5 `ResultsPage.tsx` & `PublicResultsPage.tsx`
- Banyak duplikasi (lihat §5.6).
- `PublicResultsPage.tsx` lebih lengkap (handle election_type, open/closed logic).
- `ResultsPage.tsx` (private) tidak handle case event belum close / user belum vote.

### 7.6 Admin Pages
- `Dashboard.tsx` (185 baris): Live vote count, N+1 queries (lihat §5.7), channel leak (lihat §5.19).
- `Events.tsx`: Standar CRUD list. Bagus.
- `EventDetail.tsx`: Kompleks, banyak sub-dialogs. Bagus tapi bisa dipecah.
- `Users.tsx`: Filter out admin dari list - by design. Note email field selalu undefined karena `getUserEmail` tidak dipanggil di sini (lihat §5.11).
- `Classes.tsx`: Standar CRUD + bulk assign dialog.

### 7.7 App Pages
- `Dashboard.tsx`: Logic eligibility sudah benar (cek class_id di event_voter_groups). Banyak `console.log` di production (lines 28, 32, 53-58, 67, 74) - bersihkan.
- `VotingPage.tsx`: lihat §7.4.
- `ResultsPage.tsx`: lihat §7.5.
- `Profile.tsx`: Form edit profile + change password. Bagus. Pakai `supabase.auth.updateUser({ password })` - perlu session aktif (harus dari user yang login). Bagus.
- `CandidateSettings.tsx`: Update candidate -> reset status ke `pending`. workflow benar.
- `CandidateDashboard.tsx`: Notifikasi + vote stats. Bagus.

---

## 8. Keamanan (Security Review)

### Aspek Baik
- **RLS aktif di semua tabel** + storage bucket.
- **Anon key** dipakai di frontend (bukan service role key).
- **Vercel headers** untuk `X-Frame-Options`, `X-XSS-Protection`, `X-Content-Type-Options`.
- **Anonimitas suara**: hanya admin bisa SELECT votes.
- **Storage policies**: per-user folder, tidak bisa overwrite foto kandidat lain.

### Aspek Perlu Diperkuat
1. **Unique constraint di `votes`** WAJIB (lihat §5.2).
2. **Public signup** (lihat §5.1) - pertimbangkan trade-off antara UX vs kontrol admin.
3. **Password policy lemah**: minimal 6 karakter (lihat §5.5). Standar industri: 8+ dengan kompleksitas.
4. **Tidak ada rate limiting** di `resetPasswordForEmail` (rentan spam email).
5. **Tidak ada 2FA** untuk admin.
6. **Email enumeration**: `resetPasswordForEmail` selalu return success tanpa expose apakah email terdaftar (good!) tapi cek lagi.
7. **CSP**: belum ada Content-Security-Policy. Tambah dengan hati-hati (lihat §5.24).
8. **`.env` file**: HARUS di `.gitignore`. Cek apakah terlacak git:
   ```sh
   git check-ignore -v .env
   ```
9. **CSP-friendly image sources**: foto kandidat dari Supabase Storage (`*.supabase.co`) - pastikan CORS & CSP allow.
10. **Tidak ada audit log**: siapa yang approve kandidat, edit event, dll. `approved_by` ada di candidates, tapi tidak ada general activity log.

---

## 9. Performa

### Bundle Optimization
- `vite.config.ts` punya manual chunks yang baik (`react-vendor`, `ui-components`, `data-layer`, `forms`, `charts`, `utils`).
- `chunkSizeWarningLimit: 1000` reasonable untuk shadcn project.

### Runtime Performance
- **N+1 queries** di live vote count (lihat §5.7).
- **Index**: Tidak terlihat ada eksplisit index di `votes(candidate_id)`, `votes(event_id)`, `votes(voter_id)`. Seharusnya:
  ```sql
  CREATE INDEX idx_votes_candidate ON votes(candidate_id);
  CREATE INDEX idx_votes_event ON votes(event_id);
  CREATE INDEX idx_votes_voter_event ON votes(voter_id, event_id);
  ```
- **Realtime channel leak** (lihat §5.19).

---

## 10. Testing

### Current Coverage
- `ProtectedRoute.test.tsx` (239 baris, 8 cases)
- `useAuth.test.ts` (223 baris, 6 cases)
- `candidate-helpers.test.ts` (149 baris, 12 cases)
- `utils.test.ts` - belum dibaca tapi ada.

### Kritis yang Belum Ada Test
- `VotingPage` (vote submission, error handling)
- `ResultsPage` (rendering, sort)
- Admin CRUD dialogs (form validation, success/error)
- RLS policies (perlu pgTAP atau integrasi Supabase testing)

**Rekomendasi**: Capai minimal 70% coverage untuk hooks, utils, dan pages yang handle business logic.

---

## 11. Deployment & CI/CD

- **Vercel**: `vercel.json` configured. SPA rewrites semua -> `/`. Build command `bun run build`.
- **Environment**: Pastikan production Supabase keys berbeda dari dev.
- **Migration workflow**: `supabase db push` (lihat scripts/README.md). Untuk production, set up GitHub Action untuk auto-test migrasi di PR.
- **Branches Supabase**: Belum terlihat bukti penggunaan (cek `supabase branches list`).

---

## 12. Checklist Prioritas Perbaikan

| # | Item | Severity | Effort |
|---|------|----------|--------|
| 1 | Tambah `UNIQUE(voter_id, event_id)` di `votes` | Kritis | 5 min |
| 2 | Putuskan & implementasikan signup policy (strict vs hybrid) | Kritis | 1-2 days |
| 3 | Ganti password admin default + dokumentasikan prosedur rotasi | Kritis | 30 min |
| 4 | Optimalkan query live vote count (view/function) | Tinggi | 1 day |
| 5 | Ganti string `'unique'` check dengan `error.code === '23505'` | Tinggi | 15 min |
| 6 | Fix Realtime channel cleanup di AdminDashboard | Tinggi | 15 min |
| 7 | Hidupkan `no-explicit-any` ESLint rule & refactor `as any` | Sedang | 2-3 days |
| 8 | Extract reusable Navbar/Footer component | Sedang | 1 day |
| 9 | Tambah index di kolom votes untuk performa | Sedang | 10 min |
| 10 | Tambah validasi form dengan zod di Signup/Login | Sedang | 1 day |
| 11 | Tambah ErrorBoundary global | Sedang | 30 min |
| 12 | Perkuat CSP & security headers di vercel.json | Sedang | 1 hour |
| 13 | Verifikasi `.env` di-gitignore | Rendah | 1 min |
| 14 | Refactor `Index.tsx` (795 baris) jadi sub-components | Rendah | 2 days |
| 15 | Bersihkan `console.log` dari production builds | Rendah | 30 min |
| 16 | Tambah test coverage untuk VotingPage, ResultsPage | Rendah | 2-3 days |
| 17 | Update README.md dengan setup lokal & deploy guide | Rendah | 1 hour |

---

## 13. Dokumentasi yang Direkomendasikan untuk Ditambahkan

1. **`ARCHITECTURE.md`** - diagram alur data, sequence voting, sequence approval kandidat.
2. **`API_REFERENCE.md`** - autogenerated dari Supabase functions/policies.
3. **`DEPLOYMENT.md`** - step-by-step production deployment + Supabase setup.
4. **`CONTRIBUTING.md`** - coding standards, branching strategy, testing requirements.
5. **`SECURITY.md`** - model ancaman, prosedur pelaporan vulnerability.
6. **`CHANGELOG.md`** - track perubahan per release.

---

## 14. Kesimpulan

UniVertex sudah berada di jalur yang benar sebagai platform e-voting universitas:

**Kekuatan arsitektural:**
- Stack modern dan maintainable.
- RLS policies komprehensif, keamanan data suara kuat.
- Realtime untuk live count.
- Multi-role RBAC dengan table terpisah (`user_roles`).
- Approval workflow kandidat yang thoughtful.
- Testing infrastructure setup dengan Vitest.

**Risiko utama yang harus dimitigasi sebelum production:**
1. Tidak ada UNIQUE constraint di tabel `votes` (vote integrity).
2. Kontradiksi signup publik vs kebijakan admin-only.
3. Password admin default hardcoded.

Setelah ketiga isu kritis ini ditangani, ditambah optimalisasi N+1 query dan perbaikan ESLint, platform ini akan **production-ready** untuk deployment universitas.

---

*Dokumen ini dibuat sebagai bagian dari review teknis berkala. Update secara berkala seiring evolusi codebase.*
