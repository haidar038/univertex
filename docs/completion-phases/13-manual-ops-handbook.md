# 13 — Buku Manual Operasional (blokir → backlog)

> Satu-satunya dokumen yang perlu kamu buka untuk kerja manual berkala.
> Kerjakan berurutan B1 → B2 → Y1 → Y2 → Y3, lalu G1 saat H-7.
> Setiap item: lakukan → kirim result ke agen → tunggu verifikasi hijau → lanjut.
> Format laporan: `item: <kode> | hasil: <ok/gagal> | bukti: <screenshot/log/angka>`.

## Fixture staging P1 (2026-11-21)

Staging `koveroqhxphdiakvukxt`. Semua akun sintetis, password khusus uji.

| Event | ID | Status | Kegunaan |
|---|---|---|---|
| `[P1-TEST] Voting Tunggal 2026` | `a1111111-1111-4111-8111-111111111111` | voting/open | E2E voter, double-vote, non-DPT, committee/observer |
| `[P1-TEST] Voting Paslon 2026` | `b2222222-2222-4222-8222-222222222222` | voting/open | uji paslon + tally live |
| `[P1-TEST] Counting Publik 2026` | `c3333333-3333-4333-8333-333333333333` | counting/open | hasil publik, k6 tally |
| `[P1-TEST] Voting Tertutup 2026` | `d4444444-4444-4444-8444-444444444444` | voting/closed | uji redaksi hasil (anon 401) |
| `[P1-TEST] Arsip 2026` | `e5555555-5555-4555-8555-555555555555` | archived | uji hapus event |

Akun (login password grant sudah diverifikasi):

| Email | Password | Role |
|---|---|---|
| `p1-admin@test.local` | `P1Test!2026adm` | admin, voter |
| `p1-voter@test.local` | `P1Test!2026vtr` | voter (DPT TI 2021) |
| `p1-voter2@test.local` | `P1Test!2026v2` | voter (DPT TI 2021) |
| `p1-nondpt@test.local` | `P1Test!2026ndp` | voter (Akuntansi 2021, non-DPT) |
| `p1-committee@test.local` | `P1Test!2026cmt` | committee + assignment 4 event |
| `p1-observer@test.local` | `P1Test!2026obs` | observer + assignment 4 event |
| `p1-candidate1..4@test.local` | `P1Test!2026c1..c4` | candidate, voter |

Reset sebelum rerun E2E (vote + observasi event A):

```sql
delete from public.election_observations
 where election_id = 'a1111111-1111-4111-8111-111111111111';
delete from public.votes
 where event_id = 'a1111111-1111-4111-8111-111111111111'
   and voter_id = '6e01e5b3-7dec-4f51-bdb4-4354a94d988d';
```

## B1. Paste fix import ke dashboard PROD [BLOKIR, ±2 menit]

Kenapa: import di prod rusak (pgcrypto + kolom audit). Staging sudah hijau.

1. Buka file lokal `supabase/migrations/20261012001000_fix_audit_insert_columns.sql`, salin **seluruh isi**.
2. Dashboard **prod** (`oiurjnmpkguyxevdbpbu`) → SQL Editor → New query → paste → Run. Harus `Success. No rows returned`.
3. Verifikasi (SQL Editor prod, read-only):
   ```sql
   SELECT pg_get_functiondef('public.admin_import_class_users(uuid,jsonb)'::regprocedure) LIKE '%extensions.crypt%' AS crypto_ok;
   ```
   Harus `true`.
4. Kirim: screenshot `Success` + hasil query (`crypto_ok: true`).

## B2. E2E klik staging M2 [BLOKIR, ±30 menit]

Kenapa: kode P-B hijau di unit, belum pernah diklik manusia di browser.

Persiapan (app menembak staging, login admin staging):

