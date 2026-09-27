> **ARSIP PROMPT AWAL — superseded.** Skema/RBAC/halaman di bawah adalah prompt bootstrap (SERIAL IDs, `profiles.role`, `active/closed`). Aktual: UUID, `user_roles`, 6-state, 5 role. Acuan aktif: `AGENTS.md` + `supabase/migrations/`.

# TECHNICAL PROMPT: UniVertex (Aplikasi E-Voting Universitas)

## 1. Core Stack

-   **Aplikasi:** UniVertex
    
-   **Framework:** React (Next.js)
    
-   **Database & Backend:** Supabase
    
-   **Styling:** Tailwind CSS
    

## 2. Model Data & Skema Database (Supabase Postgres)

Buat skema database berikut. **Row Level Security (RLS) harus diaktifkan (enabled) untuk semua tabel.**

```
--- 1. Tabel untuk Kelas/Grup Pemilih (DPT)
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- e.g., "Informatika 2022"
  faculty TEXT, -- e.g., "Fakultas Teknik"
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE classes IS 'Mengelola Daftar Pemilih Tetap (DPT) berdasarkan grup/kelas.';

--- 2. Tabel Profil Publik (Ekstensi dari auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  student_id TEXT UNIQUE NOT NULL, -- NIM (Nomor Induk Mahasiswa)
  class_id INT REFERENCES classes(id) ON DELETE SET NULL, -- Relasi ke DPT
  role TEXT NOT NULL DEFAULT 'voter' -- Peran: 'voter', 'admin', 'candidate'
);
COMMENT ON TABLE profiles IS 'Menyimpan data publik dan peran RBAC untuk setiap pengguna.';

--- 3. Tabel Acara Pemilihan
CREATE TABLE election_events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' -- Status: 'draft', 'active', 'closed'
);
COMMENT ON TABLE election_events IS 'Manajemen acara pemilihan oleh Admin.';

--- 4. Tabel penghubung DPT (Kelas) ke Acara Pemilihan
CREATE TABLE event_voter_groups (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES election_events(id) ON DELETE CASCADE,
  class_id INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  UNIQUE(event_id, class_id) -- Memastikan 1 kelas hanya ditambah 1x per event
);
COMMENT ON TABLE event_voter_groups IS 'Menentukan kelas mana yang boleh memilih di event tertentu.';

--- 5. Tabel Kandidat
CREATE TABLE candidates (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, -- Kandidat adalah seorang user/profile
  event_id INT NOT NULL REFERENCES election_events(id) ON DELETE CASCADE,
  vision TEXT,
  mission TEXT,
  photo_url TEXT,
  total_votes INT DEFAULT 0, -- Denormalisasi untuk live count (opsional, bisa di-trigger)
  UNIQUE(user_id, event_id) -- 1 user hanya bisa jadi 1 kandidat di 1 event
);
COMMENT ON TABLE candidates IS 'Profil kandidat yang berpartisipasi dalam sebuah event.';

--- 6. Tabel Suara (Tabel Kritis)
CREATE TABLE votes (
  id BIGSERIAL PRIMARY KEY,
  voter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  event_id INT NOT NULL REFERENCES election_events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint paling penting: 1 pemilih, 1 suara per event
  UNIQUE(voter_id, event_id)
);
COMMENT ON TABLE votes IS 'Mencatat setiap suara yang masuk. Dilindungi RLS ketat.';
```

## 3. Autentikasi & RBAC (Role-Based Access Control)

### 3.1. Penyedia: Supabase Auth

-   Gunakan Supabase Auth untuk seluruh alur: **Login** (Email/NIM + Password), **Registrasi**, **Reset Password**.
    
-   **Registrasi:** Registrasi *tidak* terbuka. Admin harus mengimpor atau membuat akun untuk pemilih. Buat fitur "Import CSV" di panel admin untuk mengisi tabel `profiles` dan `classes`.
    

### 3.2. Peran (Roles)

Peran disimpan di kolom `profiles.role`.

1.  **`admin`:**
    
    -   CRUD penuh pada tabel: `classes`, `election_events`, `event_voter_groups`.
        
    -   READ: `votes` (untuk rekapitulasi).
        
    -   CRUD: `profiles` (mendaftarkan pemilih, mengubah peran).
        
    -   CRUD: `candidates` (mendaftarkan kandidat).
        
