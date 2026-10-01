// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Klien Supabase Auth utk route handler (cookie request ↔ response)
//
// Dua pola pemakaian:
//
// 1. createSupabaseRouteClient(request, response) — handler SELALU mengembalikan
//    objek `response` yang sama (logout, /auth/callback): setAll menulis
//    Set-Cookie langsung ke objek tersebut.
//
// 2. createSupabaseAuthCollector(request) — body response final baru diketahui
//    SETELAH panggilan auth (login/register butuh user.id utk cek onboarding):
//    cookie ditampung oleh setAll, lalu applyCookies(responseFinal) menempelkan
//    semuanya. INI mencegah bug klasik di mana Set-Cookie sesi terbuang karena
//    handler membangun NextResponse.json() BARU di akhir — akibatnya login
//    200 OK tetapi browser tidak pernah menyimpan sesi (401 + redirect loop).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_COOKIE_OPTIONS,
  SUPABASE_URL,
} from "./config";

/**
 * Klien untuk handler yang mengembalikan `response` yang sama dengan objek
 * yang diterima factory (cookie refresh/signOut otomatis ikut di response itu).
 */
export function createSupabaseRouteClient(
  request: NextRequest,
  response: NextResponse,
) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

/**
 * Klien + kolektor cookie untuk handler yang membangun response final BELAKANGAN
 * (login/register). Panggil `applyCookies(responseFinal)` tepat sebelum return.
 */
export function createSupabaseAuthCollector(request: NextRequest) {
  const collected: { name: string; value: string; options?: CookieOptions }[] =
    [];
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        collected.push(...list);
      },
    },
  });
  return {
    client,
    /** Tempel seluruh cookie (token sesi/refresh/pembersihan) ke response final */
    applyCookies: (response: NextResponse) => {
      collected.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
    },
  };
}