1. **Vote single:** event open/voting `a1111111` → login `p1-voter@test.local` → vote → toast sukses → vote lagi → ditolak "sudah vote". Catat jam.
2. **Vote paslon:** event `use_pairs` `b2222222` → login `p1-voter2@test.local` → pilih paslon → vote → cek tally live (event `public_live_count=true`).
3. **Closed tidak bocor:** event closed/voting `d4444444` → login voter DPT yang belum vote → vote → harus mendarat di **dashboard** (bukan `/app/results`) → buka `/app/results/<id>` manual → harus tampil **"Hasil Disembunyikan" + "Pilihanmu: X"**, tanpa angka/persen/pemenang. Cek anon tally via REST → 401.
4. **Hapus arsip:** event `e5555555` sudah `archived` → Hapus → ketik nama persis → event hilang; cek audit `event.delete` ada (tanya agen bila perlu).
5. Kirim: untuk tiap nomor — OK/GAGAL + screenshot kunci (struk abu-abu, toast sukses, dialog hapus).

## Y1. Dashboard M4 + helpdesk [±30 menit + latihan]

1. Dashboard **prod** → catat dan bandingkan dengan 28 Sep: JWT expiry `3600`, Rate Limits ON (catat angka), URL Configuration (Site URL + Redirect, klik 1 link reset → mendarat `/reset-password`), SMTP Gmail relay masih enabled.
2. Bila ada yang berubah: tulis di `docs/supabase-auth-redirects.md §E` (tanggal + siapa + apa).
3. `docs/SOP-Helpdesk-HariH.md §1`: isi nama + nomor HP 2 PIC.
4. Latih 2 orang: reset manual 1 akun dummy (<3 menit/orang) + salin-link invite 1x.
5. Kirim: "dashboard: sama/berubah: ...", PIC terisi, "latihan: 2/2 lolos".

## Y2. Seed inbox 4/4 pasca-Resend [GATE blast, ±30 menit]

1. Panel staging `/admin/email-blast` → event uji → Isi antrean (4 alamat milikmu: Gmail/Yahoo/Outlook/kampus) → Kirim.
2. Buka keempat inbox: wajib **inbox** (bukan spam), link tidak di-disable, catat menit kirim→terima.
3. Bila 1 spam → STOP, jangan blast produksi. Kirim: provider mana + screenshot folder.
4. Sukses = lanjut; gagal = perbaiki DNS/reputasi → ulangi Y2.

## Y3. Verifikasi backup lokasi 2 [±5 menit]

1. Buka Drive privat → pastikan 2 file ada: `pilot-pre-prod-2026-10-12.sql.tar.gz` (1.082.107 bytes), `pilot-pre-staging-2026-10-12.sql.tar.gz` (120.346 bytes).
2. Kirim: "lokasi2: OK + tanggal upload". Bila belum upload, upload dulu.

## G1. P-E pra-pilot (saat H-7, staging SAJA)

1. **k6 (staging saja, jangan prod):** `tests/load/staging-mixed.js`. Mode REST-only (default aman):
   ```powershell
   $env:ANON_KEY = <anon staging, tanpa kutip>
   k6 run -e LANDING=0 -e TALLY_EVENT_ID=c3333333-3333-4333-8333-333333333333 -e VUS=100 -e DURATION=2m tests/load/staging-mixed.js
   ```
   Target preview Vercel terproteksi → script abort di setup (temuan run 100 VU pertama: tanpa guard, yang terukur justru halaman login Vercel). Untuk ikut fetch halaman app: `-e BYPASS=<secret>` (Dashboard Vercel → Settings → Deployment Protection → Protection Bypass for Automation → Generate). Catat p95/max/error%.
2. **ZAP pasif** ke staging, target 0 High. Pindai agresif dilarang di mana pun.
3. **UAT 15/15** dengan panitia (HP + laptop), minta tanda tangan.
4. **R3 advisor:** minta agen merapikan (search_path + EXECUTE) — sesi sendiri.
5. **H-1:** snapshot baru + hash + RTO + helpdesk standby (RUNBOOK §4).
6. Kirim tiap hasil; satu merah = postpone tertulis.

## G2. R2 privacy (sesi sendiri, setelah pilot stabil)

Minta agen kerjakan sebagai paket terpisah (3 migrasi kecil + uji voter/panitia/observer). Jangan digabung sesi lain.

## G3. Drift histori prod (proses permanen, bukan tugas)

Setiap migrasi baru: push staging via CLI, prod via dashboard-paste/MCP-apply + catat versi. Jangan `repair reverted` buta.