2.  **`voter`:**
    
    -   READ: `election_events`, `candidates`, `classes` (terbatas).
        
    -   READ: `profiles` (hanya data sendiri).
        
    -   CREATE: `votes` (hanya untuk `voter_id` milik sendiri dan `event_id` yang aktif).
        
    -   UPDATE: `profiles` (hanya data sendiri).
        
3.  **`candidate`:**
    
    -   Sama seperti `voter`, TAPI:
        
    -   UPDATE: `candidates` (hanya untuk `user_id` milik sendiri - untuk mengisi visi/misi).
        

### 3.3. Kebijakan RLS (Row Level Security) - WAJIB

-   **`profiles`**: Pengguna hanya bisa UPDATE/READ data mereka sendiri (`auth.uid() = id`). Admin bisa melakukan semua.
    
-   **`election_events`**: Admin bisa CRUD. Role lain hanya bisa READ (SELECT).
    
-   **`candidates`**: Admin bisa CRUD. `candidate` bisa UPDATE data mereka sendiri (`auth.uid() = user_id`). `voter` hanya bisa READ.
    
-   **`votes`**:
    
    -   INSERT: Hanya `voter` terautentikasi (`auth.role() = 'authenticated'`).
        
    -   CHECK (Insert): Pastikan `voter_id` adalah `auth.uid()`.
        
    -   SELECT: Hanya `admin` yang bisa READ. (PENTING untuk anonimitas).
        
-   **`classes` & `event_voter_groups`**: Hanya `admin` yang bisa CRUD. Role lain bisa READ.
    

## 4. Struktur Halaman & Alur Fungsional

### 4.1. Halaman Publik (Non-Auth)

-   **/login**: Halaman login (Email/NIM & Password).
    
-   **/reset-password**: Alur lupa password Supabase Auth.
    

### 4.2. Halaman Admin (`/admin/...`)

-   **Layout Admin Terproteksi** (Hanya untuk `role='admin'`).
    
-   **/admin/dashboard**: Halaman utama. Menampilkan statistik cepat dan **rekapitulasi suara** ***real-time*** (gunakan Supabase Realtime pada tabel `votes` atau `candidates.total_votes`).
    
-   **/admin/events**: CRUD (Create, Read, Update, Delete) untuk `election_events`.
    
-   **/admin/events/[id]**: Halaman detail event. Admin dapat:
    
    -   Menambahkan/Menghapus `candidates` ke event ini.
        
    -   Menambahkan/Menghapus `classes` yang boleh memilih (mengelola `event_voter_groups`).
        
-   **/admin/users**: CRUD untuk `profiles`. Mengubah peran, reset password manual.
    
-   **/admin/dpt**: CRUD untuk `classes` dan fitur **Impor CSV** untuk *bulk upload* pemilih ke `profiles` dan `classes`.
    

### 4.3. Halaman Pemilih & Kandidat (`/app/...`)

-   **Layout Aplikasi Terproteksi** (Hanya untuk `role='voter'` atau `role='candidate'`).
    
-   **/app/dashboard**: Halaman utama. Menampilkan daftar `election_events` yang `status='active'` DAN pemilih berhak memilih (cocokkan `profiles.class_id` dengan `event_voter_groups.class_id`).
    
-   **/app/vote/[event_id]**: Halaman pemungutan suara.
    
    -   Tampilkan daftar `candidates` untuk `event_id` ini.
        
    -   Tampilkan tombol "VOTE" pada setiap kandidat.
        
    -   **Logika:** Saat tombol "VOTE" diklik:
        
        1.  Lakukan `INSERT` ke tabel `votes` dengan `voter_id`, `candidate_id`, `event_id`.
            
        2.  Gunakan `try/catch`. Jika berhasil, arahkan ke halaman "Terima Kasih".
            
        3.  Jika gagal (karena *constraint* `UNIQUE(voter_id, event_id)`), tampilkan pesan "Error: Anda sudah memberikan suara".
            
-   **/app/results**: Menampilkan hasil pemilihan (hanya untuk event yang `status='closed'`).
    
-   **/app/profile**: Halaman untuk `voter` mengedit `profiles` (nama, password).
    
-   **/app/profile/candidate**: **(Hanya untuk `role='candidate'`)** Halaman tambahan di profil di mana kandidat bisa mengedit data `candidates` mereka (visi, misi, foto_url).