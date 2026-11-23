// Edge Function: blast PIN kredensial H-H (one-shot, resumable, idempotent).
//
// POST { event_id: string, send_all?: boolean, batch?: number } + Authorization: Bearer <admin JWT>
// Env: RESEND_API_KEY, RESEND_FROM (mis. "UniVertex <noreply@domainmu>"),
//      APP_URL (mis. https://univertex.site)
// Bawaan Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//
// Per item: PIN 8 digit (CSPRNG) -> set password via Auth Admin API -> kirim
// via Resend POST /emails/batch (100 email/request) -> tandai sent. PIN tidak
// pernah disimpan. Satu batch request = satu hit rate-limit Resend (10 req/dtk
// per team), jadi 3000 email = ~30 request, bukan 3000 request.
// Password di-update paralel (concurrency 16). Tanpa throttle 1,5 dtk lama —
// throttled itu warisan SMTP relay dan bikin 3000 email butuh ~75 menit.
// Gagal kirim -> attempts++ ; >=3x -> failed (diexspor ke slip fisik).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const CHUNK_SIZE = 100;
const PAGE_SIZE = 1000; // batas aman PostgREST default max-rows
const MAX_ITEMS = 5000;
const PASSWORD_CONCURRENCY = 16;
const MAX_ATTEMPTS = 3;
const MAX_RATE_RETRIES = 2;
const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";

type QueueRow = {
  id: string;
  email: string;
  full_name: string | null;
  user_id: string | null;
  attempts: number | null;
};

// Supabase client tanpa generated schema: boundaryUntyped, helper terima bentuk
// minimal saja agar deno check tidak menabrak generik SelectQueryError.
// deno-lint-ignore no-explicit-any
type AdminClient = any;

function makePin(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 100000000).padStart(8, "0");
}

