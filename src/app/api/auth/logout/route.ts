// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout — Keluar (hapus sesi Supabase / cookie lokal)
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { getAuthMode } from "@/lib/auth/config";
import { createSupabaseRouteClient } from "@/lib/auth/supabase-route";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (getAuthMode() === "supabase") {
    const response = NextResponse.json({ ok: true });
    const supabase = createSupabaseRouteClient(request, response);
    await supabase.auth.signOut();
    return response;
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
