// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Resolusi sesi owner di sisi server (route handlers, Node runtime)
//
// Mode Supabase : verifikasi cookie @supabase/ssr → supabase.auth.getUser().
// Mode lokal    : verifikasi HMAC cookie "unitku_session".
// Seluruh route handler owner WAJIB memanggil getAuthUser() dan menolak
// dengan 401 bila null — inilah gerbang isolasi data multi-tenant.
// ─────────────────────────────────────────────────────────────────────────────

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  SESSION_COOKIE,
  SUPABASE_ANON_KEY,
  SUPABASE_COOKIE_OPTIONS,
  SUPABASE_URL,
} from "./config";
import { verifySessionToken } from "./local";

export interface AuthUser {
  id: string;
  email: string;
  /** true = sesi demo mode lokal (tanpa akun) */
  demo: boolean;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();

  if (isSupabaseConfigured()) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Persist token hasil refresh SAAT dipanggil dari route handler
        // (cookies() boleh menulis di sana — middleware melompati /api/*).
        // Dari Server Component penulisan cookie dilempar Next → ditangkap;
        // penyegaran sesi untuk halaman ditangani middleware.
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* dipanggil dari Server Component — abaikan */
          }
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? "", demo: false };
  }

  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  return { id: payload.sub, email: payload.email, demo: payload.demo === true };
}
