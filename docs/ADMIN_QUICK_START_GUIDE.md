# Admin Quick Start Guide - UniVertex

## 🚀 Setup Event Pemilihan dalam 5 Langkah

### Langkah 1: Buat Kelas (Classes)
**Halaman:** `/admin/classes`

1. Klik "Tambah Kelas"
2. Isi:
   - Nama Kelas (contoh: "Informatika 2022")
   - Fakultas (contoh: "Fakultas Teknik")
3. Klik "Tambah"

**Catatan:** Kelas adalah grup pemilih (DPT). Satu event bisa punya banyak kelas pemilih.

---

### Langkah 2: Tambah Pengguna & Assign ke Kelas
**Halaman:** `/admin/users`

#### Cara 1: Tambah Manual
1. Klik "Tambah Pengguna"
2. Isi form:
   - Nama Lengkap *
   - NIM *
   - Email *
   - Password * (min 6 karakter)
   - Jurusan (opsional)
   - **Kelas** ← Pilih kelas yang sudah dibuat
   - **Roles:**
     - ☑ Pemilih (Voter) - untuk semua user
     - ☑ Kandidat (Candidate) - hanya untuk calon kandidat
3. ☑ Konfirmasi email otomatis (PENTING!)
4. Klik "Buat Pengguna"

#### Cara 2: Import CSV (Bulk)
1. Klik "Import CSV"
2. Download template CSV
3. Isi data user di Excel/Sheets
4. Upload file CSV
5. Review preview
6. Klik "Import"

**Format CSV:**
```csv
full_name,student_id,email,password,department,class_name,roles
John Doe,12345678,john@example.com,password123,Informatika,Informatika 2022,voter
Jane Smith,87654321,jane@example.com,password123,Informatika,Informatika 2022,"voter,candidate"
```

**Tips:** Untuk kandidat, tambahkan "candidate" di kolom roles (pisah dengan koma).

---

### Langkah 3: Buat Event Pemilihan
**Halaman:** `/admin/events`

1. Klik "Buat Acara Baru"
2. Isi form:
   - Judul * (contoh: "Pemilihan Ketua BEM 2025")
   - Deskripsi (contoh: "Pemilihan ketua dan wakil ketua BEM periode 2025-2026")
   - Tanggal & Waktu Mulai *
   - Tanggal & Waktu Selesai *
   - **Status:** Draft (simpan sebagai draft dulu)
3. Klik "Buat Acara"

**Catatan:** Status "Draft" = event belum tampil ke voter. Ubah ke "Active" setelah setup selesai.

---

### Langkah 4: Setup Kandidat & Pemilih
**Halaman:** `/admin/events/:id` (klik event yang baru dibuat)

#### 4A. Assign Kelas ke Event (DPT)
**Tab:** "Pemilih (DPT)"

1. Klik "Kelola Grup Pemilih"
2. Pilih kelas yang boleh vote di event ini
3. Klik checkbox untuk kelas yang dipilih
4. Klik "Simpan"

**Result:** User di kelas yang dipilih akan lihat event ini di dashboard mereka.

#### 4B. Tambah Kandidat
**Tab:** "Kandidat"

1. Klik "Tambah Kandidat"
2. Pilih user dengan role "Kandidat"
   - Gunakan search bar untuk cari nama/NIM
3. Isi:
   - **Visi** * (min 10 karakter)
   - **Misi** * (min 10 karakter)
   - URL Foto (opsional, bisa diisi kandidat nanti)
4. Klik "Tambah Kandidat"

**Result:**
- Kandidat langsung dengan status "Disetujui" (approved)
- Kandidat bisa login dan edit profil di `/app/candidate-settings`
- Kandidat bisa upload foto, edit visi/misi
- Perubahan kandidat perlu approval admin lagi

---

### Langkah 5: Aktivasi Event
**Halaman:** `/admin/events/:id`

**Checklist Sebelum Aktivasi:**
- ✅ Minimal 1 kelas sudah di-assign
- ✅ Minimal 1 kandidat sudah approved
- ✅ Visi & misi kandidat sudah lengkap
- ✅ Tanggal mulai & selesai sudah benar

**Aktivasi:**
1. Klik tombol "⋮" (titik tiga) di kanan atas
2. Pilih "Ubah Status"
3. Pilih "Active"
4. Klik "Simpan"

**Result:** Event akan muncul di dashboard voter yang terdaftar!

---

## 📋 Workflow Approval Kandidat

### Skenario: Kandidat Update Profil

#### A. Kandidat Melakukan Update
1. Kandidat login ke `/app/candidate-settings`
2. Upload foto baru atau edit visi/misi
3. Klik "Simpan Perubahan"
4. **Status berubah:** `approved` → `pending`
5. Kandidat dapat notifikasi: "Menunggu persetujuan admin"
6. Profil **TIDAK** tampil di voting page

