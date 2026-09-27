# **Konsep Proyek: UniVertex**

Revisi: 1.0  
Tanggal: 31 Oktober 2025

## **1\. Visi & Filosofi Proyek**

Nama Proyek: UniVertex  
Filosofi: Nama "UniVertex" menggabungkan "Uni" (Universitas) dan "Vertex" (Puncak atau Titik Temu).  
**Visi:** Menjadi **puncak platform demokrasi digital** di lingkungan universitas. UniVertex adalah titik temu di mana suara setiap mahasiswa dikonversi menjadi data yang aman, transparan, dan terverifikasi, yang berpuncak pada kepemimpinan yang sah dan tepercaya.

**Masalah yang Diselesaikan:**

* Proses pemilihan manual yang lambat, rentan terhadap kesalahan penghitungan, dan tidak efisien.  
* Kurangnya transparansi dalam proses pemungutan dan rekapitulasi suara.  
* Tingkat partisipasi (golput) yang tinggi karena akses yang rumit untuk memberikan suara.  
* Sulitnya mengelola daftar pemilih tetap (DPT) yang akurat dan berbasis perwakilan (kelas/jurusan).

Solusi yang Ditawarkan:  
Sebuah aplikasi web yang aman, terpusat, dan mudah diakses yang mengelola seluruh siklus pemilihan—mulai dari manajemen acara, verifikasi pemilih, hingga pemungutan suara dan rekapitulasi real-time—dengan integritas yang didukung oleh teknologi modern.

## **2\. Arsitektur Teknis & Stack**

Arsitektur ini dipilih untuk memaksimalkan kecepatan pengembangan, keamanan, dan skalabilitas *real-time* dengan memanfaatkan ekosistem Supabase.

1. **Backend & Database:** **Supabase**  
   * **Database:** Supabase Postgres digunakan untuk semua penyimpanan data relasional (acara, kandidat, suara, dll.).  
   * **Authentication:** **Supabase Auth** akan mengelola seluruh identitas pengguna. Ini secara *default* sudah mencakup alur Register, Login (Email/Password, OAuth, Magic Link), dan Reset Password.  
   * **Keamanan Data:** **Row Level Security (RLS)** akan diaktifkan secara ketat. Ini adalah inti dari implementasi RBAC, di mana kami akan mendefinisikan *policy* di level database (mis: "Hanya Admin yang bisa menulis ke tabel election\_events").  
   * **Realtime:** Supabase Realtime akan digunakan untuk fitur seperti *live vote count* di *dashboard* admin.  
2. **Frontend:** (Rekomendasi)  
   * **Framework:** React (Next.js) atau Vue (Nuxt.js).  
   * **Styling:** Tailwind CSS untuk utilitas UI yang cepat dan modern.  
   * **State Management:** Zustand atau React Context/Query.

## **3\. Pengguna & Role-Based Access Control (RBAC)**

Sistem akan memiliki tiga peran utama. Akses akan dikelola melalui *custom claims* di Supabase Auth atau (lebih disarankan) kolom role di tabel profiles yang terhubung ke tabel users.

1. **Admin (Panitia Pemilihan)**  
   * **Kekuasaan:** Akses penuh ke sistem.  
   * **Tugas:**  
     * Mengelola Acara Pemilihan (CRUD: Create, Read, Update, Delete).  
     * Mengelola Daftar Pemilih Tetap (DPT) per kelas/jurusan.  
     * Mendaftarkan/Memvalidasi akun Kandidat.  
     * Memulai dan mengakhiri periode pemungutan suara.  
     * Memantau rekapitulasi suara secara *real-time*.  
     * Mempublikasikan hasil akhir pemilihan.  
2. **Voter (Pemilih)**  
   * **Kekuasaan:** Akses terbatas.  
   * **Tugas:**  
     * Melakukan login dan verifikasi identitas (mis: NIM).  
     * Melihat daftar acara pemilihan yang aktif untuk mereka.  
     * Melihat profil kandidat (visi, misi, foto).  
     * Memberikan **satu suara** per acara pemilihan.  
     * Melihat hasil akhir setelah dipublikasikan oleh Admin.  
3. **Candidate (Kandidat)**  
   * **Kekuasaan:** Peran khusus yang ditugaskan oleh Admin.  
   * **Tugas:**  
     * Login seperti pemilih.  
     * Mengelola profil kandidat mereka sendiri (upload foto, mengisi visi & misi) setelah disetujui Admin.  
     * Melihat hasil (tetapi tidak dapat memanipulasi suara).

## **4\. Fitur Utama (Fungsionalitas)**

### **Modul 1: Autentikasi & Manajemen Akun (Supabase Auth)**

* **Registrasi:** Alur registrasi akan **terbatas/termoderasi**. Kemungkinan besar Admin akan mengimpor data mahasiswa (NIM, Email, Kelas) sebagai DPT, yang kemudian dapat "mengklaim" akun mereka atau di-generate-kan password awal.  
* **Login:** Menggunakan Email/NIM dan Password.  
* **Reset Password:** Alur "Lupa Password" standar melalui email.  
* **Manajemen Profil:** Pengguna dapat mengubah info dasar (nama, password).

### **Modul 2: Manajemen Acara Pemilihan (Admin)**