function buildMail(to: string, name: string | null, pin: string, appUrl: string) {
  const subject = "PIN Login Pemilihan UniVertex";
  const text =
    `Halo ${name ?? "Pemilih"},\n\n` +
    `Akun pemilihan Anda sudah siap.\n` +
    `Email: ${to}\n` +
    `PIN: ${pin}\n\n` +
    `Login di ${appUrl}/login lalu ikuti panduan panitia untuk memilih.\n` +
    `Jangan bagikan PIN ini ke siapa pun. Bila email ini masuk spam, tandai "Not spam" terlebih dahulu.\n\n` +
    `Bantuan: hubungi helpdesk panitia.`;
  const html =
    `<p>Halo ${name ?? "Pemilih"},</p>` +
    `<p>Akun pemilihan Anda sudah siap.</p>` +
    `<p>Email: <b>${to}</b><br>PIN: <b style="font-size:20px;letter-spacing:4px">${pin}</b></p>` +
    `<p>Login di <a href="${appUrl}/login">${appUrl}/login</a> lalu ikuti panduan panitia untuk memilih.</p>` +
    `<p>Jangan bagikan PIN ini ke siapa pun.</p>`;
  return { subject, text, html };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Worker pool: jalankan fn dengan batas konkurensi, hasil tetap urut sesuai input.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// Ambil semua pending sebelum mutasi (offset pagination tidak boleh bergeser
// saat baris ditandai sent di tengah jalan).
async function fetchAllPending(
  admin: AdminClient,
  eventId: string,
  limit: number,
): Promise<QueueRow[]> {
  const all: QueueRow[] = [];
  let from = 0;
  while (all.length < limit) {
    const size = Math.min(PAGE_SIZE, limit - all.length);
    const { data, error } = await admin
      .from("email_queue")
      .select("id, email, full_name, user_id, attempts")
      .eq("event_id", eventId)
      .eq("status", "pending")
      .order("created_at")
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as QueueRow[];
    all.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return all;
}

type BatchResponse = {
  ok: boolean;
  status: number;
  body: { data?: Array<{ id?: string; message?: string }>; message?: string };
  text: string;
};

// Idempotency-Key dibuat sekali per chunk dan dipakai ulang saat retry 429,
// supaya retry tidak mengirim duplikat. Invocation baru = key baru = PIN baru.
async function sendResendBatch(
  payload: unknown[],
  apiKey: string,
  idempotencyKey: string,
): Promise<BatchResponse> {
  for (let attempt = 0; attempt <= MAX_RATE_RETRIES; attempt++) {
    const rs = await fetch(RESEND_BATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    if (rs.status === 429 && attempt < MAX_RATE_RETRIES) {
      const raw = Number(rs.headers.get("retry-after") ?? "1");
      await sleep(Number.isFinite(raw) && raw > 0 ? raw * 1000 : 1000);
      continue;
    }
    const text = await rs.text().catch(() => "");
    let body: BatchResponse["body"] = {};
    try {
      body = text ? (JSON.parse(text) as BatchResponse["body"]) : {};
    } catch {
      //respons bukan JSON — pesan mentah tetap dipakai di error
    }
    return { ok: rs.ok, status: rs.status, body, text };
  }
  return { ok: false, status: 429, body: { message: "rate limit" }, text: "rate limit" };
}

// CORS: browser mengirim preflight OPTIONS sebelum POST (JSON + Authorization).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const resendFrom = Deno.env.get("RESEND_FROM") ?? "";
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  if (!resendKey || !resendFrom || !appUrl) {
    return json({ error: "RESEND_API_KEY / RESEND_FROM / APP_URL belum diset" }, 500);
  }
  const fromAddr = resendFrom.replace(/.*<(.*)>.*/, "$1").trim();
  if (!/^\S+@\S+\.\S+$/.test(fromAddr)) {
    console.log("[blast] bad_from_format");
    return json(
      { error: "RESEND_FROM tidak valid. Pakai email@domain atau Nama <email@domain>." },
      500,
    );
  }

  let body: { event_id?: string; batch?: number; send_all?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON: { event_id, send_all?, batch? }" }, 400);
  }
  if (!body.event_id) return json({ error: "event_id wajib" }, 400);
  const limit = body.send_all
    ? MAX_ITEMS
    : Math.min(Math.max(body.batch ?? 40, 1), MAX_ITEMS);

  // Pemanggil harus admin. Bedakan pesan: tidak ada token vs token tak valid.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) {
    console.log("[blast] auth=no_token");
    return json(
      { error: "Sesi habis atau belum login — logout lalu login ulang.", code: "no_token" },
      401,
    );
  }
  const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  // Edge client tidak punya session storage: JWT pemanggil WAJIB diteruskan
  // eksplisit ke getUser(). Tanpa argumen selalu 401 bad_token.
  const { data: { user }, error: userErr } = await anon.auth.getUser(jwt);
  if (userErr || !user) {
    console.log("[blast] auth=bad_token");
    return json(
      { error: "Token tidak valid/kedaluwarsa — logout lalu login ulang.", code: "bad_token" },
      401,
    );
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);
  if (!roles || roles.length === 0) {
    console.log("[blast] auth=not_admin");
    return json({ error: "Akun ini bukan admin.", code: "not_admin" }, 403);
  }

  let queue: QueueRow[];
  try {
    queue = await fetchAllPending(admin, body.event_id, limit);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Gagal baca antrean" }, 500);
  }

  const stats = { sent: 0, failed: 0 };
  const errors: Array<{ email: string; error: string }> = [];

  const markFailed = async (row: QueueRow, message: string) => {
    const attempts = (row.attempts ?? 0) + 1;
    await admin.from("email_queue").update({
      attempts,
      status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
      error: message.slice(0, 500),
    }).eq("id", row.id);
    stats.failed++;
    errors.push({ email: row.email, error: message.slice(0, 200) });
  };

  for (let offset = 0; offset < queue.length; offset += CHUNK_SIZE) {
    const chunk = queue.slice(offset, offset + CHUNK_SIZE);
    const pins = chunk.map(() => makePin());

    // 1) Set password paralel. Retry sekali pada 429 dari Auth Admin API.
    const pwResults = await mapWithConcurrency(
      chunk,
      PASSWORD_CONCURRENCY,
      async (row, i) => {
        if (!row.user_id) return { ok: false as const, error: "user_id kosong di antrean" };
        for (let attempt = 0; attempt < 2; attempt++) {
          const { error } = await admin.auth.admin.updateUserById(row.user_id, {
            password: pins[i],
          });
          if (!error) return { ok: true as const };
          if (error.status === 429 && attempt === 0) {
            await sleep(500);
            continue;
          }
          return { ok: false as const, error: error.message };
        }
        return { ok: false as const, error: "password update rate limited" };
      },
    );

    const sendable: Array<{ row: QueueRow; pin: string }> = [];
    for (let i = 0; i < chunk.length; i++) {
      const pw = pwResults[i];
      if (pw.ok) sendable.push({ row: chunk[i], pin: pins[i] });
      else await markFailed(chunk[i], pw.error ?? "password update gagal");
    }
    if (sendable.length === 0) continue;

    // 2) Satu batch request untuk semua PIN unik di chunk ini.
    const payload = sendable.map(({ row, pin }) => {
      const { subject, text, html } = buildMail(row.email, row.full_name, pin, appUrl);
      return {
        from: resendFrom,
        to: [row.email],
        subject,
        text,
        html,
        tags: [
          { name: "queue_id", value: row.id },
          { name: "event_id", value: body.event_id! },
        ],
      };
    });

    const chunkIndex = offset / CHUNK_SIZE;
    const idempotencyKey =
      `blast-${body.event_id.slice(0, 8)}-${chunkIndex}-${crypto.randomUUID().slice(0, 8)}`;
    const res = await sendResendBatch(payload, resendKey, idempotencyKey);
    if (!res.ok) {
      const message = res.body?.message ?? res.text?.slice(0, 200) ?? `HTTP ${res.status}`;
      for (const item of sendable) {
        await markFailed(item.row, `Resend ${res.status}: ${message}`);
      }
      continue;
    }

    // 3) data[i] urut sesuai payload[i]. Simpan id sebagai provider_msg_id.
    const data = Array.isArray(res.body?.data) ? res.body.data : [];
    for (let i = 0; i < sendable.length; i++) {
      const entry = data[i] as { id?: string; message?: string } | undefined;
      const row = sendable[i].row;
      if (entry?.id) {
        await admin.from("email_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_msg_id: entry.id,
          error: null,
        }).eq("id", row.id);
        stats.sent++;
      } else {
        await markFailed(row, `Resend batch: ${entry?.message ?? "id tidak dikembalikan"}`);
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  await admin.from("audit_log").insert({
    actor_id: user.id,
    actor_email: user.email ?? null,
    actor_role: "admin",
    action: "email.blast_batch",
    category: "admin",
    target_type: "election_events",
    target_id: body.event_id,
    description: `Blast kredensial: ${stats.sent} terkirim, ${stats.failed} gagal, ${durationMs}ms`,
    metadata: {
      event_id: body.event_id,
      sent: stats.sent,
      failed: stats.failed,
      duration_ms: durationMs,
      send_all: body.send_all === true,
    },
    severity: "info",
  });

  return json({
    sent: stats.sent,
    failed: stats.failed,
    remaining_estimate: Math.max(0, queue.length - stats.sent - stats.failed),
    errors: errors.slice(0, 10),
    duration_ms: durationMs,
  });
});
