# UniVertex — E-Voting Universitas

> SPA `Vite 5 + React 19 + TS + shadcn-ui + Tailwind`, backend `Supabase`, deploy `Vercel`. Aturan agen: `AGENTS.md`.

## Mulai cepat

```powershell
npm i
npm run dev          # http://localhost:8080
npm run test -- --run
npx tsc --noEmit
npm run build
```

Env: salin `.env.example` → `.env` (hanya anon key, jangan commit secret). Prod: `https://oiurjnmpkguyxevdbpbu.supabase.co`.

## Alur utama

* Voter: `/login` → `/app/dashboard` → `/app/vote/:eventId` → `/app/results/:eventId`
* Admin: `/admin/dashboard|events|events/:id|users|classes|invitations|audit-log|audit-export|sessions`
* Committee `/committee`, Observer `/observer` (read-only), Invite `/invite/:token`, Publik `/results/:eventId`
* Invite-only: tidak ada signup publik. Akun via admin/undangan.

## Gate produksi

Baca `AGENTS.md` + `docs/P0-Golive-Readiness-Plan.md` + `CHANGELOG.md`. Satu gate merah → postpone pilot. Manual: `docs/P1-Manual-Testing-Runbook.md`, operasional `docs/RUNBOOK.md`.
