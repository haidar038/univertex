// Edge Function: blast PIN kredensial H-H per batch (resumable, idempotent).
//
// POST { event_id: string, batch?: number } + Authorization: Bearer <admin JWT>
// Env: RESEND_API_KEY, RESEND_FROM (mis. "UniVertex <noreply@domainmu>"),
//      APP_URL (mis. https://univertex.vercel.app)
// Bawaan Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//
// Per item: generate PIN 8 digit (CSPRNG) -> set password via Auth Admin API
// -> kirim via Resend -> tandai sent. PIN tidak pernah disimpan.
// Gagal kirim (bounce/error) -> attempts++ ; >=3x -> failed (diekspos ke slip fisik).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const BATCH_DEFAULT = 40;
const BATCH_MAX = 100;
const MAX_ATTEMPTS = 3;
const THROTTLE_MS = 1500;

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

// CORS: browser (localhost/preview/prod) mengirim preflight OPTIONS sebelum
// POST karena Content-Type JSON + header Authorization. Tanpa jawaban ini
// semua invoke mati 405 sebelum menyentuh logic.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const resendFrom = Deno.env.get("RESEND_FROM") ?? "";
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  if (!resendKey || !resendFrom || !appUrl) {
    return json(
      { error: "RESEND_API_KEY / RESEND_FROM / APP_URL belum diset" },
      500,
    );
  }
  // Resend menolak from di luar format email@domain / Nama <email@domain> (422).
  // Validasi di sini agar salah setting langsung jelas, bukan jadi "gagal kirim" misterius.
  const fromAddr = resendFrom.replace(/.*<(.*)>.*/, "$1").trim();
  if (!/^\S+@\S+\.\S+$/.test(fromAddr)) {
    console.log("[blast] bad_from_format");
    return json(
      { error: "RESEND_FROM tidak valid. Pakai email@domain atau Nama <email@domain>." },
      500,
    );
  }

  let body: { event_id?: string; batch?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON: { event_id, batch? }" }, 400);
  }
  const batch = Math.min(Math.max(body.batch ?? BATCH_DEFAULT, 1), BATCH_MAX);
  if (!body.event_id) {
    return json({ error: "event_id wajib" }, 400);
  }

  // 1) Pemanggil harus admin (cek via JWT-nya sendiri).
  // Pesan dibedakan agar UI bisa mengarahkan: tidak ada token (sesi habis,
  // JWT 1 jam) vs token tak valid.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) {
    console.log("[blast] auth=no_token");
    return json(
      { error: "Sesi habis atau belum login — logout lalu login ulang.", code: "no_token" },
      401,
    );
  }
  const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  // Penting: client edge tidak punya session storage, jadi JWT pemanggil
  // WAJIB diteruskan eksplisit. getUser() tanpa argumen selalu gagal di sini
  // (itulah 401 bad_token persisten kemarin) — bukan salah token user.
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

  // 2) Ambil antrean pending.
  const { data: queue, error: qErr } = await admin
    .from("email_queue")
    .select("id, email, full_name, user_id, attempts")
    .eq("event_id", body.event_id)
    .eq("status", "pending")
    .order("created_at")
    .limit(batch);
  if (qErr) return json({ error: qErr.message }, 500);

  let sent = 0;
  let failed = 0;
  const errors: Array<{ email: string; error: string }> = [];

  // 3) Kirim satu-satu dengan throttle (hormati rate-limit provider).
  for (const item of queue ?? []) {
    const pin = makePin();
    try {
      if (!item.user_id) throw new Error("user_id kosong di antrean");
      const { error: pwErr } = await admin.auth.admin.updateUserById(item.user_id, {
        password: pin,
      });
      if (pwErr) throw new Error(`set password gagal: ${pwErr.message}`);

      const { subject, text, html } = buildMail(item.email, item.full_name, pin, appUrl);
      const rs = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: resendFrom, to: [item.email], subject, text, html }),
      });
      if (!rs.ok) {
        const t = await rs.text().catch(() => "");
        throw new Error(`Resend ${rs.status}: ${t.slice(0, 200)}`);
      }
      const jr = (await rs.json().catch(() => ({}))) as { id?: string };

      await admin.from("email_queue").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_msg_id: jr.id ?? null,
        error: null,
      }).eq("id", item.id);
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      const attempts = (item.attempts ?? 0) + 1;
      await admin.from("email_queue").update({
        attempts,
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        error: msg.slice(0, 500),
      }).eq("id", item.id);
      failed++;
      errors.push({ email: item.email, error: msg.slice(0, 200) });
    }
    await sleep(THROTTLE_MS);
  }

  // 4) Audit ringkasan batch.
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "email.blast_batch",
    category: "admin",
    target_type: "election_events",
    target_id: body.event_id,
    description: `Blast kredensial: ${sent} terkirim, ${failed} gagal`,
    metadata: { event_id: body.event_id, sent, failed },
    severity: "info",
  });

  return json({ sent, failed, remaining_estimate: (queue ?? []).length - sent - failed, errors: errors.slice(0, 10) });
});
