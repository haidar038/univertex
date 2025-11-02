# 📦 Panduan Bulk Import Users

Fitur untuk mengimport banyak pengguna sekaligus menggunakan file CSV.

---

## 🎯 Fitur Utama

1. **Upload CSV** - Upload file CSV dengan data pengguna
2. **Validasi Data** - Validasi otomatis untuk setiap baris data
3. **Preview** - Lihat preview data sebelum import dengan status valid/error
4. **Batch Creation** - Import banyak user sekaligus dengan progress indicator
5. **Error Reporting** - Laporan detail untuk setiap user yang gagal diimport
6. **Download Template** - Template CSV siap pakai

---

## 📋 Format CSV

### Kolom Wajib

| Kolom | Deskripsi | Validasi |
|-------|-----------|----------|
| `full_name` | Nama lengkap | Min 2 karakter |
| `student_id` | NIM mahasiswa | Tidak boleh kosong, harus unik |
| `email` | Email mahasiswa | Format email valid, harus unik |
| `password` | Password akun | Min 6 karakter |
| `roles` | Role pengguna | Nilai: voter, candidate (dipisah \|) |

### Kolom Opsional

| Kolom | Deskripsi | Catatan |
|-------|-----------|---------|
| `department` | Jurusan | Bebas diisi |
| `class_name` | Nama kelas | Harus sesuai dengan kelas yang sudah ada di database |

---

## 📄 Contoh File CSV

### Template Dasar

```csv
full_name,student_id,email,password,department,class_name,roles
John Doe,123456,john@example.com,password123,Teknik Informatika,Informatika 2022,voter
Jane Smith,123457,jane@example.com,password123,Teknik Informatika,Informatika 2022,voter|candidate
Bob Johnson,123458,bob@example.com,password123,Sistem Informasi,Informatika 2022,voter
```

### Multiple Roles

Untuk memberikan multiple roles kepada user, gunakan separator `|`:

```csv
full_name,student_id,email,password,department,class_name,roles
Alice Brown,123459,alice@example.com,password123,Teknik Informatika,Informatika 2022,voter|candidate
```

User di atas akan memiliki 2 roles: voter dan candidate.

---

## 🔧 Cara Menggunakan

### 1. Akses Halaman Manajemen Pengguna

- Login sebagai Admin
- Navigasi ke **Admin → Manajemen Pengguna**

### 2. Klik Tombol "Import CSV"

- Klik tombol **Import CSV** di pojok kanan atas
- Dialog import akan terbuka

### 3. Download Template (Opsional)

- Klik tombol **Download Template** untuk mendapatkan template CSV
- Edit template dengan data pengguna Anda
- Pastikan format sesuai dengan panduan

### 4. Upload File CSV

- Klik area upload atau drag & drop file CSV
- File akan divalidasi secara otomatis

### 5. Review Preview Data

Setelah upload, Anda akan melihat:
- **Jumlah Valid**: Data yang siap diimport (hijau)
- **Jumlah Error**: Data dengan kesalahan (merah)
- **Detail per baris**: Informasi lengkap untuk setiap user

Setiap baris akan menampilkan:
- ✅ **Valid** - Data benar dan siap diimport
- ❌ **Error** - Ada kesalahan, dengan detail error di bawahnya

### 6. Import Data

- Jika ada data valid, klik tombol **Import X User**
- Progress bar akan muncul menunjukkan proses import
- Hanya data valid yang akan diimport, data error akan dilewati

### 7. Review Hasil Import

Setelah selesai, Anda akan melihat:
- **Berhasil**: Jumlah user yang berhasil dibuat
- **Gagal**: Jumlah user yang gagal dengan detail error

---

## ⚠️ Validasi & Error Handling

### Validasi yang Dilakukan

1. **Nama** - Minimal 2 karakter
2. **NIM** - Tidak boleh kosong
3. **Email** - Format email valid (mengandung @ dan domain)
4. **Password** - Minimal 6 karakter
5. **Roles** - Harus salah satu dari: voter, candidate

### Error yang Mungkin Terjadi

| Error | Penyebab | Solusi |
|-------|----------|--------|
| Email sudah terdaftar | Email sudah digunakan user lain | Gunakan email berbeda |
| NIM sudah digunakan | NIM sudah ada di database | Gunakan NIM berbeda |
| Kelas tidak ditemukan | Nama kelas tidak ada di database | Cek nama kelas atau buat kelas terlebih dahulu |
| Format email tidak valid | Email tidak mengikuti format standar | Perbaiki format email (user@domain.com) |
| Password terlalu pendek | Password kurang dari 6 karakter | Gunakan password minimal 6 karakter |

---

## 💡 Tips & Best Practices

### 1. Persiapan Data

