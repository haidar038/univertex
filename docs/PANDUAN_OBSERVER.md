# Panduan Observer — UniVertex

> Acuan: `AGENTS.md`. Mode baca-saja, untuk BPM/saksi/auditor.

## Login
1. Buka `/login` dengan akun observer (undangan admin, intent `observer`).
2. Masuk ke `/observer` (hanya election yang ditugaskan).

## Yang Bisa Dilakukan
* Lihat daftar election + buka `/observer/election/:id` untuk tally agregat + riwayat observasi.
* Verifikasi penghitungan ulang: `get_election_tally` dari snapshot yang sama, disaksikan IT independen.

## Yang TIDAK Bisa Dilakukan
* Mengubah data apapun (tidak ada tombol aksi by design).
* Melihat suara individual voter (`votes` hanya admin; observer hanya agregat + audit non-rahasia).
* Menyebar screenshot dashboard sebagai “hasil resmi”. Hasil resmi hanya `/results/:id` + export bertanda waktu + hash snapshot (lihat `docs/Peraturan-Pemilihan-Template.md` §2).

## Bantuan
Hubungi admin bila assignment belum muncul (`election_observers` belum terisi).
