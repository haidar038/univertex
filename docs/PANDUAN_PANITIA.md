# Panduan Panitia (Committee) — UniVertex

> Acuan: `AGENTS.md`. Sengketa: `docs/SOP-Helpdesk-HariH.md`.

## Login
1. Buka `/login` dengan akun panitia (dibuat via undangan admin, intent `committee`).
2. Masuk ke `/committee` (hanya election yang ditugaskan via `/admin/events/:id/staff`).

## Tugas
* Buka `/committee/election/:electionId` → pantau tally agregat (bukan suara individual voter).
* Tambah observasi/catatan kejadian (append-only, tersimpan sebagai bukti).
* TIDAK dapat mengubah kandidat, suara, jadwal, atau DPT. Perubahan via admin + transisi resmi.

## Koordinasi
* Anomali → admin via channel helpdesk + catat waktu/device/bukti.
* Sengketa “sudah memilih padahal belum”: cek `votes` + `audit_log vote.cast` + `user_sessions` dulu, jangan hapus suara. Arahkan ke Pos 3 + formulir keberatan.
* Internet down >15 mnt: eskalasi ketua + IT untuk perpanjang `end_time` resmi + pengumuman, bukan suara kertas campur tanpa keputusan tertulis.