- Gunakan Excel/Google Sheets untuk menyiapkan data
- Export sebagai CSV (Comma Separated Values)
- Pastikan tidak ada baris kosong di tengah data

### 2. Validasi Sebelum Upload

- Pastikan semua email valid dan unik
- Pastikan semua NIM unik
- Cek nama kelas sudah ada di database
- Password sebaiknya cukup kuat (minimal 6 karakter)

### 3. Menangani Error

- Jika ada banyak error, download hasil error
- Perbaiki data yang error
- Upload ulang file CSV yang sudah diperbaiki

### 4. Import Bertahap

- Untuk data besar (>100 user), pertimbangkan import bertahap
- Split file CSV menjadi beberapa bagian (50-100 user per file)
- Ini memudahkan tracking jika ada error

### 5. Testing

- Test dengan file CSV kecil dulu (5-10 user)
- Pastikan format dan data sudah benar
- Baru lakukan import data besar

---

## 🔒 Keamanan

### Password Management

- Password disimpan dengan hash di Supabase Auth
- Tidak ada plain text password yang disimpan
- User dapat mengubah password setelah login pertama

### Email Confirmation

- Email confirmation otomatis diaktifkan
- User dapat langsung login tanpa verifikasi email
- Admin dapat mengubah setting ini di Supabase dashboard

### Data Privacy

- Hanya admin yang dapat melakukan bulk import
- Semua operasi tercatat di audit log Supabase
- Data CSV tidak disimpan di server setelah proses selesai

---

## 📊 Contoh Skenario Penggunaan

### Skenario 1: Import Mahasiswa Baru

Universitas memiliki 150 mahasiswa baru yang perlu didaftarkan:

1. IT Admin menyiapkan data di Excel dengan kolom: nama, NIM, email, password
2. Export Excel ke CSV
3. Upload CSV via fitur Bulk Import
4. Review preview - semua data valid
5. Import 150 user berhasil dalam 2-3 menit
6. Kirim email ke mahasiswa dengan kredensial login mereka

### Skenario 2: Import Kandidat Pemilihan

Panitia pemilu memiliki 20 kandidat yang perlu didaftarkan:

1. Buat CSV dengan data kandidat
2. Set roles = `voter|candidate` untuk setiap kandidat
3. Upload dan import
4. Kandidat otomatis memiliki 2 roles dan dapat mengisi visi-misi

### Skenario 3: Perbaikan Data Error

Upload 100 user, ternyata 10 user error karena email duplikat:

1. Review hasil import di dialog hasil
2. Copy list email yang error
3. Perbaiki di file CSV
4. Upload ulang file yang sudah diperbaiki
5. 10 user berhasil diimport

---

## 🐛 Troubleshooting

### File CSV tidak bisa dibaca

**Masalah**: Error "Gagal membaca file CSV"

**Solusi**:
- Pastikan file encoding UTF-8
- Pastikan delimiter menggunakan koma (,)
- Pastikan tidak ada karakter special di header

### Semua data error

**Masalah**: Semua baris ditandai error

**Solusi**:
- Cek format header kolom (harus lowercase)
- Pastikan kolom wajib ada semua
- Cek typo di nama kolom

### Import lambat

**Masalah**: Progress bar berjalan sangat lambat

**Solusi**:
- Normal untuk data besar (Supabase Auth butuh waktu per user)
- Estimasi: ~1-2 detik per user
- Untuk 100 user = sekitar 2-3 menit
- Jangan tutup dialog saat importing

### Kelas tidak ditemukan

**Masalah**: User berhasil dibuat tapi class_id null

**Solusi**:
- Pastikan nama kelas di CSV persis sama dengan di database
- Case sensitive: "Informatika 2022" ≠ "informatika 2022"
- Buat kelas terlebih dahulu di menu Manajemen Kelas

---

## 📈 Statistik & Metrics

Setelah import, sistem mencatat:
- Total user berhasil dibuat
- Total user gagal dengan detail error
- Waktu proses import
- List user yang berhasil dan gagal

---

## 🔄 Changelog

### Version 1.0.0 (2025-11-01)

**Initial Release**
- ✅ CSV upload dan parsing
- ✅ Data validation
- ✅ Preview dengan status valid/error
- ✅ Batch creation dengan progress
- ✅ Error reporting detail
- ✅ Download template CSV
- ✅ Support multiple roles
- ✅ Auto-assign ke kelas

---

## 📞 Support

Jika ada pertanyaan atau issues terkait Bulk Import:
1. Cek dokumentasi ini terlebih dahulu
2. Review template CSV
3. Test dengan data kecil
4. Contact IT Admin jika masalah berlanjut

---

**Last Updated**: 2025-11-01
**Author**: Claude Code Assistant
**Version**: 1.0.0
