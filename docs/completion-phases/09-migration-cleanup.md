# 09 — Migration + Artifact Cleanup

Minta (catatan #6): bereskan file tidak relevan + gabung migrasi yang satu tujuan. Hati-hati: migrasi yang sudah naik ke prod **jangan diedit** (prinsip AGENTS.md). Bersih-bersih = ke depan, bukan rewrite history.

## Jangan disentuh

* 50 migrasi yang sudah di prod (sampai `20260913000100_session_revoke_check.sql`). Edit = drift prod vs lokal.
* Skema `votes`, constraint, trigger timeline.

## Boleh dibersihkan

1. **File jelas sampah (arsipkan, bukan hapus permanen):**
   * `test-sql.cjs`, `issues.log`, `issues/`, `.kilo/`, `docs/logs/`, `backups/` — jangan commit (sudah diingatkan AGENTS.md §10). Pindah ke arsip lokal terenkripsi bila perlu bukti.
   * `supabase/reset-db.sql`, `supabase/seed.sql` lama — tandai `deprecated` atau pindah ke `supabase/_archive/` bila tidak dipakai staging baru.
   * `docs/GPT-Review-Result.md` (arsip review), `docs/last-work-codex.md`, `docs/ai-response.md`, `docs/gpt-response.md` — tetap arsip, jangan jadi acuan implementasi.
2. **Dua file revert pelajaran:** `20261009000000_harden_privacy_rls.sql` + `20261009000100_revert_harden_privacy_rls.sql` — biarkan sebagai histori. Jangan squash. Pelajaran: kerjakan ulang privacy hardening sebagai migrasi baru yang kecil-kecil (per-tabel), bukan satu file raksasa.
3. **Merge ke depan (aturan):** 1 file = 1 tujuan. Contoh yang boleh digabung: 3 fix `admin_update_password` (`20260912000100`, `...0200`, hardening) bila BELUM ke prod — karena sudah ke prod, biarkan. Untuk fitur baru (bulk delete RPC, tally guard, class-import), tulis 1 migrasi rapi per fitur dengan rollback comment di bawah (contoh pola `20260913000000` yang simpan rollback di komentar).

## Cara merge yang aman (untuk fitur baru saja)

* Buat branch/staging dulu, uji `db push` staging hijau, baru anggap merge sukses.
* Tiap migrasi wajib: header tujuan, `IF EXISTS`/`DROP POLICY IF EXISTS` agar re-run aman, `GRANT` eksplisit + `REVOKE` berlebih, comment rollback.
* Setelah M1, buat `MIGRATION-MAP.md` 1 halaman: tabel migrasi → tujuan → status prod/staging. Ini pengganti baca 52 file satu-satu.

## DoD

* [ ] Tidak ada file sampah baru ke-commit (cek `git status` bersih kecuali kerja aktif).
* [ ] `MIGRATION-MAP.md` ada + staging `migration list` = lokal.
* [ ] Privacy hardening dikerjakan ulang sebagai 3 migrasi kecil (profiles, event_voter_groups, votes-view), bukan 1 file besar.
