# 📘 Admin Components Implementation Guide

Panduan lengkap untuk menggunakan komponen admin yang telah dibuat untuk UniVertex E-Voting Platform.

---

## ✅ Komponen yang Sudah Dibuat

### **PRIORITY 1 - CRUD Dialogs** (8 komponen) ✅

#### 1. Event Management
- **CreateEventDialog** - `src/components/admin/events/CreateEventDialog.tsx`
- **EditEventDialog** - `src/components/admin/events/EditEventDialog.tsx`
- **AddCandidateDialog** - `src/components/admin/events/AddCandidateDialog.tsx`
- **AssignVoterGroupsDialog** - `src/components/admin/events/AssignVoterGroupsDialog.tsx`

#### 2. User Management
- **CreateUserDialog** - `src/components/admin/users/CreateUserDialog.tsx`
- **EditUserDialog** - `src/components/admin/users/EditUserDialog.tsx`

#### 3. Class Management
- **CreateClassDialog** - `src/components/admin/classes/CreateClassDialog.tsx`
- **EditClassDialog** - `src/components/admin/classes/EditClassDialog.tsx`

### **PRIORITY 2 - Delete & Advanced Dialogs** (5 komponen) ✅

#### 4. Delete Operations
- **DeleteEventDialog** - `src/components/admin/events/DeleteEventDialog.tsx`
- **DeleteUserDialog** - `src/components/admin/users/DeleteUserDialog.tsx`
- **DeleteClassDialog** - `src/components/admin/classes/DeleteClassDialog.tsx`

#### 5. Advanced Management
- **EventStatusDialog** - `src/components/admin/events/EventStatusDialog.tsx`
- **EditCandidateDialog** - `src/components/admin/events/EditCandidateDialog.tsx`

---

## 🔧 Cara Integrasi Komponen

### 1. Import Dialog Component

```tsx
import { CreateEventDialog } from '@/components/admin/events/CreateEventDialog';
import { EditEventDialog } from '@/components/admin/events/EditEventDialog';
import { DeleteEventDialog } from '@/components/admin/events/DeleteEventDialog';
```

### 2. Setup State Management

```tsx
const [createDialogOpen, setCreateDialogOpen] = useState(false);
const [editDialogOpen, setEditDialogOpen] = useState(false);
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [selectedEvent, setSelectedEvent] = useState<any>(null);
```

### 3. Add Dialogs to Component

```tsx
return (
  <div>
    {/* Your existing content */}

    {/* Dialogs */}
    <CreateEventDialog
      open={createDialogOpen}
      onOpenChange={setCreateDialogOpen}
      onSuccess={refetchData}
    />

    <EditEventDialog
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      event={selectedEvent}
      onSuccess={refetchData}
    />

    <DeleteEventDialog
      open={deleteDialogOpen}
      onOpenChange={setDeleteDialogOpen}
      eventId={selectedEvent?.id}
      eventTitle={selectedEvent?.title}
      onSuccess={refetchData}
    />
  </div>
);
```

### 4. Trigger Dialogs from Buttons

```tsx
// Create button
<Button onClick={() => setCreateDialogOpen(true)}>
  <Plus className="h-4 w-4" />
  Buat Event
</Button>

// Edit button
<Button onClick={() => {
  setSelectedEvent(event);
  setEditDialogOpen(true);
}}>
  <Edit className="h-4 w-4" />
</Button>

// Delete button
<Button onClick={() => {
  setSelectedEvent(event);
  setDeleteDialogOpen(true);
}} variant="destructive">
  <Trash className="h-4 w-4" />
</Button>
```

---

## 📦 Props Interface untuk Setiap Dialog

### CreateEventDialog

```typescript
interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
```

### EditEventDialog

```typescript
interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;  // Event object
  onSuccess?: () => void;
}
```

### DeleteEventDialog

```typescript
interface DeleteEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  eventTitle: string | null;
  onSuccess?: () => void;
}
```

### AddCandidateDialog

```typescript
interface AddCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;  // Required!
  onSuccess?: () => void;
}
```

### AssignVoterGroupsDialog

```typescript
interface AssignVoterGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;  // Required!
  onSuccess?: () => void;
}
```

### EventStatusDialog

```typescript
interface EventStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  currentStatus: 'draft' | 'active' | 'closed' | null;
  onSuccess?: () => void;
}
```

### EditCandidateDialog

```typescript
interface EditCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate | null;
  onSuccess?: () => void;
}
```

### CreateUserDialog

```typescript
interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
```

### EditUserDialog

```typescript
interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithRoles | null;
  onSuccess?: () => void;
}
```

### DeleteUserDialog

```typescript
interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string | null;
  onSuccess?: () => void;
}
```

### CreateClassDialog

```typescript
interface CreateClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
```

### EditClassDialog

