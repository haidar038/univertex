# Template Peraturan Pemilihan — UniVertex (1 Halaman, Wajib Diisi Panitia)

> **Status:** TEMPLATE — salin menjadi `Peraturan-Pemilihan-<NamaEvent>-<Tahun>.md` per event. Tempel ringkasannya di landing + halaman `/results/:id`.
> **Parent:** `docs/P0-Golive-Readiness-Plan.md`

## 1. Identitas Pemilihan

- Nama event: __________
- Penyelenggara (owner): __________
- Ketua panitia + kontak: __________
- Jadwal: pendaftaran __ s.d. __ | voting __ pukul __ s.d. __ | penghitungan __ | publikasi __
- Tipe: [ ] open (live tally) / [ ] closed (hasil setelah publish)
- DPT: __________ (rujuk `event_voter_groups` / rules). Jumlah DPT: ____

## 2. Sumber Hasil Resmi (satu-satunya kebenaran)

1. Halaman resmi: `/results/<eventId>` + export tally bertanda waktu + hash snapshot DB.
2. Screenshot dashboard admin / pesan WA **bukan** hasil resmi.
3. Untuk tipe closed: hasil sementara yang beredar sebelum `published` dianggap hoaks.

## 3. Tie-Break & Masa Sanggah

- Seri / selisih ≤ __ suara → [ ] putaran 2 tanggal __ / [ ] musyawarah / [ ] undi (pilih satu, coret lainnya).
- Masa sanggah: 1x24 jam setelah `published` via formulir keberatan + bukti. Setelah itu hasil final → `archived`.
- Penghitungan ulang = jalankan `get_election_tally` ulang dari snapshot yang sama, disaksikan observer + IT independen. Bukan coblos ulang.

## 4. Siapa Boleh Apa

- Publish hasil: minimal **2 approvals** (ketua + 1 komite). Publish sendirian dilarang.
- Ubah jadwal/kandidat saat `voting`: dilarang kecuali transisi resmi + audit `critical` + pengumuman.
- Buka rincian `votes` individual: dilarang kecuali investigasi fraud dengan 2 saksi + catat `audit_log`.

## 5. Privasi & Retensi (UU PDP No. 27/2022)

- Data NIM + pilihan = data sensitif. Akses minimal, tidak disebar ke grup WA.
- Snapshot H-H disimpan 1 tahun untuk audit, lalu `voter_id` dianonimkan, agregat dipertahankan.
- Korban kebocoran dinotifikasi <72 jam.

## 6. Pelanggaran

- Double-vote otomatis ditolak (`23505`). Bukti vote pertama tercatat di audit.
- Non-DPT otomatis ditolak (`42501` setelah P0-01).
- Jual-beli suara / intimidasi → diskualifikasi pemilih/kandidat oleh komite + berita acara.
