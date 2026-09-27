# Lanjutan: Perbaiki Reset Password + Potential Bug Cleanup

## Konteks

Setelah memperbaiki fitur reset password oleh admin (RPC `admin_update_password` + wiring di `ResetPasswordDialog.tsx`), masih ada tiga area kecil yang perlu diperbaiki untuk menghindari bug pelapor dan UX yang tidak konsisten. Semua perubahan bersifat frontend-only (tidak perlu migrasi baru).

## Latar Belakang Teknis

- `ResetPasswordDialog.tsx:handleResetPassword` — mengirim reset email via `supabase.auth.resetPasswordForEmail`. Fungsi ini tidak dipengaruhi oleh migration baru, tapi ada komentar kode yang sudah tidak akurat lagi.
- `ResetPassword.tsx:handlePasswordUpdate` — setelah `supabase.auth.updateUser({ password })` berhasil, jika `profile` masih null maka navigate ke `/login`. Ini menyebabkan "flash" halaman login sebelum `useAuth` redirect efek menangani ulang ke dashboard.
- `ResetPasswordDialog.tsx:handleClose` — tidak mereset state `isSubmitting`, yang berarti tombol bisa stuck disabled jika dialog ditutup saat sedang submit.

## Task

### 1. Update komentar ketinggalan zaman di `handleResetPassword`
**File:** `src/components/admin/users/ResetPasswordDialog.tsx:131-133`

**Masalah:** Komentar berbunyi *"Supabase tidak menyediakan API untuk admin mengubah password user lain dari client-side"* — sekarang tidak akurat karena RPC `admin_update_password` sudah ada (dibuat di migration `20260909000200`).

**Perbaikan:** Ganti komentar dengan penjelasan bahwa ini adalah alternatif email-based (user set password sendiri via link), berbeda dari tombol "Selesai" yang langsung menulis password ke database via `admin_update_password`.

### 2. Perbaiki redirect flash di `ResetPassword.tsx`
**File:** `src/pages/ResetPassword.tsx:82-89`

**Masalah:** Setelah `supabase.auth.updateUser({ password })` berhasil:
```tsx
if (profile) {
  navigate(dashboardPathFor(profile), { replace: true });
} else {
  navigate('/login', { replace: true });
}
```
Jika `profile` masih null (belum di-fetch oleh `useAuth`), user diarahkan ke `/login` sebentar sebelum `useAuth`'s redirect effect menangani ulang ke dashboard yang benar. Ini menyebabkan flash halaman login yang membingungkan.

**Perbaikan:** Jangan navigate ke `/login` sebagai fallback. Tetap tampilkan success message dan biarkan `useAuth`'s redirect effect (`PUBLIC_PATHS` effect) yang menangani redirect sekali profile tersedia. Atau: panggil `refresh()` dari `useAuth` secara eksplisit sebelum navigate, dan gunakan polling/`useEffect` untuk menunggu profile.

**Pendekatan yang direkomendasikan (pilihan A):** Panggil `refresh()` dari `useAuth` setelah updateUser berhasil, lalu navigate ke dashboardPathFor result (yang sudah di-fetch). Jika profile tetap null, tetap di halaman ini dengan success message.

### 3. Reset `isSubmitting` di `handleClose`
**File:** `src/components/admin/users/ResetPasswordDialog.tsx:177-184`

**Masalah:** `handleClose` tidak memanggil `setIsSubmitting(false)`. Jika dialog ditutup (via Cancel button atau backdrop click) saat `isSubmitting` true, state ini tetap true. Saat dialog dibuka kembali, `step` reset ke `'generate'` tapi `isSubmitting` masih true, dan tombol di step berikutnya akan disabled.

**Perbaiki:** Tambahkan `setIsSubmitting(false);` di `handleClose`.

## Validation Plan

1. `npx tsc --noEmit` — harus bersih
2. `npx eslint src/components/admin/users/ResetPasswordDialog.tsx src/pages/ResetPassword.tsx` — 0 error
3. `npx vitest run` — semua test existing harus tetap pass
4. Manual: buka ResetPasswordDialog, generate password, klik "Selesai" (manual reset), tutup dialog saat loading, buka lagi — tombol harus enable
5. Manual: buka ResetPassword page dengan recovery link, reset password, verifikasi tidak ada flash `/login`

## Out of Scope

- Perubahan migrasi database (semua 3 task di atas frontend-only)
- Refactor handleResetPassword untuk menggunakan RPC (desain email-based reset tetap valid sebagai alternatif)
