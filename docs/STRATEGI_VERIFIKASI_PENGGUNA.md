Itu adalah poin yang sangat penting. Keamanan dan validitas data pemilih serta kandidat adalah fondasi dari sistem e-voting yang tepercaya.

Berdasarkan konsep kita, mari kita bagi menjadi dua strategi verifikasi yang berbeda:

1.  **Verifikasi Pemilih (Memastikan Mahasiswa Aktif)**
2.  **Verifikasi Kandidat (Memastikan Kelayakan & Kepercayaan)**

---

### 1. 🎯 Strategi Verifikasi Pemilih (Mahasiswa Aktif)

Tujuan utamanya adalah memastikan bahwa hanya mahasiswa aktif yang terdaftar di universitas yang dapat memberikan suara, dan mereka hanya bisa melakukannya satu kali.

Metode terbaik di lingkungan universitas adalah **Model DPT (Daftar Pemilih Tetap) Terpusat** yang dikelola oleh Admin.

**Alur Kerja yang Direkomendasikan:**

1.  **Bukan _Self-Registration_:** Jangan izinkan mahasiswa mendaftar sendiri secara publik. Ini membuka celah untuk akun palsu, mahasiswa non-aktif, atau duplikasi data.
2.  **Data Bersumber dari Universitas:** Admin (sebagai Panitia Pemilu) harus meminta data resmi mahasiswa aktif (DPT) dari pihak Rektorat atau Bagian Akademik. Data ini biasanya berupa file Excel/CSV yang berisi:
    -   Nama Lengkap
    -   NIM (Nomor Induk Mahasiswa)
    -   Email Resmi Universitas (jika ada)
    -   Kelas/Jurusan/Fakultas (untuk tabel `classes`)
3.  **Impor Massal oleh Admin:** Anda (sebagai Admin) menggunakan fitur "Impor CSV" di panel admin UniVertex untuk mengunggah data DPT tersebut.
4.  **Pembuatan Akun Otomatis:** Sistem secara otomatis membuat akun di Supabase Auth (`auth.users`) dan data di tabel `profiles` untuk setiap mahasiswa dalam daftar tersebut.
    -   `student_id` (NIM) akan menjadi _username_ atau _field_ unik.
    -   Sistem dapat men-generate _password default_ (misal: "NIM@2025") yang harus diganti oleh mahasiswa saat login pertama kali.
5.  **Proses Login:** Mahasiswa login menggunakan NIM dan password default tersebut.

**Mengapa Metode Ini Aman?**

-   **Satu Sumber Kebenaran:** Data berasal langsung dari universitas, bukan dari _input_ pengguna yang tidak terverifikasi.
-   **Mencegah Duplikasi:** Karena NIM bersifat unik, tidak mungkin ada pemilih ganda.
-   **Beban Kerja Rendah:** Jauh lebih efisien daripada meminta ribuan mahasiswa mengupload foto KTM (Kartu Tanda Mahasiswa) satu per satu dan memverifikasinya secara manual.

---

### 2. 🛡️ Strategi Verifikasi Kandidat (Kelayakan & Kepercayaan)

Ini adalah proses yang jauh lebih ketat karena kandidat memiliki _privilege_ lebih tinggi. Ide Anda sudah sangat tepat. Kita bisa mengintegrasikannya ke dalam alur aplikasi.

**Alur Kerja yang Direkomendasikan:**

1.  **Pengajuan Pendaftaran (In-App):**

    -   Seorang `voter` yang ingin menjadi kandidat dapat menekan tombol "Daftar sebagai Kandidat" di halaman detail `election_event`.
    -   Ini akan membawa mereka ke formulir pendaftaran kandidat.

2.  **Formulir Unggah Dokumen (Wajib):**

    -   Ini adalah inti dari verifikasi. Kandidat **wajib** mengunggah dokumen-dokumen berikut (yang akan disimpan di **Supabase Storage**):
        -   **Foto Selfie dengan KTM:** Untuk verifikasi _liveness_ dan mencocokkan wajah dengan foto di KTM. Ini mencegah penipuan identitas.
        -   **Scan KTM (Kartu Tanda Mahasiswa):** Verifikasi identitas dasar.
        -   **Surat Rekomendasi (Ditandatangani Pihak Univ):** Sesuai ide Anda. Ini bisa dari Dekan, Kaprodi, atau BEM/DPM demisioner. Ini membuktikan bahwa kandidat diakui dan memiliki _good standing_.
        -   **Surat Pernyataan/Pakta Integritas (Ditandatangani Kandidat & Univ):** Sesuai ide Anda. Ini adalah kontrak legal/sosial bahwa kandidat akan mengikuti aturan, tidak curang, dan menerima hasil.
        -   **(Opsional) Transkrip Nilai:** Jika ada syarat minimal IPK untuk menjadi kandidat.

3.  **Antrian Verifikasi (Panel Admin):**

    -   Setiap pengajuan baru akan masuk ke _queue_ di Panel Admin dengan status "Pending Review".
    -   Admin membuka setiap pengajuan, memeriksa kelengkapan, dan memvalidasi keaslian dokumen satu per satu.

4.  **Aprobasi atau Penolakan oleh Admin:**
    -   **Jika Disetujui:** Admin menekan tombol "Approve". Sistem kemudian secara resmi:
        1.  Membuat _entry_ baru di tabel `candidates`.
        2.  Menghubungkan `user_id` tersebut ke `event_id` yang relevan.
        3.  Kandidat kini muncul di halaman _voting_ dan bisa mulai mengisi Visi/Misi.
    -   **Jika Ditolak:** Admin menekan "Reject" dan memberikan catatan (misal: "Tanda tangan surat rekomendasi tidak valid"). Kandidat bisa diberi kesempatan untuk mengunggah ulang.

**Bagaimana Ini Diimplementasikan (Secara Teknis):**

-   **Tabel Baru (Saran):** Buat tabel baru bernama `candidate_applications`.
    -   `id`, `user_id`, `event_id`, `status` ('pending', 'approved', 'rejected'), `notes_admin` (text).
-   **Supabase Storage:** Buat _bucket_ privat bernama `verification_documents`.
    -   File diunggah ke folder yang spesifik, misal: `/verification_documents/[user_id]/[event_id]/surat_rekomendasi.pdf`.
    -   Gunakan RLS Storage agar hanya Admin yang bisa _read_ dan user terkait yang bisa _upload_.
-   **Logika Admin:** Panel Admin tidak lagi langsung menambah kandidat dari tabel `profiles`. Panel Admin kini me-review tabel `candidate_applications`. Ketika Admin menekan "Approve", _trigger_ atau fungsi akan menyalin data itu ke tabel `candidates` yang resmi.

Dengan kombinasi DPT terpusat untuk pemilih dan alur verifikasi dokumen yang ketat untuk kandidat, UniVertex akan memiliki fondasi keamanan dan kepercayaan yang sangat kuat.
