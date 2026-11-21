# Go-Live Manual Checklist — UniVertex (01-Okt-2026)

> Sumber: `CHANGELOG.md [P1 Pilot]`, `docs/P0-Golive-Readiness-Plan.md §3`, `docs/P1-Manual-Testing-Runbook.md`, `docs/RUNBOOK.md §4-§5`, `docs/supabase-auth-redirects.md`, `docs/SOP-Helpdesk-HariH.md`.
> Prod: `oiurjnmpkguyxevdbpbu` (`ap-southeast-1`). Event asli JANGAN disentuh tulis: `95676965-a5c6-4f62-88bb-37ab9a57968b` (Hukum). Event uji: `cdeca0be-1892-4f01-b446-53e21c12a521` (Poltekes).
> Satu merah → NO-GO, postpone.

## A. Otomatis — LOLOS 2026-10-01 (agen)

- [x] `npx tsc --noEmit` → 0 error
- [x] `npm run test -- --run` → 21 files / 160 tests passed (~110s)
- [x] `npm run build` → sukses 1m19s, 4846 modules
- [x] DB read-only MCP: `profiles 12 / votes 1 / audit 147 / sessions 8 (1 revoked) / candidates 3 (Hukum 1 approved, Poltekes 2 approved) / DPT 4+4`
- [x] `election_events` keduanya `counting` (Hukum `end 2026-09-30 23:00+00`, Poltekes `end 2026-09-28 12:00+00`) → cron `auto_transition_elections` jalan
- [x] `get_election_tally(Hukum)` → 1 suara/kandidat, cocok `votes=1`; Poltekes 0 (sudah cleanup)
- [x] Trigger ada: `trg_enforce_vote_timeline` (votes), `tg_audit_log_no_update` (audit), `tg_validate_election_state_transition` (events)
- [x] RPC ada: `assert_event_is_votable x2`, `is_session_revoked`, `is_eligible_voter`, `get_election_tally`
- [x] RLS ON: `votes`, `audit_log`, `election_events`
- [x] `vote.cast` metadata event-only (tanpa candidate) → anonimitas OK (3 baris terakhir dicek)

## B. Manual — SUDAH LOLOS (tinggal arsip bukti)

- [x] P0-01 T2: non-DPT ditolak `42501` (2026-09-28, Poltekes, trigger line 35 + banner DPT UI)
- [x] P0-03 H1: revoke 13:01 → logout 13:03:46 ±3 mnt ≤5 mnt + `revoked_at` + audit (2026-09-28)
- [x] P1-01 E2E 7/7 hijau 48.7s (2026-09-28) + cleanup votes=0/obs=0 saat itu
- [x] P1-02 k6 smoke read-only 2VU/30s: 50 iter, p95 132ms (2026-09-29)
- [x] UAT 10/10 HP+laptop, drawer mobile fix `inset-y-0` (2026-09-29)
- [x] ZAP pasif 9 alerts 0 High (2026-09-29). Aktif sebagian tak sengaja (fuzz WEB-INF/PHP → 200/405, no damage)
- [x] Pentest 6/6: 4 vektor agen (anon votes kosong, `admin_create_user` 404, trigger immutable, `/admin` redirect) + Uji A force-vote `42501` + Uji B brute-force >10x aman (2026-09-29)
- [x] Peraturan `Peraturan-Pemilihan-BEM-Hukum-2026.md` SAH (Chalid+Faisal, 2026-09-29)
- [x] Gladi auto-`counting` + publish manual Poltekes (2026-09-29)
- [x] H-1 teknis (2026-09-29): tally/counts/audit wajar — re-verified hari ini §A
- [!] H5 SMTP BERSYARAT: delivered 4/4 <2 mnt (Gmail/Yahoo/Outlook/Proton), inbox 1/4 (hanya Proton inbox, 3 lain spam/junk). Mitigasi: instruksi cek-spam + fallback helpdesk. Perbaikan permanen (domain+SPF/DKIM) = backlog.

## C. Manual — SISA (kerjakan manusia, urut)

### M1. Backup/PITR + drill restore (P0-02) — BELUM
1. Dashboard Supabase → Database → Backups: pastikan PITR ON, catat retensi + screenshot.
2. Install CLI: `scoop install supabase` / `winget install supabase.cli` → `supabase --version`.
3. `supabase login` + `supabase link --project-ref oiurjnmpkguyxevdbpbu` (cek ref JANGAN tertukar).
4. `node scripts/snapshot-db.mjs --project=oiurjnmpkguyxevdbpbu --tag=p1-pre` → `Get-FileHash *.sql -Algorithm SHA256` → `tar -a -c -f *.sql.tar.gz *.sql`.
5. Simpan 2 lokasi (Drive privat + lokal BitLocker/VeraCrypt), catat `tanggal+hash+lokasi1+lokasi2` di `docs/P1-Proddirect-Notes.md`.
6. Drill restore ke project isolasi (JANGAN overwrite prod): `supabase link --project-ref <isolasi>` → `supabase db reset --linked` → `psql "<uri>" < backup.sql` → catat mulai/selesai/durasi, RTO target <1 jam (tabel 1 rusak) / <4 jam (full).
7. Verifikasi pasca-restore (`RUNBOOK.md §2.4`): `counts profiles/events/votes/audit`, `status events`, login 1 admin+1 voter, 1 vote test di isolasi.
8. Lolos bila: hash tercatat + restore <1 jam + checklist §2.4 hijau.