* Admin dapat membuat acara pemilihan baru (mis: "Pemilihan Ketua BEM 2025").  
* Setiap acara memiliki:  
  * Nama/Judul.  
  * Deskripsi/Banner.  
  * Jadwal Mulai (Tanggal & Waktu).  
  * Jadwal Selesai (Tanggal & Waktu).  
  * Status (Draft, Aktif, Selesai).  
* Admin menautkan kandidat dan kelompok pemilih (kelas) ke acara tersebut.

### **Modul 3: Manajemen Pemilih & Kelas (Admin)**

* Ini adalah fitur "Pengelolaan Pemilih Tetap per Kelas".  
* Admin dapat melakukan CRUD untuk entitas Class (mis: "Teknik Informatika 2022", "Hukum 2023").  
* Admin dapat **mengimpor (via CSV) atau menambah data mahasiswa** (Pemilih) dan menugaskan mereka ke Class yang sesuai.  
* Ini akan menjadi dasar DPT. Hanya pengguna yang terdaftar di DPT yang dapat login dan memberikan suara.

### **Modul 4: Manajemen Kandidat (Admin & Kandidat)**

* Admin mendaftarkan seorang Voter untuk menjadi Candidate dalam sebuah Election Event.  
* Setelah didaftarkan, Candidate dapat login dan mengisi profilnya (visi, misi, foto).  
* Admin harus memvalidasi/menyetujui perubahan profil kandidat sebelum ditampilkan ke publik.

### **Modul 5: Antarmuka Pemungutan Suara (Voter)**

* Halaman *voting* yang bersih dan aman.  
* Pemilih melihat daftar kandidat untuk acara yang sedang aktif.  
* Pemilih memilih satu kandidat dan melakukan konfirmasi.  
* Sistem **wajib** memastikan **satu pemilih hanya bisa memberikan satu suara per acara** (diterapkan di level *database constraint*).

### **Modul 6: Dashboard & Rekapitulasi (Admin)**

* Halaman khusus Admin untuk memantau perolehan suara secara *real-time*.  
* Menampilkan grafik batang atau diagram lingkaran dari total suara masuk.  
* Menampilkan statistik partisipasi (mis: 750 dari 1000 pemilih telah memilih).

## **5\. Desain Skema Database (Konseptual \- Supabase Postgres)**

Ini adalah struktur tabel inti yang disarankan.

\-- Tabel ini (dikelola Supabase) menyimpan info login privat  
\-- auth.users (id, email, password\_hash, etc.)

\-- 1\. Tabel Publik untuk menyimpan data pengguna dan peran (RBAC)  
CREATE TABLE profiles (  
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  
  full\_name TEXT NOT NULL,  
  student\_id TEXT UNIQUE NOT NULL, \-- NIM  
  class\_id INT REFERENCES classes(id),  
  role TEXT NOT NULL DEFAULT 'voter' \-- ('voter', 'admin', 'candidate')  
);

\-- 2\. Tabel untuk mengelola DPT per kelas  
CREATE TABLE classes (  
  id SERIAL PRIMARY KEY,  
  name TEXT NOT NULL, \-- e.g., "Informatika 2022"  
  faculty TEXT \-- e.g., "Fakultas Teknik"  
);

\-- 3\. Tabel Acara Pemilihan  
CREATE TABLE election\_events (  
  id SERIAL PRIMARY KEY,  
  title TEXT NOT NULL,  
  description TEXT,  
  start\_time TIMESTAMPTZ NOT NULL,  
  end\_time TIMESTAMPTZ NOT NULL,  
  status TEXT NOT NULL DEFAULT 'draft' \-- ('draft', 'active', 'closed')  
);

\-- 4\. Tabel Kandidat (menghubungkan user ke event)  
CREATE TABLE candidates (  
  id SERIAL PRIMARY KEY,  
  user\_id UUID NOT NULL REFERENCES profiles(id),  
  event\_id INT NOT NULL REFERENCES election\_events(id),  
  vision TEXT,  
  mission TEXT,  
  photo\_url TEXT,  
  \-- Constraint agar 1 user hanya bisa jadi 1 kandidat di 1 event  
  UNIQUE(user\_id, event\_id)  
);

\-- 5\. Tabel Suara (Tabel Paling Kritis)  
CREATE TABLE votes (  
  id BIGSERIAL PRIMARY KEY,  
  voter\_id UUID NOT NULL REFERENCES profiles(id),  
  candidate\_id INT NOT NULL REFERENCES candidates(id),  
  event\_id INT NOT NULL REFERENCES election\_events(id),  
  created\_at TIMESTAMPTZ DEFAULT now(),  
    
  \-- PENTING: Mencegah 1 pemilih vote lebih dari 1x di 1 event  
  UNIQUE(voter\_id, event\_id)  
);

\-- 6\. Tabel untuk menghubungkan DPT (kelas) ke acara pemilihan  
\-- Agar tidak semua kelas bisa vote di semua acara  
CREATE TABLE event\_voter\_groups (  
  id SERIAL PRIMARY KEY,  
  event\_id INT NOT NULL REFERENCES election\_events(id),  
  class\_id INT NOT NULL REFERENCES classes(id),  
  UNIQUE(event\_id, class\_id)  
);  
