# Panduan Admin — UniVertex

## Login
1. Buka `/login`, masukkan email & password admin.
2. Setelah login Anda masuk ke `/admin/dashboard`.

## Kelola Event
- Buat event: `/admin/events` → buat baru (isi judul, jadwal, tipe).
- Ubah status hanya via alur resmi (`draft → registration → voting → counting → published → archived`).
- JANGAN ubah window event yang sedang berjalan tanpa persetujuan panitia.

## Kelola User & Kelas
- User: `/admin/users` (buat/edit via dialog; bulk import CSV bila tersedia).
- Kelas: `/admin/classes` (assign user ke kelas = DPT per event).

## Undangan & Staff
- Undangan: `/admin/invitations` (intent voter/committee/observer).
- Staff per event: `/admin/events/:id/staff`.

## Audit & Sesi
- Audit: `/admin/audit-log`; export JSON/CSV: `/admin/audit-export`.
- Sesi: `/admin/sessions` (cabut sesi mencurigakan; akun test saja saat uji).

## H-1 / Hari H
Lihat `docs/RUNBOOK.md §4` + `docs/SOP-Helpdesk-HariH.md`.
