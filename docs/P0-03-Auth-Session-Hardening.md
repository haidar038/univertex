# P0-03 — Auth & Session Hardening

> **Status:** PLANNED. Parent: `docs/P0-Golive-Readiness-Plan.md`
> **Masalah:** `revoke_user_session_by_hash` hanya set `revoked_at` — JWT di device tetap valid. `src/components/AppBootstrap.tsx` + `src/hooks/useAuth.ts` tidak pernah cek revoke. Tanpa MFA/captcha/SMTP produksi.

## 1. Perubahan DB (kecil, 1 migrasi)

File: `supabase/migrations/20260913000100_session_revoke_check.sql`

- RPC `is_session_revoked(p_hash TEXT) RETURNS BOOLEAN` (SECURITY DEFINER, granted `authenticated`): `SELECT EXISTS(... WHERE refresh_token_hash=p_hash AND user_id=auth.uid() AND revoked_at IS NOT NULL)`.
- Pastikan `user_sessions` SELECT own-policy mengizinkan user baca `revoked_at` miliknya (sudah ada per `Update_September_2026.md §2`; verifikasi, jangan duplikasi).

## 2. Perubahan Frontend

- `src/lib/sessions.ts`: tambah `isCurrentSessionRevoked()` → panggil RPC di atas dengan `buildDeviceFingerprint().hash`.
- `src/components/AppBootstrap.tsx`: di interval 5 mnt + saat mount, jika revoked → panggil `signOut()` + toast "Sesi dicabut, silakan login ulang". Best-effort, jangan crash jika RPC 404 (migration belum apply).
- `src/hooks/useAuth.ts` `refresh()`: cek revoke dulu sebelum fetch profile; jika revoked → clear state + redirect `/login`.
- `src/pages/app/MySessions.tsx` + `src/pages/admin/Sessions.tsx`: tambah label "Sesi ini" via hash cocok + tombol "Keluar dari semua device" (loop revoke, P1 jika sempit).

## 3. Setting Dashboard Supabase Auth (catat tanggal + siapa)

- JWT expiry → **3600 detik** (1 jam). Refresh token tetap panjang agar UX voter tidak login tiap jam, tapi tiap refresh cek revoke (poin 2).
- Enable **MFA TOTP** — wajib untuk role `admin/committee` (enforce via SOP + cek `auth.mfa` di `useAuth`, bukan blokir voter).
- Enable **Leaked Password Protection** + rate-limit auth.
- CAPTCHA (Turnstile/hCaptcha) di `/login` + `/invite/:token` + `log_failed_login` tetap fire-and-forget.

## 4. SMTP Produksi

- Ganti dari default Supabase ke SMTP kampus / Resend. Update `docs/supabase-auth-redirects.md` (Redirect URLs + Site URL tetap, tambah bagian SMTP + uji kirim).
- Uji kirim: invite + reset ke Gmail/Yahoo/Outlook + email kampus. Cek spam score. Sediakan fallback helpdesk (lihat `docs/SOP-Helpdesk-HariH.md`).

## 5. Matriks Uji

| # | Skenario | Harapan |
|---|----------|---------|
| H1 | Login 2 browser → revoke 1 via MySessions | yang di-revoke keluar ≤5 mnt |
| H2 | Admin revoke via `/admin/sessions` | sama, + audit `session.revoke` |
| H3 | Login salah 10x | `audit_log auth.login.failed` ada, tanpa enumerasi email |
| H4 | Invite redeem bot tanpa captcha | ditolak setelah captcha on |
| H5 | Email reset masuk <2 mnt, tidak spam | terkirim + link ke `/reset-password` (bukan landing) |

## 6. Tradeoff UX

MFA + expiry 1 jam = gesekan. Aturan: **ketat untuk `admin/committee/observer`, longgar untuk `voter`** (password-only, session panjang, tapi tetap cek revoke). Captcha hanya di login/invite, JANGAN di tiap vote agar antrean H-H lancar.

## 7. DoD

- [ ] H1 terbukti (video/log 2 browser).
- [ ] Setting dashboard terdokumentasi (screenshot redacted).
- [ ] Email produksi terkirim ke 4 provider.
