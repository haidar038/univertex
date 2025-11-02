# Sistem Approval Kandidat - UniVertex

## Overview

Sistem approval kandidat telah diimplementasikan untuk memberikan kontrol yang lebih baik kepada admin dalam mengelola kandidat sebelum mereka tampil di pemilihan. Sistem ini mencakup upload foto kandidat, approval workflow, dashboard khusus kandidat, dan notifikasi.

## Fitur yang Diimplementasikan

### 1. Status Approval Kandidat

Setiap kandidat sekarang memiliki status approval:
- **Pending**: Kandidat baru ditambahkan atau melakukan perubahan profil, menunggu persetujuan admin
- **Approved**: Kandidat disetujui admin dan akan tampil di voting page
- **Rejected**: Kandidat ditolak oleh admin dengan alasan penolakan

**Database Changes:**
- Tabel `candidates` ditambahkan kolom: `status`, `rejection_reason`, `approved_at`, `approved_by`
- Enum type `candidate_status` dibuat untuk validasi status
- RLS policies diupdate: hanya kandidat approved yang tampil ke voter

### 2. Upload Foto Kandidat

Kandidat dapat mengunggah foto profil mereka melalui Supabase Storage:

**Fitur:**
- Upload foto melalui interface drag-drop atau file picker
- Preview foto real-time
- Validasi: ukuran maksimal 2MB, format JPG/PNG/GIF
- Storage bucket: `candidate-photos`
- Akses public untuk viewing, private untuk upload/delete

**Database Changes:**
- Tabel `candidates` ditambahkan kolom: `photo_storage_path`
- Storage policies dibuat untuk mengatur akses upload/view/delete

**Komponen:**
- `src/components/ui/image-upload.tsx`: Komponen reusable untuk upload foto
- Helper function `getCandidatePhotoUrl()` di `src/lib/candidate-helpers.ts`

### 3. Approval Workflow untuk Admin

Admin dapat menyetujui atau menolak kandidat melalui interface yang intuitif:

**Halaman Admin Event Detail:**
- Menampilkan foto, visi, misi kandidat
- Badge status untuk setiap kandidat
- Tombol "Tinjau & Setujui" untuk kandidat pending
- Tombol "Tinjau Ulang" untuk kandidat rejected

**Dialog Approval:**
- Komponen: `src/components/admin/events/ApproveCandidateDialog.tsx`
- Fitur approve dengan satu klik
- Fitur reject dengan form alasan penolakan (wajib)
- Preview lengkap profil kandidat sebelum approval

**Flow:**
1. Admin buka halaman event detail
2. Klik tombol "Tinjau & Setujui" pada kandidat
3. Review profil kandidat (foto, visi, misi)
4. Pilih "Setujui" atau "Tolak"
5. Jika tolak, wajib isi alasan penolakan
6. Kandidat menerima notifikasi

### 4. Dashboard Kandidat

Dashboard khusus untuk kandidat yang menampilkan informasi komprehensif:

**URL:** `/app/candidate-dashboard`

**Fitur:**
- **Quick Stats**: Total kandidat, jumlah disetujui, notifikasi belum dibaca
- **Notifikasi Real-time**: Approval/rejection notifications
- **Daftar Pemilihan**: Semua pemilihan yang diikuti dengan status
- **Hasil Pemilihan**: Statistik vote untuk event yang sudah closed
  - Jumlah suara
  - Peringkat
  - Persentase suara
- **Link Quick Actions**: Edit profil, lihat hasil lengkap

**Komponen:**
- `src/pages/app/CandidateDashboard.tsx`

### 5. Pengaturan Kandidat (Updated)

Halaman pengaturan kandidat diupdate dengan fitur baru:

**URL:** `/app/candidate-settings`

**Fitur Baru:**
- Upload foto kandidat dengan preview
- Status badge untuk setiap pemilihan
- Alert untuk alasan penolakan (jika rejected)
- Info alert: perubahan akan set status ke pending
- Validasi wajib untuk visi dan misi

**Behavior:**
- Saat kandidat menyimpan perubahan → status berubah ke "pending"
- Kandidat diberi notifikasi bahwa perubahan perlu approval
- Admin harus approve ulang sebelum perubahan tampil di voting

**Komponen:**
- `src/pages/app/CandidateSettings.tsx` (updated)

### 6. Sistem Notifikasi

Sistem notifikasi otomatis untuk kandidat:

