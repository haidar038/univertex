# Panduan Pemilih (Voter) — UniVertex

> Acuan: `AGENTS.md`. Bantuan: helpdesk panitia di halaman pemilihan.

## Cara Login
1. Buka `/login`.
2. Masukkan email + password (akun dibuat admin via undangan `/invite/:token`, bukan daftar sendiri).
3. Jika link konfirmasi email mendarat di landing `/`, tunggu redirect otomatis ke `/app/dashboard` (jangan klik berulang).

## Cara Vote
1. Dashboard `/app/dashboard` hanya menampilkan event DPT Anda (`class_id` ∈ `event_voter_groups`).
2. Klik “Mulai Voting” → `/app/vote/:eventId`. Tombol aktif hanya saat `status=voting` + dalam window + belum vote + DPT.
3. Pilih SATU kandidat/pasangan → “Konfirmasi Pilihan” → “Ya, Saya Yakin” (tidak bisa dibatalkan).
4. Tunggu toast “Suara berhasil tercatat” + badge “Sudah Memilih”. Audit `vote.cast` tercatat tanpa kandidat (anonim).

## Kendala
* “Tidak termasuk DPT” (`42501`) → hubungi admin/panitia, jangan paksa via API.
* “Sudah memberikan suara” (`23505`) → 1 voter = 1 suara, final.
* “Belum dimulai / sudah berakhir” (`P0001`) → cek jadwal resmi, bukan jam device.
* Lupa password → “Lupa password” di `/login` → cek inbox (<2 mnt, bukan spam). Jika email tak bisa diakses → verifikasi KTM ke pos helpdesk untuk reset manual.
* Perangkat: `/app/my-sessions` untuk lihat/cabut device asing; “Keluar dari semua device lain” bila perlu. Logout di device bersama.
