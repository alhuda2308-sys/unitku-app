// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Konfigurasi auth (aman diimpor dari client & server & middleware)
//
// Dua mode autentikasi:
//  - "supabase": NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
//    terisi → Supabase Auth (auth.users) via @supabase/ssr — dipakai produksi.
//  - "lokal"   : fallback pengembangan (sandbox tanpa kredensial Supabase) →
//    akun owner disimpan di tabel owner_accounts + cookie sesi HMAC sendiri.
//
// File ini TIDAK boleh mengimpor node:crypto / API Node agar tetap aman
// dipakai middleware (Edge runtime).
// ─────────────────────────────────────────────────────────────────────────────

/** Nama cookie sesi mode lokal (HttpOnly, HMAC-signed) */
export const SESSION_COOKIE = "unitku_session";

/** Masa berlaku sesi lokal: 30 hari */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** Rahasia HMAC sesi lokal — WAJIB diisi AUTH_SECRET di produksi */
export const AUTH_SECRET =
  process.env.AUTH_SECRET ?? "unitku-dev-secret-ganti-di-produksi";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type AuthMode = "supabase" | "local";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length >= 20;
}

export function getAuthMode(): AuthMode {
  return isSupabaseConfigured() ? "supabase" : "local";
}

/** User id sesi demo (mode lokal) — juga ownerId properti seed "kgp" */
export const DEMO_OWNER_ID = "demo-owner";

/** Halaman publik (tidak perlu sesi owner) — dipakai middleware */
export const PUBLIC_PAGE_PREFIXES = [
  "/login",
  "/register",
  "/portal", // portal penyewa (magic token)
  "/staff", // portal staf (token + PIN)
  "/auth/callback", // exchange kode OAuth Google (Supabase)
  "/payment", // halaman sukses setelah bayar lisensi (Mayar redirect)
];