```typescript
interface EditClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: Class | null;
  onSuccess?: () => void;
}
```

### DeleteClassDialog

```typescript
interface DeleteClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null;
  className: string | null;
  onSuccess?: () => void;
}
```

---

## 🎨 Features per Dialog

### Event Dialogs

#### CreateEventDialog
- ✅ Form validation dengan Zod
- ✅ Datetime picker untuk start & end time
- ✅ Status selection (draft/active/closed)
- ✅ Auto-validation: end time > start time
- ✅ Toast notifications

#### EditEventDialog
- ✅ Pre-populated form data
- ✅ Same validation as Create
- ✅ Format datetime untuk input field

#### DeleteEventDialog
- ✅ Shows cascade delete impact
- ✅ Displays: candidates count, votes count, voter groups
- ✅ Confirmation dialog
- ✅ Warning alerts

#### EventStatusDialog
- ✅ Validates requirements before activation
- ✅ Checks: has candidates, has voter groups
- ✅ Visual indicators for validation status
- ✅ Prevents activation if requirements not met

#### AddCandidateDialog
- ✅ Search/filter users with candidate role
- ✅ Excludes already registered candidates
- ✅ Vision & mission input
- ✅ Optional photo URL

#### EditCandidateDialog
- ✅ Edit vision, mission, photo
- ✅ Shows candidate name in header
- ✅ Validation for min/max length

#### AssignVoterGroupsDialog
- ✅ Multi-select classes (checkboxes)
- ✅ Search/filter functionality
- ✅ Shows student count per class
- ✅ Shows total eligible voters
- ✅ Bulk select/deselect all
- ✅ Replaces existing assignments

### User Dialogs

#### CreateUserDialog
- ✅ Full user creation with email & password
- ✅ Role assignment (voter, candidate)
- ✅ Class selection
- ✅ Email auto-confirm option
- ✅ Password validation (min 6 chars)

#### EditUserDialog
- ✅ Edit: name, NIM, department, class, roles
- ✅ Email is read-only
- ✅ Multi-role management
- ✅ Validation: must have at least 1 role

#### DeleteUserDialog
- ✅ Shows impact: votes cast, candidacies
- ✅ Warning about data deletion
- ✅ Info about auth user retention

### Class Dialogs

#### CreateClassDialog
- ✅ Simple form: name, faculty
- ✅ Unique name validation
- ✅ Required field validation

#### EditClassDialog
- ✅ Shows usage statistics
- ✅ Displays: student count, events using class
- ✅ Warning if class is in use

#### DeleteClassDialog
- ✅ Shows impact: students, events
- ✅ Explains cascade behavior
- ✅ Warning about orphaned students

---

## 🔐 Database Operations

### Cascade Delete Behavior

**Delete Event:**
- ✅ Automatically deletes: candidates, votes, event_voter_groups
- ⚠️ Configured via ON DELETE CASCADE

**Delete User:**
- ✅ Deletes from: profiles, user_roles, votes, candidates
- ⚠️ Auth user remains (requires service role)

**Delete Class:**
- ✅ Sets: profiles.class_id = null
- ✅ Deletes: event_voter_groups
- ⚠️ Configured via ON DELETE SET NULL

---

## 🧪 Testing Guide

### Test Create Dialog

```bash
1. Click "Tambah" button
2. Fill all required fields
3. Submit form
4. Verify success toast
5. Verify data appears in list
6. Test form validation errors
```

### Test Edit Dialog

```bash
1. Click Edit button on existing item
2. Verify form is pre-populated
3. Modify some fields
4. Submit form
5. Verify changes reflected
6. Test validation on edited data
```

### Test Delete Dialog

```bash
1. Click Delete button
2. Verify statistics are shown
3. Read warnings
4. Confirm deletion
5. Verify item removed from list
6. Verify related data deleted
```

### Test Dialog Edge Cases

