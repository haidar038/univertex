import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

/**
 * P-E — k6 STAGING ONLY (JANGAN ke prod).
 *
 * Campuran baca H-H: buka app + daftar event + tally (+ login burst opsional).
 *
 * PENTING — jebakan Deployment Protection Vercel (temuan run 100 VU sebelumnya):
 *   URL preview *.vercel.app anonim di-redirect ke vercel.com/login. k6 mengikuti
 *   redirect diam-diam sehingga "landing 200" PASS padahal yang diukur = halaman
 *   login Vercel (~334KB) — run jadi 343MB download, p95 10s, tidak valid.
 *   Script ini ABORT di setup bila mendeteksi itu. Pilihan:
 *     - LANDING=0 : lewati fetch halaman app (fokus REST/Auth staging = SLO asli).
 *     - BYPASS=<secret> : Protection Bypass for Automation (Dashboard Vercel →
 *       project → Settings → Deployment Protection → Protection Bypass for Automation → Generate).
 *     - TARGET=<URL non-proteksi>, mis. preview lokal `npm run preview` (http://localhost:4173).
 *
 * Env:
 *   TARGET   base URL app (default http://localhost:8080)
 *   REST     base Supabase staging (default https://koveroqhxphdiakvukxt.supabase.co)
 *   ANON_KEY anon key STAGING (jangan prod, jangan commit)
 *   LANDING  '0' = lewati fetch halaman app
 *   BYPASS   Protection Bypass for Automation (opsional)
 *   VUS / DURATION  default 50 / 2m. Naik bertahap: 100 → 300 → 600.
 *   LOGIN_BURST=1 + VOTER_EMAIL + VOTER_PASS — login berulang (simulasi antrean pagi).
 *     HATI-HATI rate-limit auth Supabase per-IP: 429 = rate limit, catat apa adanya,
 *     jangan retry paksa. Pakai akun uji beban khusus staging, bukan akun asli.
 *   TALLY_EVENT_ID / VOTE_EVENT_ID — panggil get_election_tally; hasil deny
 *     terstruktur (400/401/403) dihitung OK, bukan error. WAJIB event yang
 *     terlihat oleh anon; event terhapus/tersembunyi balas 500 P0002 dan
 *     setup akan ABORT (dulu sempat bikin false-red 3/3).
 *     Contoh staging: 87f36fe7-f251-4326-8215-1eff49058608 (status voting, anon-visible).
 *   VOTE=1 — saat ini hanya mengaktifkan login + tally-dengan-token untuk akun uji;
 *     jalur tulis vote BELUM diimplementasi di script ini (butuh fixture multi-akun).
 *
 * Catatan threshold:
 *   - `errors` = rate check yang gagal (0/1 per check). rate=95% = 95% check gagal.
 *   - Tally anon 400/401/403 = jawaban DIHARAPKAN, ditandai via responseCallback
 *     (expectedStatuses) supaya `http_req_failed` hanya menghitung kegagalan riil
 *     (TCP reset, 5xx, dsb) — tanpa ini angka tampak ~50% palsu.
 *   - Threshold `{name:...}` ada supaya summary menampilkan breakdown per-endpoint.
 *
 * SLO R6: login p95<2s, tally p95<500ms, vote 100/mnt error<1%.
 */
export const options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || '2m',
  thresholds: {
    errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    // Per-endpoint: hanya untuk visibilitas breakdown di summary.
    'http_req_duration{name:landing}': ['p(95)<2000'],
    'http_req_duration{name:events}': ['p(95)<2000'],
    'http_req_duration{name:login}': ['p(95)<2000'],
    'http_req_duration{name:tally}': ['p(95)<2000'],
  },
};

const errorRate = new Rate('errors');
const BASE = __ENV.TARGET || 'http://localhost:8080';
const REST = __ENV.REST || 'https://koveroqhxphdiakvukxt.supabase.co';
const ANON = __ENV.ANON_KEY || '';
const WANT_VOTE = __ENV.VOTE === '1';
const WANT_LANDING = __ENV.LANDING !== '0';
const BYPASS = __ENV.BYPASS || '';

function checkMark(res, name, fn) {
  const ok = check(res, { [name]: fn });
  errorRate.add(ok ? 0 : 1);
  return ok;
}

