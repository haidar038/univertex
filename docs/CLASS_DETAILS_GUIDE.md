# 📚 Panduan Enhanced Class Details

Fitur untuk melihat detail kelas dengan list mahasiswa dan bulk assign users ke kelas.

---

## 🎯 Fitur Utama

1. **View Students List** - Lihat daftar mahasiswa di kelas
2. **Statistics Dashboard** - Total mahasiswa, pemilih, kandidat
3. **Export to CSV** - Download daftar mahasiswa ke CSV
4. **Bulk Assign Users** - Assign banyak user ke kelas sekaligus
5. **Search & Filter** - Cari user untuk assign
6. **Multi-select** - Checkbox untuk select multiple users

---

## 📍 Lokasi & Akses

### Cara Mengakses

**Class Details Dialog:**
1. Login sebagai **Admin**
2. Navigasi ke **Admin → Manajemen Kelas**
3. Pada card kelas, klik tombol **"Lihat Detail"**

**Bulk Assign Dialog:**
1. Dari Class Details, klik **"Assign Users"**, atau
2. Dari card kelas, klik icon **UserPlus (👥+)**

### Komponen

- **ClassDetailsDialog**: `src/components/admin/classes/ClassDetailsDialog.tsx`
- **BulkAssignUsersDialog**: `src/components/admin/classes/BulkAssignUsersDialog.tsx`
- **Integration**: `src/pages/admin/Classes.tsx`

---

## 🔍 Class Details Dialog

### Fitur

#### 1. Statistics Cards (3 Metrics)

```
┌─────────────────┐ ┌─────────────┐ ┌─────────────┐
│ Total Mahasiswa │ │  Pemilih    │ │  Kandidat   │
│       150       │ │      145    │ │       5     │
└─────────────────┘ └─────────────┘ └─────────────┘
```

**Metrics:**
- **Total Mahasiswa**: Jumlah semua mahasiswa di kelas
- **Pemilih**: Mahasiswa dengan role voter
- **Kandidat**: Mahasiswa dengan role candidate

#### 2. Students List Table

**Columns:**
- No (auto-increment)
- Nama (full_name)
- NIM (student_id)
- Jurusan (department)
- Role (badges untuk setiap role)

**Features:**
- Scrollable area (max height 400px)
- Sticky header
- Hover effect pada row
- Role badges dengan warna berbeda

#### 3. Export to CSV

**Format CSV:**
```csv
No,Nama Lengkap,NIM,Jurusan,Roles
1,"John Doe",123456,"Teknik Informatika","voter"
2,"Jane Smith",123457,"Teknik Informatika","voter|candidate"
```

**Filename**: `daftar_mahasiswa_[ClassName].csv`

**Button**: "Export CSV" dengan icon Download

#### 4. Assign Users Button

**Function**: Membuka dialog Bulk Assign
**Button**: "Assign Users" dengan icon UserPlus
**Location**: Dialog footer

---

## 👥 Bulk Assign Users Dialog

### Workflow

#### Step 1: Search Users

**Search Field:**
- Placeholder: "Cari nama, NIM, atau jurusan..."
- Icon: Search (magnifying glass)
- Real-time filtering

**Filter Criteria:**
- Nama lengkap (case-insensitive)
- NIM (partial match)
- Jurusan (case-insensitive)

#### Step 2: Select Users

**User Card:**
```
┌─────────────────────────────────────┐
│ ☑️ John Doe                ✓       │
│    NIM: 123456 • Teknik Informatika│
│    Kelas saat ini: Informatika 2021│
└─────────────────────────────────────┘
```

**Features:**
- Checkbox untuk select/deselect
- Visual highlight untuk selected users (primary border)
- CheckCircle icon untuk selected state
- Info kelas saat ini (jika ada)
- Hover effect

#### Step 3: Bulk Actions

**Select All Button:**
- Function: Toggle select semua user di filtered list
- Text: "Pilih Semua" / "Batalkan Semua"
- Location: Stats bar

**Stats Bar:**
```
┌─────────────────────────────────────────┐
│ 5 dari 23 user dipilih  [Pilih Semua] │
└─────────────────────────────────────────┘
```

#### Step 4: Assign

**Assign Button:**
- Text: "Assign X User" (X = jumlah selected)
- Disabled jika tidak ada user yang dipilih
- Loading state: "Mengassign..."

**Process:**
- Update `class_id` untuk semua selected users
- Parallel updates dengan Promise.all
- Error handling per user
- Success toast dengan count

---

## 📊 Data Management

### Database Operations

#### Fetch Students

**Query:**
```sql
SELECT id, full_name, student_id, department
FROM profiles
WHERE class_id = :classId
ORDER BY full_name
```

**Join with Roles:**
```sql
SELECT user_id, role
FROM user_roles
WHERE user_id IN (:studentIds)
```

#### Fetch Available Users

**Query:**
```sql
SELECT id, full_name, student_id, department, class_id
FROM profiles
WHERE class_id != :classId OR class_id IS NULL
ORDER BY full_name
```

