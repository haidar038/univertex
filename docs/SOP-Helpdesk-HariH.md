# SOP Helpdesk Hari-H — UniVertex (Cetak 2 Lembar)

> **Status:** PLANNED. Parent: `docs/P0-Golive-Readiness-Plan.md`. Cetak + simpan offline — jangan andalkan buka laptop saat antrean panjang.

## 1. Pos & Personil

- Pos 1 (verifikasi): cek KTM + DPT di `/admin/users` (kolom email). PIC: __ HP: __
- Pos 2 (reset): eksekusi reset via `ResetPasswordDialog` (pakai `admin_list_users`/`get_user_email`, JANGAN email dummy). PIC: __
- Pos 3 (sengketa): terima formulir keberatan, catat `audit_log`. PIC: __
- Kontak darurat IT on-call: __ | Supabase status: status.supabase.com | Vercel: vercel-status.com

## 2. Alur Reset Manual (verifikasi dulu, reset kemudian)

1. Minta KTM + sebutkan NIM + tanggal lahir (cocokkan `profiles`).
2. Admin cari user di `/admin/users`, klik KeyRound → `ResetPasswordDialog` → kirim ke **email asli** (dari RPC, bukan tebakan).
3. Jika email tidak bisa diakses: pakai `admin_update_password` (lihat `20260912..._hardening_admin_update_password.sql`) → set password sementara → user wajib ganti di `/app/profile` → catat `user.reset_password` + tanda tangan kertas.
4. JANGAN kirim password via WA tanpa verifikasi tatap muka + JANGAN foto layar password.

## 3. Jika Voter "Sudah Memilih" Padahal Merasa Belum

1. Cek `votes` miliknya (admin): `SELECT event_id, created_at FROM votes WHERE voter_id='<uid>'`.
2. Cek `audit_log`: `vote.cast` + `auth.login` jam berapa, dari device apa (`user_sessions`).
3. Jika ada → tunjukkan waktu + device, arahkan ke Pos 3 untuk keberatan resmi. JANGAN hapus suara diam-diam.
4. Jika tidak ada → cek DPT (`event_voter_groups`), status event (`voting` + window), coba device lain.

## 4. Jika Internet/TPS Down

1. Alihkan antrean ke TPS cadangan / tethering (2 ISP + 1 tethering sudah disiapkan P0-02).
2. Jika >15 mnt: ketua + IT putuskan perpanjang `end_time` via transisi resmi (`EventStatusDialog`) + umumkan di pengeras suara + WA resmi.
3. JANGAN terima "screenshot sudah vote" / suara kertas campur tanpa keputusan tertulis komite.

## 5. Formulir Keberatan (salin ke kertas)

```
Nama/NIM: __ | Event: __ | Jam kejadian: __ | Device: __
Uraian: __ | Bukti (foto error, jam): __ | Tuntutan: __
Tanda tangan pelapor + 1 saksi panitia + jam terima: __
Keputusan komite: __ | Eksekusi (SQL/RPC apa): __ | Audit ID: __
```
