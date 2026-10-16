# 14 — Upacara Kredensial H-H (tanpa tergantung email)

Keputusan panitia: voter baru dapat akses saat H-H (antisipasi penggelembungan
suara). Kendala: SMTP terbatas (spam + rate-limit) — kirim 1600 email saat H-H
tidak realistis. Solusi di bawah menghilangkan ketergantungan email sepenuhnya.

## 1. Pisahkan 3 hal yang berbeda (ini kuncinya)

| # | Hal | Kapan | Butuh email? |
|---|---|---|---|
| 1 | **Provisioning akun** (siapa terdaftar, NIM unik) | H-7 s/d H-1, bulk import | TIDAK |
| 2 | **Distribusi kredensial** (tahu password) | H-H, fisik di TPS | TIDAK |
| 3 | **Hak vote** (bisa mencoblos) | H-H, window voting | TIDAK |

Ancaman sebenarnya bukan "akun dibuat lebih awal", melainkan **kredensial bocor
ke orang yang salah**. Akun yang dibuat H-7 tidak bisa mencoblos sebelum window
(trigger `tg_enforce_vote_timeline` + `UNIQUE(voter_id,event_id)` menjamin).
Yang harus dikunci H-H adalah **pengetahuan password**, bukan baris database.

## 2. Kenapa magic link/email H-H DITOLAK

Magic link = email juga (ketergantungan SMTP yang sama), plus lebih buruk:
link kedaluwarsa, masuk spam, 1600× kirim = rate-limit + antrean + gagal massal.
Email tetap dipakai hanya untuk operasional panitia/admin + fallback individual.

## 3. Rekomendasi: slip kredensial fisik + gerbang login (2 lapis)

**Lapis 1 — password ditahan sampai H-H (tanpa kode baru, wajib):**
1. H-7: import 1600 akun dengan password acak per voter (generator di dialog
   import). Admin **unduh CSV kredensial SEKALI** (email, NIM, password) —
   server tidak pernah menampilkannya lagi.
2. CSV dicetak per-kelas menjadi slip tertutup (nama, NIM, email, password
   sementara, URL login, 3 langkah). Amplop per kelas, simpan terkunci.
3. H-H: cek KTM → serahkan slip → voter login (didampingi) → coblos → selesai.
   Slip tak terambil = disegel + dihitung (rekonsiliasi: suara ≤ slip terserah).

**Lapis 2 — gerbang `banned_until` (penguat opsional, kecil):**
- Kolom `auth.users.banned_until` ADA dan dihormati GoTrue (terverifikasi
  2026-10-12): user ter-ban tidak bisa login walau password bocor.
- Saat import: set `banned_until = '9999-01-01'` untuk semua voter.
- H-H pagi: 1 perintah buka gerbang (`banned_until = NULL` untuk role voter).
- Pasca-publish: tutup lagi + revoke sesi. Tanpa email, hitungan detik,
  reversible bila salah tekan.

## 4. Yang dibangun (kecil, masuk P-C/P-D)

- [ ] Generator password acak di `BulkImportUsersDialog` + tombol "Unduh CSV
      kredensial (sekali)" pasca-import. Tanpa ini, panitia harus karang
      1600 password manual (tidak realistis).
- [ ] (Opsional) RPC `admin_set_voter_gate(p_banned BOOLEAN)`: ban/unban
      massal role voter + audit. Bila disetujui, 0,5 hari.
- [ ] SOP cetak & distribusi slip (per kelas, alur TPS, rekonsiliasi sisa).

## 5. Kaitan ke P-E

Beban H-H = **badai login pagi** (1600 slip → login berbarengan), bukan vote
merenung. Skrip k6 P-E wajib simulasikan login burst + vote, bukan read-only.
