# 01 — Konteks Pilot 1600 Voter

## Apa yang mau dicapai

Satu pemilihan nyata jalan mulus untuk ~1600 voter + 10+ staff, tanpa drama H-H: login lancar, vote tercatat 1x, hasil tidak bocor duluan, audit bisa dipertanggungjawabkan.

## Batasan yang tidak bisa ditawar (catatan user #1)

* Hosting di Vercel, domain masih `univertex.vercel.app`.
* Konsekuensi: **tidak bisa pakai Resend / SMTP custom dengan domain sendiri** secara proper (butuh verifikasi domain + SPF/DKIM). Pilihan realistis untuk pilot:
  1. Tetap pakai **Supabase default email provider** (paling gampang, tapi rate-limit ketat + gampang masuk spam).
  2. Pakai **Gmail SMTP relay** yang sudah teruji (`univertexapp@gmail.com`, bukti `docs/supabase-auth-redirects.md:61-66`: delivered 4/4, inbox cuma 1/4).
* Artinya: jangan desain alur yang 100% tergantung email masuk inbox. Selalu sediakan fallback manual (admin reset password, salin link invite manual, helpdesk H-H). Detail di `11-email-smtp-vercel.md`.

## Beban yang harus diantisipasi

* 1600 voter tidak datang barengan, tapi jam pertama bisa 300-600 login/vote bersamaan. Smoke test lama (`2 VU/30s p95 132ms`) tidak mewakili ini.
* Wajib uji beban di **staging**, bukan di prod. Target minimal: 100 → 300 → 600 VU read + vote campuran, ukur p95, error rate, dan饱和 RPC `get_election_tally`.
* Realtime + tally adalah titik panas. Jangan panggil tally per-kandidat (N+1), pakai 1 RPC seperti `ResultsPage.tsx:89-92` sekarang.

## Konsep yang masih bikin bingung (catatan #2, #7, #8)

* **Visibilitas event:** open vs closed + checkbox "tampilkan hasil setelah voter memilih" saat ini bisa bocorkan siapa unggul. Untuk closed, voter hanya boleh lihat "kamu pilih siapa", statistik harus abu-abu / tanda tanya / disembunyikan. Spec perbaikan di `05-event-visibility.md`.
* **Invite vs user management vs bulk import:** tiga jalur bikin akun saat ini tumpang tindih. Panitia minta voter **baru bisa milih saat H-H**, tapi akun sudah dibuat jauh hari biar tidak ada manipulasi dadakan. Desain baru: akun dibuat awal (pre-provision), akses vote dibuka hanya saat window H-H via DPT + status `voting`. Detail di `10-invitations-and-class-import.md`.
* **Kelas:** assign satu-satu tidak masuk akal untuk 1600 orang. Maunya: admin pilih kelas → import → email konfirmasi → voter konfirm → auto-login. Spec di doc yang sama.

## Yang sudah jelas tidak kurang

* Lifecycle 6-state (`draft → registration → voting → counting → published → archived`) via RPC, bukan update status manual (`src/lib/election-state.ts`, `admin_transition_election_state`).
* 5 roles (`admin/voter/candidate/committee/observer`), 31 permission keys.
* Vote dijaga DB: `UNIQUE(voter_id,event_id)` + trigger `tg_enforce_vote_timeline` + `is_eligible_voter()` + `voter_id=auth.uid()`.
* Audit append-only, export dibatasi permission `audit.export`.