**Filter Logic:**
- Exclude users already in target class
- Include users with no class
- Include users from other classes (untuk move)

#### Bulk Assign

**Update Query:**
```sql
UPDATE profiles
SET class_id = :targetClassId
WHERE id = :userId
```

**Batch Operation:**
```typescript
const updates = selectedUserIds.map(userId =>
  supabase
    .from('profiles')
    .update({ class_id: targetClassId })
    .eq('id', userId)
);

await Promise.all(updates);
```

---

## 🎨 User Interface

### Class Card (Classes Page)

**Layout:**
```
┌─────────────────────────────────────┐
│ 🎓                      [✏️] [🗑️]   │
│                                     │
│ Informatika 2022                    │
│ Fakultas Teknik                     │
│                                     │
│ [👁️ Lihat Detail]  [👥+]            │
└─────────────────────────────────────┘
```

**Buttons:**
- **Edit** (✏️): Edit class info
- **Delete** (🗑️): Delete class
- **Lihat Detail** (👁️): Open details dialog
- **Assign Users** (👥+): Open bulk assign dialog

### Class Details Dialog

**Layout:**
```
┌─────────────────────────────────────────┐
│ Detail Kelas: Informatika 2022          │
│ Daftar mahasiswa yang terdaftar...      │
├─────────────────────────────────────────┤
│ [Total: 150] [Pemilih: 145] [Kandidat: 5]│
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ No | Nama | NIM | Jurusan | Role   │ │
│ │ 1  | John | 001 | TI      | [Voter]│ │
│ │ 2  | Jane | 002 | TI      | [Cand] │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [👥+ Assign] [📥 Export]     [Tutup]   │
└─────────────────────────────────────────┘
```

### Bulk Assign Dialog

**Layout:**
```
┌─────────────────────────────────────────┐
│ Assign Users ke Kelas: Informatika 2022│
│ Pilih user yang ingin di-assign...      │
├─────────────────────────────────────────┤
│ 🔍 [Cari nama, NIM, atau jurusan...]   │
├─────────────────────────────────────────┤
│ 5 dari 23 user dipilih  [Pilih Semua]  │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ ☑️ John Doe            ✓            │ │
│ │    NIM: 123456 • TI                 │ │
│ │    Kelas: Informatika 2021          │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ ☐ Jane Smith                        │ │
│ │    NIM: 123457 • SI                 │ │
│ │    Kelas: -                         │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [Batal]                  [Assign 5 User]│
└─────────────────────────────────────────┘
```

---

## 🎯 Use Cases

### Use Case 1: View Class Members

**Skenario**: Admin ingin lihat daftar mahasiswa di kelas

**Flow**:
1. Admin buka Manajemen Kelas
2. Klik "Lihat Detail" pada card Informatika 2022
3. Dialog terbuka dengan:
   - Statistics: 150 mahasiswa, 145 pemilih, 5 kandidat
   - Tabel list mahasiswa dengan role
4. Admin scroll untuk lihat semua mahasiswa
5. Admin klik "Tutup"

### Use Case 2: Export Student List

**Skenario**: Admin perlu list mahasiswa untuk keperluan administrasi

**Flow**:
1. Admin buka detail kelas
2. Klik "Export CSV"
3. File `daftar_mahasiswa_Informatika_2022.csv` ter-download
4. Admin buka file di Excel
5. Data siap untuk diproses/print

### Use Case 3: Assign New Students

**Skenario**: Mahasiswa baru perlu di-assign ke kelas

**Flow**:
1. Admin buka detail kelas Informatika 2024
2. Klik "Assign Users"
3. Search "2024" untuk filter mahasiswa angkatan baru
4. Select all 50 mahasiswa baru
5. Klik "Assign 50 User"
6. Success: 50 mahasiswa berhasil di-assign
7. Close dialog
8. Lihat detail kelas lagi → total bertambah 50

### Use Case 4: Move Student to Different Class

**Skenario**: Mahasiswa pindah kelas

**Flow**:
1. Admin buka detail kelas target (Informatika 2023)
2. Klik "Assign Users"
3. Search nama mahasiswa: "John Doe"
4. Lihat info: "Kelas saat ini: Informatika 2022"
5. Select John Doe
6. Klik "Assign 1 User"
7. John Doe pindah dari kelas lama ke kelas baru

### Use Case 5: Bulk Reassign from CSV Import

**Skenario**: Import mahasiswa baru via CSV, perlu assign ke kelas

**Flow**:
1. Admin import 100 mahasiswa via Bulk Import Users
2. Mahasiswa ter-create tanpa kelas (class_id = null)
3. Admin buka detail Informatika 2024
4. Klik "Assign Users"
5. Filter users tanpa kelas (terlihat di list)
6. Select all 100 users
7. Assign semua ke kelas
8. Done: 100 mahasiswa ter-assign

---

## 🚨 Error Handling

### Error 1: No Students Found

**Kondisi**: Kelas belum ada mahasiswa

