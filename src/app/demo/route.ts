// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — GET /demo — Masuk dashboard demo TANPA registrasi (satu klik)
//
// Dipakai CTA landing "Coba Denah Kost Saya — Gratis". Membuat sesi demo
// (ownerId "demo-owner") yang melihat dataset seed realistis "Kost Griya
// Pratama" (denah, penghuni, tagihan, buku kas) lalu redirect ke /dashboard —
// data seed dimuat otomatis oleh ensureSeedForUser().
//
// Bekerja di SEMUA mode auth:
//  - Mode lokal (sandbox/self-host): cookie HMAC "unitku_session" — alur asli.
//  - Mode Supabase (produksi): cookie demo lokal yang sama; getAuthUser()
//    menghormatinya HANYA bila tidak ada sesi Supabase dan flag demo:true
//    (sub dipaksa DEMO_OWNER_ID) — pengunjung tetap masuk tanpa registrasi.
//
// Sesi Supabase yang SUDAH ada (owner sungguhan) TIDAK diganggu — owner yang
// sedang login langsung diarahkan ke dashboard miliknya, bukan mode demo.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import {
  DEMO_OWNER_ID,
  isSupabaseConfigured,
  SESSION_COOKIE,
} from "@/lib/auth/config";
import {
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/local";
import { createSupabaseAuthCollector } from "@/lib/auth/supabase-route";

export const dynamic = "force-dynamic";

/** Owner asli → dashboard biasa; sesi demo → dashboard dgn mode demo instan */
const OWNER_DASHBOARD_URL = "/dashboard";
/** ?demo=1 → dashboard memasang dataset simulasi 12 kamar secara instan
 *  (tanpa panggilan API/database) — mode demo tidak pernah menunggu Supabase */
const DEMO_DASHBOARD_URL = "/dashboard?demo=1";

export async function GET(request: NextRequest) {
  const ownerDashboard = new URL(OWNER_DASHBOARD_URL, request.nextUrl.origin);
  const demoDashboard = new URL(DEMO_DASHBOARD_URL, request.nextUrl.origin);

  // ── Mode Supabase: owner yang sudah login jangan dipaksa masuk demo ────────
  if (isSupabaseConfigured()) {
    const collector = createSupabaseAuthCollector(request);
    const { data } = await collector.client.auth.getUser();
    if (data.user) {
      const response = NextResponse.redirect(ownerDashboard);
      collector.applyCookies(response); // sertakan cookie refresh bila ada
      return response;
    }
  } else {
    // ── Mode lokal: sesi valid existing (owner/demo) jangan ditimpa ──────────
    const existing = request.cookies.get(SESSION_COOKIE)?.value;
    const payload = existing ? verifySessionToken(existing) : null;
    if (payload) {
      // Demo lama tetap diarahkan ke mode demo instan; owner asli → biasa
      return NextResponse.redirect(payload.demo ? demoDashboard : ownerDashboard);
    }
  }

  // ── Pengunjung baru → buat sesi demo & masuk dashboard berisi data seed ────
  const response = NextResponse.redirect(demoDashboard);
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
