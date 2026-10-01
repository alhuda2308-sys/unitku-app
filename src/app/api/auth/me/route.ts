// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me — Info sesi aktif (publik; user=null bila belum masuk)
// Dipakai guard onboarding, kartu Akun di Pengaturan, dan tampilan login.
// isSuperAdmin hanya boolean — daftar email admin TIDAK pernah dikirim ke client.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getAuthMode } from "@/lib/auth/config";
import { getAuthUser } from "@/lib/auth/server";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  return NextResponse.json({
    user: user ? { id: user.id, email: user.email } : null,
    mode: getAuthMode(),
    demo: user?.demo ?? false,
    isSuperAdmin: isSuperAdminEmail(user?.email),
  });
}
