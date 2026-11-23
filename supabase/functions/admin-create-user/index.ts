// Edge Function: buat user admin + kirim email konfirmasi via Resend.
//
// POST { email, password, full_name, student_id, class_id?, department?,
//        email_confirm?: boolean }
// Authorization: Bearer <admin JWT>
// Env: RESEND_API_KEY, RESEND_FROM, APP_URL (+ Supabase bawaan).
//
// Alasan tidak pakai RPC admin_create_user lagi: RPC insert langsung ke
// auth.users dengan confirmation_token='' → tidak ada token, tidak ada email.
// Di sini GoTrue yang buat user (email_confirm:false) lalu generateLink
// menghasilkan action_link yang dikirim lewat Resend (domain terverifikasi).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const RESEND_URL = "https://api.resend.com/emails";

type Body = {
  email?: string;
  password?: string;
  full_name?: string;
  student_id?: string;
  class_id?: string | null;
  department?: string | null;
  email_confirm?: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

function buildConfirmationMail(link: string, name: string, appUrl: string) {
  const subject = "Konfirmasi email akun UniVertex";
  const text =
    `Halo ${name},\n\n` +
    `Akun UniVertex Anda sudah dibuat oleh admin.\n` +
    `Silakan konfirmasi email dengan membuka tautan ini:\n${link}\n\n` +
    `Setelah konfirmasi, login di ${appUrl}/login memakai email dan password yang diberikan admin.\n` +
    `Bila tautan tidak berfungsi, salin alamat di atas ke browser.\n\n` +
    `Bantuan: hubungi helpdesk panitia.`;
  const html =
    `<p>Halo ${name},</p>` +
    `<p>Akun UniVertex Anda sudah dibuat oleh admin.</p>` +
    `<p><a href="${link}">Konfirmasi email akun Anda</a></p>` +
    `<p>Atau salin tautan ini ke browser:<br>${link}</p>` +
    `<p>Setelah konfirmasi, login di <a href="${appUrl}/login">${appUrl}/login</a> ` +
    `memakai email dan password yang diberikan admin.</p>`;
  return { subject, text, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const resendFrom = Deno.env.get("RESEND_FROM") ?? "";
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  if (!resendKey || !resendFrom || !appUrl) {
    return json({ error: "RESEND_API_KEY / RESEND_FROM / APP_URL belum diset" }, 500);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON tidak valid" }, 400);
  }

  // 1) Pemanggil harus admin dengan permission user.create.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return json({ error: "Sesi habis — logout lalu login ulang.", code: "no_token" }, 401);
  }
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: userErr } = await caller.auth.getUser(jwt);
  if (userErr || !user) {
    return json({ error: "Token tidak valid/kedaluwarsa.", code: "bad_token" }, 401);
  }
  const { data: allowed, error: permErr } = await caller.rpc("caller_has_permission", {
    p_permission: "user.create",
  });
  if (permErr || allowed !== true) {
    return json({ error: "Tidak memiliki izin user.create.", code: "not_allowed" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const email = (body.email ?? "").trim().toLowerCase();
  const fullName = (body.full_name ?? "").trim();
  const password = body.password ?? "";
  const studentId = (body.student_id ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return json({ error: "Format email tidak valid" }, 400);
  }
  if (password.length < 8) {
    return json({ error: "Password minimal 8 karakter" }, 400);
  }
  if (fullName.length < 2) {
    return json({ error: "Nama minimal 2 karakter" }, 400);
  }
  if (!studentId) {
    return json({ error: "NIM harus diisi" }, 400);
  }
  const { data: dup } = await admin
    .from("profiles")
    .select("id")
    .eq("student_id", studentId)
    .limit(1);
  if (dup && dup.length > 0) {
    return json({ error: "NIM sudah digunakan", code: "duplicate_nim" }, 409);
  }

  const confirm = body.email_confirm !== false;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: confirm,
    user_metadata: {
      full_name: fullName,
      student_id: studentId,
      department: body.department || null,
      class_id: body.class_id || null,
    },
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Gagal membuat user";
    const code = /already registered|already exists|23505/i.test(msg) ? "duplicate_email" : "create_failed";
    return json(
      { error: code === "duplicate_email" ? "Email sudah terdaftar" : msg, code },
      code === "duplicate_email" ? 409 : 400,
    );
  }
  const userId = created.user.id;

  const { error: profileErr } = await admin.from("profiles").update({
    full_name: fullName,
    student_id: studentId,
    department: body.department || null,
    class_id: body.class_id || null,
  }).eq("id", userId);
  if (profileErr) {
    console.log("[create-user] profile_update_failed", profileErr.message);
  }

  if (confirm) {
    return json({ user_id: userId, confirmed: true, email_sent: false });
  }

  // 2) Buat action_link konfirmasi lalu kirim via Resend.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${appUrl}/login` },
  });
  const actionLink = linkData?.properties?.action_link;
  if (linkErr || !actionLink) {
    return json(
      { user_id: userId, confirmed: false, email_sent: false, email_error: linkErr?.message ?? "generateLink gagal" },
      200,
    );
  }
  const { subject, text, html } = buildConfirmationMail(actionLink, fullName, appUrl);
  const rs = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [email],
      subject,
      text,
      html,
      tags: [
        { name: "purpose", value: "email_confirmation" },
        { name: "user_id", value: userId },
      ],
    }),
  });
  if (!rs.ok) {
    const detail = (await rs.text().catch(() => "")).slice(0, 200);
    return json(
      { user_id: userId, confirmed: false, email_sent: false, email_error: `Resend ${rs.status}: ${detail}` },
      200,
    );
  }
  const sent = await rs.json().catch(() => ({})) as { id?: string };
  return json({ user_id: userId, confirmed: false, email_sent: true, message_id: sent.id ?? null });
});
