// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout — Keluar (hapus sesi Supabase / cookie lokal)
//
// Cookie sesi lokal SELALU dihapus (termasuk di mode Supabase) agar sesi
// demo dari CTA /demo tidak "hidup lagi" setelah owner keluar.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { getAuthMode } from "@/lib/auth/config";
import { createSupabaseRouteClient } from "@/lib/auth/supabase-route";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  if (getAuthMode() === "supabase") {
    const supabase = createSupabaseRouteClient(request, response);
    await supabase.auth.signOut();
  }
  // Bersihkan cookie sesi lokal (mode lokal & sisa sesi demo mode Supabase)
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
