# Load Test — Prod-Direct (smoke read-only)

> **Slot staging penuh → TIDAK ADA load test beban di prod.**
> Plan asli (`phase4-5 §4C.2`: stages 5m→100 / 10m→500 / 5m→0,
> 200 VU SLO, stretch 2000-user) **DILARANG dijalankan ke prod**
> (risiko rate-limit, RLS overload, mengganggu voter asli).
> File ini hanya smoke kecil untuk sinyal awal.

## Cara run (butuh binary k6 — TIDAK ada di mesin ini)

```bash
# Install k6 dulu: https://k6.io/docs/get-started/installation/
k6 run tests/load/election-day.js
# Atau dengan env eksplisit:
k6 run -e TARGET=https://<app-prod> -e ANON_KEY=<anon> -e VUS=2 -e DURATION=30s tests/load/election-day.js
```

Default `TARGET=http://localhost:4173` (hasil `npm run preview` setelah
`npm run build`) — mengukur frontend statis lokal, BUKAN SLO DB prod.

## Interpretasi

- `http_req_duration p(95)<500, p(99)<1000, errors<1%` = threshold smoke saja.
- Hasil smoke **BUKAN bukti** `vote >50/sec` / `200-VU lolos SLO`.
- Klaim SLO penuh = `NOT RUN ON PROD` → backlog butuh env isolasi.
- Jangan sertakan secret (anon key) di PR/CHANGELOG — cukup ringkasan angka.
