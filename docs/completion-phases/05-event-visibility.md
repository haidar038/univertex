# 05 — Spec Visibilitas Event (Open vs Closed)

Masalah (catatan #2): checkbox "Tampilkan hasil setelah voter memilih" (`CreateEventDialog.tsx:241-243`, `EditEventDialog.tsx:293-299`) saat ini bisa dinyalakan untuk event `closed`. Akibatnya voter yang sudah milih langsung diarahkan ke `/app/results/:id` (`VotingPage.tsx:194-195`) dan bisa lihat siapa unggul + trophy pemenang (`ResultsPage.tsx:225-249`). Untuk closed ini bocor.

## Aturan baru (final, gampang diingat)

| Tipe | Sebelum vote | Sesudah vote (belum published) | Setelah published |
|---|---|---|---|
| `open` | Boleh lihat hasil live | Boleh lihat hasil live | Boleh |
| `closed` | Tidak lihat hasil | Lihat **struk abu-abu**: "Pilihanmu: X" + statistik disensor (`?` / bar abu-abu, tanpa angka, tanpa trophy) | Boleh lihat penuh |

* `public_results` = siapa boleh buka halaman hasil (publik vs login). `show_results_after_voting` = auto-redirect setelah vote. `election_type` = open/closed yang menentukan sensor.
* Untuk `closed`, `show_results_after_voting` **tidak boleh dipilih**. UI: disable + force `false` + tooltip. DB: guard di RPC/view (defense in depth, karena UI bisa diakali).

## Perubahan konkret

1. **Form admin** (`CreateEventDialog.tsx`, `EditEventDialog.tsx`):
   * `watch('election_type')`: bila `closed` → `setValue('show_results_after_voting', false)` + `disabled` + helper text "Hasil closed dibuka saat status published oleh admin."
   * Zod refine: tolak `closed + show_results_after_voting=true` dengan pesan jelas.
2. **Setelah vote** (`VotingPage.tsx:194-198`):
   * `open` → `navigate(/app/results/:id)` (tetap).
   * `closed` → `navigate('/app/dashboard')` atau halaman struk `/app/receipt/:id` (baru, ringan): tampilkan event, "Suara tercatat", "Pilihanmu: [nama / paslon]", tanpa angka.
3. **Halaman hasil** (`ResultsPage.tsx`, `EventResultsView.tsx`, `Dashboard.tsx:189`):
   * Tambah fungsi `canSeeTally(event, user, hasVoted)`: `true` bila `open` ATAU `status=published/archived` ATAU (admin/committee/observer dengan permission). Selain itu → mode `redacted`.
   * Mode `redacted`: sembunyikan trophy, pemenang, angka, persen, total. Ganti bar dengan abu-abu + `?`. Tetap tampilkan daftar kandidat/paslon (nama + foto) supaya voter yakin pilihannya masuk.
   * JANGAN andalkan sembunyikan tombol saja — RPC `get_election_tally` harus tolak voter untuk closed pre-publish (403/`42501`). Kalau tidak, DevTools tetap bisa intip.
4. **Migrasi kecil** (1 file, tanpa ubah `votes`):
   * `secure_get_election_tally_closed`: cek `election_type + status + has_permission/caller_has_permission`. Tulis test: voter closed pre-publish ditolak, admin lolos, open lolos, published lolos.

## DoD

* [ ] Closed + checkbox nyala tidak bisa disimpan (UI + zod).
* [ ] Voter closed sesudah vote tidak lihat angka/pemenang (UI + RPC).
* [ ] Open tetap live seperti sekarang (tidak regresi).
* [ ] E2E: `closed-redacted.spec.ts` (buat) hijau di staging.
