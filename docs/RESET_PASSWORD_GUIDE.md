# 🔐 Panduan Reset User Password

Fitur untuk admin mereset password pengguna dengan generate password acak yang kuat.

---

## 🎯 Fitur Utama

1. **Generate Strong Password** - Generate password acak dengan kombinasi huruf, angka, dan simbol
2. **Copy to Clipboard** - Salin password dengan satu klik
3. **Show/Hide Password** - Toggle visibility password untuk verifikasi
4. **Send Reset Email** - Kirim email reset password otomatis
5. **Manual Sharing** - Opsi untuk sharing password secara manual
6. **Security Warnings** - Alert dan reminder tentang keamanan password

---

## 📍 Lokasi & Akses

### Cara Mengakses

1. Login sebagai **Admin**
2. Navigasi ke **Admin → Manajemen Pengguna**
3. Cari user yang ingin direset passwordnya
4. Klik icon **key (🔑)** di kolom Aksi

### Komponen

- **Lokasi**: `src/components/admin/users/ResetPasswordDialog.tsx`
- **Integrasi**: `src/pages/admin/Users.tsx`
- **Icon**: KeyRound dari lucide-react

---

## 🔧 Cara Menggunakan

### Step 1: Buka Dialog Reset Password

- Di tabel user, klik icon **KeyRound** (kunci)
- Dialog "Reset Password Pengguna" akan terbuka
- Lihat info user: nama dan email

### Step 2: Generate Password

