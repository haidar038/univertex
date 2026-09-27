### **Aplikasi E-Voting UniVertex**

#### **1\. Konsep Aplikasi Inti**

* **Nama Aplikasi:** UniVertex  
* **Tujuan:** Aplikasi web e-voting yang aman untuk pemilihan universitas (BEM, Himpunan, dll.).  
* **Stack:** React (Next.js), Tailwind CSS, dan Supabase.

#### **2\. Model Data (Tabel Supabase)**

Buat tabel Supabase berikut:

1. **classes (DPT / Grup Pemilih):**  
   * id (primary key)  
   * name (text, unique, cth: "Informatika 2022")  
   * faculty (text, cth: "Fakultas Teknik")  
2. **profiles (Profil Pengguna & RBAC):**  
   * id (UUID, foreign key ke auth.users.id, primary key)  
   * full\_name (text)  
   * student\_id (text, unique, cth: "NIM")  
   * role (text, default: 'voter', nilai: 'admin', 'voter', 'candidate')  
   * class\_id (foreign key ke classes.id)  
3. **election\_events (Acara Pemilihan):**  
   * id (primary key)  
   * title (text, cth: "Pemilihan Ketua BEM 2025")  
   * description (text)  
   * start\_time (timestamp)  
   * end\_time (timestamp)  
   * status (text, default: 'draft', nilai: 'draft', 'active', 'closed')  
4. **candidates (Kandidat):**  
   * id (primary key)  
   * user\_id (foreign key ke profiles.id)  
   * event\_id (foreign key ke election\_events.id)  
   * vision (text)  
   * mission (text)  
   * photo\_url (text)  
5. **votes (Kotak Suara):**  
   * id (primary key)  
   * voter\_id (foreign key ke profiles.id)  
   * candidate\_id (foreign key ke candidates.id)  
   * event\_id (foreign key ke election\_events.id)  
   * *Constraint:* Tambahkan *unique constraint* pada (voter\_id, event\_id) untuk memastikan 1 pemilih 1 suara.  
6. **event\_voter\_groups (Penghubung Event & DPT):**  
   * id (primary key)  
   * event\_id (foreign key ke election\_events.id)  
   * class\_id (foreign key ke classes.id)  
   * *Constraint:* Tambahkan *unique constraint* pada (event\_id, class\_id).

#### **3\. Autentikasi & Halaman Publik**

* Gunakan **Supabase Auth** untuk autentikasi.  
* **Halaman /login:** Halaman login standar dengan Email (atau NIM/student\_id) dan Password.  
* **Halaman /reset-password:** Alur standar Supabase untuk lupa password.  
* **Logika Pendaftaran:** Pendaftaran publik **DINONAKTIFKAN**. Akun hanya bisa dibuat oleh Admin.

#### **4\. Role 1: Panel Admin (role: 'admin')**

Buat layout /admin yang terproteksi hanya untuk peran admin.

1. **Halaman /admin/dashboard:**  
   * Menampilkan statistik (total pemilih, total event).  
   * Menampilkan **Komponen Live Vote Count** untuk election\_events yang sedang status='active'. Gunakan Supabase Realtime untuk mendengarkan perubahan pada tabel votes.  
2. **Halaman /admin/events:**  
   * Menampilkan tabel data election\_events dengan fungsi CRUD (Create, Read, Update, Delete).  
   * Form untuk membuat/mengedit event (Title, Description, Start Time, End Time, Status).  
3. **Halaman /admin/events/\[id\] (Detail Event):**  
   * Tab 1: **Kelola Kandidat:**  
     * Tampilkan daftar candidates untuk event ini.  
     * Fitur "Tambah Kandidat": Cari dari tabel profiles, pilih user, lalu tambahkan sebagai candidates di event ini.  
   * Tab 2: **Kelola Pemilih (DPT):**  
     * Tampilkan daftar classes yang boleh memilih di event ini (dari event\_voter\_groups).  
     * Fitur "Tambah Grup Pemilih": Pilih dari tabel classes dan tambahkan ke event ini.  
4. **Halaman /admin/users (Manajemen Pengguna):**  
   * Menampilkan tabel data profiles (terhubung ke classes).  
   * Fitur untuk **Membuat Akun Baru** (Form: Nama, NIM, Email, Password, pilih class\_id, pilih role).  
   * Fitur untuk **Mengedit Pengguna** (mengubah nama, class\_id, role).  
   * (Opsional) Fitur **"Impor CSV"** untuk *bulk upload* data ke profiles dan classes.  
5. **Halaman /admin/dpt (Manajemen Kelas):**  
   * Menampilkan tabel data classes dengan fungsi CRUD (Nama Kelas, Fakultas).

#### **5\. Role 2 & 3: Panel Pemilih & Kandidat (role: 'voter' / 'candidate')**

Buat layout /app yang terproteksi untuk peran voter dan candidate.

1. **Halaman /app/dashboard (Halaman Utama Pemilih):**  
   * Tampilkan daftar election\_events yang berstatus active DAN pemilih terdaftar di dalamnya (Logika: profiles.class\_id harus ada di event\_voter\_groups untuk event tersebut).  
   * Tampilkan pesan jika tidak ada pemilihan aktif.  
   * Tampilkan election\_events yang berstatus closed di bagian "Hasil Pemilihan".  
2. **Halaman /app/vote/\[event\_id\] (Halaman Voting):**  
   * Hanya bisa diakses jika event status='active' dan pemilih belum vote.  
   * Tampilkan profil semua candidates (foto, nama, visi, misi) untuk event\_id ini.  
   * Setiap kandidat memiliki tombol **"VOTE"**.  
   * **Logika Voting:**  
     1. Klik "VOTE" \-\> Tampilkan modal konfirmasi "Apakah Anda yakin?"  
     2. Konfirmasi \-\> Lakukan INSERT ke tabel votes.  
     3. Jika berhasil: Arahkan ke halaman "Terima kasih, suara Anda telah dicatat".  
     4. Jika gagal (karena *unique constraint*): Tampilkan pesan error "Anda sudah memberikan suara untuk pemilihan ini".  
3. **Halaman /app/results/\[event\_id\] (Halaman Hasil):**  
   * Hanya bisa diakses jika event status='closed'.  
   * Tampilkan perolehan suara (grafik batang) untuk setiap kandidat di event ini.  
4. **Halaman /app/profile (Profil Pengguna):**  
   * Izinkan pengguna (voter/candidate) mengedit profiles.full\_name dan mengubah password.  
5. **Halaman /app/profile/candidate-settings (HANYA role: 'candidate')**  
   * Jika role adalah candidate, tampilkan tab/halaman tambahan ini.  
   * Izinkan kandidat mengedit data candidates mereka sendiri (hanya untuk user\_id mereka) seperti vision, mission, dan photo\_url.