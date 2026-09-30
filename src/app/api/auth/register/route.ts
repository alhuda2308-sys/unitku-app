// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register — Daftar akun owner baru
//
// Mode Supabase: supabase.auth.signUp — bila verifikasi email aktif di
//                dashboard Supabase, sesi null → needsEmailConfirmation=true.
// Mode lokal   : akun disimpan di owner_accounts (scrypt) + sesi langsung.
// Validasi     : format email, password minimal 6 karakter, email unik.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthMode, SESSION_COOKIE } from "@/lib/auth/config";
import { createSessionToken, hashPassword, sessionCookieOptions } from "@/lib/auth/local";
import { createSupabaseRouteClient } from "@/lib/auth/supabase-route";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
  }

  if (getAuthMode() === "supabase") {
    const response = NextResponse.json({ ok: true });
    const supabase = createSupabaseRouteClient(request, response);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error("[api/auth/register] Supabase signUp gagal:", error.message);
      const duplicate = /already|terdaftar|exists/i.test(error.message);
      return NextResponse.json(
        {
          error: duplicate
            ? "Email sudah terdaftar. Silakan masuk."
            : error.message,
        },
        { status: duplicate ? 409 : 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      needsEmailConfirmation: !data.session,
      user: data.user ? { id: data.user.id, email: data.user.email ?? email } : null,
    });
  }

  // ── Mode lokal ─────────────────────────────────────────────────────────────
  try {
    const existing = await db.ownerAccount.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan masuk." },
        { status: 409 },
      );
    }
    const account = await db.ownerAccount.create({
      data: { email, passwordHash: hashPassword(password) },
    });
    const response = NextResponse.json({
      ok: true,
      needsEmailConfirmation: false,
      user: { id: account.id, email },
    });
    response.cookies.set(
      SESSION_COOKIE,
      createSessionToken({ sub: account.id, email }),
      sessionCookieOptions,
    );
    return response;
  } catch (err) {
    console.error("[api/auth/register] DB gagal:", err);
    return NextResponse.json(
      { error: "Database tidak terjangkau — coba tombol \"Masuk sebagai Demo\"." },
      { status: 503 },
    );
  }
}
