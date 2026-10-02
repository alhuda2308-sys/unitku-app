// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Middleware proteksi rute (SaaS multi-tenant)
//
// - Landing komersial "/" PUBLIK (KYC Mayar: fitur, harga, legalitas).
// - Halaman owner ("/dashboard", /onboarding, dst.) wajib sesi → belum masuk
//   diarahkan ke /login?next=… ; yang sudah masuk tidak melihat /login|/register.
// - Halaman publik: "/", /login, /register, /legal/*, /portal (penyewa),
//   /staff (staf), /payment (sukses bayar), /auth/callback (OAuth), aset & PWA.
// - /api/* DILEWATKAN middleware — isolasi data ditegakkan di level route
//   handler (401 JSON) karena beberapa endpoint publik bercabang token
//   (portal penyewa / verifikasi staf) yang tidak boleh terblokir di sini.
//
// Mode Supabase: sesi diverifikasi + di-refresh via @supabase/ssr.
// Mode lokal   : cukup cek keberadaan cookie sesi (verifikasi HMAC penuh
//                dilakukan route handler; file ini edge-safe tanpa node:crypto).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  PUBLIC_PAGE_PREFIXES,
  SESSION_COOKIE,
  SUPABASE_ANON_KEY,
  SUPABASE_COOKIE_OPTIONS,
  SUPABASE_URL,
} from "@/lib/auth/config";

function isPublicPage(pathname: string): boolean {
  if (pathname === "/") return true; // landing komersial publik (Mayar KYC)
  return PUBLIC_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (next && next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

/** Tujuan bila yang sudah masuk membuka /login|/register — dashboard owner */
const AUTHED_HOME = "/dashboard";

/** Klien Supabase + response terbaru (cookie refresh mungkin mengganti response)
 *  Pola resmi @supabase/ssr: setAll menulis token hasil refresh KE request
 *  (agar server component membaca token baru) DAN ke response yang DIKEMBALIKAN
 *  middleware (agar browser menyimpannya) — respons dari getResponse() HARUS
 *  objek terakhir yang dimutasi. */
function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS, // host-only + lax + secure (prod)
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  return { client, getResponse: () => response };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API ditegakkan di route handler (401 JSON, bukan redirect halaman)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isSupabaseConfigured()) {
    const { client, getResponse } = createSupabaseMiddlewareClient(request);
    const { data } = await client.auth.getUser();
    // Sesi Supabase ATAU cookie demo lokal (CTA /demo). Cek cookie hanya
    // keberadaan — verifikasi HMAC + pembatasan demo dilakukan penuh di
    // getAuthUser() (route handler), pola sama dengan mode lokal.
    const hasSession =
      Boolean(data.user) || Boolean(request.cookies.get(SESSION_COOKIE)?.value);

    if (isPublicPage(pathname)) {
      if (hasSession && isAuthPage) {
        const url = request.nextUrl.clone();
        url.pathname = AUTHED_HOME;
        url.search = "";
        return NextResponse.redirect(url);
      }
      return getResponse();
    }
    if (!hasSession) return redirectToLogin(request);
    return getResponse();
  }

  // ── Mode lokal — keberadaan cookie sesi (verifikasi penuh di handler) ────
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isPublicPage(pathname)) {
    if (hasSession && isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = AUTHED_HOME;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  if (!hasSession) return redirectToLogin(request);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Semua path kecuali aset statis, PWA & file ber-ekstensi
    "/((?!_next/static|_next/image|icons/|images/|logo.svg|robots.txt|manifest.webmanifest|sw.js|workbox-.*\\.js|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