- Klik tombol **"Generate Password"**
- Password acak akan digenerate otomatis
- Password memiliki:
  - Panjang: 12 karakter
  - Minimal 1 huruf besar
  - Minimal 1 huruf kecil
  - Minimal 1 angka
  - Minimal 1 karakter spesial (!@#$%^&*)

### Step 3: Copy Password

- Klik tombol **"Salin"** atau **"Copy"**
- Password otomatis tersalin ke clipboard
- Toast notification "Password berhasil disalin" muncul
- Icon berubah menjadi CheckCircle (✓) selama 3 detik

### Step 4: Pilih Metode Reset

Ada 2 opsi:

#### Opsi A: Kirim Email Reset (Otomatis)
- Klik tombol **"Kirim Email Reset"**
- Email reset password dikirim ke user
- User akan menerima link reset password
- User dapat membuat password baru sendiri

#### Opsi B: Share Manual
- Klik tombol **"Selesai"**
- Bagikan password yang sudah di-copy kepada user
- Via channel yang aman (WhatsApp, Telegram, dll)
- Instruksikan user untuk login dengan password baru

### Step 5: Instruksi ke User

Setelah reset, berikan instruksi kepada user:
1. Login dengan password baru
2. Navigasi ke **Profile → Ubah Password**
3. Ganti password dengan password pribadi mereka
4. Simpan perubahan

---

## 🔒 Password Generator

### Spesifikasi Password

**Format**: 12 karakter dengan kombinasi:
- **Huruf Besar** (A-Z): Min 1
- **Huruf Kecil** (a-z): Min 1
- **Angka** (0-9): Min 1
- **Simbol** (!@#$%^&*): Min 1
- **Random order**: Karakter diacak untuk keamanan

**Contoh Password**:
```
aB3!xYz9@K2m
P@ssw0rd!X7q
9M$k2Lp@Tn5v
```

### Algoritma Generator

```javascript
1. Generate 1 uppercase letter (A-Z)
2. Generate 1 lowercase letter (a-z)
3. Generate 1 number (0-9)
4. Generate 1 special character (!@#$%^&*)
5. Fill remaining 8 characters with random from all charset
6. Shuffle all characters randomly
7. Return 12-character password
```

### Keamanan Password

✅ **Strong Password Criteria**:
- Panjang minimal 12 karakter (lebih kuat dari requirement 6)
- Kombinasi 4 jenis karakter
- Unpredictable (random generation)
- No dictionary words
- No personal info

---

## 🔐 Security Features

### 1. Password Visibility Toggle

- Default: Password hidden (●●●●●●●●●●●●)
- Click eye icon: Show password
- Click eye-off icon: Hide password
- Prevent shoulder surfing

### 2. Clipboard Security

- Password copied securely via Navigator Clipboard API
- Auto-clear notification after 3 seconds
- One-time copy (tidak tersimpan permanently)

### 3. Email Reset Security

- Menggunakan Supabase Auth resetPasswordForEmail
- Token-based reset (secure)
- Time-limited reset link
- Redirect to app reset password page

### 4. Security Warnings

Dialog menampilkan beberapa warning:

⚠️ **Warning 1**: Password harus dibagikan secara aman
⚠️ **Warning 2**: User harus mengubah password setelah login pertama
⚠️ **Note**: Keterbatasan Supabase Auth (admin tidak bisa langsung ubah password)

---

## 📧 Email Reset Flow

### Supabase Auth Integration

```typescript
await supabase.auth.resetPasswordForEmail(userEmail, {
  redirectTo: `${window.location.origin}/reset-password`,
});
```

**Flow**:
1. Admin klik "Kirim Email Reset"
2. Supabase kirim email ke user
3. Email berisi link reset password
4. User klik link → redirect ke `/reset-password`
5. User input password baru
6. Password ter-update di Supabase Auth

### Email Content

Email yang dikirim Supabase berisi:
- Subject: "Reset Your Password"
- Body: Reset password instructions
- Link: Secure token-based link
- Expiry: 60 minutes (default)

---

## 🚨 Limitations & Workarounds

### Limitation: Admin Cannot Directly Change Password

**Masalah**:
Supabase Auth tidak menyediakan API untuk admin mengubah password user lain dari client-side karena alasan keamanan.

**Solusi**:
1. **Email Reset** (Recommended): User reset sendiri via email
2. **Manual Sharing**: Admin generate password dan share ke user
3. **Service Role API** (Advanced): Gunakan Supabase Admin API di backend

### Workaround Options

#### Option 1: Email Reset (Best Practice)
```typescript
// Admin trigger email reset
await supabase.auth.resetPasswordForEmail(email);
// User receives email and resets password themselves
```

**Pros**:
- ✅ Secure (token-based)
- ✅ Self-service
- ✅ No manual password sharing

**Cons**:
- ❌ User must have access to email
- ❌ Requires extra step

#### Option 2: Manual Password Sharing
```typescript
// Admin generates password
const password = generateStrongPassword();
// Admin shares to user via secure channel
// User logs in and changes password
```

**Pros**:
- ✅ Immediate access
- ✅ No email required
- ✅ Admin has control

**Cons**:
- ❌ Password transmission risk
- ❌ Requires secure channel
- ❌ Manual process

#### Option 3: Service Role API (Backend)
```typescript
// Backend with service role key
const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
  userId,
  { password: newPassword }
);
```

**Pros**:
- ✅ Direct password update
- ✅ No email needed
- ✅ Full control

**Cons**:
- ❌ Requires backend implementation
- ❌ Service role key exposure risk
- ❌ More complex setup

---

## 📱 User Experience

### UI Flow

```
[User Table]
    ↓ Click Key Icon
[Dialog: Step 1 - Generate]
    ↓ Click "Generate Password"
[Dialog: Step 2 - Confirm]
    ↓ Copy Password
    ↓ Choose: Email Reset OR Manual Share
[Dialog: Step 3 - Complete]
    ↓ Follow-up instructions
[Close Dialog]
```

### Step Indicators

Dialog menggunakan 3 steps:
1. **generate** - Initial screen dengan warning
2. **confirm** - Password generated, copy & choose method
3. **complete** - Success screen dengan next steps

### Visual Feedback

- ✅ **Success**: Green checkmark icon
- ⚠️ **Warning**: Yellow alert icon
- 🔑 **Key**: Icon di button tabel
- 👁️ **Eye**: Show/hide password toggle
- 📋 **Copy**: Clipboard icon
- ✉️ **Mail**: Email icon
- ♻️ **Refresh**: Generate ulang icon

---

## 🎯 Use Cases

### Use Case 1: User Lupa Password

**Skenario**: User report lupa password dan tidak bisa login

**Flow**:
1. User contact admin via support
2. Admin buka Manajemen Pengguna
3. Cari user berdasarkan nama/NIM
4. Klik icon reset password
5. Generate password baru
6. Pilih **"Kirim Email Reset"**
7. User cek email → reset password sendiri

### Use Case 2: New User Setup

**Skenario**: Admin baru buat user dan perlu share initial password

**Flow**:
1. Admin buat user via "Tambah Pengguna"
2. User dibuat dengan password default
3. Admin klik reset password
4. Generate password kuat
5. Copy password
6. Share ke user via WhatsApp
7. User login pertama kali
8. User diminta ubah password

### Use Case 3: Security Breach Response

**Skenario**: Suspek account compromise, perlu reset emergency

**Flow**:
1. Admin detect suspicious activity
2. Immediate password reset
3. Generate new password
4. Send email reset ke user
5. User forced to reset
6. Enable 2FA (optional)
7. Review activity logs

### Use Case 4: Bulk Password Reset (Future)

**Skenario**: Mass password reset untuk kelas tertentu

**Future Enhancement**:
1. Admin select multiple users
2. Bulk reset password action
3. Generate unique password per user
4. Export passwords ke CSV (encrypted)
5. Distribute passwords securely

---

## 🐛 Troubleshooting

### Issue 1: Copy to Clipboard Failed

**Masalah**: Error saat copy password

**Penyebab**:
- Browser tidak support Clipboard API
- HTTPS requirement (Clipboard API hanya works di HTTPS)
- Permission denied

**Solusi**:
```javascript
// Check if clipboard available
if (!navigator.clipboard) {
  // Fallback: Show password in alert
  alert(password);
}

// Or use manual select + copy
input.select();
document.execCommand('copy');
```

### Issue 2: Email Not Received

**Masalah**: User tidak terima email reset

**Penyebab**:
- Email masuk spam folder
- Email address salah
- Supabase email service issue
- Rate limiting

**Solusi**:
1. Cek spam folder
2. Verify email address di database
3. Cek Supabase dashboard → Email Settings
4. Try manual password sharing instead

### Issue 3: Generated Password Too Complex

**Masalah**: User complain password terlalu rumit

**Penyebab**:
- 12 characters + symbols sulit diingat
- User prefer simple password

**Solusi**:
- Instruksikan user untuk immediate change password
- Use password manager recommendation
- Customize generator (remove symbols)

**Code Adjustment**:
```typescript
// Simpler password (no symbols)
const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const length = 10; // Shorter
```

### Issue 4: Reset Link Expired

**Masalah**: User klik reset link tapi sudah expired

**Penyebab**:
- Default expiry: 60 minutes
- User delay action

**Solusi**:
- Generate new reset link
- Increase expiry time (Supabase settings)
- Use manual password sharing

---

## 🔄 Integration with Other Features

### 1. Create User Dialog

Saat create user:
- Password initial required
- Setelah create, admin bisa immediate reset
- Generate strong password for new user

### 2. Edit User Dialog

Edit user tidak termasuk password change:
- Password management separate
- Use reset password feature instead

### 3. User Profile Page

User dapat ubah password sendiri:
- Navigate to `/app/profile`
- Section "Ubah Password"
- Input old password + new password

---

## 📊 Statistics & Monitoring

### Metrics to Track

1. **Password Reset Count**: Total reset per month
2. **Method Used**: Email vs Manual share ratio
3. **Time to Reset**: Average time dari request ke complete
4. **Failed Resets**: Count gagal reset dan reason

### Logging

Log events:
- `admin.password_reset.initiated`
- `admin.password_reset.generated`
- `admin.password_reset.email_sent`
- `admin.password_reset.completed`

---

## 🚀 Future Enhancements

### Planned Features

1. **Password History**
   - Track last 5 passwords
   - Prevent password reuse
   - Compliance requirement

2. **Password Expiry**
   - Auto-expire after 90 days
   - Force password change
   - Email reminder before expiry

3. **Password Strength Meter**
   - Visual indicator
   - Realtime feedback
   - Suggestions

4. **Bulk Reset**
   - Select multiple users
   - Mass password reset
   - CSV export

5. **2FA Integration**
   - Optional 2FA setup
   - SMS/TOTP options
   - Enhanced security

6. **Audit Trail**
   - Full reset history
   - Who initiated
   - When completed
   - Method used

---

## 📞 Support

Jika ada pertanyaan atau issues terkait Reset Password:
1. Cek dokumentasi ini terlebih dahulu
2. Review kode komponen `ResetPasswordDialog.tsx`
3. Test dengan data sample
4. Contact IT Admin jika masalah berlanjut

---

## 📋 Checklist untuk Admin

Saat melakukan password reset:

- [ ] Verify user identity (confirm nama, NIM, email)
- [ ] Generate strong password
- [ ] Copy password to clipboard
- [ ] Choose reset method (email/manual)
- [ ] If manual: Use secure channel (encrypted chat)
- [ ] Verify user received password
- [ ] Instruct user to login immediately
- [ ] Remind user to change password after first login
- [ ] Document reset in admin notes (optional)
- [ ] Follow up after 24 hours (ensure user changed password)

---

**Last Updated**: 2025-11-01
**Author**: Claude Code Assistant
**Version**: 1.0.0
