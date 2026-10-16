# 08 — Staging Strategy (`univertex-staging`)

Kabar baik (catatan #5): project sudah dibuat, tidak perlu teori lagi.

* Prod: `UniVertex / oiurjnmpkguyxevdbpbu`, `ap-southeast-1`, ACTIVE_HEALTHY.
* Staging: `univertex-staging / koveroqhxphdiakvukxt`, `ap-northeast-1`, ACTIVE_HEALTHY (terpantau 2026-10-11 via akun `etercode-univertex`).
* Beda region tidak masalah untuk pilot (latency staging sedikit lebih tinggi, justru bagus untuk uji pesimis).

## Status push 2026-10-12 (P-A, agen)

* Staging awal kosong (0 tabel, verifikasi read-only).
* `db push --dry-run` hijau 52 file → push nyata: 37 langsung + 15 sisanya (push kedua, EXIT 0) = **52/52 applied**.
* Tambahan: `20261012000000_reseed_role_permissions.sql` (1 file, idempotent) — karena migrasi reset TEST-ONLY me-truncate `role_permissions`. Push EXIT 0 → staging `role_permissions=48` = prod.
* Paritas terverifikasi read-only: 22 relasi (20 tabel + 2 view), 7 RPC kunci ada (`is_eligible_voter`, `assert_event_is_votable` x2, `get_election_tally`, `is_session_revoked`, `admin_transition_election_state`, `auto_transition_elections`), 10 policy profiles/evg/votes identik prod, trigger `trg_enforce_vote_timeline` + `tg_audit_log_no_update` + `tg_validate_election_state_transition` ada.
* Vercel env split DONE 2026-10-12 (project `univertex`): 4 var prod (`URL`, `ANON_KEY`, `PUBLISHABLE_KEY`, `PROJECT_ID`) → target `production` saja (nilai tidak diubah); 4 var staging baru → target `preview` + `development`. `VITE_APP_ENV` tidak disentuh.
* BELUM: snapshot prod `.sql` + hash (CLI butuh Docker yang tidak ada di mesin ini; fallback `pg_dump.exe` butuh DB password dashboard — minta ke user, lihat tasklist P-A). Drill restore data menunggu file snapshot.

## Konsep (gampang)

```
Vercel production  → prod DB (oiur...)
Vercel preview     → staging DB (kover...)
Lokal dev          → staging DB (jangan tembak prod dari laptop)
Prod = suci, staging = boleh rusak
```

* Staging = cermin prod (skema sama, data boleh beda/minim). Semua uji tulis + beban + ZAP + UAT di staging.
* Prod hanya disentuh untuk: migrasi final yang sudah hijau di staging + snapshot + vote nyata H-H.

## Setup sekali (urut)

1. `supabase link --project-ref koveroqhxphdiakvukxt` → `supabase db push` (52 migrasi lokal) → catat hasil. Bila gagal di file tertentu, perbaiki lokal, JANGAN edit manual di dashboard lalu lupa catat.
2. Buat 5 akun uji di staging (admin, voter eligible, non-DPT, committee, observer) + 1 event uji + DPT kecil. Jangan copy 1600 data asli ke staging (hemat + privasi).
3. Vercel: `production env` = prod URL+anon, `preview env` = staging URL+anon. Simpan pola di `.env.example` (tanpa secret asli).
4. Jalankan 1 vote uji staging → cek `vote.cast` audit → cleanup.

## Operasi rutin

* Sebelum push ke prod: `migration list` prod vs staging, `db push --dry-run`, baru `push` prod. Cek `--project-ref` dua kali (jangan tertukar — ini kesalahan klasik).
* Snapshot prod tiap milestone: `node scripts/snapshot-db.mjs --project=oiurjnmpkguyxevdbpbu --tag=...` → hash SHA-256 → 2 lokasi (Drive privat + lokal terenkripsi).
* Drill restore: restore backup prod ke staging (bukan sebaliknya), ukur durasi + RTO, verifikasi counts + login + vote uji.

## DoD M1

* Staging migrasi hijau, env split terbukti (buka preview → data staging, bukan prod), snapshot + restore <1 jam tercatat.
