// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/callback — Exchange kode OAuth Google (Supabase Auth) → sesi
// Dipakai redirectTo signInWithOAuth. Publik.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createSupabaseRouteClient } from "@/lib/auth/supabase-route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=oauth-tidak-aktif`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth-gagal`);
  }

  const response = NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
  const supabase = createSupabaseRouteClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession gagal:", error.message);
    return NextResponse.redirect(`${origin}/login?error=oauth-gagal`);
  }
  return response;
}
