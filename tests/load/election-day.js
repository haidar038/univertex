import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

/**
 * P1-02 — k6 PROD-DIRECT: smoke READ-ONLY saja.
 *
 * DILARANG di prod (slot staging penuh bukan alasan melanggar):
 * - stages 5m→100 / 10m→500 / 5m→0 (plan asli §4C.2)
 * - stretch 2000-user
 * - vote insert / login brute-force berulang
 *
 * Yang dijalankan: 1–5 VU, <1 menit, GET publik + list events voting.
 * SLO p95<500ms / p99<1000ms / errors<1% DICATAT sebagai NOT-PROVEN untuk
 * beban penuh — butuh env isolasi sebelum klaim lolos.
 */
export const options = {
  vus: Number(__ENV.VUS || 2),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
  },
};

const errorRate = new Rate('errors');
const BASE = __ENV.TARGET || 'http://localhost:4173';
const ANON = __ENV.ANON_KEY || '';

export default function () {
  let res = http.get(`${BASE}/`);
  check(res, { 'landing 200': (r) => r.status === 200 }) || errorRate.add(1);

  res = http.get(`${BASE}/rest/v1/election_events?status=eq.voting&limit=10`, {
    headers: { apikey: ANON },
  });
  // 401 tanpa anon key valid = ekspektasi; hanya catat, bukan fail beban.
  check(res, { 'list events responded': (r) => r.status === 200 || r.status === 401 }) ||
    errorRate.add(1);

  sleep(1);
}