### M2. Dashboard Auth final (P0-03-sisa) — SEBAGIAN
1. Authentication → Settings → JWT expiry = 3600 → screenshot.
2. Authentication → Rate Limits: ON (sign-in 30/5mnt, email 30/jam) → screenshot.
3. Authentication → URL Configuration: Site URL = origin prod; Redirect `https://<prod>/**` + `http://localhost:5173/**` (+ preview bila ada). Klik link reset asli → harus mendarat `[prod]/reset-password` (bukan landing).
4. MFA TOTP: enable di dashboard, tapi app belum ada UI enroll/verify (`grep mfa src/` =0) → status DEFERRED. Aturan pilot: admin/committee wajib via SOP manual, voter password-only.
5. Leaked-password: N/A Free plan → catat pengecualian.
6. CAPTCHA: DEFERRED (tanpa widget = blokir semua login bila dipaksa). Jangan enable di prod tanpa widget di `/login` + `/invite/:token`.
7. SMTP: host sudah Gmail relay (`univertexapp@gmail.com`). Uji ulang H5 bila ganti kredensial: kirim invite+reset ke Gmail/Yahoo/Outlook/kampus → catat <2 mnt + inbox/spam + screenshot link. Siapkan fallback helpdesk (`admin_update_password`, `SOP §2`).
8. Catat semua di `docs/supabase-auth-redirects.md §E` (tanggal+pelaku+bukti).

### M3. E2E prod-direct ulang (bila butuh bukti segar) — TERAKHIR 2026-09-28
> Kedua event kini `counting` → vote ditolak. Butuh event `[P1-TEST]` voting ATAU window baru. Jangan pakai event asli.
1. Ikuti `docs/P1-Manual-Testing-Runbook.md` Fase 0–5 penuh (kelas `P1 TEST Kelas`, 5 akun `p1-*@test.local`, event `[P1-TEST]`, kandidat approved, DPT, voting via state-machine, staff).
2. Snapshot pre (M1 langkah 4-5).
3. `npm run dev` + `TEST_EVENT_ID=<uuid> p1-*` env → `npm test:e2e` → ekspektasi 7/7 nol-skip.
4. Verifikasi SQL Fase 4.1 (vote=1, obs≥1, `vote.cast` event-only) + opsional regresi 42501 non-DPT.
5. Cleanup urut Fase 4.3 + residu 0 (Fase 4.4). `audit_log` dipertahankan (append-only).
6. Lolos bila: report hijau + residu 0 + hash pre/post tercatat.

### M4. Beban penuh — NOT RUN (dilarang di prod)
- Smoke `tests/load/election-day.js` (2VU) = lolos. SLO 200-VU + stretch 2000 = JANGAN di prod tanpa env isolasi. Lolos bila dijalankan di isolasi + p95 <500ms.

### M5. ZAP aktif + brute-force — DILARANG di prod
- Pasif 0 High = lolos. Aktif agresif + brute-force sungguhan hanya di isolasi hasil M1.

### M6. Helpdesk H-H — BELUM
1. Isi `SOP-Helpdesk-HariH.md §1`: PIC Pos1/2/3 + HP, IT on-call, cek `status.supabase.com` + `vercel-status.com`.
2. Cetak 2 lembar SOP + formulir keberatan §5, simpan offline.
3. Siapkan 2 ISP + 1 tethering, uji reset via `ResetPasswordDialog` + `admin_update_password` di 1 akun uji.
4. Briefing panitia (`PANDUAN_PANITIA.md`) + kontak darurat di grup WA resmi.
5. Lolos bila: personil terisi + cetakan ada + reset test 1x sukses.

### M7. H-1 (RUNBOOK §4) + H+1 (RUNBOOK §5) — BELUM
- H-1: snapshot+hash 2 lokasi, gate P0 (T2/H1/drill), test 2-3 akun, tally cocok, audit 24 jam wajar, Sentry 0 baru, briefing, kontak, decision go/no-go.
- H+1–H+7: tally final cocok, export audit JSON+CSV (`/admin/audit-export`), feedback, incident log, snapshot post (simpan 1 thn), archive event → `archived`.
- Lolos bila semua checkbox §4 + §5 dicentang + bukti di `CHANGELOG.md [P1 Pilot]`.

## D. Definisi lolos pilot

Semua §A hijau + §B arsip ada + M1+M2+M6+M7 hijau + M3 segar (bila event baru) + M4/M5 di isolasi bila diwajibkan. Satu merah → NO-GO.
