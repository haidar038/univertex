# Troubleshooting & Fixes - UniVertex

## Issues Fixed

### 1. ✅ Assign User ke Kelas Tidak Berfungsi

**Masalah:** Saat admin melakukan assign user ke kelas melalui Edit User Dialog, tidak ada perubahan yang terjadi.

**Penyebab:** Kode sudah benar, masalahnya mungkin di RLS policy atau user tidak refresh data.

**Solusi:**
- EditUserDialog sudah mengupdate `class_id` dengan benar di line 147
- Pastikan user logout dan login ulang setelah class di-assign
- Atau refresh halaman untuk reload profile data

**Cara Menggunakan:**
1. Admin buka "Manajemen Pengguna"
2. Klik icon Edit (pensil) pada user
3. Pilih kelas dari dropdown "Kelas"
4. Klik "Simpan Perubahan"
5. User perlu logout/login untuk melihat perubahan

---

### 2. ✅ Event Tidak Muncul di Dashboard Voter/Kandidat

**Masalah:** Dashboard voter dan kandidat kosong meskipun ada event aktif.

**Penyebab:**
- User belum di-assign ke kelas
- Kelas belum di-assign ke event melalui "Kelola Grup Pemilih"
- Query gagal karena `eligibleEventIds` kosong

**Solusi:**
File: `src/pages/app/Dashboard.tsx`
- Tambahkan check untuk empty `eligibleEventIds`
- Return empty array jika user tidak punya class atau tidak ada eligible events
- Tambahkan error handling yang lebih baik

**Flow Yang Benar:**
1. Admin membuat Event
2. Admin membuat Class (jika belum ada)
3. Admin assign User ke Class (via Edit User)
4. Admin assign Class ke Event (via "Kelola Grup Pemilih" di Event Detail)
5. User dengan class tersebut akan melihat event di dashboard

**Checklist:**
- [ ] User sudah punya `class_id` di tabel profiles
- [ ] Class sudah di-link ke event di tabel `event_voter_groups`
- [ ] Event status = 'active'
- [ ] User sudah logout/login untuk refresh data

---

### 3. ✅ Kandidat Tidak Bisa Ditambahkan oleh Admin

**Masalah:** Saat admin menambahkan kandidat manual, tidak terjadi penambahan data di tabel `candidates`.

**Penyebab:** Kemungkinan RLS policy memblokir INSERT atau error tidak tertangkap dengan baik.

**Solusi:**
File: `src/components/admin/events/AddCandidateDialog.tsx`
- Tambahkan console.log untuk debugging
- Tambahkan `.select()` setelah `.insert()` untuk memverifikasi data ter-insert
- Log error details (code, message, details, hint)

**Debugging:**
1. Buka browser console (F12)
2. Coba tambah kandidat
3. Lihat console log:
   - "Submitting candidate data" - data yang dikirim
   - "Insert result" - hasil insert
   - "Insert error details" - jika ada error

**Possible Errors:**
- **RLS Policy Error**: Admin tidak punya permission INSERT ke `candidates`
  - Check policy "Admins can insert candidates" ada dan active
  - Verify `has_role(auth.uid(), 'admin')` returns true
- **Foreign Key Error**: `user_id` atau `event_id` tidak valid
- **Unique Constraint**: Kandidat sudah terdaftar di event ini

**Manual Check:**
```sql
-- Check if admin has proper role
SELECT * FROM user_roles WHERE user_id = auth.uid() AND role = 'admin';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'candidates';

-- Try direct insert (as admin)
INSERT INTO candidates (user_id, event_id, vision, mission, status)
VALUES ('user-uuid', 'event-uuid', 'Test', 'Test', 'approved');
```

---

### 4. ✅ Role Kandidat Membingungkan

**Masalah:** User sudah memiliki role `candidate` namun di CandidateSettings muncul "Anda belum terdaftar sebagai kandidat di pemilihan manapun".

**Penjelasan:**
- **Role `candidate`** = User BISA menjadi kandidat (permission)
- **Entry di tabel `candidates`** = User TERDAFTAR sebagai kandidat di event tertentu

**Perbedaan:**
- Role `candidate`: Diberikan oleh admin di User Management
- Terdaftar sebagai kandidat: Didaftarkan admin di Event Detail → Tab Kandidat → Tambah Kandidat

**Solusi:**
File: `src/pages/app/CandidateSettings.tsx`
- Update pesan untuk lebih jelas
- Tambahkan penjelasan bahwa admin yang mendaftarkan
- Tambahkan catatan tentang flow pendaftaran

**Flow Lengkap:**
1. Admin beri role `candidate` ke user (User Management)
2. Admin daftarkan user sebagai kandidat di event tertentu (Event Detail)
3. Kandidat bisa edit profil (visi, misi, foto) di CandidateSettings
4. Admin approve perubahan kandidat
5. Kandidat tampil di voting page

---

