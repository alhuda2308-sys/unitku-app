// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Resolusi sesi owner di sisi server (route handlers, Node runtime)
//
// Mode Supabase : verifikasi cookie @supabase/ssr → supabase.auth.getUser().
//                 Bila tidak ada sesi Supabase, cookie demo lokal (HMAC) tetap
//                 dihormati HANYA untuk sesi demo — CTA "Coba Denah Kost Saya
//                 — Gratis" (/demo) tetap masuk tanpa registrasi di produksi.
// Mode lokal    : verifikasi HMAC cookie "unitku_session".
// Seluruh route handler owner WAJIB memanggil getAuthUser() dan menolak
// dengan 401 bila null — inilah gerbang isolasi data multi-tenant.
//
// Keamanan fallback demo (mode Supabase): sub dipaksa DEMO_OWNER_ID dan flag
// demo:true diwajibkan — cookie lokal tidak pernah bisa meniru owner asli;
// dalam kondisi terburuk (AUTH_SECRET bocor/default) penyerang hanya melihat
// data simulasi demo, bukan data tenant mana pun.
// ─────────────────────────────────────────────────────────────────────────────

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  DEMO_OWNER_ID,
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
    // getUser() DIJAMIN tidak melempar: kegagalan sesaat (race rotasi refresh
    // token antar request paralel, network auth down) TIDAK boleh membuat
    // seluruh route handler 500 — cukup dianggap "tidak ada sesi Supabase"
    // (fallback cookie demo tetap dievaluasi; isolasi data tetap ditegakkan
    // oleh verifikasi di langkah berikutnya).
    let supabaseUser: { id: string; email?: string } | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      supabaseUser = data.user ?? null;
    } catch {
      supabaseUser = null;
    }
    if (supabaseUser) {
      return { id: supabaseUser.id, email: supabaseUser.email ?? "", demo: false };
    }
    // Tidak ada sesi Supabase → hormati cookie demo lokal (CTA /demo):
    // HANYA sesi demo yang boleh lewat jalur ini di produksi.
    const demoToken = cookieStore.get(SESSION_COOKIE)?.value;
    const demoPayload = demoToken ? verifySessionToken(demoToken) : null;
    if (demoPayload?.demo === true) {
      return {
        id: DEMO_OWNER_ID, // dipaksa — abaikan sub dari cookie (lihat catatan keamanan)
        email: demoPayload.email || "demo@unitku.id",
        demo: true,
      };
    }
    return null;
  }

  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  return { id: payload.sub, email: payload.email, demo: payload.demo === true };
}
