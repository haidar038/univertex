// Edge Function: login paralel memakai NIM sebagai password.
//
// POST { identifier, password } — identifier boleh email atau NIM.
// Tidak butuh JWT (dipanggil sebelum session ada); deploy dengan
// `supabase functions deploy nim-login --no-verify-jwt`.
//
// Supabase Auth hanya punya SATU password. Password yang tersimpan adalah PIN
// dari blast dan TIDAK dirotasi. Jalur ini memverifikasi NIM secara terpisah,
// lalu mengeluarkan token_hash magiclink via Auth Admin API. generateLink
// TIDAK mengirim email — jadi tidak bergantung pada Resend/Gmail yang delayed.
// Client menyelesaikan session dengan supabase.auth.verifyOtp(token_hash).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (bawaan), APP_URL (redirect).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

type Body = {
  identifier?: string;
  password?: string;
};

type Resolved = {
  id: string;
  email: string;
  student_id: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

// Pesan seragam: jangan membocorkan apakah email/NIM terdaftar.
const INVALID = "Email atau kombinasi password yang dimasukkan salah.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  if (!supabaseUrl || !serviceKey || !appUrl) {
    return json({ error: "SUPABASE_URL / SERVICE_ROLE / APP_URL belum diset" }, 500);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON tidak valid" }, 400);
  }

  const identifier = (body.identifier ?? "").trim();
  const password = body.password ?? "";
  if (!identifier || !password) {
    return json({ error: "Identifier dan password wajib diisi" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const audit = async (
    action: string,
    resolved: Resolved | null,
    description: string,
    severity: string,
  ) => {
    await admin.from("audit_log").insert({
      actor_id: resolved?.id ?? null,
      actor_email: resolved?.email ?? null,
      actor_role: resolved ? "voter" : null,
      action,
      category: "auth",
      target_type: "auth.users",
      target_id: resolved?.id ?? null,
      description,
      metadata: { method: "nim_password" },
      severity,
    });
  };

  // 1) Resolve email/NIM → identitas via RPC service-role.
  const { data: matches } = await admin.rpc("resolve_nim_login", {
    p_identifier: identifier,
  });
  const resolved: Resolved | null =
    Array.isArray(matches) && matches.length > 0
      ? (matches[0] as Resolved)
      : null;

  // Akun banned tidak boleh dapat sesi lewat jalur ini.
  const authUser = resolved
    ? (await admin.auth.admin.getUserById(resolved.id)).data?.user
    : null;
  const bannedUntil = (authUser as unknown as { banned_until?: string | null } | null)
    ?.banned_until ?? null;
  const isBanned = !!bannedUntil && Date.parse(String(bannedUntil)) > Date.now();
  const studentId = (resolved?.student_id ?? "").trim().toLowerCase();
  const valid =
    !!resolved &&
    !!resolved.email &&
    !isBanned &&
    studentId.length > 0 &&
    studentId === password.trim().toLowerCase();

  if (!resolved || !valid) {
    await audit(
      "auth.login_nim_failed",
      resolved,
      "Login NIM gagal",
      "warning",
    ).catch(() => undefined);
    return json({ error: INVALID }, 401);
  }

  // 2) Token magiclink tanpa email. verifyOtp di client membuat session.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: resolved.email,
    options: { redirectTo: appUrl },
  });
  // GoTrue Admin API mengembalikan field `hashed_token` (bukan `token_hash`)
  // di properties. supabase-js verifyOtp menerimanya sebagai `token_hash`.
  const properties = link?.properties as unknown as
    | { hashed_token?: string; token_hash?: string }
    | undefined;
  const tokenHash = properties?.hashed_token ?? properties?.token_hash;
  if (linkErr || !tokenHash) {
    console.log(
      "[nim-login] generate_link_failed",
      linkErr?.message ?? "hashed_token kosong",
    );
    return json({ error: "Gagal membuat sesi. Coba lagi." }, 500);
  }

  await audit(
    "auth.login_nim",
    resolved,
    "Login memakai NIM sebagai password",
    "info",
  ).catch(() => undefined);

  return json({ token_hash: tokenHash });
});