### 5. ⚠️ Konfirmasi Email Otomatis Tidak Berfungsi

**Masalah:** Saat admin menambah user, user harus konfirmasi via email sebelum bisa login.

**Penyebab:** Supabase Authentication settings mengharuskan email confirmation.

**Solusi Sementara:**
Ada checkbox "Konfirmasi email otomatis" di CreateUserDialog, tapi ini tidak sepenuhnya berfungsi karena batasan Supabase client SDK.

**Solusi Lengkap (Butuh Setup Tambahan):**

#### Option 1: Disable Email Confirmation (Paling Mudah)
1. Buka Supabase Dashboard
2. Go to Authentication → Settings
3. Scroll ke "Email Confirmations"
4. **Uncheck** "Enable email confirmations"
5. Save

**Pros:** Mudah, tidak perlu kode tambahan
**Cons:** Semua user (termasuk signup sendiri) tidak perlu konfirmasi email

#### Option 2: Manual Confirm via SQL (Per User)
Admin dapat confirm user secara manual via SQL:

```sql
-- Confirm user email
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'user@example.com';
```

**Cara:** Admin buka Supabase Dashboard → SQL Editor → Run query di atas

#### Option 3: Service Role Key (Recommended for Production)
Buat Edge Function atau API endpoint dengan service role key:

```typescript
// supabase/functions/admin-create-user/index.ts
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') // Service role key
)

// Create user dengan auto-confirm
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email: 'user@example.com',
  password: 'password',
  email_confirm: true, // Auto-confirm
  user_metadata: {
    full_name: 'Name',
    student_id: 'NIM'
  }
})
```

**File Changes Needed:**
1. Create `supabase/functions/admin-create-user/index.ts`
2. Update `CreateUserDialog.tsx` to call this function
3. Deploy edge function: `npx supabase functions deploy admin-create-user`

#### Option 4: Generate Magic Link
Admin bisa generate magic link untuk user:

```typescript
const { data, error } = await supabase.auth.admin.generateLink({
  type: 'signup',
  email: 'user@example.com',
  password: 'password',
  options: {
    data: {
      full_name: 'Name',
      student_id: 'NIM'
    }
  }
})

// Share data.properties.action_link dengan user
```

**Recommended:** Option 1 untuk development, Option 3 untuk production.

---

### 6. ✅ Flow Approval Kandidat Tidak Jelas

**Masalah:** Tidak ada button atau aksi untuk approval kandidat, flow membingungkan.

**Penjelasan Flow Lengkap:**

#### A. Admin Menambahkan Kandidat Baru
**URL:** `/admin/events/:id` → Tab "Kandidat"

1. Klik tombol "Tambah Kandidat"
2. Dialog terbuka:
   - Pilih user dengan role `candidate`
   - Isi Visi (minimal 10 karakter)
   - Isi Misi (minimal 10 karakter)
   - (Opsional) Isi URL foto
3. Klik "Tambah Kandidat"
4. **Status otomatis: `approved`** (kandidat langsung tampil di voting)

**Screenshot Locations:**
- Button "Tambah Kandidat": Kanan atas tab Kandidat
- Form: Dialog dengan 4 fields

#### B. Kandidat Mengupdate Profil
**URL:** `/app/candidate-settings`

1. Kandidat login dan buka "Pengaturan Kandidat"
2. Upload foto (drag-drop atau click)
3. Edit Visi dan Misi
4. Klik "Simpan Perubahan"
5. **Status berubah ke: `pending`** (perlu approval admin)
6. Kandidat dapat notifikasi: "Profil berhasil diperbarui dan menunggu persetujuan admin"
7. Profil TIDAK tampil di voting page sampai admin approve

**Screenshot Locations:**
- Menu "Pengaturan Kandidat": Sidebar kiri
- Form: Foto upload + Visi + Misi
- Alert: "Setelah menyimpan perubahan, profil Anda akan diubah ke status 'Menunggu Persetujuan'"

#### C. Admin Approve/Reject Kandidat
**URL:** `/admin/events/:id` → Tab "Kandidat"

**Visual Indicators:**
- Badge status di setiap kandidat card:
  - 🟡 "Menunggu Persetujuan" (pending)
  - 🟢 "Disetujui" (approved)
  - 🔴 "Ditolak" (rejected)

**Actions:**
1. **Untuk Kandidat Pending:**
   - Button "Tinjau & Setujui" muncul di bawah card
   - Klik button → Dialog approval terbuka
   - Lihat preview: Foto, Visi, Misi
   - Pilih action:
     - **Setujui**: Klik "Setujui" → Status jadi `approved` → Tampil di voting
     - **Tolak**: Klik "Tolak" → Form "Alasan Penolakan" (wajib) → Submit → Kandidat dapat notifikasi dengan alasan

2. **Untuk Kandidat Rejected:**
   - Button "Tinjau Ulang" muncul
   - Alasan penolakan ditampilkan di card (teks merah)
   - Admin bisa re-review dan approve jika sudah diperbaiki