export function setup() {
  console.log(
    `config: TARGET=${BASE} REST=${REST} LANDING=${WANT_LANDING} ` +
      `LOGIN_BURST=${__ENV.LOGIN_BURST === '1'} VOTE=${WANT_VOTE} BYPASS=${BYPASS ? 'set' : '-'}`
  );

  if (WANT_LANDING && !BYPASS) {
    const probe = http.get(`${BASE}/`, { redirects: 0, tags: { name: 'setup-probe' } });
    const loc = probe.headers['Location'] || probe.headers['location'] || '';
    const isRedirect = probe.status >= 301 && probe.status <= 308;
    if ((isRedirect && /vercel\.com/.test(loc)) || probe.status === 401) {
      throw new Error(
        `TARGET tampak TERPROTEKSI (status=${probe.status}${loc ? ` -> ${loc.slice(0, 90)}` : ''}). ` +
          'Run akan mengukur halaman login Vercel, bukan app. Set BYPASS=<secret> atau LANDING=0.'
      );
    }
  }

  if ((WANT_VOTE || __ENV.LOGIN_BURST === '1') && (!__ENV.VOTER_EMAIL || !__ENV.VOTER_PASS)) {
    throw new Error('VOTE=1 / LOGIN_BURST=1 butuh VOTER_EMAIL + VOTER_PASS.');
  }

  if (!ANON) console.warn('ANON_KEY kosong — request REST ke staging akan 401.');

  // Event tally: validasi cepat supaya ID basi/tak terlihat anon gagal di awal,
  // bukan jadi false-red di tengah run (PostgREST: event tak terlihat -> 500 P0002).
  const evId = __ENV.VOTE_EVENT_ID || __ENV.TALLY_EVENT_ID || '';
  if (ANON && evId) {
    const tp = http.post(
      `${REST}/rest/v1/rpc/get_election_tally`,
      JSON.stringify({ p_event_id: evId }),
      {
        headers: { apikey: ANON, 'Content-Type': 'application/json' },
        tags: { name: 'setup-probe' },
        responseCallback: http.expectedStatuses(200, 400, 401, 403),
      }
    );
    if (tp.status === 500 && /P0002/.test(tp.body || '')) {
      throw new Error(`TALLY_EVENT_ID/VOTE_EVENT_ID tidak ditemukan atau tidak terlihat oleh anon: ${evId}`);
    }
  }

  if (!WANT_VOTE) return { token: null };
  const res = http.post(
    `${REST}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: __ENV.VOTER_EMAIL, password: __ENV.VOTER_PASS }),
    { headers: { apikey: ANON, 'Content-Type': 'application/json' }, tags: { name: 'login' } }
  );
  if (res.status !== 200) {
    throw new Error(`login setup gagal: ${res.status} ${res.body.slice(0, 120)}`);
  }
  return { token: res.json().access_token };
}

export default function (data) {
  // 1) Login burst opsional (simulasi antrean pagi).
  if (WANT_VOTE || __ENV.LOGIN_BURST === '1') {
    const lr = http.post(
      `${REST}/auth/v1/token?grant_type=password`,
      JSON.stringify({ email: __ENV.VOTER_EMAIL, password: __ENV.VOTER_PASS }),
      { headers: { apikey: ANON, 'Content-Type': 'application/json' }, tags: { name: 'login' } }
    );
    checkMark(lr, 'login 200', (r) => r.status === 200);
  }

  // 2) Halaman app (matikan via LANDING=0).
  if (WANT_LANDING) {
    const params = { tags: { name: 'landing' } };
    if (BYPASS) params.headers = { 'x-vercel-protection-bypass': BYPASS };
    const res = http.get(`${BASE}/`, params);
    checkMark(res, 'landing 200', (r) => r.status === 200);
  }

  // 3) Baca daftar event voting (staging REST).
  const headers = { apikey: ANON };
  if (data?.token) headers['Authorization'] = `Bearer ${data.token}`;
  let res = http.get(`${REST}/rest/v1/election_events?status=eq.voting&limit=10`, {
    headers,
    tags: { name: 'events' },
  });
  checkMark(res, 'list events 2xx', (r) => r.status >= 200 && r.status < 300);

  // 4) Tally (opsional).
  const evId = __ENV.VOTE_EVENT_ID || __ENV.TALLY_EVENT_ID || '';
  if (evId) {
    res = http.post(`${REST}/rest/v1/rpc/get_election_tally`, JSON.stringify({ p_event_id: evId }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
      tags: { name: 'tally' },
      responseCallback: http.expectedStatuses(200, 400, 401, 403),
    });
    checkMark(res, 'tally ok/deny-terstruktur', (r) => [200, 400, 401, 403].includes(r.status));
  }

  sleep(1);
}
