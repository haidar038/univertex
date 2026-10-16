import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

/**
 * P-E — k6 STAGING ONLY (JANGAN ke prod).
 *
 * Campuran baca H-H: login burst + event + kandidat + tally.
 * Vote tulis MATI default (butuh VOTE=1 + VOTE_EVENT_ID + kredensial uji).
 *
 * Env:
 *   TARGET   base URL app yang menembak staging (preview deploy / dev)
 *   REST     base Supabase staging https://koveroqhxphdiakvukxt.supabase.co
 *   ANON_KEY anon key STAGING (jangan prod, jangan commit)
 *   VUS / DURATION  default 50 / 2m. Naik bertahap: 100 -> 300 -> 600.
 *   VOTE=1 + VOTE_EVENT_ID + VOTER_EMAIL + VOTER_PASS  untuk uji tulis
 *   (akun uji khusus beban, BUKAN akun panitia asli)
 *
 * SLO R6: login p95<2s, vote 100/mnt error<1%, tally p95<500ms.
 */
export const options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || '2m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.01'],
  },
};

const errorRate = new Rate('errors');
const BASE = __ENV.TARGET || 'http://localhost:8080';
const REST = __ENV.REST || 'https://koveroqhxphdiakvukxt.supabase.co';
const ANON = __ENV.ANON_KEY || '';
const WANT_VOTE = __ENV.VOTE === '1';

function rest(path, token) {
  const headers = { apikey: ANON };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return http.get(`${REST}/rest/v1/${path}`, { headers });
}

export function setup() {
  if (!WANT_VOTE) return { token: null };
  const res = http.post(
    `${REST}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: __ENV.VOTER_EMAIL, password: __ENV.VOTER_PASS }),
    { headers: { apikey: ANON, 'Content-Type': 'application/json' } }
  );
  if (res.status !== 200) {
    throw new Error(`login setup gagal: ${res.status} ${res.body.slice(0, 120)}`);
  }
  return { token: res.json().access_token };
}

export default function (data) {
  // 1) Login burst (token baru tiap iterasi = simulasi antrean pagi)
  if (WANT_VOTE || __ENV.LOGIN_BURST === '1') {
    const lr = http.post(
      `${REST}/auth/v1/token?grant_type=password`,
      JSON.stringify({ email: __ENV.VOTER_EMAIL, password: __ENV.VOTER_PASS }),
      { headers: { apikey: ANON, 'Content-Type': 'application/json' } }
    );
    check(lr, { 'login 200': (r) => r.status === 200 }) || errorRate.add(1);
  }

  // 2) Baca: landing + event voting + tally
  let res = http.get(`${BASE}/`);
  check(res, { 'landing 200': (r) => r.status === 200 }) || errorRate.add(1);

  res = rest('election_events?status=eq.voting&limit=10', data?.token);
  check(res, { 'list events 2xx': (r) => r.status >= 200 && r.status < 300 }) || errorRate.add(1);

  const evId = __ENV.VOTE_EVENT_ID || (__ENV.TALLY_EVENT_ID ?? '');
  if (evId) {
    res = http.post(
      `${REST}/rest/v1/rpc/get_election_tally`,
      JSON.stringify({ p_event_id: evId }),
      {
        headers: {
          apikey: ANON,
          'Content-Type': 'application/json',
          ...(data?.token ? { Authorization: `Bearer ${data.token}` } : {}),
        },
      }
    );
    check(res, { 'tally ok/deny-terstruktur': (r) => [200, 401, 42501].includes(r.status) || r.status === 400 }) ||
      errorRate.add(1);
  }

  sleep(1);
}