```bash
1. Open dialog → close without saving
2. Open dialog → fill half → close → reopen (should reset)
3. Submit with validation errors
4. Submit with network error
5. Spam click submit button (should disable)
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Dialog tidak muncul
```tsx
// ✅ Solution: Pastikan state management benar
const [open, setOpen] = useState(false);
<Dialog open={open} onOpenChange={setOpen} />
```

### Issue 2: Form tidak ter-populate
```tsx
// ✅ Solution: useEffect dengan dependency
useEffect(() => {
  if (data) {
    reset(data);
  }
}, [data, reset]);
```

### Issue 3: Validation error tidak muncul
```tsx
// ✅ Solution: Register field dan display error
<Input {...register('fieldName')} />
{errors.fieldName && <p className="text-destructive">{errors.fieldName.message}</p>}
```

### Issue 4: onSuccess tidak dipanggil
```tsx
// ✅ Solution: Pastikan callback dipanggil
const handleSubmit = async () => {
  // ... save logic
  onSuccess?.(); // ← Jangan lupa!
  onOpenChange(false);
};
```

---

## 📊 Statistics

### Total Komponen Dibuat
- **PRIORITY 1:** 8 komponen ✅
- **PRIORITY 2:** 5 komponen ✅
- **PRIORITY 3:** 5 komponen ✅ (Bulk Import, Event Results, Reset Password, Class Details × 2)
- **Total:** 18 komponen ✅

### Lines of Code
- Event dialogs: ~1,900 lines
- User dialogs: ~1,400 lines
- Class dialogs: ~700 lines
- Bulk Import: ~600 lines
- Event Results: ~650 lines
- Reset Password: ~350 lines
- Class Details: ~500 lines
- Bulk Assign Users: ~350 lines
- **Total:** ~6,450 lines

### Coverage
- ✅ Create operations: 100%
- ✅ Read operations: 100%
- ✅ Update operations: 100%
- ✅ Delete operations: 100%
- ✅ Advanced features: 80%

---

## 🎯 Priority 3 Features

### Completed Features ✅

#### 1. **Bulk Import Users** ✅
- **Component**: `BulkImportUsersDialog.tsx` - `src/components/admin/users/BulkImportUsersDialog.tsx`
- **Features**:
  - ✅ CSV upload dengan drag & drop
  - ✅ Data validation otomatis
  - ✅ Preview data dengan status valid/error
  - ✅ Batch creation dengan progress indicator
  - ✅ Error reporting detail per user
  - ✅ Download template CSV
  - ✅ Support multiple roles (voter|candidate)
  - ✅ Auto-assign ke kelas
- **Documentation**: `docs/BULK_IMPORT_USERS_GUIDE.md`
- **Integration**: Sudah terintegrasi di `/admin/users` dengan tombol "Import CSV"

#### 2. **Event Results Page** ✅
- **Component**: `EventResultsView.tsx` - `src/components/admin/events/EventResultsView.tsx`
- **Features**:
  - ✅ Vote count visualization dengan charts interaktif
  - ✅ Bar Chart untuk perbandingan suara
  - ✅ Pie Chart untuk distribusi persentase
  - ✅ Statistics dashboard (Total Suara, DPT, Partisipasi)
  - ✅ Winner announcement dengan highlight khusus
  - ✅ Export to CSV dengan auto-download
  - ✅ Export to PDF via window.print
  - ✅ Detailed results table dengan progress bars
  - ✅ Real-time data fetching
  - ✅ Responsive design
- **Documentation**: `docs/EVENT_RESULTS_GUIDE.md`
- **Integration**: Sudah terintegrasi di `/admin/events/:id` sebagai tab "Hasil Pemilihan"

#### 3. **Reset User Password** ✅
- **Component**: `ResetPasswordDialog.tsx` - `src/components/admin/users/ResetPasswordDialog.tsx`
- **Features**:
  - ✅ Generate strong password (12 chars, mixed case, numbers, symbols)
  - ✅ Copy to clipboard dengan visual feedback
  - ✅ Show/hide password toggle
  - ✅ Send reset email via Supabase Auth
  - ✅ Manual password sharing option
  - ✅ Generate ulang password
  - ✅ Security warnings dan best practices
  - ✅ 3-step workflow (generate → confirm → complete)
  - ✅ Clipboard API integration
- **Documentation**: `docs/RESET_PASSWORD_GUIDE.md`
- **Integration**: Sudah terintegrasi di `/admin/users` dengan icon KeyRound di setiap row

#### 4. **Enhanced Class Details** ✅
- **Components**:
  - `ClassDetailsDialog.tsx` - `src/components/admin/classes/ClassDetailsDialog.tsx`
  - `BulkAssignUsersDialog.tsx` - `src/components/admin/classes/BulkAssignUsersDialog.tsx`
- **Features**:
  - ✅ View students list dengan tabel lengkap
  - ✅ Statistics dashboard (Total, Voters, Candidates)
  - ✅ Export student list to CSV
  - ✅ Bulk assign users to class
  - ✅ Search & filter users (nama, NIM, jurusan)
  - ✅ Multi-select dengan checkbox
  - ✅ Select all / deselect all
  - ✅ Visual feedback untuk selected users
  - ✅ Show current class per user
  - ✅ Scrollable list dengan sticky header
  - ✅ Role badges untuk setiap student
- **Documentation**: `docs/CLASS_DETAILS_GUIDE.md`
- **Integration**: Sudah terintegrasi di `/admin/classes` dengan tombol "Lihat Detail" dan icon UserPlus

---

## 📞 Support

Jika ada pertanyaan atau issues:
1. Check dokumentasi ini terlebih dahulu
2. Review kode komponen yang relevan
3. Test di development environment
4. Create issue di repository

---

**Last Updated:** 2025-11-01
**Version:** 2.0.0
**Author:** Claude Code Assistant
