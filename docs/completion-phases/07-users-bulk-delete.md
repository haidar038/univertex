# 07 — Bulk Delete Users di `src/pages/admin/Users.tsx`

Minta (catatan #4): hapus banyak user sekaligus, bukan satu-satu (`DeleteUserDialog.tsx` saat ini single).

## Desain UI (ikut pola tabel yang ada)

* Tambah checkbox header (pilih semua di halaman) + checkbox per baris (`users.map` di `Users.tsx`).
* Toolbar muncul saat `selected.size > 0`: "X dipilih [Hapus massal] [Batal]".
* Dialog baru `BulkDeleteUsersDialog.tsx` (tirukan `DeleteUserDialog.tsx:33-71`):
  * Tampilkan ringkasan: N user, berapa yang punya votes/kandidat (query count per id, batch, bukan N+1 RPC berat).
  * Aturan blokir:
    * Lewati `admin` (jangan tampilkan admin di list — sudah difilter di `Users.tsx:fetchUsers`, pertahankan).
    * Bila ada yang `votesCount>0` atau `candidaciesCount>0` → tampilkan daftar + minta ketik `HAPUS` + checkbox "Saya paham data vote/kandidat ikut terpengaruh". Default: tolak hapus yang ada vote (paling aman untuk pilot 1600).
    * Tombol hapus disabled saat proses, progress bar per-batch (misal 25/batch biar tidak timeout).
  * Sukses: toast + `fetchUsers()` + audit.

## Backend

* Jangan hapus via loop `profiles.delete()` tanpa guard — pakai RPC baru `admin_bulk_delete_users(p_user_ids uuid[])` (SECURITY DEFINER + `has_permission('user.delete')`):
  * Kembalikan ringkasan `{deleted, skipped_admin, skipped_has_votes, skipped_has_candidacy}`.
  * Tulis 1 baris audit `user.bulk_delete` dengan metadata ids + counts (jangan log email mentah bila tidak perlu).
  * Manfaatkan cascade yang sudah ada (`20260910_fix_user_deletion_cascade.sql`) — verifikasi tidak orphan `user_roles`/`candidates`/`votes`.
* Hapus harus urut: kandidat/DPT-link/invite → roles → profile → (auth user via existing flow, jangan bikin flow baru).

## DoD

* [ ] Pilih 50 user dummy di staging → hapus massal <30 detik, tanpa orphan (cek counts).
* [ ] Yang sudah vote ditolak dengan pesan jelas (kode error terstruktur, bukan string).
* [ ] Audit `user.bulk_delete` tercatat + bisa di-export.
* [ ] Tidak bisa hapus admin dari UI ini.
