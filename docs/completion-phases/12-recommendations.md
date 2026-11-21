# 12 — Rekomendasi Tambahan (Perlu Persetujuan)

> Di luar 8 catatan user, tapi ketemu saat validasi 11 Okt. Setujui/tolak per item sebelum masuk tasklist.

## R1 — Kunci tally di server untuk closed (SETUJU disarankan)

* Masalah: `get_election_tally` bisa dipanggil voter via DevTools untuk closed yang jalan (catatan `docs/ai-response.md:520-521`, kode `ResultsPage.tsx:89-92` tanpa guard UI). Perbaikan UI saja tidak cukup.
* Usul: 1 migrasi guard (tolak voter untuk closed pre-publish, loloskan admin/committee/observer via `has_permission`). Estimasi 0.5 hari + test. Masuk P-B bila setuju.

## R2 — Ulangi privacy hardening per-tabel kecil (SETUJU disarankan)

* Masalah: revert 9 Okt kembalikan `profiles SELECT USING(true)` + `event_voter_groups SELECT public` (live 11 Okt konfirmasi). Untuk 1600 NIM/nama, ini risiko privasi.
* Usul: 3 migrasi kecil (profiles: self+staff-event-scoped, evg: member+staff, votes-view: redacted) + uji sebagai voter/panitia/observer di staging. Estimasi 1-1.5 hari. Masuk P-C bila setuju. Jangan 1 file besar lagi.

## R3 — Rapikan advisor Supabase (SETUJU, murah)

* Temuan 11 Okt: 7 fungsi `search_path mutable` + 16 RPC anon-executable + 45 auth-executable. Bukan bocor, tapi noise + permukaan serangan.
* Usul: set `search_path=public` tetap + cabut EXECUTE berlebih (uji invite/tally/sesi tidak break). Estimasi 0.5 hari. Masuk P-E.

## R4 — Beli domain sendiri (TUNDA pasca-pilot, tapi rencanakan)

* Tanpa domain sendiri, email selamanya spam-prone + tidak bisa Resend proper + Site URL tetap vercel.app.
* Usul: backlog M5+. Bila disetujui awal, cukup beli + parkir (jangan migrasi H-7).

## R5 — Bekukan scope anti-creep (SETUJU disarankan)

* Yang SENGAJA tidak dikerjakan pilot: redesign secrecy ballots (P2), hierarchy organisasi penuh (P2), k6 2000-user di prod (dilarang), white-label multi-kampus, MFA UI penuh.
* Usul: tulis di `02-milestones.md` + tolak PR yang menyentuh `votes` schema / menambah framework tanpa persetujuan (aturan `package.json`).

## R6 — Definisi DONE 1600 (SETUJU disarankan)

* Tambah SLO pilot ke M5: login 300 bersamaan p95 <2s, vote 100/menit error <1%, tally p95 <500ms di staging, helpdesk jawab <5 menit (jam sibuk), backup + RTO <1 jam tertulis.
* Bila tidak tercapai → postpone tertulis, bukan paksa.

## Keputusan — 2026-10-11 oleh user

| ID | Setuju / Tolak / Tunda | Tanggal | Oleh |
|---|---|---|---|
| R1 | Setuju → masuk P-B | 2026-10-11 | user |
| R2 | Setuju → masuk P-C | 2026-10-11 | user |
| R3 | Setuju → masuk P-E | 2026-10-11 | user |
| R4 | Tunda (bukan tolak) → backlog M5+ | 2026-10-11 | user |
| R5 | Setuju → scope dibekukan | 2026-10-11 | user |
| R6 | Setuju → SLO masuk M5 | 2026-10-11 | user |
