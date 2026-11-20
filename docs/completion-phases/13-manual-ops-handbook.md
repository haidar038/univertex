# 13 — Buku Manual Operasional (blokir → backlog)

> Satu-satunya dokumen yang perlu kamu buka untuk kerja manual berkala.
> Kerjakan berurutan B1 → B2 → Y1 → Y2 → Y3, lalu G1 saat H-7.
> Setiap item: lakukan → kirim result ke agen → tunggu verifikasi hijau → lanjut.
> Format laporan: `item: <kode> | hasil: <ok/gagal> | bukti: <screenshot/log/angka>`.

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

1. **Vote single:** event open/voting (`d8b974a5`) → login 1 voter DPT → vote → toast sukses → vote lagi → ditolak "sudah vote". Catat jam.
2. **Vote paslon:** bila ada event `use_pairs`, ulangi langkah 1 di sana. Bila belum ada, lewati + tulis "paslon: belum ada event".
3. **Closed tidak bocor:** event closed/voting (`3c0c4606`) → login voter → vote → harus mendarat di **dashboard** (bukan `/app/results`) → buka `/app/results/<id>` manual → harus tampil **"Hasil Disembunyikan" + "Pilihanmu: X"**, tanpa angka/persen/pemenang. Coba panggil tally via console (harus 42501) — opsional.
4. **Hapus arsip:** arsipkan 1 event uji kecil (status → archived via tombol Status) → Hapus → ketik nama persis → event hilang; cek audit `event.delete` ada (tanya agen bila perlu).
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
   k6 run -e LANDING=0 -e TALLY_EVENT_ID=87f36fe7-f251-4326-8215-1eff49058608 -e VUS=100 -e DURATION=2m tests/load/staging-mixed.js
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
