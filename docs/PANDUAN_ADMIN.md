# Panduan Admin — UniVertex

> Acuan teknis: `AGENTS.md`. Template operasional H-H: `docs/RUNBOOK.md`, `docs/SOP-Helpdesk-HariH.md`.

## Login
1. Buka `/login` dengan email + password admin (MFA TOTP wajib bila diaktifkan).
2. Masuk ke `/admin/dashboard` (rekap real-time via `get_election_tally`, bukan N+1).

## Kelola Event
* `/admin/events` → buat baru (judul, deskripsi, `start_time/end_time`, tipe `open/closed`, `public_results`, `show_results_after_voting`).
* Ubah status **hanya via dialog Ubah Status** (`draft → registration → voting → counting → published → archived`). Jangan update `status` langsung.
* Dilarang ubah window/kandidat saat `voting` tanpa transisi resmi + audit `critical` + pengumuman (lihat `docs/Peraturan-Pemilihan-Template.md` §4).
* Detail event `/admin/events/:id`: tambah/approve kandidat, assign `event_voter_groups` (DPT per kelas), staff `/admin/events/:id/staff`.

## Kelola User & Kelas
* `/admin/users`: buat via `admin_create_user` (sesi admin tidak hijack), bulk CSV, reset via `ResetPasswordDialog` ke **email asli dari RPC** (bukan `${student_id}@university.edu`). Kolom email untuk monitoring.
* `/admin/classes`: CRUD kelas + assign user ke `class_id` (DPT). User tanpa `class_id` = non-DPT → vote ditolak `42501`.

## Undangan & Staff
* `/admin/invitations`: intent `register/voter_group/candidate/committee/observer`, token 64-hex, salin link `/invite/:token` manual (email SMTP belum otomatis bila belum setting).
* Staff per event: `/admin/events/:id/staff` (committee role `chair/secretary/verifier/technical/member`, observer read-only).

## Audit & Sesi
* `/admin/audit-log` filter kategori/severity + `/admin/audit-export` JSON (append-only, DELETE diblokir).
* `/admin/sessions`: cabut sesi mencurigakan; revoke enforced ≤5 mnt via `AppBootstrap` + `refresh()`. Audit `session.revoke`.

## H-1 / Hari H / H+1
* H-1: `docs/RUNBOOK.md` §4 (snapshot + hash 2 lokasi, test 2–3 akun, tally, audit, Sentry, briefing, go/no-go).
* Hari H: `docs/SOP-Helpdesk-HariH.md` (pos verifikasi/reset/sengketa, jangan hapus suara diam-diam).
* H+1: `docs/RUNBOOK.md` §5 (verifikasi tally, export audit, snapshot 1 tahun, archive ke `archived`).
