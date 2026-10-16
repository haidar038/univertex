# 11 — Email + SMTP di `univertex.vercel.app`

Fakta (catatan #1 + bukti `docs/supabase-auth-redirects.md:61-67`): domain vercel.app milik Vercel, tidak bisa pasang SPF/DKIM/Resend domain sendiri. Tanpa itu, email gampang masuk spam + link di-disable Yahoo/Outlook. Ini bukan bug kode, ini batasan platform.

## Pilihan untuk pilot (pilih 1, tulis tanggal + siapa)

### Opsi A — Supabase default provider (disarankan bila waktu mepet)

* Pro: nol setting, langsung jalan untuk invite + reset + konfirmasi.
* Kontra: rate-limit ketat (cocok untuk puluhan/jam, mepet untuk 1600 sekaligus), spam placement buruk.
* Cara pakai: kirim batch kecil (50-100/jam) + sediakan salin-link manual + helpdesk reset manual. Jangan blast 1600 sekaligus.

### Opsi B — Gmail SMTP relay (sudah teruji, disarankan bila mau inbox lumayan)

* Sudah ada: `univertexapp@gmail.com` + App password, delivered 4/4 <2 mnt, inbox 1/4 (Proton inbox, Gmail/Yahoo/Outlook spam) — `supabase-auth-redirects.md:62-66`.
* Pro: delivered cepat, kuota lumayan untuk pilot.
* Kontra: tetap spam di 3 provider besar + banner "might be dangerous". Perlu SOP "cek spam → Not spam → klik".
* Cara pakai: sama seperti A (batch + fallback), tambah instruksi voter sebelum H-H (broadcast 1 halaman cara klik link dari spam).

### Opsi C — Domain sendiri + Resend/SMTP kampus (TUNDA pasca-pilot)

* Butuh beli domain + verifikasi + ganti Site URL + Redirect URLs + uji ulang. Jangan kerjakan H-7 pilot. Catat sebagai backlog M5+.

## Keputusan pilot 2026-10-12: Opsi B (Gmail relay) — disetujui user

* Alasan: sudah terkonfigurasi + teruji 28 Sep (delivered 4/4 <2 mnt); Resend mustahil tanpa domain sendiri; default Supabase rate-limit terlalu ketat untuk 1600 akun.
* Aturan kirim: batch 50–100/jam (jangan blast 1600 sekaligus); akun pre-provision via import (tidak tergantung inbox); setiap kirim disertai instruksi cek-spam + fallback salin-link manual (`SOP-Helpdesk-HariH.md §6`).
* Template email 1 paragraf (ID): "UniVertex: akun pemilihan Anda sudah dibuat. Login di <prod> dengan email ini. Bila diminta konfirmasi, cek folder Spam → tandai Not spam → klik link. Bantuan: <kontak helpdesk>."
* MFA: deferred tercatat; aturan manual — admin/committee wajib TOTP via SOP (aktifkan di dashboard per-akun), voter password-only.
* Verifikasi dashboard 28 Sep tetap berlaku (JWT 3600, rate-limit ON, redirect + Site URL prod, reset → `/reset-password`); user konfirmasi ulang tidak ada perubahan sebelum H-7, bila ada catat di `supabase-auth-redirects.md §E`.

## Checklist Auth dashboard (P-D, sekali)

* JWT expiry 3600, rate-limit ON, Site URL = origin prod, Redirect `https://<prod>/**` + `http://localhost:5173/**` (+ preview staging bila dipakai), reset mendarat `/reset-password` (bukti klik-link 29 Sep sudah lulus).
* CAPTCHA + MFA UI: deferred tercatat (`grep mfa src/` = 0, `grep captcha src/` = 0). Untuk pilot: CAPTCHA off + `log_failed_login` jalan, MFA admin/committee via SOP manual.
* Leaked password: N/A Free plan — catat pengecualian, jangan kejar.

## SOP fallback 1 halaman (wajib cetak untuk helpdesk)

1. Voter tidak dapat email → admin salinkan link `/invite/:token` dari `Invitations.tsx` ATAU reset manual via `admin_update_password` → voter login → ganti password.
2. Link masuk spam → instruksi "Tandai Not spam / Looks safe DULU, baru klik".
3. Reset tidak mendarat `/reset-password` → cek Redirect URLs, jangan share link mentah via chat tanpa origin benar.

## DoD M4

* [ ] Keputusan A/B tertulis + batch plan (berapa/jam, kapan blast).
* [ ] Template email 1 paragraf (ID, jelas, tanpa kata spam-trigger).
* [ ] 2 orang helpdesk bisa reset manual <3 menit/orang (uji).
