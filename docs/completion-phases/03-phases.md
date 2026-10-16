# 03 — Phases (Urutan Kerja)

Kerjakan berurutan. Jangan loncat ke beban (P-E) sebelum staging hidup (P-A).

## P-A — Staging + Backup (M1)

* Isi `univertex-staging` dari migrasi lokal, split env Vercel, snapshot prod, drill restore.
* Spec: `08-staging-strategy.md`. Task: `04-tasklist.md §P-A`.

## P-B — Aturan Hasil + Paslon (M2)

* Kunci visibilitas closed (`05-event-visibility.md`) + rapikan pairing (`06-candidate-pairs.md`).
* Sentuh UI: `CreateEventDialog.tsx`, `EditEventDialog.tsx`, `VotingPage.tsx`, `ResultsPage.tsx`, `Dashboard.tsx`, `EventDetail.tsx` (tab Pasangan).
* DB: tidak ubah skema `votes`. Kalau perlu, tambah flag/view + RPC guard untuk tally, bukan ubah constraint.

## P-C — User Massal + Invite (M3)

* Bulk delete (`07-users-bulk-delete.md`) + import per-kelas + invite rework (`10-invitations-and-class-import.md`).
* Sentuh: `src/pages/admin/Users.tsx`, `BulkImportUsersDialog.tsx`, `DeleteUserDialog.tsx` (baru: bulk), `Classes.tsx` + `BulkAssignUsersDialog.tsx`, `Invitations.tsx`, RPC `admin_create_user` / `admin_create_invitation` / `redeem_invitation` (tambah guard, bukan duplikasi).

## P-D — Email + Auth H-H (M4)

* Putuskan provider, bereskan redirect, SOP fallback (`11-email-smtp-vercel.md`).
* Tanpa custom domain = tanpa janji inbox 100%. Fokus ke delivered + fallback cepat.

## P-E — Beban + Keamanan Staging (M5 awal)

* k6 100→300→600 VU di staging, ZAP pasif, pentest 6 vektor ulang, rapikan advisor Supabase (search_path + EXECUTE berlebih).
* Dilarang keras di prod.

## P-F — Gladi + Go/No-Go (M5 akhir)

* UAT 15/15, gladi tutup-otomatis via cron, H-1 checklist, hash backup, sign-off panitia.
* Hasil: GO atau postpone tertulis, bukan lisan.
