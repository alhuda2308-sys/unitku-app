// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me — Info sesi aktif (publik; user=null bila belum masuk)
// Dipakai guard onboarding, kartu Akun di Pengaturan, dan tampilan login.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getAuthMode } from "@/lib/auth/config";
import { getAuthUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  return NextResponse.json({
    user: user ? { id: user.id, email: user.email } : null,
    mode: getAuthMode(),
    demo: user?.demo ?? false,
  });
}
