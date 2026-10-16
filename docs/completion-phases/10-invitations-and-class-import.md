# 10 — Invite Rework + Import per-Kelas + Akses H-H Only

Masalah (catatan #7, #8): invite email tidak masuk, konsep invite vs bulk import vs user management ambigu, panitia mau voter baru bisa milih **saat H-H saja**, admin mau assign tidak satu-satu.

## Keputusan desain (final untuk pilot)

* **Voter massal (1600) = import per-kelas, BUKAN invite satu-satu.** Invite tetap ada tapi khusus susulan: committee/observer/kandidat tambahan + voter susulan <20 orang.
* **Akun dibuat awal (pre-provision), hak milih dibuka H-H.** Ini menjawab "manipulasi diantisipasi sedini mungkin" + "baru bisa milih saat H-H": data dikunci awal, vote ditolak di luar window oleh DB (bukan janji UI).
* **Email konfirmasi + auto-login:** habis import, sistem kirim 1 email per voter (atau link manual bila email nyangkut) → voter klik konfirm → langsung login tanpa password baru yang ribet.

## Alur baru

```
Admin pilih Kelas (ex: IF-2024-A)
  → Upload CSV / pick dari tabel (full_name, student_id, email)
  → Sistem buat akun via admin_create_user (idempotent, skip bila email sudah ada)
  → Set class_id + role voter + masuk DPT event (event_voter_groups / eligibility_rules)
  → Kirim email konfirmasi (token invite intent=register, expiry 14 hari)
  → Voter klik → accept_invitation_and_register / redeem_invitation → auto-login → dashboard
  → Sebelum H-H: voter bisa login, lihat event, TAPI vote ditolak (status != voting / window belum buka → P0001/42501 + banner)
  → H-H: status voting + window buka + DPT cocok → vote 1x → struk abu-abu (closed) / hasil live (open)
```

## Perubahan konkret

1. **Import per-kelas** (`Classes.tsx`, `BulkAssignUsersDialog.tsx`, `BulkImportUsersDialog.tsx:82`):
   * Mode baru: dropdown kelas → preview N calon → tombol Import. CSV boleh tanpa `class_name` karena sudah dipilih di UI.
   * Panggil RPC batch (bukan loop insert dari browser 1600x — timeout). RPC: `admin_import_class_users(p_class_id, p_users jsonb)` (baru, 1 migrasi). Kembalikan `{created, skipped_exists, errors[]}`.
   * Habis import: tombol "Kirim email konfirmasi (N)" + "Salin link manual (CSV)" sebagai fallback bila SMTP nyangkut.
2. **Invite dipersempit** (`Invitations.tsx:49,105-115`):
   * Default intent untuk susulan: `committee/observer/candidate`. Intent `register/voter_group` disembunyikan dari UI massal (tetap ada di DB untuk kompatibilitas).
   * Tampilkan kolom: status (pending/accepted/expired/revoked), tombol salin link + kirim ulang + revoke. Jangan janjikan "email otomatis terkirim" bila provider default.
3. **Akses H-H only (tanpa fitur baru gede):**
   * Andalkan yang sudah ada: `assert_event_is_votable` (timeline) + `is_eligible_voter` (DPT) + `voter_id=auth.uid()` + `UNIQUE(voter_id,event_id)`. Tambah 1 RPC `get_my_access(event_id)` (optional, ringan) untuk pesan UI yang jelas: `belum_buka / bukan_DPT / sudah_vote / boleh_vote`.
   * `VotingPage.tsx:86-93,168-173`: ganti cek eligibility cepat dengan RPC itu bila ada, biar pesan tidak menipu.
4. **Token + keamanan:**
   * Token tetap 64-hex, expiry 14 hari, sekali pakai (`accepted_at`), bisa revoke. Rate-limit pembuatan massal (jangan 1600 RPC invite sekaligus — pakai job batch + jeda).
   * `redeem_invitation` wajib: cek expiry + revoke + email cocok + buat role idempotent (`ON CONFLICT DO NOTHING`).

## DoD M3

* [ ] Import 100 dummy/kelas di staging → akun jadi + DPT masuk + email/link keluar.
* [ ] Voter pre-H-H bisa login tapi vote ditolak dengan pesan benar (`P0001`/`42501`).
* [ ] H-H simulasi (window dibuka) → vote 1x sukses → vote ke-2 ditolak `23505`.
* [ ] Invite susulan committee/observer jalan (buat → salin → redeem → role masuk).

## Keputusan sinkronisasi 2026-10-16 (audit user management)

- Import: SATU jalur = RPC batch \dmin_import_class_users\ (incl. roles). Loop per-baris UI DIHAPUS. PIN tetap dibuat di client (butuh plaintext untuk slip).
- Hapus user: SATU aturan = \dmin_bulk_delete_users\ (tunggal panggil dengan 1 id). Blokir pemilik votes/kandidatur di semua jalur.
- Invite vs assign staff: invite = orang LUAR (belum punya akun, butuh intent committee/observer/candidate); assign di ElectionStaff = orang DALAM (sudah punya akun). Keduanya hidup, tidak digabung.
- Gerbang login H-H = penahanan distribusi password (cukup). \anned_until\ TIDAK dibangun. \get_my_access\ RESMI DIBATALKAN (YAGNI; trigger + banner cukup).