**Database:**
- Tabel `candidate_notifications` menyimpan notifikasi
- Trigger database otomatis membuat notifikasi saat status berubah

**Jenis Notifikasi:**
- **Approved**: Profil disetujui dan akan tampil di pemilihan
- **Rejected**: Profil ditolak dengan alasan tertentu
- **Changes Submitted**: Perubahan profil menunggu persetujuan

**Fitur:**
- Badge counter notifikasi belum dibaca
- Click to mark as read
- Timestamp setiap notifikasi

### 7. Voting Page (Updated)

Voting page diupdate untuk mendukung fitur baru:

**Changes:**
- Hanya menampilkan kandidat dengan status "approved"
- Menampilkan foto kandidat dari storage
- Fallback ke gradient icon jika tidak ada foto
- Improved UI dengan foto profil yang lebih besar

**Komponen:**
- `src/pages/app/VotingPage.tsx` (updated)

### 8. Navigation Updates

**VoterLayout:**
- Menu "Dashboard Kandidat" muncul untuk user dengan role candidate
- Menu "Pengaturan Kandidat" tetap ada
- Icon Trophy untuk dashboard kandidat

## Database Schema

### Tabel: `candidates`

```sql
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  event_id UUID REFERENCES election_events(id),
  vision TEXT,
  mission TEXT,
  photo_url TEXT,
  photo_storage_path TEXT,  -- NEW
  status candidate_status DEFAULT 'pending',  -- NEW
  rejection_reason TEXT,  -- NEW
  approved_at TIMESTAMPTZ,  -- NEW
  approved_by UUID REFERENCES auth.users(id),  -- NEW
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabel: `candidate_notifications`

```sql
CREATE TABLE public.candidate_notifications (
  id UUID PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,  -- 'approved', 'rejected', 'changes_submitted'
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Storage Bucket: `candidate-photos`

```
bucket_id: candidate-photos
public: true
policies:
  - Anyone can view
  - Authenticated users can upload to their own folder
  - Users can update/delete their own photos
```

## Workflow Lengkap

### A. Admin Menambahkan Kandidat Baru

1. Admin buka halaman Event Detail
2. Klik "Tambah Kandidat"
3. Pilih user dengan role "candidate"
4. Isi visi dan misi kandidat
5. Submit → Status otomatis "approved"
6. Kandidat langsung tampil di voting page

### B. Kandidat Mengupdate Profil

1. Kandidat login dan buka "Pengaturan Kandidat"
2. Upload foto (opsional)
3. Edit visi dan misi
4. Submit → Status berubah ke "pending"
5. Kandidat menerima notifikasi "menunggu persetujuan"
6. Profil TIDAK tampil di voting page sampai approved

### C. Admin Menyetujui Perubahan

1. Admin buka Event Detail
2. Lihat kandidat dengan status "pending"
3. Klik "Tinjau & Setujui"
4. Review profil (foto, visi, misi)
5. Klik "Setujui"
6. Kandidat menerima notifikasi "disetujui"
7. Profil tampil di voting page

### D. Admin Menolak Kandidat

1. Admin buka Event Detail
2. Klik "Tinjau & Setujui" pada kandidat pending
3. Review profil
4. Klik "Tolak"
5. Isi alasan penolakan (wajib)
6. Submit
7. Kandidat menerima notifikasi dengan alasan penolakan
8. Kandidat dapat edit ulang dan resubmit

### E. Kandidat Melihat Hasil Pemilihan

1. Kandidat buka "Dashboard Kandidat"
2. Lihat statistik untuk event yang sudah closed:
   - Jumlah suara yang diperoleh
   - Peringkat di antara kandidat
   - Persentase suara
3. Klik "Lihat Hasil Lengkap" untuk detail

## Security & Permissions

### Row Level Security (RLS)

**Kandidat:**
- Hanya bisa update visi, misi, dan foto mereka sendiri
- Tidak bisa mengubah status approval
- Hanya bisa view kandidat approved (kecuali profil sendiri)

**Admin:**
- Bisa view semua kandidat (termasuk pending dan rejected)
- Bisa approve/reject kandidat
- Bisa edit semua field kandidat

**Voter:**
- Hanya bisa view kandidat approved
- Tidak bisa edit atau view kandidat pending/rejected

### Storage Security

**Foto Kandidat:**
- Upload: Hanya authenticated users, ke folder user_id mereka sendiri
- View: Public (siapa saja bisa lihat)
- Update/Delete: Hanya pemilik foto

## API Endpoints (Supabase)

### Fetch Approved Candidates (Voting)

```typescript
const { data } = await supabase
  .from('candidates')
  .select('*, profiles(*)')
  .eq('event_id', eventId)
  .eq('status', 'approved');
```

### Approve Candidate (Admin)

```typescript
const { error } = await supabase
  .from('candidates')
  .update({
    status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: adminId,
    rejection_reason: null,
  })
  .eq('id', candidateId);
```

### Reject Candidate (Admin)

```typescript
const { error } = await supabase
  .from('candidates')
  .update({
    status: 'rejected',
    rejection_reason: reason,
    approved_at: null,
    approved_by: null,
  })
  .eq('id', candidateId);
```

### Upload Photo

```typescript
const { data, error } = await supabase.storage
  .from('candidate-photos')
  .upload(`${userId}/${timestamp}.${ext}`, file);
```

## Testing Checklist

- [ ] Admin dapat menambahkan kandidat baru (status approved)
- [ ] Kandidat dapat upload foto profil
- [ ] Kandidat dapat edit visi/misi (status jadi pending)
- [ ] Admin dapat melihat semua status kandidat
- [ ] Admin dapat approve kandidat pending
- [ ] Admin dapat reject kandidat dengan alasan
- [ ] Kandidat menerima notifikasi saat status berubah
- [ ] Hanya kandidat approved yang tampil di voting page
- [ ] Foto kandidat tampil di voting page
- [ ] Dashboard kandidat menampilkan statistik yang benar
- [ ] Kandidat dapat melihat hasil pemilihan yang sudah closed
- [ ] Navigation menu muncul dengan benar untuk kandidat

## Future Enhancements

1. **Email Notifications**: Kirim email saat status approval berubah
2. **Approval History**: Log semua perubahan status approval
3. **Bulk Approval**: Approve multiple kandidat sekaligus
4. **Comment System**: Admin bisa beri komentar feedback
5. **Photo Cropping**: Built-in image cropper untuk foto profil
6. **Version History**: Track perubahan visi/misi kandidat
7. **Auto-Approval**: Setting untuk auto-approve kandidat tertentu
8. **Approval Delegation**: Multiple admin dengan level approval berbeda

## Migration Guide

Untuk apply fitur ini ke existing database:

```bash
# Apply migration
npx supabase db push

# Migration akan:
# 1. Menambahkan kolom baru ke tabel candidates
# 2. Membuat tabel candidate_notifications
# 3. Setup storage bucket candidate-photos
# 4. Update RLS policies
# 5. Set existing candidates to 'approved' (backward compatibility)
```

## Troubleshooting

### Kandidat tidak tampil di voting page
- Check status kandidat di admin panel
- Pastikan status = 'approved'
- Check RLS policies di Supabase dashboard

### Upload foto gagal
- Check storage bucket 'candidate-photos' exists
- Check storage policies allow upload
- Verify file size < 2MB
- Verify file format (JPG/PNG/GIF)

### Notifikasi tidak muncul
- Check trigger `candidate_status_notification` exists
- Check tabel `candidate_notifications` accessible
- Verify RLS policies untuk notifications

### Admin tidak bisa approve/reject
- Check user memiliki role 'admin'
- Verify RLS policy "Admins can approve or reject candidates"
- Check function `has_role()` working correctly

## File Changes Summary

### New Files
- `supabase/migrations/20251101100000_add_candidate_approval_system.sql`
- `src/components/ui/image-upload.tsx`
- `src/components/admin/events/ApproveCandidateDialog.tsx`
- `src/pages/app/CandidateDashboard.tsx`
- `src/lib/candidate-helpers.ts`
- `docs/CANDIDATE_APPROVAL_SYSTEM.md`

### Modified Files
- `src/pages/app/CandidateSettings.tsx`
- `src/pages/app/VotingPage.tsx`
- `src/pages/admin/EventDetail.tsx`
- `src/components/admin/events/AddCandidateDialog.tsx`
- `src/components/VoterLayout.tsx`
- `src/App.tsx`

## Conclusion

Sistem approval kandidat telah berhasil diimplementasikan dengan lengkap sesuai dengan dokumentasi project. Fitur ini memberikan kontrol penuh kepada admin untuk mengelola kandidat sebelum mereka tampil di pemilihan, sekaligus memberikan dashboard yang informatif untuk kandidat dalam memantau status dan performa mereka.
