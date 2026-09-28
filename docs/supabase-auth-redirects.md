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
- [x] SMTP host: Gmail SMTP relay + App password (`univertexapp@gmail.com`) — 2026-09-28 oleh developer. Resend DITOLAK (tanpa custom domain).
- [x] Uji Gmail: 2026-09-28 — TERKIRIM <2 mnt tapi masuk SPAM + banner "might be dangerous".
- [x] Uji Yahoo: 2026-09-28 — TERKIRIM tapi SPAM, link di-disable sampai "not spam".
- [x] Uji Outlook: 2026-09-28 — TERKIRIM tapi JUNK ("identified as junk").
- [x] Uji Proton (pengganti email kampus): 2026-09-28 — TERKIRIM + INBOX ✓.
- Verdict H5: delivered 4/4 cepat, inbox-placement 1/4 → BERSYARAT (lihat mitigasi di bawah), bukan hijau penuh.
- Mitigasi pilot: instruksi voter cek spam + "Not spam/Looks safe" SEBELUM klik link (Yahoo/Outlook disable link di spam); fallback helpdesk reset manual (`admin_update_password`, `docs/SOP-Helpdesk-HariH.md` §2). Perbaikan permanen (domain sendiri + SPF/DKIM via Resend/SMTP kampus) = backlog pasca-pilot.

### E. Checklist perubahan dashboard

| Tanggal | Siapa | Perubahan | Bukti |
|---|---|---|---|
| 2026-09-28 | developer | JWT expiry 3600 (default, verified) | screenshot Sessions |
| 2026-09-28 | developer | MFA TOTP: dashboard tersedia, TAPI app belum ada UI enroll/verify/AAL2 (`grep mfa src/` = 0) → DEFERRED, bukan enforced. Ref: `docs/supabase/about-mfa-totp-by-gemini.md` | implementasi menyusul pasca-pilot |
| 2026-09-28 | developer | Leaked password: N/A (Free plan, butuh Pro) → pengecualian tercatat | dashboard notice |
| 2026-09-28 | developer | Rate-limit ON (default: sign-in 30/5mnt, email 30/jam) | screenshot Rate Limits |
| 2026-09-28 | developer | CAPTCHA login/invite: DEFERRED (tanpa widget, enforcement = blokir semua login) | `grep captcha src/` = 0 |
| 2026-09-28 | developer | Redirect URLs: vercel.app + localhost terdaftar ✓. Site URL MASIH `http://localhost:8080` → WAJIB ganti ke origin prod sebelum pilot | screenshot URL Configuration |
| 2026-09-28 | developer | SMTP Gmail relay + uji H5 (lihat §D) | 4 inbox screenshots |
