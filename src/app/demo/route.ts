// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — GET /demo — Masuk dashboard demo TANPA registrasi (satu klik)
//
// Dipakai CTA landing "Coba Denah Kost Saya — Gratis". Mode lokal (sandbox /
// self-host tanpa Supabase Auth): membuat sesi demo (ownerId "demo-owner")
// yang melihat dataset seed realistis "Kost Griya Pratama" (denah 2 lantai,
// penghuni, tagihan, buku kas) lalu redirect ke /dashboard — data seed
// dimuat otomatis oleh ensureSeedForUser().
//
// Mode Supabase (produksi): sesi demo tanpa akun tidak tersedia → diarahkan
// ke /login?next=/dashboard agar pengunjung tetap punya jalur jelas.
//
// Sesi yang SUDAH ada (owner sungguhan maupun demo) TIDAK ditimpa — aman
// diklik oleh owner yang sedang login.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import {
  DEMO_OWNER_ID,
  getAuthMode,
  SESSION_COOKIE,
} from "@/lib/auth/config";
import {
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/local";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (getAuthMode() === "supabase") {
    // Produksi Supabase Auth: demo tanpa akun dinonaktifkan — arahkan ke login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", "/dashboard");
    return NextResponse.redirect(url);
  }

  // Sudah punya sesi valid (owner / demo) → jangan timpa cookie, langsung masuk
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (existing && verifySessionToken(existing)) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));
  }

  // Pengunjung baru → buat sesi demo & redirect ke dashboard berisi data seed
  const response = NextResponse.redirect(
    new URL("/dashboard", request.nextUrl.origin),
  );
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
