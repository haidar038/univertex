# Peraturan Pemilihan — Pemilihan BEM Fakultas Hukum 2026

> **Status:** DRAF pra-isi agen 2026-09-29 dari data live DB. Bagian bertanda **[PUTUSAN PANITIA]**
> wajib diisi + ditandatangani panitia sebelum publikasi hasil. Template induk:
> `docs/Peraturan-Pemilihan-Template.md`.

## 1. Identitas Pemilihan (terisi dari DB)

- Nama event: Pemilihan BEM Fakultas Hukum 2026 (`95676965-a5c6-4f62-88bb-37ab9a57968b`)
- Jadwal: voting 16 Sep 2026 11:00 WIB s.d. 30 Sep 2026 11:00 WIB (DB: `2026-09-16 04:00Z`–`2026-09-30 04:00Z`)
- Tipe: **open** (live tally) | DPT: 4 kelas (`event_voter_groups`)
- Penyelenggara (owner): **[PUTUSAN PANITIA]**
- Ketua panitia + kontak: **[PUTUSAN PANITIA]**

## 2. Sumber Hasil Resmi (satu-satunya kebenaran)

1. Halaman resmi: `/results/95676965-a5c6-4f62-88bb-37ab9a57968b` + export tally bertanda waktu + hash snapshot DB.
2. Screenshot dashboard admin / pesan WA **bukan** hasil resmi.

## 3. Tie-Break & Masa Sanggah

- Seri / selisih ≤ __ suara → **[PUTUSAN PANITIA: putaran 2 tanggal __ / musyawarah / undi — pilih satu]**.
- Masa sanggah: 1x24 jam setelah `published` via formulir keberatan + bukti. Setelah itu final → `archived`.
- Penghitungan ulang = `get_election_tally` ulang dari snapshot yang sama, disaksikan observer + IT independen.

## 4. Siapa Boleh Apa

- Publish hasil: minimal **2 approvals** (ketua + 1 komite). Publish sendirian dilarang.
- Ubah jadwal/kandidat saat `voting`: dilarang kecuali transisi resmi + audit `critical` + pengumuman.
- Buka rincian `votes` individual: dilarang kecuali investigasi fraud dengan 2 saksi + catat `audit_log`.
- Publisher hasil (nama + peran): **[PUTUSAN PANITIA]**.

## 5. Privasi & Retensi (UU PDP No. 27/2022)

- NIM + pilihan = sensitif; akses minimal, tidak disebar ke grup WA.
- Snapshot H-H disimpan 1 tahun; lalu `voter_id` dianonimkan, agregat dipertahankan.
- Korban kebocoran dinotifikasi <72 jam.

## 6. Pelanggaran

- Double-vote otomatis ditolak (`23505` — terbukti E2E 2026-09-28).
- Non-DPT otomatis ditolak (`42501` — terbukti T2 2026-09-28).
- Jual-beli suara / intimidasi → diskualifikasi oleh komite + berita acara.
