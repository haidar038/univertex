# Peraturan Pemilihan — Pemilihan BEM Fakultas Hukum 2026

> **Status:** SAH 2026-09-29 — disahkan Chalid Ridwan (Ketua Panitia) + Faisal Abidin (Komite).
> Dokumen final, tidak ada isian tersisa. Perubahan setelah ini hanya via amandemen tertulis panitia.

## 1. Identitas Pemilihan (bagian ini SUDAH terisi dari database, jangan diubah)

- Nama event: Pemilihan BEM Fakultas Hukum 2026 (`95676965-a5c6-4f62-88bb-37ab9a57968b`)
- Jadwal: voting 16 Sep 2026 11:00 WIB s.d. 30 Sep 2026 11:00 WIB
- Tipe: **open** (perolehan suara tampil langsung) | DPT: 4 kelas
- Penyelenggara (organisasi pemilik acara, contoh: *BEM Fakultas Hukum periode 2025/2026*): BEM FH Unkhair periode 2025/2026
- Ketua panitia (nama + nomor WA aktif hari-H, contoh: *Ahmad Hidayat — 0812-xxxx-xxxx*): Chalid Ridwan - 081234567890

## 2. Sumber Hasil Resmi (satu-satunya kebenaran)

1. Halaman resmi: `/results/95676965-a5c6-4f62-88bb-37ab9a57968b` + export tally bertanda waktu + hash snapshot DB.
2. Screenshot dashboard admin / pesan WA **bukan** hasil resmi.

## 3. Jika Suara Seri

- Suara seri terjadi apabila dua atau lebih kandidat memperoleh jumlah
  suara sah tertinggi yang sama persis (selisih 0 suara).

- Cara memutuskan:
  - Pemungutan suara ulang (putaran 2) paling lambat 3×24 jam setelah
    hasil seri diumumkan, hanya untuk kandidat yang memperoleh suara
    tertinggi yang sama.

- Suara pada putaran 1 tidak digabungkan dengan suara pada putaran 2.
  Hasil putaran 2 menjadi dasar penetapan pemenang akhir.

- Masa sanggah: 1×24 jam setelah hasil dipublikasi, melalui formulir
  keberatan resmi yang disertai bukti.

- Penghitungan ulang (recount) berarti menghitung ulang dari dataset
  suara yang sama (`get_election_tally`) dan tidak menghasilkan suara baru.
  Recount dilakukan dengan disaksikan observer + IT independen dan dicatat
  dalam audit log.

- Setelah masa sanggah selesai dan seluruh keberatan telah diselesaikan,
  hasil ditetapkan sebagai FINAL dan diarsipkan.

## 4. Siapa Boleh Apa

- Publish hasil: minimal **2 orang** (ketua + 1 komite). Publish sendirian dilarang.
- Dua nama yang berhak publish (contoh: *Ahmad Hidayat (ketua) + Siti Rahma (sekretaris)*): Achmad Fatchur Rozaq (Ketua) dan Siti Nadira (Komite/Sekretaris)
- Ubah jadwal/kandidat saat voting berjalan: dilarang, kecuali lewat prosedur resmi + tercatat di audit + diumumkan.
- Buka rincian suara per orang: dilarang, kecuali investigasi kecurangan dengan 2 saksi + tercatat di audit.

## 5. Privasi & Retensi (UU PDP No. 27/2022)

- NIM, identitas pemilih, dan rekam pilihan suara merupakan Data Pribadi
  yang wajib dilindungi. Akses dibatasi berdasarkan prinsip kebutuhan
  untuk menjalankan tugas resmi dan data tersebut tidak disebarkan ke
  grup WhatsApp atau kanal publik.
- Data H-H disimpan 1 tahun untuk audit, lalu nama pemilih dianonimkan, angka agregat dipertahankan.
- Kegagalan Pelindungan Data Pribadi ditangani dan diberitahukan sesuai
  UU No. 27 Tahun 2022, termasuk kewajiban pemberitahuan paling lambat
  3×24 jam apabila ketentuan tersebut berlaku.

## 6. Pelanggaran

- Setiap pemilih hanya dapat memberikan satu suara.
- Percobaan pemberian suara kedua ditolak sistem dan tidak menghasilkan
  suara tambahan.
- Pemilih yang tidak termasuk DPT tidak dapat memberikan suara.
- Jual-beli suara / intimidasi → diskualifikasi pemilih/kandidat oleh komite + berita acara.

Technical evidence:
`23505` — duplicate vote protection
`42501` — non-DPT authorization protection
Tested: `2026-09-28`

## 7. Pengesahan

- Disahkan tanggal: 29 September 2026

- Tanda tangan 1
  Jabatan: Ketua Panitia
  Nama jelas: Chalid Ridwan

- Tanda tangan 2
  Jabatan: Komite
  Nama jelas: Faisal Abidin