3. **Untuk Kandidat Approved:**
   - Tidak ada action button (sudah disetujui)
   - Admin masih bisa edit via button edit (ikon pensil)

**Screenshot Locations:**
- Badge status: Di card header kandidat
- Button "Tinjau & Setujui": Di bawah visi/misi
- Dialog approval: Center screen dengan preview lengkap
- Alasan penolakan: Teks merah kecil di bawah badge rejected

#### D. Kandidat Melihat Notifikasi
**URL:** `/app/candidate-dashboard`

**Notifikasi Types:**
- ✅ **Approved**: "Selamat! Profil kandidat Anda telah disetujui..."
- ❌ **Rejected**: "Profil kandidat Anda ditolak. Alasan: [reason]"
- ⏳ **Changes Submitted**: "Perubahan profil kandidat Anda sedang menunggu persetujuan admin."

**Visual:**
- Badge counter notifikasi belum dibaca di Quick Stats
- Alert card untuk setiap notifikasi (hijau/merah/kuning)
- Klik notifikasi → Mark as read

---

## Summary Checklist untuk Admin

### Setup Awal Event
- [ ] Buat Class di "Manajemen Kelas"
- [ ] Assign Users ke Class di "Manajemen Pengguna"
- [ ] Buat Election Event di "Manajemen Acara"
- [ ] Assign Classes ke Event (Event Detail → Tab "Pemilih DPT" → "Kelola Grup Pemilih")

### Setup Kandidat
- [ ] Beri role `candidate` ke user tertentu di "Manajemen Pengguna"
- [ ] Daftarkan user sebagai kandidat (Event Detail → Tab "Kandidat" → "Tambah Kandidat")
- [ ] Isi visi, misi, dan foto kandidat
- [ ] Kandidat otomatis approved saat ditambahkan admin

### Approval Workflow
- [ ] Monitor kandidat pending di Event Detail
- [ ] Klik "Tinjau & Setujui" untuk review
- [ ] Approve atau Reject dengan alasan
- [ ] Kandidat menerima notifikasi otomatis

### Aktivasi Event
- [ ] Pastikan minimal 1 kandidat approved
- [ ] Pastikan minimal 1 class assigned ke event
- [ ] Ubah status event dari "draft" ke "active"
- [ ] Voter di class yang assigned akan melihat event di dashboard

---

## Common Errors & Solutions

### Error: "Gagal menambahkan kandidat"
- **Check:** User sudah punya role `candidate`?
- **Check:** User belum terdaftar di event ini?
- **Check:** Admin login dengan account yang benar?
- **Solution:** Lihat console log untuk error details

### Error: "Event tidak muncul di dashboard voter"
- **Check:** User punya `class_id`?
- **Check:** Class sudah di-assign ke event?
- **Check:** Event status = 'active'?
- **Solution:** Follow "Setup Awal Event" checklist di atas

### Error: "Kandidat tidak bisa upload foto"
- **Check:** Storage bucket `candidate-photos` exists?
- **Check:** Storage policies allow upload?
- **Check:** File size < 2MB?
- **Check:** File format JPG/PNG/GIF?
- **Solution:** Cek Supabase Dashboard → Storage → candidate-photos

### Error: "User harus konfirmasi email"
- **Quick Fix:** Disable email confirmation di Supabase settings
- **Manual Fix:** Run SQL query untuk confirm user
- **Proper Fix:** Implement service role key (see Option 3 above)

---

## Debug Queries

```sql
-- Check user's class
SELECT p.full_name, p.student_id, c.name as class_name
FROM profiles p
LEFT JOIN classes c ON p.class_id = c.id
WHERE p.id = 'user-uuid';

-- Check user's roles
SELECT ur.role
FROM user_roles ur
WHERE ur.user_id = 'user-uuid';

-- Check event's assigned classes
SELECT ee.title, c.name as class_name
FROM event_voter_groups evg
JOIN election_events ee ON evg.event_id = ee.id
JOIN classes c ON evg.class_id = c.id
WHERE ee.id = 'event-uuid';

-- Check candidates in event
SELECT p.full_name, c.status, c.vision, c.mission
FROM candidates c
JOIN profiles p ON c.user_id = p.id
WHERE c.event_id = 'event-uuid';

-- Check pending candidates
SELECT p.full_name, c.status, ee.title
FROM candidates c
JOIN profiles p ON c.user_id = p.id
JOIN election_events ee ON c.event_id = ee.id
WHERE c.status = 'pending';
```

---

## Contact & Support

Jika masih ada masalah yang tidak tercantum di sini, check:
1. Browser console (F12) untuk error messages
2. Supabase Dashboard → Logs untuk server errors
3. Supabase Dashboard → Database → Tables untuk verify data
4. GitHub Issues: https://github.com/anthropics/claude-code/issues
