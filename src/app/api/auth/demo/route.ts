// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/demo — Masuk cepat tanpa akun (KHUSUS mode lokal)
//
// Membuat sesi demo (ownerId "demo-owner") yang melihat dataset seed
// "Kost Griya Pratama". Dinonaktifkan saat Supabase Auth aktif agar
// produksi tidak pernah memakai akun demo bersama.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { DEMO_OWNER_ID, getAuthMode, SESSION_COOKIE } from "@/lib/auth/config";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth/local";

export const dynamic = "force-dynamic";

export async function POST() {
  if (getAuthMode() === "supabase") {
    return NextResponse.json(
      { error: "Mode demo hanya tersedia pada mode lokal (tanpa Supabase Auth)." },
      { status: 400 },
    );
  }
  const response = NextResponse.json({
    ok: true,
    demo: true,
    user: { id: DEMO_OWNER_ID, email: "demo@unitku.id" },
  });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken({
      sub: DEMO_OWNER_ID,
      email: "demo@unitku.id",
      demo: true,
    }),
    sessionCookieOptions,
  );
  return response;
}
