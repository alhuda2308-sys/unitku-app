// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login — Masuk owner
//
// Mode Supabase: supabase.auth.signInWithPassword (cookie sesi ditulis ke
//                response via @supabase/ssr). Mode lokal: verifikasi scrypt
//                owner_accounts + cookie HMAC unitku_session.
// Balikan       : { ok, user, needsOnboarding } — dipakai form Masuk utk
//                 mengarahkan akun baru (belum punya properti) ke /onboarding.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthMode } from "@/lib/auth/config";
import {
  createSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth/local";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { createSupabaseAuthCollector } from "@/lib/auth/supabase-route";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "Kata sandi wajib diisi." }, { status: 400 });
  }

  let userId: string;
  let needsOnboarding = false;

  if (getAuthMode() === "supabase") {
    // Kolektor cookie: response final baru bisa dibangun setelah signIn (butuh
    // user.id untuk cek onboarding) — cookie sesi ditampung lalu ditempel ke
    // response final. Tanpa ini Set-Cookie sb-…-auth-token terbuang (login 200
    // tetapi sesi tak tersimpan → /api/* 401 + middleware redirect loop).
    const { client: supabase, applyCookies } = createSupabaseAuthCollector(request);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      console.error("[api/auth/login] Supabase signInWithPassword gagal:", error?.message);
      const failed = NextResponse.json(
        { error: "Email atau password salah." },
        { status: 401 },
      );
      applyCookies(failed); // cookie pembersihan/refresh parsial tetap diteruskan
      return failed;
    }
    userId = data.user.id;
    try {
      needsOnboarding =
        (await db.property.count({ where: { ownerId: userId } })) === 0;
    } catch (err) {
      console.error("[api/auth/login] DB check properti gagal:", err);
    }
    const response = NextResponse.json({
      ok: true,
      user: { id: userId, email: data.user.email ?? email },
      needsOnboarding,
    });
    applyCookies(response); // ← kunci: Set-Cookie sesi ikut ke browser
    return response;
  }

  // ── Mode lokal (sandbox/dev tanpa kredensial Supabase) ────────────────────
  let account: { id: string; passwordHash: string } | null = null;
  try {
    account = await db.ownerAccount.findUnique({ where: { email } });
  } catch (err) {
    console.error("[api/auth/login] DB tidak terjangkau:", err);
    return NextResponse.json(
      { error: "Database tidak terjangkau — coba tombol \"Masuk sebagai Demo\"." },
      { status: 503 },
    );
  }
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
  }
  try {
    needsOnboarding = (await db.property.count({ where: { ownerId: account.id } })) === 0;
  } catch {
    /* default false — dashboard tetap bisa dimuat */
  }

  const response = NextResponse.json({
    ok: true,
    user: { id: account.id, email },
    needsOnboarding,
  });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken({ sub: account.id, email }),
    sessionCookieOptions,
  );
  return response;
}