#### B. Admin Approve/Reject
1. Admin buka `/admin/events/:id` → Tab "Kandidat"
2. Lihat badge status:
   - 🟡 **Menunggu Persetujuan** → Perlu action
   - 🟢 **Disetujui** → OK
   - 🔴 **Ditolak** → Perlu perbaikan
3. Untuk kandidat pending:
   - Klik "Tinjau & Setujui"
   - Dialog terbuka dengan preview (foto, visi, misi)
   - Pilih aksi:
     - **Setujui:** Klik "Setujui" → Status `approved` → Tampil di voting
     - **Tolak:** Klik "Tolak" → Isi alasan penolakan (wajib) → Submit

#### C. Kandidat Melihat Hasil
- **Jika Approved:** Notifikasi hijau "Profil disetujui!"
- **Jika Rejected:** Notifikasi merah dengan alasan penolakan
- Kandidat bisa perbaiki dan submit ulang

---

## 🔍 Monitoring Event

### Dashboard Admin (`/admin/dashboard`)
Menampilkan:
- Total events (draft, active, closed)
- Total users
- Total classes
- Live vote count untuk event active

### Event Detail (`/admin/events/:id`)

#### Tab "Kandidat"
- Lihat semua kandidat dengan status
- Badge warna untuk status (pending/approved/rejected)
- Button approval untuk pending
- Edit kandidat jika perlu

#### Tab "Pemilih (DPT)"
- Lihat kelas yang assigned
- Tambah/hapus kelas

#### Tab "Hasil Pemilihan"
- **Active event:** Live vote count (real-time)
- **Closed event:** Final results dengan chart
- Export results (coming soon)

---

## 🛠️ Troubleshooting Common Issues

### "Event tidak muncul di voter dashboard"
**Checklist:**
1. Event status = "Active"? (bukan draft)
2. Voter sudah punya kelas?
   - Check: `/admin/users` → lihat kolom "Kelas"
   - Fix: Edit user → Pilih kelas
3. Kelas sudah di-assign ke event?
   - Check: `/admin/events/:id` → Tab "Pemilih"
   - Fix: Klik "Kelola Grup Pemilih" → Pilih kelas
4. Voter sudah logout/login lagi?

### "Tidak bisa tambah kandidat"
**Checklist:**
1. User sudah punya role "Kandidat"?
   - Check: `/admin/users` → lihat badge role
   - Fix: Edit user → Centang "Kandidat (Candidate)"
2. User belum jadi kandidat di event ini?
   - Check: Apakah nama user muncul di dropdown?
   - Jika tidak: User sudah jadi kandidat di event ini
3. Browser console ada error?
   - Press F12 → lihat tab "Console"
   - Copy error message untuk debugging

### "Kandidat tidak bisa upload foto"
**Checklist:**
1. File size < 2MB?
2. Format JPG/PNG/GIF?
3. Browser support modern features?
4. Supabase storage bucket active?
   - Check: Supabase Dashboard → Storage → candidate-photos

### "User harus konfirmasi email"
**Quick Fix:**
1. Buka Supabase Dashboard
2. Authentication → Settings
3. **Uncheck** "Enable email confirmations"
4. Save

**Manual Fix per User:**
1. Supabase Dashboard → SQL Editor
2. Run query:
```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'user@example.com';
```

---

## 📊 Best Practices

### Naming Convention
- **Classes:** `[Jurusan] [Tahun]` (contoh: "Informatika 2022")
- **Events:** `[Jenis] [Jabatan] [Tahun]` (contoh: "Pemilihan Ketua BEM 2025")
- **Passwords:** Min 8 karakter, kombinasi huruf dan angka

### Timeline Event
1. **2 minggu sebelum:** Buat event, setup kandidat
2. **1 minggu sebelum:** Sosialisasi, test voting
3. **Hari H:** Aktivasi event pagi hari
4. **Setelah close:** Export results, buat pengumuman

### Security
- Jangan share admin password
- Selalu logout setelah selesai
- Backup data sebelum bulk operations
- Review kandidat approval dengan teliti

---

## 📱 Support & Help

**Documentation:**
- Full docs: `/docs/CANDIDATE_APPROVAL_SYSTEM.md`
- Troubleshooting: `/docs/TROUBLESHOOTING_FIXES.md`
- Bulk import guide: `/docs/BULK_IMPORT_USERS_GUIDE.md`

**Quick Commands (Browser Console):**
```javascript
// Get current user
supabase.auth.getUser()

// Check user roles
supabase.from('user_roles').select('*').eq('user_id', 'USER_ID')

// List all events
supabase.from('election_events').select('*')
```

**Emergency Contact:**
- Technical issues: [Your IT team contact]
- Account issues: [Admin contact]
- Feature requests: GitHub Issues
