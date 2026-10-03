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

/** Batas waktu getUser() di middleware — Supabase Auth yang lambat/hang tidak
 *  boleh menahan navigasi halaman lebih dari ini. */
const GET_USER_TIMEOUT_MS = 4_000;

/**
 * getUser() yang DIJAMIN selesai: error (network Supabase Auth down, race
 * refresh token berlomba antar request paralel) ATAU timeout → user null —
 * TIDAK pernah melempar dan TIDAK pernah menggantung.
 *
 * INI KUNCI ANTI LOOP: kegagalan sesaat getUser() TIDAK boleh memicu redirect
 * membuta — pemilik sesi sah akan dipantul-pantulkan /login ⇄ /dashboard
 * (infinite reload) karena request berikutnya justru lolos saat race selesai.
 */
async function getUserSafe(
  client: ReturnType<typeof createServerClient>,
): Promise<{ id: string } | null> {
  // catch di sini agar race tidak pernah reject (termasuk rejection belakangan)
  const getUser = client.auth.getUser().catch(() => ({ data: { user: null } }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<{ data: { user: null } }>((resolve) => {
      timer = setTimeout(() => resolve({ data: { user: null } }), GET_USER_TIMEOUT_MS);
    });
    const { data } = await Promise.race([getUser, timeout]);
    return data.user ? { id: data.user.id } : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Ada cookie auth Supabase (sb-*)? — bukti sesi (valid/basi) pernah ada.
 *  Dipakai sebagai fallback BILA getUser() gagal sesaat: JANGAN mengusir
 *  pengguna dari halaman terproteksi — cukup route handler yang menegakkan
 *  401 JSON (isolasi data tetap aman), tanpa pantulan redirect halaman. */
function hasSupabaseAuthCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
}

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
    const user = await getUserSafe(client); // null bila tak ada sesi / gagal sesaat / timeout
    const hasSbCookies = hasSupabaseAuthCookies(request);
    // Cookie demo lokal (CTA /demo). Cek cookie hanya keberadaan — verifikasi
    // HMAC + pembatasan demo dilakukan penuh di getAuthUser() (route handler),
    // pola sama dengan mode lokal.
    const hasDemoCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

    if (isPublicPage(pathname)) {
      // Pemilik sesi TERVERIFIKASI tidak perlu melihat /login|/register lagi.
      // PENTING (anti infinite reload): pantulan ini HANYA saat user benar-benar
      // terverifikasi — cookie basi/sesi kedaluwarsa TIDAK boleh dipantulkan ke
      // /dashboard (di sana API 401 → dilempar balik ke /login → loop abadi).
      if (isAuthPage && user) {
        const url = request.nextUrl.clone();
        url.pathname = AUTHED_HOME;
        url.search = "";
        return NextResponse.redirect(url);
      }
      return getResponse();
    }

    // Halaman terproteksi — susur ke /login HANYA bila jelas tak ada keterangan
    // sesi sama sekali. Bila cookie sb-* ada tetapi getUser() gagal sesaat
    // (network auth / race refresh token), BIARKAN LEWAT: halaman dashboard
    // menangani dengan anggun (fallback offline), route handler menegakkan 401
    // JSON bila sesi memang batal — TANPA pantulan redirect halaman.
    if (!user && !hasSbCookies && !hasDemoCookie) return redirectToLogin(request);
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