**UI**: Alert box dengan pesan
```
ℹ️ Belum Ada Mahasiswa
Belum ada mahasiswa yang terdaftar di kelas ini.
```

**Actions Available**:
- Assign Users button tetap aktif
- Export button disabled

### Error 2: No Available Users

**Kondisi**: Semua users sudah di-assign

**UI**: Alert box dengan pesan
```
ℹ️ Tidak Ada User
Semua user sudah di-assign ke kelas ini atau kelas lain.
```

**Actions Available**:
- Assign button disabled
- Cancel button tetap aktif

### Error 3: Search No Results

**Kondisi**: Search query tidak match

**UI**: Alert box dengan pesan
```
ℹ️ Tidak Ada User
Tidak ada user yang cocok dengan pencarian.
```

**Actions Available**:
- Clear search
- Try different query

### Error 4: Assign Failed

**Kondisi**: Database error saat assign

**Error Message**: "Beberapa user gagal di-assign"

**Handling**:
- Show error toast
- Log error ke console
- Dialog tetap terbuka
- User bisa retry

---

## 🔄 Integration Points

### Integration with Users Management

**Create User → Auto-assign to Class:**
```
User Form includes class_id field
↓
User created with class_id
↓
Appears in Class Details automatically
```

### Integration with Events

**Event Voter Groups:**
```
Event selects eligible classes
↓
Students from those classes can vote
↓
Class Details shows voting-eligible students
```

### Integration with Bulk Import

**CSV Import → Bulk Assign:**
```
Import 100 users without class
↓
Open Bulk Assign dialog
↓
Select all imported users
↓
Assign to target class
```

---

## 📊 Statistics & Reporting

### Metrics to Track

1. **Class Size**: Total students per class
2. **Voter Ratio**: Percentage of voters vs total
3. **Candidate Ratio**: Percentage of candidates vs total
4. **Assignment Activity**: Bulk assign operations count
5. **Export Frequency**: How often lists are exported

### Reports Available

1. **Class Member List**: CSV export dari Class Details
2. **All Classes Summary**: Via Classes page (future enhancement)
3. **Cross-class Analysis**: Compare class sizes (future)

---

## 🚀 Future Enhancements

### Planned Features

1. **Drag & Drop Assign**
   - Drag user card from one class to another
   - Visual feedback
   - Batch move

2. **Class Comparison View**
   - Side-by-side class comparison
   - Student count comparison
   - Move students between classes

3. **Advanced Filters**
   - Filter by role
   - Filter by department
   - Filter by voting eligibility

4. **Student Details**
   - Click student name → detail modal
   - Edit student info inline
   - View student voting history

5. **Export Options**
   - Export with photos
   - Export to Excel (.xlsx)
   - Export to PDF

6. **Bulk Operations**
   - Bulk delete from class
   - Bulk change roles
   - Bulk send notifications

---

## 🐛 Troubleshooting

### Issue 1: Students Not Appearing

**Problem**: Class Details shows empty list

**Possible Causes**:
- No students assigned to class
- Database query error
- class_id mismatch

**Solution**:
```sql
-- Check if students exist
SELECT * FROM profiles WHERE class_id = 'target_class_id';

-- Check class_id is correct
SELECT * FROM classes WHERE id = 'target_class_id';
```

### Issue 2: Assign Button Disabled

**Problem**: Cannot click Assign button

**Possible Causes**:
- No users selected
- All users already in class
- Loading state stuck

**Solution**:
- Select at least one user
- Check selectedUserIds state
- Refresh dialog

### Issue 3: Search Not Working

**Problem**: Search doesn't filter users

**Possible Causes**:
- Search query empty
- Filter logic error
- State update issue

**Solution**:
```typescript
// Check filter logic
const filtered = users.filter(user =>
  user.full_name.toLowerCase().includes(query.toLowerCase())
);
```

### Issue 4: Export CSV Empty

**Problem**: Downloaded CSV has only header

**Possible Causes**:
- students array empty
- CSV generation error
- Blob creation failed

**Solution**:
- Check students.length > 0
- Verify CSV format
- Test with console.log(csvContent)

---

## 📞 Support

Jika ada pertanyaan atau issues terkait Class Details:
1. Cek dokumentasi ini terlebih dahulu
2. Review kode komponen yang relevan
3. Test dengan data sample
4. Contact IT Admin jika masalah berlanjut

---

## 📋 Admin Checklist

Untuk pengelolaan kelas yang efektif:

- [ ] Create semua kelas yang dibutuhkan
- [ ] Import atau create users
- [ ] Assign users ke kelas masing-masing
- [ ] Verify class statistics (total, voters, candidates)
- [ ] Export class lists untuk backup
- [ ] Setup event voter groups based on classes
- [ ] Monitor class sizes regularly
- [ ] Update assignments saat ada mahasiswa baru/pindah
- [ ] Document class assignments untuk audit trail

---

**Last Updated**: 2025-11-01
**Author**: Claude Code Assistant
**Version**: 1.0.0
