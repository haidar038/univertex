# Konfigurasi Redirect Supabase Auth

Kode klien mengirim reset-password ke `${window.location.origin}/reset-password`.
Supabase hanya memakai URL ini jika origin tersebut terdaftar pada konfigurasi
Auth; jika tidak, ia kembali ke **Site URL** (biasanya landing page).

Di Supabase Dashboard, buka **Authentication → URL Configuration** lalu:

1. Set **Site URL** ke origin aplikasi produksi, misalnya
   `https://univertex.example.com` (tanpa path).
2. Tambahkan setiap origin aplikasi pada **Redirect URLs** dengan pola berikut:

   - `https://univertex.example.com/**`
   - `http://localhost:5173/**`

3. Tambahkan pola origin preview bila Vercel preview dipakai untuk pengujian.

Link konfirmasi yang dibuat dari Dashboard/Auth akan kembali ke Site URL. Aplikasi
kemudian membaca sesi hasil konfirmasi dan mengarahkan pengguna ke dashboard sesuai
role. Link reset dari aplikasi dan dialog admin kembali langsung ke
`/reset-password`, tempat pengguna dapat menyetel password baru.

---

## P0-03 — Auth hardening (setting dashboard, 2026-09-13)

> Semua di bawah ini setting **dashboard** (tidak bisa via migrasi).
> Catat tanggal + siapa yang mengubah. Status awal: PLANNED — selesaikan sebelum pilot.

### A. JWT & session

- **JWT expiry → 3600 detik (1 jam):** Authentication → Settings → JWT expiry.
  Refresh token tetap panjang agar voter tidak login tiap jam, tapi tiap
  refresh `useAuth.refresh()` + `AppBootstrap` (interval 5 mnt) cek
  `is_session_revoked()` → revoke memaksa logout ≤5 mnt (bukti: matriks H1).
- Verifikasi: login → revoke via MySessions dari browser lain → browser
  pertama keluar ≤5 mnt + toast "Sesi dicabut".

### B. MFA + proteksi password

- **MFA TOTP:** Authentication → Sign In / MFA → enable TOTP.
  Aturan: **wajib untuk `admin`/`committee`** (enforce via SOP + cek manual),
  longgar untuk `voter` (password-only agar antrean H-H lancar).
- **Leaked Password Protection:** ON. **Rate-limit auth:** ON (cek di
  Authentication → Rate Limits).

### C. CAPTCHA

- Enable CAPTCHA (Turnstile/hCaptcha) — pasang HANYA di `/login` +
  `/invite/:token`. JANGAN di tiap vote (antrean H-H).
- `log_failed_login` tetap fire-and-forget (tanpa enumerasi email).
- Uji: H4 bot tanpa captcha ditolak setelah captcha on.

### D. SMTP produksi

- Ganti dari default Supabase ke SMTP kampus / Resend:
  Project Settings → Auth → SMTP Settings → host/port/user/pass + sender.
- Uji kirim (H5): invite + reset ke Gmail/Yahoo/Outlook + email kampus.
  Syarat lolos: masuk <2 mnt, tidak spam, link reset ke `/reset-password`
  (bukan landing). Sediakan fallback helpdesk (`docs/SOP-Helpdesk-HariH.md`).
- [ ] SMTP host: ............ (isi)
- [ ] Uji Gmail: ..../..../.... oleh ....
- [ ] Uji Yahoo: ..../..../.... oleh ....
- [ ] Uji Outlook: ..../..../.... oleh ....
- [ ] Uji email kampus: ..../..../.... oleh ....

### E. Checklist perubahan dashboard

| Tanggal | Siapa | Perubahan | Bukti |
|---|---|---|---|
| | | JWT expiry 3600 | screenshot redacted |
| | | MFA TOTP on | screenshot redacted |
| | | Leaked password + rate-limit on | screenshot redacted |
| | | CAPTCHA login/invite | uji H4 log |
| | | SMTP produksi | uji H5 4 provider |
