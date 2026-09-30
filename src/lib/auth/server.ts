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
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Refresh token ditangani middleware — route handler cukup membaca
        setAll: () => {},
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
