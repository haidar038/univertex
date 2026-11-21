# Completion Phases — Source of Truth Pilot Terkendali UniVertex

> Folder ini adalah **source-of-truth utama** untuk mengejar pilot terkendali.
> Kalau ada konflik dengan docs lama (`P0-*`, `P1-*`, `RUNBOOK.md`), yang di folder ini yang menang untuk eksekusi ke depan. Docs lama jadi arsip.

## Skala pilot yang dikejar

* **~1600 voter**, **10+ staff** (admin, committee, observer).
* 1 event live nyata, bukan event uji.
* Satu merah = NO-GO (aturan tetap dari `docs/P0-Golive-Readiness-Plan.md:40`).

## Daftar dokumen

| File | Isi | Untuk catatan user |
|---|---|---|
| `01-context.md` | Konteks, batasan Vercel + SMTP, skala 1600 | #1 |
| `02-milestones.md` | Milestone M0-M5 + definisi DONE | semua |
| `03-phases.md` | Fase P-A s/d P-F, urutan kerja | semua |
| `04-tasklist.md` | Tasklist checklist per fase, bisa dicentang | semua |
| `05-event-visibility.md` | Spec visibilitas open/closed + hasil abu-abu | #2 |
| `06-candidate-pairs.md` | Status pairing + yang kurang di UI | #3 |
| `07-users-bulk-delete.md` | Spec bulk delete di `Users.tsx` | #4 |
| `08-staging-strategy.md` | Konsep staging `univertex-staging` | #5 |
| `09-migration-cleanup.md` | Clean-up + merge migrasi | #6 |
| `10-invitations-and-class-import.md` | Rework invite + import per-kelas + akses H-H | #7, #8 |
| `11-email-smtp-vercel.md` | Strategi email di domain vercel.app | #1 |
| `12-recommendations.md` | Tambahan yang perlu disetujui | — |
| `13-manual-ops-handbook.md` | **Buku kerja manual berkala (blokir → backlog) — mulai dari sini untuk kerja manusia** | semua |

## Cara pakai

1. Baca `01-context.md` → `02-milestones.md` → `03-phases.md` sekali.
2. Kerja harian cuma dari `04-tasklist.md`. Satu task = satu PR/commit kecil.
3. Setiap selesai fase, update `02-milestones.md` (tanggal + bukti) + `CHANGELOG.md`.
4. Spec detail (`05-11`) dibaca saat kerjakan fase terkait, bukan dihafal di awal.

## Aturan keras (dari AGENTS.md, diringkas)

* DDL hanya via migrasi `supabase/migrations/YYYYMMDDHHMMSS_nama.sql`, 1 file 1 tujuan.
* DILARANG ubah skema `votes` (`voter_id`, `candidate_id/pair_id`, `UNIQUE(voter_id,event_id)`, trigger `trg_enforce_vote_timeline`).
* Jangan duplikasi RPC yang sudah ada (`get_election_tally`, `is_eligible_voter`, `admin_create_user`, `redeem_invitation`, dll).
* Error handling pakai `error.code` (`23505` sudah-vote, `P0001` timeline, `42501` non-DPT), bukan string-match.
* Audit helper tidak boleh break flow utama.
* Live project: prod `oiurjnmpkguyxevdbpbu` (`ap-southeast-1`), staging `koveroqhxphdiakvukxt` (`ap-northeast-1`, nama `univertex-staging`, terpantau ACTIVE_HEALTHY 2026-10-11 via akun `etercode-univertex`).

## Status terakhir (11 Okt 2026, read-only)

* Prod live: 20 tabel, `votes 28 / profiles 58 / events 4 / audit 357` (tumbuh dari baseline Sep).
* Migrasi lokal 52 file (50 + harden + revert). Privacy RLS saat ini longgar lagi (post-revert 9 Okt).
* Pairs UI admin **sudah ada** (`EventDetail.tsx` tab Pasangan + 3 dialog), bukan nol — yang kurang adalah polish + testing skala.
