# 06 — Candidate Pairs (Paslon)

Klarifikasi catatan #3: pairing **tidak nol**. DB + admin UI sudah ada, yang kurang adalah polish + kepastian alur.

## Yang sudah ada (jangan bikin ulang)

* DB: `candidate_pairs`, `candidate_pair_members`, `votes.pair_id` + constraint "candidate XOR pair" (`20251104040000_create_candidate_pairs.sql`), tally group by `candidate_id, pair_id`.
* Admin: `EventDetail.tsx:371,535,906-919` tab Pasangan + `CreatePairDialog.tsx`, `EditPairDialog.tsx`, `ApprovePairDialog.tsx` + toggle `use_pairs` + audit `event.use_pairs_change`.
* Voter: `VotingPage.tsx:109-113,153-157` (mode paslon), `ResultsPage.tsx:96-119` + `EventResultsView.tsx:71-88` (tally per-paslon), helper `src/lib/candidate-pair-helpers.ts` (`fetchPairsWithMembers`, `getPairDisplayName`).

## Yang masih kurang (fokus sini)

1. **Switch mode membingungkan:** toggle `use_pairs` di tengah jalan (sudah ada kandidat/vote) bisa bikin data campur. Aturan: kunci toggle saat `status != draft` ATAU sudah ada votes. Butuh konfirmasi ketik + audit (sudah ada audit, tinggal guard).
2. **Form paslon kurang panduan:** admin harus pick 2 kandidat approved + posisi ketua/wakil + nomor urut + foto gabungan. Tambah validasi: 2 anggota beda, keduanya approved + event sama, tidak boleh masuk 2 paslon aktif sekaligus.
3. **Voter UI:** kartu paslon harus jelas (foto berdua, nama gabungan, visi/misi gabungan), bukan dua kartu single yang bikin bingung. Samakan dengan `getPairDisplayName`.
4. **Hasil:** pastikan tidak double-count (1 vote = 1 paslon, bukan 2 kandidat). Tally sudah group by `pair_id`, tinggal uji.
5. **Hapus paslon:** `CreatePairDialog.tsx:165` ada delete saat gagal — pastikan ada soft-guard bila sudah ada vote (tolak + pesan, jangan hapus diam-diam).

## Task

* [ ] Guard toggle `use_pairs` (draft-only + zero-votes + konfirmasi).
* [ ] Validasi form paslon (anggota, status, event, duplikat).
* [ ] Polish kartu paslon voter + halaman hasil paslon (foto, nama, anggota).
* [ ] E2E paslon: buat → approve → vote → tally → hapus-ditolak-bila-ada-vote.
* [ ] Panduan 1 halaman untuk panitia (buat paslon tanpa panggil developer).

## Out of scope pilot

* Desain ulang secrecy ballots (tetap P2). Paslon tetap pakai `votes.pair_id` langsung.
