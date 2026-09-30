// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Middleware proteksi rute (SaaS multi-tenant)
//
// - Halaman dashboard ("/", /rooms, /cash, /invoices, /maintenance, /settings,
//   /onboarding, dst.) wajib sesi owner → belum masuk diarahkan ke
//   /login?next=… ; yang sudah masuk tidak melihat /login|/register lagi.
// - Halaman publik: /login, /register, /portal (penyewa), /staff (staf),
//   /auth/callback (OAuth), aset statis & PWA.
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
  SUPABASE_URL,
} from "@/lib/auth/config";

function isPublicPage(pathname: string): boolean {
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

/** Klien Supabase + response terbaru (cookie refresh mungkin mengganti response) */
function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    const hasSession = Boolean(data.user);

    if (isPublicPage(pathname)) {
      if (hasSession && isAuthPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
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
      url.pathname = "/";
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
